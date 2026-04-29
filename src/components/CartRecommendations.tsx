import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Sparkles } from 'lucide-react';
import { useLang } from '@/lib/langContext';
import { PRODUCTS } from '@/data/products';
import { categoryLabel } from '@/lib/productLabels';
import { useCartStore } from '@/stores/localCartStore';
import { toWebp } from '@/lib/toWebp';

// Master Prompt Vol. II — heading interpolates the FIRST cart item's
// product name lowercased so the cross-sell reads as "Teams that order
// hoodie premium often add:" instead of a generic "customers also
// bought". Picking by insertion order (first item in `items`) makes the
// heading stable for the buyer's session — they see the same line they
// just added cross-referenced, not a category they happened to add 3
// items in. Falls back to a sensible static label when the cart is
// empty (in which case the section is already gated below).

// Maximum number of cross-sell cards rendered. Matches the md+ grid (4 cols)
// so on desktop every rec is visible; on mobile users scroll horizontally.
const MAX_RECS = 4;
// Scoring weights for the cross-sell ranking. Same-category products get a
// stronger boost so a hoodie buyer sees other hoodies/sweatshirts first
// before unrelated categories like caps or bags.
const SCORE_SAME_CATEGORY = 2;
const SCORE_DEFAULT = 1;

/**
 * Cross-sell module shown above the cart total on the Cart page and
 * inside the CartDrawer. Picks up to MAX_RECS products the customer DOESN'T
 * already have in their cart, biased toward the same category as their
 * existing items (people who buy hoodies also buy t-shirts, caps, etc.).
 *
 * Layout: horizontal snap-scroll on narrow viewports (fits inside the
 * CartDrawer without forcing a squeezed 3-column grid), 4-column grid
 * on md+ so all recommendations are visible at once on the Cart page.
 * A right-side fade mask hints at scrollability on mobile.
 */
export function CartRecommendations() {
  const { lang, t } = useLang();
  const items = useCartStore(s => s.items);

  // Stable key over just the product-id membership of the cart so the rec
  // memo below doesn't re-run on every qty bump / option toggle (which mutate
  // `items` but leave the set of product IDs unchanged). Sorted+joined so
  // reordering items in the cart also doesn't invalidate the memo.
  const productIdsKey = useMemo(
    () => Array.from(new Set(items.map(it => it.productId))).sort().join('|'),
    [items],
  );

  // Memoise the rec computation: PRODUCTS is a static array of ~dozens of
  // entries, but recomputing the filter+sort on every cart store update (qty
  // bumps, option toggles in the drawer) wastes work. Re-runs only when the
  // cart's product membership actually changes.
  const recs = useMemo(() => {
    if (productIdsKey === '') return [];
    const inCartIds = new Set(productIdsKey.split('|'));
    const categoriesInCart = new Set(
      Array.from(inCartIds)
        .map(id => PRODUCTS.find(p => p.id === id)?.category)
        .filter(Boolean),
    );
    return PRODUCTS
      .filter(p => !inCartIds.has(p.id))
      .map(p => ({
        p,
        score: categoriesInCart.has(p.category) ? SCORE_SAME_CATEGORY : SCORE_DEFAULT,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RECS)
      .map(x => x.p);
  }, [productIdsKey]);

  if (items.length === 0) return null;
  if (recs.length === 0) return null;

  // Master Prompt Vol. II — heading interpolates the FIRST cart item's
  // product name (lowercased). Trim guards against accidental whitespace
  // padding from upstream data and keeps the lowercased token clean.
  const firstName = items[0]?.productName?.trim() ?? '';
  const productLabel = firstName
    ? firstName.toLowerCase()
    : (lang === 'en' ? 'this' : 'ceci');

  return (
    <section
      className="bg-gradient-to-br from-secondary/50 to-background border border-border rounded-2xl p-4 md:p-5"
      aria-label={t('produitsRecommandesAria')}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-[#E8A838]" aria-hidden="true" />
          <h3 className="text-sm font-extrabold text-foreground">
            {lang === 'en'
              ? `Teams that order ${productLabel} often add:`
              : `Les équipes qui commandent ${productLabel} ajoutent souvent :`}
          </h3>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {lang === 'en' ? 'Save shipping' : 'Économise sur la livraison'}
        </span>
      </div>
      <div className="relative">
        {/* Mobile: horizontal scroll with snap. md+: 4-col grid.
            The fade mask below only shows on mobile to hint at more
            items off-screen; it is pointer-events-none so it never
            blocks taps on the last visible card. */}
        <div
          className="flex gap-2 overflow-x-auto snap-x snap-mandatory -mx-1 px-1 pb-1 scrollbar-none md:grid md:grid-cols-4 md:overflow-visible md:mx-0 md:px-0 md:pb-0"
          role="list"
        >
        {recs.map(p => {
          // Use fr-CA locale formatting so French users see '27,54 $' with
          // a comma separator (matches the rest of the site — cart totals,
          // quote rows, admin dashboards). en-CA also uses '27.54 $' with
          // a space before the dollar sign, which is correct for Canadian
          // English too, so a single formatter works for both locales.
          const priceFmt = p.basePrice.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
          return (
          <Link
            key={p.sku}
            to={`/product/${p.shopifyHandle}`}
            aria-label={`${categoryLabel(p.category, lang)} ${p.sku} — ${lang === 'en' ? 'from' : 'à partir de'} ${priceFmt} $`}
            role="listitem"
            className="group block bg-background rounded-xl overflow-hidden border border-border hover:border-[#0052CC]/30 hover:shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 snap-start shrink-0 basis-[40%] min-w-[40%] md:basis-auto md:min-w-0 md:shrink"
          >
            <div className="aspect-square bg-secondary relative overflow-hidden">
              {p.imageDevant && (
                <picture>
                  <source srcSet={toWebp(p.imageDevant)} type="image/webp" />
                  <img
                    src={p.imageDevant}
                    alt={`${categoryLabel(p.category, lang)} ${p.sku}`}
                    width={300}
                    height={300}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                    decoding="async"
                    onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                  />
                </picture>
              )}
              <span
                aria-hidden="true"
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-[#0052CC] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
              >
                <Plus size={12} aria-hidden="true" />
              </span>
            </div>
            <div className="p-2">
              <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/60 truncate">
                {p.sku}
              </div>
              <div className="text-[12px] font-extrabold text-foreground truncate">
                {categoryLabel(p.category, lang)}
              </div>
              <div className="text-[11px] font-bold text-[#0052CC] mt-0.5">
                {lang === 'en' ? 'From' : 'À partir de'} {priceFmt} $
              </div>
            </div>
          </Link>
          );
        })}
        </div>
        {/* Right-edge fade mask — mobile only, non-interactive. Uses
            the section's own gradient background so it blends with the
            surrounding card regardless of light/dark theme. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 right-0 h-full w-8 bg-gradient-to-l from-background/90 to-transparent md:hidden"
        />
      </div>
    </section>
  );
}
