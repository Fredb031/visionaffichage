import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Share2, Check, ShoppingCart, Trash2 } from 'lucide-react';
import { useLang } from '@/lib/langContext';
import { PRODUCTS } from '@/data/products';
import { categoryLabel } from '@/lib/productLabels';
import { useWishlist } from '@/hooks/useWishlist';
import { useCartStore } from '@/stores/localCartStore';
import { plural } from '@/lib/plural';
import { toWebp } from '@/lib/toWebp';
import type { CartItemCustomization } from '@/types/customization';

type SortKey = 'recent' | 'name' | 'price-asc' | 'price-desc';

/**
 * Show the customer's wishlist as a small grid. An empty state is now
 * rendered in place of the silent `return null` the component used to
 * emit — the Account page is the only caller today and the empty block
 * is a better nudge than a vanishing section.
 */
export function WishlistGrid({ limit = 6 }: { limit?: number }) {
  const { lang } = useLang();
  const { handles, toggle } = useWishlist();
  const cartAddItem = useCartStore(s => s.addItem);
  // 'idle' | 'shared' | 'copied' | 'failed' — distinguish the native
  // share-sheet path (SMS / email / Messages) from the clipboard
  // fallback. Saying "Copied!" after the user actually emailed their
  // wishlist to a coworker was a small but real UX lie.
  const [shareState, setShareState] = useState<'idle' | 'shared' | 'copied' | 'failed'>('idle');
  const shareTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [addedAll, setAddedAll] = useState(false);
  const addedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sort, setSort] = useState<SortKey>('recent');
  useEffect(() => () => {
    if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
    if (addedTimerRef.current) clearTimeout(addedTimerRef.current);
  }, []);

  // Resolve handles to product records, preserving insertion order
  // (useWishlist prepends on toggle, so the first handle is the most
  // recently added). This ordering feeds the 'recent' sort's tie-break.
  const resolved = useMemo(
    () => handles
      .map(h => PRODUCTS.find(p => p.shopifyHandle === h))
      .filter((p): p is NonNullable<typeof p> => Boolean(p)),
    [handles],
  );

  // Stable sort — we decorate with the original index so ties preserve
  // insertion order. The wishlist hook doesn't track a date, so 'recent'
  // falls back to the raw handles order (newest prepended).
  const sorted = useMemo(() => {
    const decorated = resolved.map((p, i) => ({ p, i }));
    const cmp = (a: { p: typeof resolved[number]; i: number }, b: { p: typeof resolved[number]; i: number }) => {
      let diff = 0;
      if (sort === 'name') {
        const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
        diff = categoryLabel(a.p.category, lang).localeCompare(categoryLabel(b.p.category, lang), locale);
      } else if (sort === 'price-asc') {
        diff = a.p.basePrice - b.p.basePrice;
      } else if (sort === 'price-desc') {
        diff = b.p.basePrice - a.p.basePrice;
      }
      // Stable fallback: original array index. For 'recent' this is the
      // only comparator so newest-first (index 0) wins naturally.
      return diff !== 0 ? diff : a.i - b.i;
    };
    return decorated.sort(cmp).map(d => d.p);
  }, [resolved, sort, lang]);

  const items = sorted.slice(0, limit);

  // Empty state — replaces the old `return null`. Centered Heart with
  // a CTA back to /products keeps the Account page from dead-ending
  // when a customer hasn't liked anything yet.
  if (resolved.length === 0) {
    return (
      <section
        className="bg-white border border-border rounded-2xl p-6 mt-5 text-center"
        aria-labelledby="wishlist-heading"
      >
        <h2 id="wishlist-heading" className="sr-only">
          {lang === 'en' ? 'Your wishlist' : 'Ta wishlist'}
        </h2>
        <Heart size={40} className="text-zinc-300 mx-auto mb-3" aria-hidden="true" />
        <div className="font-bold text-base text-foreground mb-1">
          {lang === 'en' ? 'Your wishlist is empty' : 'Ta wishlist est vide'}
        </div>
        <div className="text-sm text-muted-foreground mb-4">
          {lang === 'en'
            ? 'Tap the \u2665 on any product to save it.'
            : 'Appuie sur le \u2665 sur un produit pour l\u2019ajouter.'}
        </div>
        <Link
          to="/products"
          className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground font-bold text-sm px-5 py-2.5 rounded-full hover:bg-primary/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {lang === 'en' ? 'Browse products' : 'Voir les produits'}
        </Link>
      </section>
    );
  }

  const shareWishlist = async () => {
    // Build a compact shareable payload: one line per product with
    // the fully-qualified URL so the recipient can click through.
    // typeof window guard because PRODUCTS can be imported in SSR paths.
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://visionaffichage.com';
    const header = lang === 'en'
      ? `My Vision Affichage wishlist (${plural(items.length, { one: '{count} product', other: '{count} products' }, 'en')}):`
      : `Ma liste Vision Affichage (${plural(items.length, { one: '{count} produit', other: '{count} produits' }, 'fr')}) :`;
    const body = items
      .map(p => `\u2022 ${categoryLabel(p.category, lang)} (${p.sku}) \u2014 ${origin}/product/${p.shopifyHandle}`)
      .join('\n');
    const text = `${header}\n${body}`;
    let nextState: 'shared' | 'copied' | 'failed' = 'failed';
    try {
      // Prefer the native share sheet on mobile. Falls back to the
      // clipboard on desktop where navigator.share is undefined.
      // Track which path ran so the confirmation text matches what
      // the user actually did — "Copied!" after a real send via the
      // share sheet would be misleading.
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ text, title: lang === 'en' ? 'My Vision Affichage wishlist' : 'Ma liste Vision Affichage' });
        nextState = 'shared';
      } else if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        nextState = 'copied';
      }
    } catch (err) {
      // AbortError fires when the user dismisses the share sheet —
      // not a failure, just a no-op from the user's perspective.
      if ((err as Error)?.name === 'AbortError') return;
      // silent
    }
    setShareState(nextState);
    if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
    shareTimerRef.current = setTimeout(() => {
      setShareState('idle');
      shareTimerRef.current = null;
    }, 2000);
  };

  // Bulk "Add all" — creates a minimal CartItemCustomization per saved
  // product: default colour (first swatch), single unit of the first
  // listed size, no logo/text. Customers can refine in the customizer
  // from the cart row; the intent here is to stop making them revisit
  // every product page to bulk-order their saved list.
  const addAllToCart = () => {
    for (const p of resolved) {
      const defaultColorId = p.colors[0]?.id ?? null;
      const defaultSize = p.sizes[0] ?? 'OS';
      const unitPrice = p.basePrice;
      const payload: Omit<CartItemCustomization, 'cartId' | 'addedAt'> = {
        productId: p.id,
        productName: categoryLabel(p.category, lang),
        colorId: defaultColorId,
        logoPlacement: null,
        logoPlacementBack: null,
        placementSides: 'none',
        textAssets: [],
        sizeQuantities: [{ size: defaultSize, quantity: 1 }],
        activeView: 'front',
        step: 3,
        previewSnapshot: p.imageDevant ?? '',
        unitPrice,
        totalQuantity: 1,
        totalPrice: parseFloat(unitPrice.toFixed(2)),
      };
      cartAddItem(payload);
    }
    setAddedAll(true);
    if (addedTimerRef.current) clearTimeout(addedTimerRef.current);
    addedTimerRef.current = setTimeout(() => {
      setAddedAll(false);
      addedTimerRef.current = null;
    }, 2000);
  };

  const clearWishlist = () => {
    const msg = lang === 'en'
      ? 'Remove all products from your wishlist?'
      : 'Supprimer tous les produits de ta wishlist ?';
    if (typeof window === 'undefined' || !window.confirm(msg)) return;
    // useWishlist exposes toggle() — calling it on an already-saved
    // handle removes it. Snapshot handles first so we iterate a stable
    // list instead of a React-state array that mutates under us.
    for (const h of [...handles]) toggle(h);
  };

  const sortLabel = lang === 'en' ? 'Sort' : 'Trier';
  const sortOptions: Array<{ value: SortKey; label: string }> = [
    { value: 'recent',     label: lang === 'en' ? 'Most recent'     : 'Plus r\u00e9cent' },
    { value: 'name',       label: lang === 'en' ? 'Name A-Z'        : 'Nom A-Z' },
    { value: 'price-asc',  label: lang === 'en' ? 'Price ascending' : 'Prix croissant' },
    { value: 'price-desc', label: lang === 'en' ? 'Price descending': 'Prix d\u00e9croissant' },
  ];

  return (
    <section className="bg-white border border-border rounded-2xl p-5 mt-5" aria-labelledby="wishlist-heading">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h2 id="wishlist-heading" className="font-bold text-base flex items-center gap-2">
          <Heart size={16} className="text-[#E8A838] fill-[#E8A838]" aria-hidden="true" />
          {lang === 'en' ? 'Saved products' : 'Produits enregistr\u00e9s'}
          <span className="text-xs font-normal text-muted-foreground">({handles.length})</span>
        </h2>
        <button
          type="button"
          onClick={shareWishlist}
          aria-live="polite"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 rounded-full hover:border-muted-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
        >
          {shareState === 'shared' ? (
            <>
              <Check size={12} className="text-emerald-600" aria-hidden="true" />
              {lang === 'en' ? 'Shared!' : 'Partag\u00e9 !'}
            </>
          ) : shareState === 'copied' ? (
            <>
              <Check size={12} className="text-emerald-600" aria-hidden="true" />
              {lang === 'en' ? 'Copied!' : 'Copi\u00e9 !'}
            </>
          ) : shareState === 'failed' ? (
            <>
              <Share2 size={12} aria-hidden="true" />
              {lang === 'en' ? 'Copy blocked' : 'Copie bloqu\u00e9e'}
            </>
          ) : (
            <>
              <Share2 size={12} aria-hidden="true" />
              {lang === 'en' ? 'Share' : 'Partager'}
            </>
          )}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <label className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground">
          {sortLabel}
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortKey)}
            className="text-xs font-semibold text-foreground bg-background border border-border rounded-full px-3 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          >
            {sortOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={addAllToCart}
            aria-live="polite"
            className="inline-flex items-center gap-1.5 text-xs font-bold bg-primary text-primary-foreground px-3 py-1.5 rounded-full hover:bg-primary/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          >
            {addedAll ? (
              <>
                <Check size={12} aria-hidden="true" />
                {lang === 'en' ? 'Added' : 'Ajout\u00e9'}
              </>
            ) : (
              <>
                <ShoppingCart size={12} aria-hidden="true" />
                {lang === 'en' ? 'Add all to cart' : 'Tout ajouter au panier'}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={clearWishlist}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-destructive border border-border px-3 py-1.5 rounded-full hover:border-destructive/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-1"
          >
            <Trash2 size={12} aria-hidden="true" />
            {lang === 'en' ? 'Clear wishlist' : 'Vider la wishlist'}
          </button>
        </div>
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
              </div>
              <div className="p-2.5">
                <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/60 truncate">
                  {p.sku}
                </div>
                <div className="text-[13px] font-extrabold text-foreground truncate">
                  {categoryLabel(p.category, lang)}
                </div>
                <div className="text-[11px] text-primary font-bold mt-0.5">
                  {/* Use the locale's currency formatter so 'fr-CA' renders
                      '27,54\u00a0$' with a non-breaking space — a regular
                      space lets the amount wrap away from the '$' on narrow
                      tiles. style:'currency' + currency:'CAD' also fixes the
                      decimal separator (',' vs '.') in one shot. */}
                  {lang === 'en' ? 'From' : '\u00c0 partir de'}{'\u00a0'}
                  {p.basePrice.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', {
                    style: 'currency',
                    currency: 'CAD',
                    currencyDisplay: 'narrowSymbol',
                  })}
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
