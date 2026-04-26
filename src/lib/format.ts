/**
 * Single source of truth for money rendered to a buyer.
 *
 * Why this file exists:
 * - Raw `.toFixed(2)` is locale-blind: it always emits "27.54" with a dot,
 *   which looks wrong next to fr-CA UI copy where every other number uses
 *   a comma ("27,54"). fmtMoney defers to Intl.NumberFormat so fr-CA
 *   customers see "27,54 $" and en-CA customers see "$27.54".
 * - `.toFixed(2)` on NaN / undefined-coerced-to-NaN renders the literal
 *   string "NaN" in the UI. fmtMoney returns an em-dash ("—") so the page
 *   degrades gracefully when a Shopify variant ships without a price.
 *
 * Call sites should prefer fmtMoney over any ad-hoc template-literal money
 * formatting — cart rows, PDP prices, checkout summaries, customizer
 * totals, quote pages.
 */

// Reuse the canonical Lang union from i18n so the two never drift; if a third
// locale is ever added there, fmtMoney's contract picks it up automatically.
import type { Lang } from './i18n';

/** Map our Lang union to the BCP-47 tag Intl.NumberFormat expects. */
const localeFor = (lang?: Lang): string =>
  lang === 'en' ? 'en-CA' : 'fr-CA';

/**
 * Format a number as CAD currency, locale-aware.
 *
 * @param n     Raw amount. NaN / Infinity / null / undefined → "—".
 * @param lang  'fr' (default) → "27,54 $" · 'en' → "$27.54".
 */
export const fmtMoney = (n: number | null | undefined, lang?: Lang): string => {
  if (n == null || !Number.isFinite(n)) return '—';
  // Collapse negative-zero to positive zero so discount math like
  // (subtotal - subtotal) doesn't render as "-$0.00" in cart/checkout —
  // Object.is(-0, 0) is false but Intl preserves the sign on -0.
  const safe = Object.is(n, -0) ? 0 : n;
  return new Intl.NumberFormat(localeFor(lang), {
    style: 'currency',
    currency: 'CAD',
  }).format(safe);
};
