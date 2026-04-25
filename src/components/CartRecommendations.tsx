import { Link } from 'react-router-dom';
import { Plus, Sparkles } from 'lucide-react';
import { useLang } from '@/lib/langContext';
import { PRODUCTS } from '@/data/products';
import { categoryLabel } from '@/lib/productLabels';
import { useCartStore } from '@/stores/localCartStore';

/**
 * Cross-sell module shown above the cart total on the Cart page and
 * inside the CartDrawer. Picks up to 4 products the customer DOESN'T
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

  if (items.length === 0) return null;

  const inCartIds = new Set(items.map(it => it.productId));
  const categoriesInCart = new Set(
    items
      .map(it => PRODUCTS.find(p => p.id === it.productId)?.category)
      .filter(Boolean),
  );

  // Score: products NOT in cart + bonus if same category as cart
  const recs = PRODUCTS
    .filter(p => !inCartIds.has(p.id))
    .map(p => ({ p, score: categoriesInCart.has(p.category) ? 2 : 1 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(x => x.p);

  if (recs.length === 0) return null;

  return (
    <section
      className="bg-gradient-to-br from-secondary/50 to-background border border-border rounded-2xl p-4 md:p-5"
      aria-label={t('produitsRecommandesAria')}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-brand-blue" aria-hidden="true" />
          <h3 className="text-sm font-extrabold text-foreground">
            {lang === 'en' ? 'Customers also ordered' : 'Souvent commandé avec'}
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
              )}
              <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-[#0052CC] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md">
                <Plus size={12} />
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
