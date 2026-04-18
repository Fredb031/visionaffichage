import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useLang } from '@/lib/langContext';
import { PRODUCTS } from '@/data/products';
import { categoryLabel } from '@/lib/productLabels';
import { useWishlist } from '@/hooks/useWishlist';

/**
 * Show the customer's wishlist as a small grid. Renders nothing when
 * empty (a separate empty state is more helpful in some places, but
 * on the Account page we already have a primary orders section so
 * the wishlist should just disappear when irrelevant).
 */
export function WishlistGrid({ limit = 6 }: { limit?: number }) {
  const { lang } = useLang();
  const { handles, toggle } = useWishlist();

  const items = handles
    .map(h => PRODUCTS.find(p => p.shopifyHandle === h))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .slice(0, limit);

  if (items.length === 0) return null;

  return (
    <section className="bg-white border border-border rounded-2xl p-5 mt-5" aria-labelledby="wishlist-heading">
      <div className="flex items-center justify-between mb-4">
        <h2 id="wishlist-heading" className="font-bold text-base flex items-center gap-2">
          <Heart size={16} className="text-[#E8A838] fill-[#E8A838]" aria-hidden="true" />
          {lang === 'en' ? 'Saved products' : 'Produits enregistrés'}
          <span className="text-xs font-normal text-muted-foreground">({handles.length})</span>
        </h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {items.map(p => (
          <div key={p.sku} className="relative group">
            <Link
              to={`/product/${p.shopifyHandle}`}
              className="block bg-background rounded-xl overflow-hidden border border-border hover:border-primary/30 hover:shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <div className="aspect-square bg-secondary">
                {p.imageDevant && (
                  <img
                    src={p.imageDevant}
                    alt={`${categoryLabel(p.category, lang)} ${p.sku}`}
                    width={300}
                    height={300}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                    decoding="async"
                  />
                )}
              </div>
              <div className="p-2.5">
                <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/60 truncate">
                  {p.sku}
                </div>
                <div className="text-[13px] font-extrabold text-foreground truncate">
                  {categoryLabel(p.category, lang)}
                </div>
                <div className="text-[11px] text-primary font-bold mt-0.5">
                  {lang === 'en' ? 'From' : 'À partir de'} {p.basePrice.toFixed(2)} $
                </div>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => toggle(p.shopifyHandle)}
              aria-label={lang === 'en' ? `Remove ${p.sku} from wishlist` : `Retirer ${p.sku} des favoris`}
              className="absolute top-2 right-2 w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm border border-border text-[#B37D10] flex items-center justify-center hover:bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838] focus-visible:ring-offset-1"
            >
              <Heart size={14} className="fill-[#E8A838]" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
