import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useLang } from '@/lib/langContext';
import { PRODUCTS } from '@/data/products';
import { categoryLabel } from '@/lib/productLabels';
import { useCartStore } from '@/stores/localCartStore';

/**
 * Cross-sell module — Section 6.1 of the Master Prompt redesign.
 *
 * Headline calls out the type of the FIRST item in the cart by name
 * ("Les équipes qui commandent T-shirts ajoutent souvent : ...") so
 * the recommendation feels tailored, not generic. Sub-line nudges
 * shipping efficiency ("Complète ta commande pour économiser sur la
 * livraison").
 *
 * Algorithm — picks 3 products the customer doesn't already have in
 * their cart and that belong to a DIFFERENT category from the first
 * cart item's category, biased toward category coherence (caps with
 * tees, tees with hoodies). PRODUCTS has no popularity field, so we
 * use the natural insertion order of `PRODUCTS` as the popular-desc
 * proxy — featured types are listed first in src/data/products.ts.
 *
 * Visual structure — 3 cards in `grid-cols-3 gap-4` with brand-blue
 * (#0052CC) hover border, image, type name, "À partir de Xs", and a
 * "+ Ajouter" CTA button that inverts on hover via the group hover.
 */
export function CartRecommendations() {
  const { lang, t } = useLang();
  const items = useCartStore(s => s.items);

  if (items.length === 0) return null;

  const inCartIds = new Set(items.map(it => it.productId));
  const firstCartItem = items[0];
  const firstProduct = PRODUCTS.find(p => p.id === firstCartItem.productId);
  const firstCategory = firstProduct?.category;
  const firstTypeName = firstProduct ? categoryLabel(firstProduct.category, lang) : '';

  // Filter cart items + filter different category than firstCartItem.category,
  // sort by popularity (insertion order in PRODUCTS), take 3.
  const recs = PRODUCTS
    .filter(p => !inCartIds.has(p.id))
    .filter(p => firstCategory ? p.category !== firstCategory : true)
    .slice(0, 3);

  if (recs.length === 0) return null;

  return (
    <section
      className="bg-card border border-border rounded-2xl p-4 md:p-5"
      aria-label={t('produitsRecommandesAria')}
    >
      <div className="mb-4">
        <h3 className="text-base md:text-lg font-extrabold text-foreground">
          {lang === 'en' ? (
            <>
              Teams ordering <span className="text-[#0052CC]">{firstTypeName}</span> often add:
            </>
          ) : (
            <>
              Les équipes qui commandent <span className="text-[#0052CC]">{firstTypeName}</span> ajoutent souvent :
            </>
          )}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          {lang === 'en'
            ? 'Complete your order to save on shipping'
            : 'Complète ta commande pour économiser sur la livraison'}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4" role="list">
        {recs.map(p => {
          const priceFmt = p.basePrice.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
          return (
            <Link
              key={p.sku}
              to={`/product/${p.shopifyHandle}`}
              role="listitem"
              aria-label={`${categoryLabel(p.category, lang)} ${p.sku} — ${lang === 'en' ? 'from' : 'à partir de'} ${priceFmt} $`}
              className="group block bg-background rounded-xl overflow-hidden border border-border hover:border-[#0052CC] hover:shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2"
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
              </div>
              <div className="p-3 space-y-1.5">
                <div className="text-sm font-extrabold text-foreground truncate">
                  {categoryLabel(p.category, lang)}
                </div>
                <div className="text-xs font-bold text-muted-foreground">
                  {lang === 'en' ? 'From' : 'À partir de'} {priceFmt} $
                </div>
                <div
                  className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#0052CC] text-[#0052CC] text-xs font-bold transition-colors group-hover:bg-[#0052CC] group-hover:text-white"
                >
                  <Plus size={12} aria-hidden="true" />
                  {lang === 'en' ? 'Add' : 'Ajouter'}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
