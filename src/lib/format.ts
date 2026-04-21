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

type Lang = 'fr' | 'en';

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
  return new Intl.NumberFormat(localeFor(lang), {
    style: 'currency',
    currency: 'CAD',
  }).format(n);
};
