import type { MetadataRoute } from 'next';
import { products } from '@/lib/products';
import { industries } from '@/lib/industries';
import { BASE_URL } from '@/lib/seo';
import { routing } from '@/i18n/routing';

const LOCALES = routing.locales;
const DEFAULT_LOCALE = routing.defaultLocale;

type StaticPath = { path: string; priority: number; changeFrequency: 'weekly' | 'monthly' };

const STATIC_PATHS: StaticPath[] = [
  { path: '', priority: 1.0, changeFrequency: 'weekly' },
  { path: '/produits', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/industries', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/avis', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/a-propos', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/comment-ca-marche', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/faq', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/kit', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/soumission', priority: 0.5, changeFrequency: 'monthly' },
];

function altLanguages(path: string): Record<string, string> {
  return {
    'fr-CA': `${BASE_URL}/fr-ca${path}`,
    'en-CA': `${BASE_URL}/en-ca${path}`,
    'x-default': `${BASE_URL}/${DEFAULT_LOCALE}${path}`,
  };
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of LOCALES) {
    for (const { path, priority, changeFrequency } of STATIC_PATHS) {
      entries.push({
        url: `${BASE_URL}/${locale}${path}`,
        lastModified: now,
        changeFrequency,
        priority,
        alternates: { languages: altLanguages(path) },
      });
    }

    for (const p of products) {
      const path = `/produits/${p.slug}`;
      entries.push({
        url: `${BASE_URL}/${locale}${path}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.8,
        alternates: { languages: altLanguages(path) },
      });
    }

    for (const i of industries) {
      const path = `/industries/${i.slug}`;
      entries.push({
        url: `${BASE_URL}/${locale}${path}`,
        lastModified: now,
        changeFrequency: 'monthly',
        priority: 0.7,
        alternates: { languages: altLanguages(path) },
      });
    }
  }

  return entries;
}
