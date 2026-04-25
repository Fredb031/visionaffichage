import type { Product } from '@/data/products';

type Category = Product['category'];

const FR: Record<Category, string> = {
  tshirt: 'T-Shirt',
  hoodie: 'Hoodie',
  crewneck: 'Crewneck',
  polo: 'Polo',
  longsleeve: 'Chandail manches longues',
  sport: 'Sport',
  cap: 'Casquette',
  toque: 'Tuque',
};

const EN: Record<Category, string> = {
  tshirt: 'T-Shirt',
  hoodie: 'Hoodie',
  crewneck: 'Crewneck',
  polo: 'Polo',
  longsleeve: 'Long sleeve',
  sport: 'Sport',
  cap: 'Cap',
  toque: 'Beanie',
};

// Generic per-language fallback used when a category isn't in the
// FR/EN map. Stale localStorage rows (Wishlist, RecentlyViewed, Cart)
// may carry a SKU whose category was since renamed/removed, and CSV /
// Shopify imports occasionally arrive with an unexpected category
// string. Without a fallback the lookup returns `undefined`, which
// renders verbatim into alt text, aria-labels, and `document.title`
// (e.g. "undefined ABC123 — Vision Affichage"). The fallback keeps the
// surrounding copy grammatical and never produces the literal string
// "undefined" in user-facing UI.
const FALLBACK: Record<'fr' | 'en', string> = {
  fr: 'Article',
  en: 'Item',
};

/** Resolve a localised category label.
 *
 * - Unknown / null / non-string category values fall back to a generic
 *   "Article" / "Item" for the given language instead of returning
 *   `undefined`, which would otherwise render literally in alt text
 *   and document.title.
 * - Unknown `lang` values fall back to French (the historical default
 *   matches the prior signature so existing callers are unaffected). */
export function categoryLabel(category: Category, lang: 'fr' | 'en' = 'fr'): string {
  const dict = lang === 'en' ? EN : FR;
  // Bracket lookup is safe even for unexpected runtime values (URL
  // params, stale persisted state, mistyped CSV import) because we
  // narrow the result back to string via the fallback below.
  const label = dict[category as Category];
  if (typeof label === 'string' && label) return label;
  return lang === 'en' ? FALLBACK.en : FALLBACK.fr;
}
