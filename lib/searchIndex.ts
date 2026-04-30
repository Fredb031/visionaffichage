import type { Bilingual, Locale } from './types';
import { products } from './products';
import { industries } from './industries';

export type SearchEntryType = 'product' | 'industry' | 'page';

export type SearchEntry = {
  type: SearchEntryType;
  id: string;
  href: (locale: Locale) => string;
  title: Bilingual;
  snippet: Bilingual;
  imageSlug?: string;
  /** Pre-tokenized lowercase, diacritic-stripped terms used for matching. */
  tokens: string[];
};

/**
 * Lowercase a string and strip common French diacritics so "broderie" matches
 * "broderie", "Broderie", "brôderïe", etc. Falls back to a regex scrub if the
 * runtime lacks Intl normalize support.
 */
export function normalizeText(input: string): string {
  if (!input) return '';
  let out = input.toLowerCase();
  if (typeof out.normalize === 'function') {
    // Strip combining diacritical marks (U+0300–U+036F) after NFD decomposition.
    out = out.normalize('NFD').replace(/[̀-ͯ]/g, '');
  } else {
    out = out
      .replace(/[àâä]/g, 'a')
      .replace(/[éèêë]/g, 'e')
      .replace(/[îï]/g, 'i')
      .replace(/[ôö]/g, 'o')
      .replace(/[ùûü]/g, 'u')
      .replace(/[ç]/g, 'c');
  }
  return out;
}

/** Split a normalized string on whitespace + punctuation. */
export function tokenize(input: string): string[] {
  return normalizeText(input)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
}

function buildTokens(parts: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  for (const p of parts) {
    if (!p) continue;
    for (const t of tokenize(p)) seen.add(t);
  }
  return Array.from(seen);
}

const STATIC_PAGES: Array<{
  id: string;
  path: string;
  title: Bilingual;
  snippet: Bilingual;
  extraTokens: string[];
}> = [
  {
    id: 'home',
    path: '',
    title: { 'fr-ca': 'Accueil', 'en-ca': 'Home' },
    snippet: {
      'fr-ca': 'Vision Affichage — vêtements brodés et imprimés au Québec.',
      'en-ca': 'Vision Affichage — embroidered and printed apparel in Quebec.',
    },
    extraTokens: ['accueil', 'home', 'vision', 'affichage'],
  },
  {
    id: 'soumission',
    path: '/soumission',
    title: { 'fr-ca': 'Demander une soumission', 'en-ca': 'Request a quote' },
    snippet: {
      'fr-ca': 'Soumission gratuite en moins de 24 heures.',
      'en-ca': 'Free quote in under 24 hours.',
    },
    extraTokens: ['quote', 'soumission', 'devis', 'estimate'],
  },
  {
    id: 'kit',
    path: '/kit',
    title: { 'fr-ca': 'Kit découverte', 'en-ca': 'Discovery kit' },
    snippet: {
      'fr-ca': 'Échantillons de tissus livrés à votre porte.',
      'en-ca': 'Fabric samples delivered to your door.',
    },
    extraTokens: ['kit', 'samples', 'echantillons', 'discovery', 'decouverte'],
  },
  {
    id: 'avis',
    path: '/avis',
    title: { 'fr-ca': 'Réalisations & avis', 'en-ca': 'Portfolio & reviews' },
    snippet: {
      'fr-ca': 'Ce que disent nos clients québécois.',
      'en-ca': 'What our Quebec clients say.',
    },
    extraTokens: ['portfolio', 'reviews', 'avis', 'realisations', 'temoignages'],
  },
  {
    id: 'contact',
    path: '/contact',
    title: { 'fr-ca': 'Nous joindre', 'en-ca': 'Contact us' },
    snippet: {
      'fr-ca': 'Téléphone, courriel et adresse.',
      'en-ca': 'Phone, email, and address.',
    },
    extraTokens: ['contact', 'phone', 'email', 'courriel', 'telephone'],
  },
  {
    id: 'a-propos',
    path: '/a-propos',
    title: { 'fr-ca': 'À propos', 'en-ca': 'About' },
    snippet: {
      'fr-ca': "L'histoire de Vision Affichage.",
      'en-ca': 'The Vision Affichage story.',
    },
    extraTokens: ['about', 'apropos', 'histoire', 'story', 'company', 'entreprise'],
  },
  {
    id: 'faq',
    path: '/faq',
    title: { 'fr-ca': 'Foire aux questions', 'en-ca': 'FAQ' },
    snippet: {
      'fr-ca': 'Réponses aux questions les plus fréquentes.',
      'en-ca': 'Answers to the most common questions.',
    },
    extraTokens: ['faq', 'questions', 'help', 'aide'],
  },
  {
    id: 'comment-ca-marche',
    path: '/comment-ca-marche',
    title: { 'fr-ca': 'Comment ça marche', 'en-ca': 'How it works' },
    snippet: {
      'fr-ca': 'Notre processus en cinq étapes.',
      'en-ca': 'Our five-step process.',
    },
    extraTokens: ['process', 'how', 'works', 'comment', 'marche', 'etapes', 'steps'],
  },
];

let cachedIndex: SearchEntry[] | null = null;

export function getSearchIndex(): SearchEntry[] {
  if (cachedIndex) return cachedIndex;

  const entries: SearchEntry[] = [];

  for (const product of products) {
    entries.push({
      type: 'product',
      id: `product:${product.slug}`,
      href: (locale) => `/${locale}/produits/${product.slug}`,
      title: product.title,
      snippet: product.identityHook,
      imageSlug: product.gallery?.[0] ?? product.slug,
      tokens: buildTokens([
        product.title['fr-ca'],
        product.title['en-ca'],
        product.identityHook['fr-ca'],
        product.identityHook['en-ca'],
        product.description['fr-ca'],
        product.description['en-ca'],
        product.bestFor['fr-ca'],
        product.bestFor['en-ca'],
        product.styleCode,
        product.brand,
        product.category,
        product.decorationDefault,
        product.slug,
        ...(product.decorationOptions ?? []),
      ]),
    });
  }

  for (const industry of industries) {
    entries.push({
      type: 'industry',
      id: `industry:${industry.slug}`,
      href: (locale) => `/${locale}/industries/${industry.slug}`,
      title: industry.name,
      snippet: industry.shortDescription,
      imageSlug: industry.slug,
      tokens: buildTokens([
        industry.name['fr-ca'],
        industry.name['en-ca'],
        industry.shortDescription['fr-ca'],
        industry.shortDescription['en-ca'],
        industry.pitch['fr-ca'],
        industry.pitch['en-ca'],
        industry.hookLine?.['fr-ca'],
        industry.hookLine?.['en-ca'],
        industry.slug,
      ]),
    });
  }

  for (const page of STATIC_PAGES) {
    entries.push({
      type: 'page',
      id: `page:${page.id}`,
      href: (locale) => `/${locale}${page.path}`,
      title: page.title,
      snippet: page.snippet,
      tokens: buildTokens([
        page.title['fr-ca'],
        page.title['en-ca'],
        page.snippet['fr-ca'],
        page.snippet['en-ca'],
        ...page.extraTokens,
      ]),
    });
  }

  cachedIndex = entries;
  return entries;
}

/**
 * Score a single entry for a given normalized query token list.
 * +2 per exact token match, +3 bonus per prefix match against an entry token,
 * +5 bonus if the full query is a prefix of the entry title.
 */
function scoreEntry(entry: SearchEntry, queryTokens: string[], rawQuery: string, locale: Locale): number {
  if (queryTokens.length === 0) return 0;
  let score = 0;
  const tokenSet = new Set(entry.tokens);

  for (const q of queryTokens) {
    if (tokenSet.has(q)) {
      score += 2;
    }
    for (const t of entry.tokens) {
      if (t !== q && t.startsWith(q) && q.length >= 2) {
        score += 3;
        break;
      }
    }
  }

  const normalizedTitle = normalizeText(entry.title[locale] ?? entry.title['fr-ca']);
  if (rawQuery.length >= 2 && normalizedTitle.startsWith(rawQuery)) {
    score += 5;
  }

  // Slight type-based tie-breaker: products first, then industries, then pages.
  if (score > 0) {
    if (entry.type === 'product') score += 0.3;
    else if (entry.type === 'industry') score += 0.2;
    else score += 0.1;
  }

  return score;
}

export function search(query: string, locale: Locale, limit = 10): SearchEntry[] {
  const rawQuery = normalizeText(query.trim());
  if (!rawQuery) return [];
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const index = getSearchIndex();
  const scored: Array<{ entry: SearchEntry; score: number }> = [];

  for (const entry of index) {
    const score = scoreEntry(entry, queryTokens, rawQuery, locale);
    if (score > 0) scored.push({ entry, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.entry);
}
