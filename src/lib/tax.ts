// Province-aware Canadian sales-tax computation.
//
// Audit P1 #5 — Checkout previously hardcoded GST 5% + QST 9.975% for every
// buyer regardless of `form.province`. ON / BC / AB shoppers saw a Quebec
// tax line and a total that mismatched what Shopify actually charged at
// checkout. This module owns the rate table and the breakdown shape so any
// surface (Checkout summary, sticky aside, future order receipts) renders
// the right components for the right province.
//
// Authoritative tax is always Shopify's server-side computation against the
// final shipping address — the values we render here are an estimate so
// the buyer can see roughly what's coming. The displayed total ALWAYS gets
// re-evaluated by Shopify before the card is charged.

export type ProvinceCode =
  | 'QC'
  | 'ON'
  | 'NB'
  | 'NS'
  | 'PE'
  | 'NL'
  | 'BC'
  | 'SK'
  | 'MB'
  | 'AB'
  | 'YT'
  | 'NT'
  | 'NU';

export interface TaxRates {
  gst: number;
  pst: number;
  hst: number;
}

export const TAX_RATES_BY_PROVINCE: Record<ProvinceCode, TaxRates> = {
  // QC: GST + QST
  QC: { gst: 0.05, pst: 0.09975, hst: 0 },
  // HST provinces (single line on the cart)
  ON: { gst: 0, pst: 0, hst: 0.13 },
  NB: { gst: 0, pst: 0, hst: 0.15 },
  NS: { gst: 0, pst: 0, hst: 0.15 },
  PE: { gst: 0, pst: 0, hst: 0.15 },
  NL: { gst: 0, pst: 0, hst: 0.15 },
  // GST + PST
  BC: { gst: 0.05, pst: 0.07, hst: 0 },
  SK: { gst: 0.05, pst: 0.06, hst: 0 },
  MB: { gst: 0.05, pst: 0.07, hst: 0 },
  // GST only
  AB: { gst: 0.05, pst: 0, hst: 0 },
  YT: { gst: 0.05, pst: 0, hst: 0 },
  NT: { gst: 0.05, pst: 0, hst: 0 },
  NU: { gst: 0.05, pst: 0, hst: 0 },
};

export interface TaxBreakdown {
  gst: number;
  pst: number;
  hst: number;
  total: number;
  /** Province code actually used to compute the breakdown after fallback. */
  province: ProvinceCode;
  rates: TaxRates;
}

/**
 * Compute estimated Canadian sales tax for `subtotal` shipped to `province`.
 *
 * Returns a breakdown object with each component (gst / pst / hst) plus the
 * combined `total`. Defaults to QC if the province is missing or unknown so
 * the most common case (Vision Affichage's home base) preserves prior
 * behaviour.
 *
 * Note: the displayed estimate is informational. Shopify recomputes tax
 * server-side from the final shipping address, and that figure is what's
 * actually charged.
 */
export function computeTax(
  subtotal: number,
  province: string | undefined,
): TaxBreakdown {
  const code = (province ?? '').toUpperCase() as ProvinceCode;
  const resolved: ProvinceCode = code in TAX_RATES_BY_PROVINCE ? code : 'QC';
  const rates = TAX_RATES_BY_PROVINCE[resolved];
  // Clamp to non-negative: a negative subtotal would yield a negative tax
  // line, which is never a legal Canadian tax result. Treat it as 0.
  const safeSubtotal = Number.isFinite(subtotal) && subtotal > 0 ? subtotal : 0;
  const gst = safeSubtotal * rates.gst;
  const pst = safeSubtotal * rates.pst;
  const hst = safeSubtotal * rates.hst;
  return {
    gst,
    pst,
    hst,
    total: gst + pst + hst,
    province: resolved,
    rates,
  };
}

/** PST rate label in the buyer's locale (e.g. "TVQ", "PST"). */
export function pstLabel(province: ProvinceCode, lang: 'fr' | 'en'): string {
  if (province === 'QC') return lang === 'en' ? 'QST' : 'TVQ';
  return lang === 'en' ? 'PST' : 'TVP';
}

/** HST label in the buyer's locale. */
export function hstLabel(lang: 'fr' | 'en'): string {
  return lang === 'en' ? 'HST' : 'TVH';
}

/** GST label in the buyer's locale. */
export function gstLabel(lang: 'fr' | 'en'): string {
  return lang === 'en' ? 'GST' : 'TPS';
}

/** Format a percentage for display, using a comma decimal separator in FR. */
export function fmtRate(rate: number, lang: 'fr' | 'en'): string {
  // Round to 3 decimals to handle 9.975%, drop trailing zeroes.
  const pct = rate * 100;
  const fixed = pct.toFixed(3).replace(/\.?0+$/, '');
  return lang === 'en' ? fixed : fixed.replace('.', ',');
}
