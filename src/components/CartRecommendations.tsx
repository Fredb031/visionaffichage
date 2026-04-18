import { Link } from 'react-router-dom';
import { Plus, Sparkles } from 'lucide-react';
import { useLang } from '@/lib/langContext';
import { PRODUCTS } from '@/data/products';
import { categoryLabel } from '@/lib/productLabels';
import { useCartStore } from '@/store/cartStore';

/**
 * Cross-sell module shown above the cart total on the Cart page and
 * inside the CartDrawer. Picks 3 products the customer DOESN'T already
 * have in their cart, biased toward the same category as their existing
 * items (people who buy hoodies also buy t-shirts, caps, etc.).
 */
export function CartRecommendations() {
  const { lang } = useLang();
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
    .slice(0, 3)
    .map(x => x.p);

  if (recs.length === 0) return null;

  return (
    <section className="bg-gradient-to-br from-secondary/50 to-background border border-border rounded-2xl p-4 md:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-[#E8A838]" />
          <h3 className="text-sm font-extrabold text-foreground">
            {lang === 'en' ? 'Customers also ordered' : 'Souvent commandé avec'}
          </h3>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {lang === 'en' ? 'Save shipping' : 'Économise sur la livraison'}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {recs.map(p => (
          <Link
            key={p.sku}
            to={`/product/${p.shopifyHandle}`}
            className="group block bg-background rounded-xl overflow-hidden border border-border hover:border-[#0052CC]/30 hover:shadow-md transition-all"
          >
            <div className="aspect-square bg-secondary relative overflow-hidden">
              {p.imageDevant && (
                <img
                  src={p.imageDevant}
                  alt={`${categoryLabel(p.category, lang)} ${p.sku}`}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                  decoding="async"
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
                {lang === 'en' ? 'From' : 'À partir de'} {p.basePrice.toFixed(2)} $
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
