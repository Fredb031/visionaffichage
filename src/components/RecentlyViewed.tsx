import { Link } from 'react-router-dom';
import { History } from 'lucide-react';
import { useLang } from '@/lib/langContext';
import { PRODUCTS } from '@/data/products';
import { categoryLabel } from '@/lib/productLabels';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';

// Storage key + same-tab sync event must match useRecentlyViewed.ts.
// Duplicated here because the hook doesn't expose a clear() method —
// rather than widen the hook's public surface for a single consumer,
// we clear localStorage directly and broadcast the same custom event
// the hook already listens for so every mounted instance re-reads and
// drops the list in the same tick.
const STORAGE_KEY = 'vision-recently-viewed';
const SAME_TAB_EVENT = 'vision-recently-viewed-change';

/**
 * Shows up to 8 of the user's most-recently-viewed products. Used on
 * the cart empty state as a gentle prompt ('here's what you were
 * looking at, want to keep going?'). Renders nothing if the user
 * hasn't viewed any products yet.
 *
 * The default display cap (8) matches the hook's internal MAX, but we
 * keep the cap at the component level rather than trusting the hook's
 * slice — a future consumer might want the full history for analytics
 * or a compact bubble for the navbar, and clamping here leaves the
 * hook's behaviour untouched.
 */
export function RecentlyViewed({ limit = 8 }: { limit?: number }) {
  const { lang } = useLang();
  const { handles } = useRecentlyViewed();

  const items = handles
    .map(h => PRODUCTS.find(p => p.shopifyHandle === h))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .slice(0, limit);

  if (items.length === 0) return null;

  // Clear the persisted history after a confirm prompt. The hook
  // exposes no clear()/remove() today, so we wipe localStorage and
  // dispatch the hook's same-tab event — every mounted instance of
  // useRecentlyViewed re-reads storage on that event and flips to an
  // empty array, which collapses this section (items.length === 0
  // returns null) on the same render pass.
  const handleClear = () => {
    const msg = lang === 'en'
      ? 'Clear recently viewed products?'
      : 'Effacer les produits récemment consultés ?';
    if (!window.confirm(msg)) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* private mode */ }
    try { window.dispatchEvent(new CustomEvent(SAME_TAB_EVENT)); } catch { /* noop */ }
  };

  return (
    // Use aria-labelledby pointing to the visible h3 instead of a
    // redundant aria-label. With both set, screen readers announce
    // the region label and then re-announce the same heading text on
    // next move — duplicated "Recently viewed" / "Vus récemment".
    // Matching WishlistGrid's labelledby pattern keeps the region
    // named while letting the heading serve as its sole label.
    <section className="mt-10" aria-labelledby="recently-viewed-heading">
      <div className="flex items-center gap-2 mb-4 justify-center relative">
        <History size={14} className="text-muted-foreground" aria-hidden="true" />
        <h3 id="recently-viewed-heading" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {lang === 'en' ? 'Recently viewed' : 'Vus récemment'}
        </h3>
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-0 text-[10px] font-medium text-muted-foreground hover:text-foreground underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] rounded px-1"
        >
          {lang === 'en' ? 'Clear history' : "Effacer l'historique"}
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map(p => (
          <Link
            key={p.sku}
            to={`/product/${p.shopifyHandle}`}
            className="group block bg-background rounded-xl overflow-hidden border border-border hover:border-primary/30 hover:shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
                  onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                />
              )}
            </div>
            <div className="p-2">
              <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/60 truncate">
                {p.sku}
              </div>
              <div className="text-[12px] font-extrabold text-foreground truncate">
                {categoryLabel(p.category, lang)}
              </div>
              <div className="text-[10px] text-primary font-bold mt-0.5 truncate">
                {/* Mirror WishlistGrid: locale-aware price so the French build
                    renders '27,54 $' rather than '27.54 $'. Showing the price
                    here turns the strip from a bare thumbnail row into an
                    actual re-engagement prompt — the cart empty-state isn't
                    just 'you looked at this' but 'you looked at this, here's
                    what it costs, still want it?'. */}
                {lang === 'en' ? 'From' : 'À partir de'}{' '}
                {p.basePrice.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} $
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
