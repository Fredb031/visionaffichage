/**
 * SanMar Canada PromoStandards — Base SOAP client (server-side / Deno only)
 *
 * This module is the foundation that every SanMar service module (products,
 * inventory, pricing, media, orders) imports. It MUST run server-side because:
 *
 *   1. SanMar's API is IP-whitelisted — they only accept requests from
 *      static IPs you've registered with their EDI team. Browser fetches
 *      from arbitrary client IPs would be rejected even if CORS allowed it.
 *   2. The `id` (customer ID) and `password` are credentials. Never ship
 *      them in a browser bundle. That's why this lives under
 *      `supabase/functions/_shared/sanmar/` and uses bare `Deno.env.get()`
 *      — NOT VITE_-prefixed env vars.
 *
 * Step 1 of the integration only builds this shared library. The actual
 * HTTP edge functions that import it (one per resource) come in Step 3+.
 */

import { XMLParser } from 'https://esm.sh/fast-xml-parser@4.5.0';

// ── Configuration ──────────────────────────────────────────────────────────

/**
 * SanMar Canada PromoStandards base URLs.
 * UAT (test) is the default until an operator flips SANMAR_ENV=PROD after
 * SanMar confirms the production credentials and IP allowlist (PDF Step 5
 * "Establishing Web Services Access process").
 */
const BASE_URLS = {
  UAT: 'https://edi.atc-apparel.com/uat-ws/promostandards/',
  PROD: 'https://edi.atc-apparel.com/pstd/',
} as const;

/** 30 second hard ceiling. SanMar's p99 is ~3s; anything past 30s is hung. */
const SOAP_TIMEOUT_MS = 30_000;

/** Read a SanMar env var. Defined as a function (not a constant) so the
 * value is re-read on every call — Deno edge functions reuse module
 * instances across requests but env can change between deploys. */
function env(key: string): string {
  return Deno.env.get(key) ?? '';
}

/** Returns `{ id, password, mediaPassword, baseUrl }`. Throws if the
 * mandatory ID/password pair is unset so misconfigured deploys fail
 * loudly rather than calling SanMar with empty credentials. */
export function getSanmarConfig(): {
  id: string;
  password: string;
  mediaPassword: string;
  baseUrl: string;
  envName: 'UAT' | 'PROD';
} {
  const id = env('SANMAR_CUSTOMER_ID');
  const password = env('SANMAR_PASSWORD');
  const mediaPassword = env('SANMAR_MEDIA_PASSWORD') || password;
  const envName = (env('SANMAR_ENV') || 'UAT').toUpperCase() as 'UAT' | 'PROD';
  if (!id || !password) {
    throw new SanmarApiError(
      'configuration',
      'SANMAR_CUSTOMER_ID and SANMAR_PASSWORD must be set',
      'Error',
    );
  }
  const baseUrl = BASE_URLS[envName] ?? BASE_URLS.UAT;
  return { id, password, mediaPassword, baseUrl, envName };
}

// ── Errors ─────────────────────────────────────────────────────────────────

/** Codes that PromoStandards always treats as Errors (not Information).
 * Per the PDF Appendix A — auth failures, missing required fields, and
 * service-specific validation errors all live in this set. */
const ERROR_CODES = new Set([
  100, 104, 105, 110, 115, 120, 125, 130, 135, 140, 145, 150,
  300, 301, 302,
  600, 610, 620, 630,
  999,
]);

/** Typed error thrown by `soapCall` whenever SanMar returns a fault, a
 * ServiceMessage with severity='Error', or a code in ERROR_CODES. Carries
 * `code` so callers can branch on shape (e.g. retry on 600 transient
 * errors, surface 100 auth errors as configuration problems). */
export class SanmarApiError extends Error {
  public readonly code: string | number;
  public readonly severity: string;
  public readonly raw?: unknown;
  constructor(
    code: string | number,
    description: string,
    severity: string = 'Error',
    raw?: unknown,
  ) {
    super(`[SanMar ${code}] ${description}`);
    this.name = 'SanmarApiError';
    this.code = code;
    this.severity = severity;
    this.raw = raw;
  }
}

// ── XML helpers ────────────────────────────────────────────────────────────

/** Escape user-provided strings before embedding them inside SOAP envelope
 * XML. Catches the five XML-significant characters; anything else is
 * passed through. Use this on EVERY caller-provided value, especially
 * order submission fields that contain free-form addresses / company
 * names — failing to escape `&` in "Smith & Sons" would invalidate the
 * envelope and SanMar would reject with code 100. */
export function xmlEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[<>&"']/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c] ?? c),
  );
}

/** ISO 8601 date-time string suitable for PromoStandards `xs:dateTime`
 * fields. Always emits UTC ("Z" suffix). */
export function formatIsoDate(date: Date | string | undefined | null): string {
  if (!date) return new Date().toISOString();
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString();
}

// ── SOAP envelope wrapper + parser config ──────────────────────────────────

/** Wraps an inner body fragment in a SOAP 1.1 envelope. The inner fragment
 * must already include the request element (e.g. `<GetProductRequest>`)
 * and its namespace declaration. */
function wrapEnvelope(innerBody: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Envelope xmlns="http://schemas.xmlsoap.org/soap/envelope/"><Body>${innerBody}</Body></Envelope>`;
}

/** Shared parser instance. `removeNSPrefix: true` strips the `ns2:` /
 * `ns0:` prefixes so callers can read response fields without caring
 * which namespace alias SanMar's gateway happened to emit on a given
 * day (it varies). `parseTagValue: false` keeps numeric-looking strings
 * as strings — SanMar partIds like "00012345" must not be coerced to 12345. */
const xmlParser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
});

/** Recursively walk a parsed SOAP body looking for `ServiceMessage` nodes.
 * They can appear inline (single object) or as an array; can be nested
 * inside a `serviceMessageArray` wrapper or sit at the top level. We
 * collect them all and return a flat array. */
function collectServiceMessages(node: unknown): Array<{
  code?: string | number;
  description?: string;
  severity?: string;
}> {
  const out: Array<{ code?: string | number; description?: string; severity?: string }> = [];
  function visit(n: unknown): void {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) {
      for (const item of n) visit(item);
      return;
    }
    const obj = n as Record<string, unknown>;
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'ServiceMessage' || key === 'serviceMessage') {
        if (Array.isArray(value)) {
          for (const v of value) {
            if (v && typeof v === 'object') {
              const m = v as Record<string, unknown>;
              out.push({
                code: m.code as string | number,
                description: m.description as string,
                severity: m.severity as string,
              });
            }
          }
        } else if (value && typeof value === 'object') {
          const m = value as Record<string, unknown>;
          out.push({
            code: m.code as string | number,
            description: m.description as string,
            severity: m.severity as string,
          });
        }
      } else if (value && typeof value === 'object') {
        visit(value);
      }
    }
  }
  visit(node);
  return out;
}

/** Look for a SOAP Fault. PromoStandards services occasionally surface
 * authorization failures as raw `<Fault>` instead of a ServiceMessage. */
function findSoapFault(parsed: Record<string, unknown>): { code: string; description: string } | null {
  const envelope = (parsed.Envelope ?? parsed) as Record<string, unknown>;
  const body = (envelope.Body ?? envelope) as Record<string, unknown>;
  const fault = body.Fault as Record<string, unknown> | undefined;
  if (!fault) return null;
  const code =
    (fault.faultcode as string) ??
    ((fault.Code as Record<string, unknown>)?.Value as string) ??
    'soap-fault';
  const description =
    (fault.faultstring as string) ??
    ((fault.Reason as Record<string, unknown>)?.Text as string) ??
    'SOAP Fault';
  return { code: String(code), description: String(description) };
}

// ── Public soapCall helper ─────────────────────────────────────────────────

export interface SoapCallOptions<T> {
  /** Service path appended to the base URL — e.g. `productdata2.0/ProductDataServiceV2.php`. */
  endpoint: string;
  /** SOAPAction header. Most PromoStandards services accept `""`. */
  soapAction?: string;
  /** Inner XML body (already includes the request element + namespace). */
  body: string;
  /** Project the parsed JSON into the caller's preferred shape. Receives
   * the full parsed envelope — caller knows which response wrapper to
   * read. Throwing inside `parseResult` propagates as-is. */
  parseResult: (parsed: Record<string, unknown>) => T;
  /** Override the default 30s timeout. */
  timeoutMs?: number;
}

/**
 * Execute a SOAP 1.1 POST against SanMar PromoStandards.
 *
 *   - Wraps `body` in `<Envelope><Body>...</Body></Envelope>`.
 *   - Sends with `Content-Type: text/xml; charset=utf-8` and `SOAPAction: ""`.
 *   - Aborts after `timeoutMs` (default 30s).
 *   - Parses response with fast-xml-parser, namespace-prefix-stripped.
 *   - Detects ServiceMessage / Fault errors and throws `SanmarApiError`.
 *   - Returns `parseResult(parsed)` — caller projects to their shape.
 */
export async function soapCall<T>(opts: SoapCallOptions<T>): Promise<T> {
  const { baseUrl } = getSanmarConfig();
  const url = baseUrl + opts.endpoint;
  const envelope = wrapEnvelope(opts.body);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? SOAP_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': opts.soapAction ?? '""',
      },
      body: envelope,
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeout);
    const msg = (e as Error).name === 'AbortError'
      ? `SanMar request timed out after ${opts.timeoutMs ?? SOAP_TIMEOUT_MS}ms`
      : `SanMar request failed: ${(e as Error).message}`;
    throw new SanmarApiError('network', msg, 'Error', e);
  }
  clearTimeout(timeout);

  const text = await res.text();
  // Even on HTTP 500 the body usually contains a SOAP Fault we want to
  // surface. We parse first, then check status.
  let parsed: Record<string, unknown>;
  try {
    parsed = xmlParser.parse(text) as Record<string, unknown>;
  } catch (e) {
    throw new SanmarApiError(
      'parse',
      `Failed to parse SanMar response (HTTP ${res.status}): ${(e as Error).message}`,
      'Error',
      text.slice(0, 500),
    );
  }

  const fault = findSoapFault(parsed);
  if (fault) {
    throw new SanmarApiError(fault.code, fault.description, 'Error', parsed);
  }

  const messages = collectServiceMessages(parsed);
  for (const m of messages) {
    const codeNum = typeof m.code === 'string' ? parseInt(m.code, 10) : m.code;
    const isErrorCode = typeof codeNum === 'number' && !Number.isNaN(codeNum) && ERROR_CODES.has(codeNum);
    const isErrorSev = (m.severity ?? '').toLowerCase() === 'error';
    if (isErrorCode || isErrorSev) {
      throw new SanmarApiError(
        m.code ?? 'unknown',
        m.description ?? 'Unknown SanMar service error',
        m.severity ?? 'Error',
        parsed,
      );
    }
  }

  if (!res.ok) {
    throw new SanmarApiError(
      `http-${res.status}`,
      `SanMar returned HTTP ${res.status} with no SOAP Fault`,
      'Error',
      text.slice(0, 500),
    );
  }

  return opts.parseResult(parsed);
}

// ── Internal helpers re-exported for service modules ───────────────────────

/** Strip the SOAP envelope and Body wrapper from a parsed response. Each
 * service module knows the inner response element name and digs into it. */
export function unwrapBody(parsed: Record<string, unknown>): Record<string, unknown> {
  const env = (parsed.Envelope ?? parsed) as Record<string, unknown>;
  const body = (env.Body ?? env) as Record<string, unknown>;
  return body;
}

/** Coerce a value that fast-xml-parser may return as `string | string[] |
 * undefined` into an array. Useful for fields like `<part>` that repeat
 * 1..N times — when N=1 the parser hands you the bare object instead of a
 * one-element array. */
export function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}
