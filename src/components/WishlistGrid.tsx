import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Share2, Check } from 'lucide-react';
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
  // 'idle' | 'copied' | 'failed' — mirrors the AdminImageGen clipboard
  // pattern so failures surface instead of silently no-op'ing when the
  // browser blocks clipboard access (iframe, insecure context, Safari
  // private mode).
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const shareTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
  }, []);

  const items = handles
    .map(h => PRODUCTS.find(p => p.shopifyHandle === h))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .slice(0, limit);

  if (items.length === 0) return null;

  const shareWishlist = async () => {
    // Build a compact shareable payload: one line per product with
    // the fully-qualified URL so the recipient can click through.
    // typeof window guard because PRODUCTS can be imported in SSR paths.
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://visionaffichage.com';
    const header = lang === 'en'
      ? `My Vision Affichage wishlist (${items.length} product${items.length !== 1 ? 's' : ''}):`
      : `Ma liste Vision Affichage (${items.length} produit${items.length !== 1 ? 's' : ''}) :`;
    const body = items
      .map(p => `• ${categoryLabel(p.category, lang)} (${p.sku}) — ${origin}/product/${p.shopifyHandle}`)
      .join('\n');
    const text = `${header}\n${body}`;
    let ok = false;
    try {
      // Prefer the native share sheet on mobile. Falls back to the
      // clipboard on desktop where navigator.share is undefined —
      // both paths end at the same visible "copied/shared" indicator.
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ text, title: lang === 'en' ? 'My Vision Affichage wishlist' : 'Ma liste Vision Affichage' });
        ok = true;
      } else if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch (err) {
      // AbortError fires when the user dismisses the share sheet —
      // not a failure, just a no-op from the user's perspective.
      if ((err as Error)?.name === 'AbortError') return;
      console.warn('[WishlistGrid] share failed:', err);
    }
    setShareState(ok ? 'copied' : 'failed');
    if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
    shareTimerRef.current = setTimeout(() => {
      setShareState('idle');
      shareTimerRef.current = null;
    }, 2000);
  };

  return (
    <section className="bg-white border border-border rounded-2xl p-5 mt-5" aria-labelledby="wishlist-heading">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h2 id="wishlist-heading" className="font-bold text-base flex items-center gap-2">
          <Heart size={16} className="text-[#E8A838] fill-[#E8A838]" aria-hidden="true" />
          {lang === 'en' ? 'Saved products' : 'Produits enregistrés'}
          <span className="text-xs font-normal text-muted-foreground">({handles.length})</span>
        </h2>
        <button
          type="button"
          onClick={shareWishlist}
          aria-live="polite"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 rounded-full hover:border-muted-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
        >
          {shareState === 'copied' ? (
            <>
              <Check size={12} className="text-emerald-600" aria-hidden="true" />
              {lang === 'en' ? 'Copied!' : 'Copié !'}
            </>
          ) : shareState === 'failed' ? (
            <>
              <Share2 size={12} aria-hidden="true" />
              {lang === 'en' ? 'Copy blocked' : 'Copie bloquée'}
            </>
          ) : (
            <>
              <Share2 size={12} aria-hidden="true" />
              {lang === 'en' ? 'Share' : 'Partager'}
            </>
          )}
        </button>
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
                    onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
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
