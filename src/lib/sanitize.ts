/**
 * Input sanitization helpers for free-text user entries before they hit
 * localStorage (Task 14.4).
 *
 * Why this exists:
 * - The site persists user-typed strings (contact messages, gift notes,
 *   admin/vendor private notes) into localStorage and later renders them
 *   back through React. React already escapes text children, so a naive
 *   `<script>` payload in a note won't execute on re-render. But the
 *   same blob can be copy-pasted into an email, a CSV export, or a
 *   server-side log that DOESN'T auto-escape — so we strip the angle
 *   brackets at the ingest point to keep the stored string defanged
 *   across every downstream consumer.
 * - We deliberately DON'T pull in DOMPurify. These fields never accept
 *   rich HTML; plain-string rules (strip `<` and `>`, trim, collapse
 *   whitespace, cap length) cover the realistic threat model for
 *   localStorage-only persistence without adding a ~20kb dep.
 * - When the backend lands, server-side sanitization is still required.
 *   These helpers are defense-in-depth for the client-persisted copy,
 *   NOT a replacement for a proper server-side allowlist.
 */

export interface SanitizeTextOpts {
  /** Hard cap on the returned string length. Defaults to 10_000 so a
   *  pathological paste can't balloon a localStorage write beyond the
   *  browser quota and take down unrelated features. Callers with
   *  tighter contracts (e.g. 250-char gift messages) pass their own. */
  maxLength?: number;
}

const DEFAULT_MAX_LENGTH = 10_000;

/**
 * Clean a free-text string for safe persistence.
 *
 * Rules applied, in order:
 *  1. Coerce non-string input to empty string (defensive — the call
 *     sites all hold React state typed as string, but an upstream bug
 *     could still feed in `undefined`).
 *  2. Strip `<` and `>` to prevent HTML / tag injection in any
 *     downstream renderer that doesn't auto-escape (CSV export, email
 *     template, server log).
 *  3. Trim leading/trailing whitespace.
 *  4. Collapse runs of whitespace (including newlines) into a single
 *     space — keeps the stored blob compact and prevents an all-newline
 *     payload from evading length caps visually.
 *  5. Truncate to `maxLength`.
 */
export function sanitizeText(input: string, opts?: SanitizeTextOpts): string {
  if (typeof input !== 'string') return '';
  const max = opts?.maxLength ?? DEFAULT_MAX_LENGTH;
  // Strip angle brackets first so the whitespace collapse doesn't have
  // to reason about "<  >" collapsing into "<>" (a would-be tag opener).
  const stripped = input.replace(/[<>]/g, '');
  // \s matches newlines, tabs, and the unicode whitespace class. A
  // single space is the safest replacement — it preserves word
  // boundaries so "line one\n\nline two" becomes "line one line two"
  // instead of "line oneline two".
  const collapsed = stripped.replace(/\s+/g, ' ').trim();
  return collapsed.length > max ? collapsed.slice(0, max) : collapsed;
}

/**
 * Flags bare `javascript:` or `data:` URI schemes embedded in user
 * input. Useful for catching paste-job injection attempts into text
 * that might later be rendered as a link by a careless consumer.
 *
 * Intentionally permissive — matches the scheme regardless of
 * surrounding whitespace or mixed case, which is how the common
 * bypasses are typed ("JaVaScRiPt:", "  data:text/html"). Callers
 * decide whether to reject the whole payload or just surface a warning.
 */
export function isSuspiciousUrl(s: string): boolean {
  if (typeof s !== 'string' || !s) return false;
  // Normalize whitespace and case so obfuscated variants ("\tjava\nscript:")
  // still match. We check for the scheme token anywhere in the string
  // because the attack surface is "text that becomes an href", and any
  // embedded occurrence can be the one that ends up as the link target.
  const normalized = s.replace(/\s+/g, '').toLowerCase();
  return normalized.includes('javascript:') || normalized.includes('data:');
}
