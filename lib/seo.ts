import type { Locale } from './types';
import { routing } from '@/i18n/routing';

export const BASE_URL = 'https://visionaffichage.com';

function normalizePath(path: string): string {
  if (!path) return '';
  const withSlash = path.startsWith('/') ? path : `/${path}`;
  return withSlash === '/' ? '' : withSlash;
}

export function getCanonicalUrl(locale: Locale, path: string): string {
  return `${BASE_URL}/${locale}${normalizePath(path)}`;
}

export function getAlternates(
  path: string,
  locale?: Locale,
): {
  canonical: string;
  languages: Record<string, string>;
} {
  const norm = normalizePath(path);
  const canonicalLocale = locale ?? routing.defaultLocale;
  return {
    canonical: `/${canonicalLocale}${norm}`,
    languages: {
      'fr-CA': `/fr-ca${norm}`,
      'en-CA': `/en-ca${norm}`,
      'x-default': `/${routing.defaultLocale}${norm}`,
    },
  };
}

/**
 * Build a URL to the dynamic OG image endpoint with route-specific
 * title + optional subtitle. Used by per-page generateMetadata so social
 * shares show the actual page context instead of brand defaults.
 */
export function getOgImageUrl(title: string, subtitle?: string): string {
  const params = new URLSearchParams({ title });
  if (subtitle) params.set('subtitle', subtitle);
  return `${BASE_URL}/api/og?${params.toString()}`;
}
