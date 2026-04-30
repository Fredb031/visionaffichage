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

export function getAlternates(path: string): {
  canonical: string;
  languages: Record<string, string>;
} {
  const norm = normalizePath(path);
  return {
    canonical: `/${routing.defaultLocale}${norm}`,
    languages: {
      'fr-CA': `/fr-ca${norm}`,
      'en-CA': `/en-ca${norm}`,
      'x-default': `/${routing.defaultLocale}${norm}`,
    },
  };
}
