import type { Locale } from './types';

const localeMap: Record<Locale, 'fr-CA' | 'en-CA'> = {
  'fr-ca': 'fr-CA',
  'en-ca': 'en-CA',
};

export function formatCAD(cents: number, locale: Locale): string {
  return new Intl.NumberFormat(localeMap[locale], {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatLeadTime(
  days: { min: number; max: number },
  locale: Locale,
): string {
  return locale === 'fr-ca'
    ? `${days.min}-${days.max} jours ouvrables`
    : `${days.min}-${days.max} business days`;
}

export function formatProductionMicrocopy(
  days: { min: number; max: number },
  locale: Locale,
): string {
  return locale === 'fr-ca'
    ? `Production ${days.min}-${days.max} jours`
    : `Production ${days.min}-${days.max} days`;
}

export function formatMinQty(qty: number, locale: Locale): string {
  return locale === 'fr-ca' ? `Min. ${qty}` : `Min. ${qty}`;
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(localeMap[locale]).format(value);
}
