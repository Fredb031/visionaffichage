/**
 * CompareBar — Volume II §15.1.
 *
 * Sticky bottom bar that slides up once 2+ items are selected. Shows
 * thumbnail + name + remove × per slot, plus a primary CTA that
 * navigates to /comparer. Hidden below 2 items so the user doesn't
 * see a one-product "compare" state that has nothing to compare against.
 *
 * Mounted at App root so it persists across routes — selecting from
 * /products and clicking through to a PDP keeps the bar visible.
 * Hides itself on /comparer (the page already shows the same data
 * inline; no need to double up).
 */
import { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { useCompareStore } from '@/lib/compareStore';
import { PRODUCTS } from '@/data/products';
import { useLang } from '@/lib/langContext';
import { categoryLabel } from '@/lib/productLabels';
import { toWebp } from '@/lib/toWebp';

export function CompareBar() {
  const { lang } = useLang();
  const navigate = useNavigate();
  const location = useLocation();
  const items = useCompareStore(s => s.items);
  const remove = useCompareStore(s => s.remove);
  const clear = useCompareStore(s => s.clear);

  // Memoize the SKU → product resolution so a parent re-render (route
  // change firing the location hook, language toggle, etc.) doesn't redo
  // an O(items × PRODUCTS) find-walk. The compare store is stable per
  // selection, so the dep is the items array reference itself.
  //
  // CRITICAL: this hook MUST run before any early-return below. Calling
  // useMemo after `if (items.length < 2) return null` made the number of
  // hooks invoked depend on the items count — when the store flipped from
  // 2 items back to 1 (user removing the last comparison), React would
  // see "rendered fewer hooks than previous render" and crash the entire
  // app shell since CompareBar is mounted at App root. Same hooks-after-
  // early-return class as CapacityWidget + CartRecommendations.
  const products = useMemo(
    () =>
      items
        .map(sku => PRODUCTS.find(p => p.sku === sku))
        .filter((p): p is NonNullable<typeof p> => Boolean(p)),
    [items],
  );

  // Only render once 2+ items so we never show a useless one-item bar.
  if (items.length < 2) return null;
  // Already on /comparer — the page itself is the comparator surface,
  // a sticky bar over it would be redundant chrome.
  if (location.pathname === '/comparer') return null;

  // Stale localStorage may hold SKUs no longer in PRODUCTS; if resolution
  // drops us below 2, the bar has nothing meaningful to compare.
  if (products.length < 2) return null;

  const compareLabel = lang === 'en' ? `Compare (${products.length})` : `Comparer (${products.length})`;
  const clearLabel = lang === 'en' ? 'Clear' : 'Effacer';
  const countAnnouncement = lang === 'en'
    ? `${products.length} products being compared`
    : `${products.length} produits comparés`;

  return (
    <div
      role="region"
      aria-label={lang === 'en' ? 'Product comparison bar' : 'Barre de comparaison produits'}
      className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur-md shadow-[0_-8px_24px_rgba(27,58,107,0.12)]"
    >
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {countAnnouncement}
      </div>
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          {products.map(p => {
            const name = categoryLabel(p.category, lang);
            return (
              <div
                key={p.sku}
                className="flex items-center gap-2 bg-secondary rounded-full pr-2 pl-1 py-1 border border-border"
              >
                <picture>
                  <source srcSet={toWebp(p.imageDevant)} type="image/webp" />
                  <img
                    src={p.imageDevant}
                    alt={p.shortName}
                    width={32}
                    height={32}
                    loading="lazy"
                    decoding="async"
                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                    onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                  />
                </picture>
                <span className="text-[11px] font-bold text-foreground truncate max-w-[110px]">
                  {name}
                </span>
                <button
                  type="button"
                  onClick={() => remove(p.sku)}
                  aria-label={lang === 'en'
                    ? `Remove ${p.shortName} from compare`
                    : `Retirer ${p.shortName} de la comparaison`}
                  className="w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-border/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={clear}
            className="text-[11px] font-bold text-muted-foreground hover:text-foreground px-3 py-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {clearLabel}
          </button>
          <button
            type="button"
            onClick={() => navigate('/comparer')}
            className="text-[12px] font-extrabold px-5 py-2 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {compareLabel} →
          </button>
        </div>
      </div>
    </div>
  );
}
