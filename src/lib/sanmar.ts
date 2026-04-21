/**
 * sanmar.ts — Client for the SanMar Canada PromoStandards API
 *
 * The browser cannot call SanMar directly (CORS + secret credentials), so all
 * traffic flows through the Supabase Edge Function `sanmar-product`. Set up:
 *
 *   1. supabase login
 *   2. supabase functions deploy sanmar-product
 *   3. supabase secrets set \
 *        SANMAR_CUSTOMER_ID=xxx \
 *        SANMAR_PASSWORD=you@email.com \
 *        SANMAR_MEDIA_PASSWORD=xxx
 *
 * Until the function is deployed, every call returns null and logs a warning —
 * the rest of the site keeps working with the local product data.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

const EDGE_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/sanmar-product` : null;

/** One row of live SanMar inventory for a single part (color + size SKU),
 * aggregated across all warehouse locations. */
export interface SanmarInventoryPart {
  partId: string | null;
  partColor: string | null;
  labelSize: string | null;
  totalQty: number;
  locations: Array<{ id: string | null; name: string | null; qty: number }>;
}

/** Product metadata returned by SanMar PromoStandards for a single style. */
export interface SanmarProduct {
  productName: string | null;
  description: string | null;
  productBrand: string | null;
  category: string | null;
  colors: string[];
  sizes: string[];
  parts: Array<{ partId: string | null; color: string | null; size: string | null }>;
}

/** Media bundle (image URLs + descriptor) for a SanMar style. */
export interface SanmarMedia {
  urls: string[];
  description: string;
}

/** One row of tier pricing for a SanMar part at a given minimum quantity. */
export interface SanmarPricingRow {
  partId: string | null;
  minQty: number;
  price: number;
}

type Action = 'product' | 'inventory' | 'media' | 'pricing';

// Hard timeout so a hung SanMar edge function doesn't leave the
// React Query inflight state stuck forever. 8s is well above the
// p99 ~1.5s inventory round-trip.
const SANMAR_TIMEOUT_MS = 8_000;

/** Named error class for SanMar edge-function HTTP failures. Carries
 * `status`, optional `code`, and raw `body` so callers can branch on
 * error shape instead of sniffing message strings. Extends Error so
 * existing `catch (e)` / `instanceof Error` paths continue to work.
 *
 * Note: the internal `call` helper currently swallows errors and returns
 * `null` by design (graceful degradation before the edge function is
 * deployed). This class is exported for consumers that want to throw /
 * branch on structured errors in their own wrappers. */
export class SanmarError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly body?: unknown;
  constructor(
    message: string,
    opts: { status: number; code?: string; body?: unknown } = { status: 0 },
  ) {
    super(message);
    this.name = 'SanmarError';
    this.status = opts.status;
    this.code = opts.code;
    this.body = opts.body;
    // Preserve stack on V8
    if (typeof (Error as unknown as { captureStackTrace?: unknown }).captureStackTrace === 'function') {
      (Error as unknown as { captureStackTrace: (t: object, c: unknown) => void })
        .captureStackTrace(this, SanmarError);
    }
  }
}

/** Options forwarded to the internal SanMar edge call. `signal` is
 * composed with the internal timeout controller — aborting it cancels
 * the fetch; the timeout still fires independently after
 * SANMAR_TIMEOUT_MS. */
export interface SanmarRequestOptions {
  signal?: AbortSignal;
}

async function call<T>(
  action: Action,
  productId: string,
  partId?: string,
  lang: 'en' | 'fr' = 'en',
  options: SanmarRequestOptions = {},
): Promise<T | null> {
  if (!EDGE_URL || !SUPABASE_KEY) {
    console.warn('[sanmar] Supabase not configured — skipping', action);
    return null;
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SANMAR_TIMEOUT_MS);
  // Forward an external AbortSignal (e.g. from React effect cleanup) so
  // callers can cancel on unmount without racing the timeout.
  const external = options.signal;
  const onExternalAbort = () => controller.abort();
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener('abort', onExternalAbort, { once: true });
  }
  const cleanup = () => {
    clearTimeout(timeoutId);
    if (external) external.removeEventListener('abort', onExternalAbort);
  };
  try {
    const res = await fetch(EDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ action, productId, partId, lang }),
      signal: controller.signal,
    });
    // Surface 404 distinctly — the edge function not being deployed
    // returns a 404 with a non-JSON HTML/text body that would otherwise
    // blow up in res.json() and log as an opaque SyntaxError, hiding the
    // real setup step (`supabase functions deploy sanmar-product`) from
    // anyone debugging a fresh checkout.
    if (res.status === 404) {
      console.warn('[sanmar]', action, 'edge function not deployed (404) — run `supabase functions deploy sanmar-product`');
      return null;
    }
    const json = await res.json();
    if (!res.ok || !json.ok) {
      console.warn('[sanmar]', action, `failed (${res.status}):`, json.error || json.hint);
      return null;
    }
    return json.data as T;
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      // Distinguish caller-initiated cancel from our timeout — callers
      // shouldn't log a timeout when they aborted on their own.
      if (external?.aborted) {
        // Quiet — this was a deliberate cancel.
      } else {
        console.warn('[sanmar]', action, `timed out after ${SANMAR_TIMEOUT_MS}ms`);
      }
    } else {
      console.warn('[sanmar]', action, 'error:', err);
    }
    return null;
  } finally {
    cleanup();
  }
}

/** Typed SanMar client. Each method returns the decoded payload on
 * success, or `null` when the edge function is not deployed / the
 * request fails / the caller aborts. `options.signal` forwards to
 * fetch for unmount cancellation. */
export const sanmar = {
  /** Fetch product metadata (name, brand, colors, sizes, parts) for a style. */
  getProduct:   (productId: string, lang?: 'en' | 'fr', options?: SanmarRequestOptions) =>
    call<SanmarProduct>('product', productId, undefined, lang, options),
  /** Fetch live inventory (per-part, per-warehouse quantities) for a style. */
  getInventory: (productId: string, options?: SanmarRequestOptions) =>
    call<SanmarInventoryPart[]>('inventory', productId, undefined, 'en', options),
  /** Fetch media (image URLs + description) for a style. */
  getMedia:     (productId: string, lang?: 'en' | 'fr', options?: SanmarRequestOptions) =>
    call<SanmarMedia>('media', productId, undefined, lang, options),
  /** Fetch tier pricing rows for a style. */
  getPricing:   (productId: string, options?: SanmarRequestOptions) =>
    call<SanmarPricingRow[]>('pricing', productId, undefined, 'en', options),
};

// ── Aggregate helpers ──────────────────────────────────────────────────────

/** Aggregated stock totals across all parts of a SanMar style, broken
 * down by color, by size, and by the color+size pair. */
export interface StockSummary {
  totalAvailable: number;
  byColor: Map<string, number>;
  bySize: Map<string, number>;
  byColorSize: Map<string, number>; // key = `${color}|${size}`
}

/** Stable empty StockSummary reference. Safe to share across renders
 * because `summarizeStock` always constructs its own Maps when `parts`
 * is a real array; this constant is never mutated internally. Useful
 * for tests, SSR defaults, and consumers that want a single stable
 * reference for the "no data" case instead of allocating fresh empty
 * Maps on every render. */
export const EMPTY_SANMAR_SUMMARY: StockSummary = {
  totalAvailable: 0,
  byColor: new Map<string, number>(),
  bySize: new Map<string, number>(),
  byColorSize: new Map<string, number>(),
};

/** Reduce a list of SanMar inventory parts into a StockSummary.
 * Null / non-array input yields an empty summary (fresh Maps). */
export function summarizeStock(parts: SanmarInventoryPart[] | null): StockSummary {
  const byColor = new Map<string, number>();
  const bySize = new Map<string, number>();
  const byColorSize = new Map<string, number>();
  let totalAvailable = 0;

  // Accept only real arrays. The edge function could theoretically
  // return an error object or null while TypeScript still narrows to
  // SanmarInventoryPart[], and iterating a non-iterable throws.
  if (!Array.isArray(parts)) return { totalAvailable, byColor, bySize, byColorSize };

  for (const p of parts) {
    if (!p || typeof p !== 'object') continue;
    // SanMar's SOAP-to-REST gateway has been known to return null /
    // undefined for totalQty on discontinued parts. Coerce to 0 so a
    // single bad row doesn't turn the whole summary into NaN and
    // render as "NaN en stock" on the PDP stock badge. Also clamp
    // negative values — a negative sentinel qty on one part would
    // otherwise cancel out real stock on another part and suppress
    // the "In stock" badge on products that are actually stocked.
    const raw = Number.isFinite(p.totalQty) ? p.totalQty : 0;
    const qty = raw < 0 ? 0 : raw;
    totalAvailable += qty;
    // Only string keys land in the Maps — a numeric partColor (has
    // happened in test data) would be truthy and pollute the map
    // with a number-keyed entry that doesn't match any UI lookup.
    if (typeof p.partColor === 'string' && p.partColor) {
      byColor.set(p.partColor, (byColor.get(p.partColor) ?? 0) + qty);
    }
    if (typeof p.labelSize === 'string' && p.labelSize) {
      bySize.set(p.labelSize, (bySize.get(p.labelSize) ?? 0) + qty);
    }
    if (typeof p.partColor === 'string' && p.partColor && typeof p.labelSize === 'string' && p.labelSize) {
      const key = `${p.partColor}|${p.labelSize}`;
      byColorSize.set(key, (byColorSize.get(key) ?? 0) + qty);
    }
  }

  return { totalAvailable, byColor, bySize, byColorSize };
}
