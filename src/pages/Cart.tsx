import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { CartDrawer } from '@/components/CartDrawer';
import { useCartStore } from '@/stores/localCartStore';
import { useCartStore as useShopifyCartStore } from '@/stores/cartStore';
import { useLang } from '@/lib/langContext';
import { Trash2, ShoppingCart, ArrowLeft, Lock, Tag, XCircle, ShieldCheck, MapPin, Minus, Plus, BookmarkPlus, Link2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { getSettings } from '@/lib/appSettings';
import { AIChat } from '@/components/AIChat';
import { CartRecommendations } from '@/components/CartRecommendations';
import { DeliveryBadge } from '@/components/DeliveryBadge';
import { RecentlyViewed } from '@/components/RecentlyViewed';
import { PRODUCTS, type Product } from '@/data/products';
import { categoryLabel } from '@/lib/productLabels';
import { readLS, writeLS } from '@/lib/storage';
import { plural } from '@/lib/plural';
import type { CartItemCustomization } from '@/types/customization';

// Task 5.2 — match-style cross-sell. Generic "also bought" rows are
// noise for a merch cart: what actually helps a company putting
// together a kit is category-coherent pairings (hoodies round out
// with a cap + a tee, tees round out with a hoodie + a cap, etc.).
// The map is keyed by the DOMINANT category in the cart and lists the
// SKUs of the recommended partners in priority order. Keep this small
// and editable — swapping a SKU here is the whole tuning surface.
const crossSellMap: Record<string, string[]> = {
  hoodie: ['ATC6606', 'ATC1000'],   // cap + tee
  tshirt: ['ATCF2500', 'ATC6606'],   // hoodie + cap
  cap: ['ATC1000', 'ATCF2500'],      // tee + hoodie
  polo: ['ATC6606', 'S445LS'],       // cap + long-sleeve polo
};

// Save-for-later list persisted independently of the active cart so it
// survives an "empty cart" click and a Shopify-side sync clear. Same
// shape as cart items so a restore is a straight re-insert with a
// fresh cartId (addItem regenerates it). 20-item cap keeps the
// localStorage footprint bounded on buyers who park a lot of
// candidates — we drop the OLDEST entry on overflow (FIFO) so the
// most recently parked item is always kept.
const SAVED_FOR_LATER_KEY = 'vision-saved-for-later';
const SAVED_FOR_LATER_CAP = 20;

// Task 5.7 — the hint list for the promo-code autocomplete. Drawn from
// the same settings bag applyDiscount() resolves against so an admin
// who adds VISION25 via /admin/settings sees it suggested too, but we
// restrict to codes whose name starts with the public "VISION" prefix
// so a private/staff code the owner set up (e.g. PRESSE2025) never
// surfaces on the storefront. Threshold copy is static — the rate is
// live, the "10+/15+/20+" units hint is a convention we ship with.
export function getPublicPromoHints(): Array<{ code: string; rate: number; threshold: number }> {
  let codes: Record<string, number>;
  try { codes = getSettings().discountCodes ?? {}; } catch { codes = {}; }
  const hints: Array<{ code: string; rate: number; threshold: number }> = [];
  for (const [code, rate] of Object.entries(codes)) {
    if (!code.startsWith('VISION')) continue;
    if (typeof rate !== 'number' || !(rate > 0)) continue;
    // Pull the trailing digits off "VISION10" → 10 as the threshold.
    // Falls back to Math.round(rate * 100) so a "VISIONFLASH" sale-code
    // still renders a plausible number instead of NaN/"+".
    const m = code.match(/(\d+)$/);
    const threshold = m ? parseInt(m[1], 10) : Math.round(rate * 100);
    hints.push({ code, rate, threshold });
  }
  // Sort by rate ascending so the lowest-barrier code is the first
  // suggestion — matches the way the admin table shows them and the
  // way buyers read a ladder (10 → 15 → 20).
  hints.sort((a, b) => a.rate - b.rate);
  return hints;
}

function PromoCodeInput({
  onApply,
  placeholder,
  applyLabel,
  invalidLabel,
}: {
  onApply: (code: string) => boolean;
  placeholder: string;
  applyLabel: string;
  invalidLabel: string;
}) {
  const { lang } = useLang();
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [focused, setFocused] = useState(false);
  // -1 === nothing highlighted; ArrowDown from the text input picks
  // index 0 on first press. Reset whenever the suggestion list shape
  // changes so a stale index can't point past the array.
  const [activeIdx, setActiveIdx] = useState(-1);
  // Ref-tracked so parent unmount + rapid re-submit don't leak / fight.
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Dismiss the popover when focus moves fully out of the wrapper —
  // but we can't use onBlur on the input alone because clicking a
  // suggestion would race-fire blur before the click lands.
  const wrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  const hints = getPublicPromoHints();
  const trimmed = code.trim().toUpperCase();
  const suggestions = hints.filter(h => !trimmed || h.code.startsWith(trimmed));
  const showSuggestions = focused && suggestions.length > 0 && (trimmed === '' || !suggestions.some(s => s.code === trimmed));

  const submit = (override?: string) => {
    const raw = (override ?? code).trim();
    if (!raw) return;
    const ok = onApply(raw);
    if (!ok) {
      setError(true);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => {
        setError(false);
        errorTimerRef.current = null;
      }, 2500);
    } else {
      setCode('');
      setActiveIdx(-1);
    }
  };

  const pickSuggestion = (codeStr: string) => {
    // Fill the input for visual confirmation then immediately apply —
    // if applyDiscount fails for a suggestion (settings race), the
    // error surface still shows so the user isn't left guessing.
    setCode(codeStr);
    setActiveIdx(-1);
    submit(codeStr);
  };

  return (
    <div className="space-y-1" ref={wrapperRef} onBlur={e => {
      // Popover visibility hinges on focused — close only when focus
      // actually leaves the wrapper (clicking a suggestion keeps focus
      // inside it, so the click lands before we close).
      if (!wrapperRef.current?.contains(e.relatedTarget as Node | null)) {
        setFocused(false);
        setActiveIdx(-1);
      }
    }}>
      <div className="relative flex items-center gap-1.5">
        <Tag size={13} className="text-muted-foreground flex-shrink-0" aria-hidden="true" />
        <input
          type="text"
          value={code}
          onChange={e => { setCode(e.target.value.toUpperCase()); setError(false); setActiveIdx(-1); }}
          onFocus={() => setFocused(true)}
          onKeyDown={e => {
            if (e.key === 'ArrowDown' && showSuggestions) {
              e.preventDefault();
              setActiveIdx(i => Math.min(suggestions.length - 1, i + 1));
            } else if (e.key === 'ArrowUp' && showSuggestions) {
              e.preventDefault();
              setActiveIdx(i => Math.max(-1, i - 1));
            } else if (e.key === 'Escape' && showSuggestions) {
              // Just hide the popover; don't clobber what the user typed.
              setFocused(false);
              setActiveIdx(-1);
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (showSuggestions && activeIdx >= 0 && activeIdx < suggestions.length) {
                pickSuggestion(suggestions[activeIdx].code);
              } else {
                submit();
              }
            }
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-invalid={error || undefined}
          aria-autocomplete="list"
          aria-expanded={showSuggestions}
          aria-controls="promo-suggestions-cart"
          aria-activedescendant={
            showSuggestions && activeIdx >= 0 && activeIdx < suggestions.length
              ? `promo-sugg-cart-${suggestions[activeIdx].code}`
              : undefined
          }
          role="combobox"
          autoComplete="off"
          className={`flex-1 bg-secondary border rounded-lg px-2.5 py-1.5 text-xs uppercase tracking-wider outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/25 ${
            error ? 'border-rose-300 focus:border-rose-500' : 'border-border focus:border-primary'
          }`}
        />
        <button
          type="button"
          onClick={() => submit()}
          disabled={!code.trim()}
          className="px-3 py-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-lg hover:opacity-90 disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
        >
          {applyLabel}
        </button>
        {showSuggestions && (
          <ul
            id="promo-suggestions-cart"
            role="listbox"
            aria-label={lang === 'en' ? 'Public promo codes' : 'Codes promo publics'}
            className="absolute left-0 right-0 top-full mt-1 z-20 bg-card border border-border rounded-lg shadow-lg overflow-hidden"
          >
            {suggestions.map((s, idx) => {
              const ratePct = Math.round(s.rate * 100);
              const thresholdLabel = lang === 'en'
                ? `${ratePct}% off (${s.threshold}+ units)`
                : `${ratePct} % off (${s.threshold}+ unités)`;
              const active = idx === activeIdx;
              return (
                <li
                  key={s.code}
                  id={`promo-sugg-cart-${s.code}`}
                  role="option"
                  aria-selected={active}
                >
                  <button
                    type="button"
                    // onMouseDown so the click fires BEFORE the input's
                    // blur tears the popover down. Using onClick alone
                    // races with the wrapper onBlur and swallows picks.
                    onMouseDown={e => { e.preventDefault(); pickSuggestion(s.code); }}
                    onMouseEnter={() => setActiveIdx(idx)}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-xs transition-colors ${
                      active ? 'bg-[#E8A838]/15 text-foreground' : 'hover:bg-secondary text-foreground'
                    }`}
                  >
                    <span className="font-mono font-extrabold tracking-wider">{s.code}</span>
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      {thresholdLabel}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {error && (
        <p className="text-[10px] text-rose-600 font-semibold pl-5" role="alert">{invalidLabel}</p>
      )}
    </div>
  );
}
import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';

/**
 * Cart page — uses the LOCAL cart store as the single source of truth.
 *
 * The local store (src/store/cartStore.ts) is what CartDrawer, Navbar badge,
 * and ProductCustomizer all write to. The Shopify store (src/stores/cartStore.ts)
 * is only called at checkout time to create a Shopify cart and get a checkoutUrl.
 *
 * Previous bug: this page was reading from the Shopify store while everything
 * else wrote to the local store → the cart page showed different items.
 */
export default function Cart() {
  const { lang } = useLang();
  const navigate = useNavigate();
  const { items, addItem, removeItem, updateItemQuantity, rollbackItem, getTotal, getItemCount, discountCode, discountApplied, applyDiscount, clearDiscount, clear } = useCartStore();
  const shopifyCart = useShopifyCartStore();
  const [cartOpen, setCartOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  // Per-row in-flight flag so rapid +/- clicks can't race against each
  // other (the Shopify mutation is async — the 2nd click would see a
  // stale post-optimistic snapshot as "truth" and mask the 1st failure).
  // Also used to disable the buttons + dim the row while the background
  // sync is inflight so the user sees something is happening.
  const [pendingRows, setPendingRows] = useState<Record<string, boolean>>({});

  // "Copier le lien du panier" — lets shoppers park the URL to come
  // back later or forward it to a colleague. Writes window.location.href
  // to the clipboard and flips the label to "Copié" for 2s so they have
  // visible confirmation. Falls back silently on environments where the
  // Clipboard API is unavailable (old browsers, insecure contexts) — we
  // toast an error instead of throwing so the page keeps working.
  const [linkCopied, setLinkCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);
  const handleCopyCartLink = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (!url) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Legacy fallback for insecure contexts — a throwaway textarea
        // + execCommand('copy') still works where navigator.clipboard
        // is gated. Best-effort only; we don't care if it no-ops.
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch { /* ignore */ }
        document.body.removeChild(ta);
      }
      setLinkCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => {
        setLinkCopied(false);
        copyTimerRef.current = null;
      }, 2000);
    } catch (e) {
      console.warn('Cart link copy failed', e);
      toast.error(
        lang === 'en' ? 'Couldn\u2019t copy link' : 'Impossible de copier le lien',
        { duration: 2500 },
      );
    }
  };

  // Saved-for-later list. Hydrated from localStorage on mount + written
  // back on every mutation so it survives a refresh and a cart clear.
  // We treat the in-memory array as the source of truth during the
  // session; readLS is only used for the initial hydration.
  const [savedItems, setSavedItems] = useState<CartItemCustomization[]>(
    () => {
      const raw = readLS<CartItemCustomization[]>(SAVED_FOR_LATER_KEY, []);
      return Array.isArray(raw) ? raw.filter(it => it && typeof it.cartId === 'string' && it.cartId) : [];
    },
  );
  useEffect(() => {
    writeLS(SAVED_FOR_LATER_KEY, savedItems);
  }, [savedItems]);

  const totalPrice = getTotal();
  const totalQty = getItemCount();

  // Match the locale-aware money formatting used on FeaturedProducts /
  // WishlistGrid / ProductDetailBulkCalc so French users see "27,54 $"
  // (comma decimal) instead of "27.54 $" on the cart page. Plain
  // .toFixed() is locale-blind and makes the cart the odd page out.
  const fmtMoney = (n: number) =>
    (Number.isFinite(n) ? n : 0).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  // Section 09 — copy spec calls for "Panier | Vision Affichage". We keep
  // the live item-count prefix so a buyer with multiple tabs open can
  // still see at a glance which one holds their cart, but the rest of
  // the title now matches the brand-voice phrasing the rest of the app
  // routes through useDocumentTitle for.
  useEffect(() => {
    const prev = document.title;
    const count = totalQty > 0 ? ` (${totalQty})` : '';
    document.title = lang === 'en'
      ? `Cart${count} | Vision Affichage`
      : `Panier${count} | Vision Affichage`;
    return () => { document.title = prev; };
  }, [lang, totalQty]);

  // Track the safety-net timer so the normal path (navigate unmounts
  // this component within a few ms) doesn't fire setCheckingOut on a
  // dead component and trigger the React dev warning.
  const checkoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (checkoutTimerRef.current) clearTimeout(checkoutTimerRef.current);
    };
  }, []);

  const handleCheckout = () => {
    // Flip the disabled state on the button so rapid double-clicks don't
    // queue multiple navigations while the browser is transitioning.
    setCheckingOut(true);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    // SPA navigation — avoid the full page reload window.location.href
    // would trigger (re-parsing HTML, re-running vite chunks the
    // browser already has cached, losing in-memory stores).
    navigate('/checkout');
    // If the route guard or some other middleware blocks the
    // navigation (very rare but possible with experimental router
    // configs), the button would stay disabled forever. 2s safety
    // net to release it.
    if (checkoutTimerRef.current) clearTimeout(checkoutTimerRef.current);
    checkoutTimerRef.current = setTimeout(() => {
      setCheckingOut(false);
      checkoutTimerRef.current = null;
    }, 2000);
  };

  // Remove from BOTH local + Shopify cart so Shopify checkout reflects the
  // user's actual basket. Without this, deleted items still appear at pay.
  //
  // Don't drop a Shopify line if another local cart row still references
  // the same variantId (happens when the same colour+size is customized
  // twice with different placements) — the sibling row would end up with
  // nothing on the Shopify side and the customer would be charged zero
  // for it at checkout.
  //
  // Read LIVE store state via getState after the local removal so a
  // second rapid click doesn't see a stale snapshot and skip Shopify
  // removals the first click already committed to dropping.
  const handleRemoveItem = async (cartId: string) => {
    const item = useCartStore.getState().items.find(i => i.cartId === cartId);
    removeItem(cartId);
    const vids = item?.shopifyVariantIds ?? [];
    if (vids.length === 0) return;
    const stillReferenced = new Set<string>();
    for (const other of useCartStore.getState().items) {
      for (const v of other.shopifyVariantIds ?? []) stillReferenced.add(v);
    }
    for (const variantId of vids) {
      if (stillReferenced.has(variantId)) continue;
      try { await shopifyCart.removeItem(variantId); } catch (e) { console.warn('Shopify cart removeItem failed', e); }
    }
  };

  // Optimistic quantity update on a cart row.
  //
  // 1. Snapshot the row (so we can revert on failure).
  // 2. Scale sizeQuantities + totalPrice locally so the UI reflects
  //    the change instantly — the user sees the number tick up/down
  //    and the total recomputes with zero latency, which is the whole
  //    point of optimistic UI.
  // 3. Fire the Shopify sync in the background for each variant that
  //    backs this row, scaling each variant's Shopify quantity by the
  //    same ratio so the Size×Color breakdown stays consistent at
  //    checkout.
  // 4. On ANY Shopify failure (network drop, userError, cart-not-found
  //    that wasn't auto-recovered), revert the local row to the
  //    snapshot AND toast the user so they know their change didn't
  //    stick — otherwise they'd click Checkout and be surprised by a
  //    different total on Shopify's side.
  const handleQuantityChange = async (cartId: string, delta: number) => {
    // Guard against double-clicks while a sync is in flight for this
    // row. The optimistic update is still committed instantly, but
    // stacking mutations on the same variant races the per-variant
    // in-flight queue in stores/cartStore.ts and can silently clobber
    // each other's intended quantity.
    if (pendingRows[cartId]) return;
    const snapshot = useCartStore.getState().items.find(i => i.cartId === cartId);
    if (!snapshot) return;
    const currentTotal = Math.max(1, snapshot.totalQuantity || 1);
    const nextTotal = Math.max(0, currentTotal + delta);
    if (nextTotal === currentTotal) return;
    if (nextTotal === 0) {
      // Decrementing to zero = remove. Route through the shared remove
      // handler so the Shopify mirror logic (sibling-reference check,
      // etc) runs exactly once.
      await handleRemoveItem(cartId);
      return;
    }
    // Capture the PRE-optimistic Shopify quantities so we can scale
    // them by the ratio the user actually wants, not by the already-
    // updated local state.
    const ratio = nextTotal / currentTotal;
    const vids = snapshot.shopifyVariantIds ?? [];
    const shopifyBefore = new Map<string, number>();
    for (const vid of vids) {
      const line = shopifyCart.items.find(i => i.variantId === vid);
      if (line) shopifyBefore.set(vid, line.quantity);
    }

    // --- Optimistic commit ---
    updateItemQuantity(cartId, nextTotal);
    setPendingRows(prev => ({ ...prev, [cartId]: true }));

    // --- Background Shopify sync ---
    try {
      if (vids.length > 0) {
        const failures: string[] = [];
        for (const vid of vids) {
          const before = shopifyBefore.get(vid);
          if (!before || before <= 0) continue;
          const nextQty = Math.max(1, Math.round(before * ratio));
          try {
            await shopifyCart.updateQuantity(vid, nextQty);
          } catch (e) {
            console.warn('Shopify updateQuantity failed', vid, e);
            failures.push(vid);
          }
        }
        // The Shopify store swallows errors internally (logs + returns);
        // detect a silent failure by reading back state and comparing
        // to what we intended. If any variant didn't move, treat the
        // whole row as failed so the user's pricing is never wrong.
        const shopifyAfter = useShopifyCartStore.getState().items;
        const silentMismatch = vids.some(vid => {
          const before = shopifyBefore.get(vid);
          if (!before || before <= 0) return false;
          const expected = Math.max(1, Math.round(before * ratio));
          const actual = shopifyAfter.find(i => i.variantId === vid)?.quantity;
          return actual !== expected;
        });
        if (failures.length > 0 || silentMismatch) {
          throw new Error('shopify-sync-failed');
        }
      }
    } catch (_err) {
      // Revert local state + toast. Only revert if the row is still
      // there — the user might have removed it while we awaited.
      rollbackItem(snapshot);
      toast.error(
        lang === 'en'
          ? 'Couldn\u2019t update quantity. Please try again.'
          : 'Impossible de mettre à jour la quantité. Réessaie.',
        { duration: 4000 },
      );
    } finally {
      setPendingRows(prev => {
        const next = { ...prev };
        delete next[cartId];
        return next;
      });
    }
  };

  // Save-for-later: park the active cart row in the sidelist and drop
  // it from the active cart (including the Shopify mirror, otherwise
  // the buyer gets charged at checkout for a line they explicitly
  // parked). FIFO overflow — when the cap is hit we drop the oldest
  // saved entry so the freshly-parked item is always retained.
  const handleSaveForLater = async (cartId: string) => {
    const item = useCartStore.getState().items.find(i => i.cartId === cartId);
    if (!item) return;
    // Append first, evict oldest if we exceed the cap.
    setSavedItems(prev => {
      const next = [...prev, item];
      if (next.length > SAVED_FOR_LATER_CAP) {
        next.splice(0, next.length - SAVED_FOR_LATER_CAP);
      }
      return next;
    });
    await handleRemoveItem(cartId);
    toast.success(
      lang === 'en' ? 'Saved for later' : 'Sauvegardé pour plus tard',
      { duration: 2500 },
    );
  };

  // Move a saved entry back into the active cart. addItem regenerates
  // a fresh cartId + addedAt so we strip the stale ones from the saved
  // snapshot; the rest of the customization (logo, sizes, price) is
  // preserved verbatim. Note: shopifyVariantIds are NOT re-synced here
  // because the Shopify cart line was already dropped when the item
  // was parked; the next checkout will rebuild it.
  const handleMoveBackToCart = (savedCartId: string) => {
    const entry = savedItems.find(s => s.cartId === savedCartId);
    if (!entry) return;
    // Drop cartId + addedAt for the Omit<> signature on addItem.
    const { cartId: _c, addedAt: _a, ...rest } = entry;
    void _c; void _a;
    addItem(rest);
    setSavedItems(prev => prev.filter(s => s.cartId !== savedCartId));
    toast.success(
      lang === 'en' ? 'Moved back to cart' : 'Remis dans le panier',
      { duration: 2500 },
    );
  };

  const handleRemoveSaved = (savedCartId: string) => {
    setSavedItems(prev => prev.filter(s => s.cartId !== savedCartId));
  };

  return (
    <div id="main-content" tabIndex={-1} className="min-h-screen bg-background focus:outline-none">
      <Navbar onOpenCart={() => setCartOpen(true)} />
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />

      <div className="max-w-3xl mx-auto px-6 pt-20 pb-32">
        <Link
          to="/products"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {lang === 'en' ? 'Continue shopping' : 'Continuer tes achats'}
        </Link>

        <div className="flex items-baseline gap-3 mb-8 flex-wrap">
          <h1 className="text-3xl font-extrabold tracking-tight">
            {lang === 'en' ? 'Your cart' : 'Ton panier'}
          </h1>
          {totalQty > 0 && (
            <span className="text-lg font-semibold text-muted-foreground">
              ({lang === 'en'
                ? plural(totalQty, { one: '{count} item', other: '{count} items' }, 'en')
                : plural(totalQty, { one: '{count} article', other: '{count} articles' }, 'fr')})
            </span>
          )}
          {items.length > 0 && (
            <button
              type="button"
              onClick={handleCopyCartLink}
              aria-label={lang === 'en' ? 'Copy cart link' : 'Copier le lien du panier'}
              title={lang === 'en' ? 'Copy cart link' : 'Copier le lien du panier'}
              aria-live="polite"
              className={`ml-auto self-center inline-flex items-center gap-1.5 px-3 h-8 rounded-full border text-[11px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                linkCopied
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'border-border bg-secondary/60 text-muted-foreground hover:text-foreground hover:border-foreground/40'
              }`}
            >
              {linkCopied ? (
                <>
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  {lang === 'en' ? 'Copied' : 'Copié'}
                </>
              ) : (
                <>
                  <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {lang === 'en' ? 'Copy cart link' : 'Copier le lien du panier'}
                </>
              )}
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="text-center py-16 px-6 max-w-md mx-auto">
            <div className="relative w-32 h-32 mx-auto mb-7" aria-hidden="true">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#0052CC]/10 to-[#E8A838]/10 blur-2xl" />
              <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-secondary to-background border-2 border-border flex items-center justify-center">
                <ShoppingCart className="h-12 w-12 text-[#0052CC]" strokeWidth={1.5} />
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-[#E8A838] text-[#1B3A6B] rounded-full text-sm font-extrabold flex items-center justify-center shadow-lg">
                0
              </div>
            </div>
            {/* Section 09 — empty-cart copy in the loss-aversion +
                peer-language voice. CTA still routes to /products
                (the canonical converting surface) but the label is
                now the spec's "Parcourir les produits". */}
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground mb-2">
              {lang === 'en' ? 'Your cart is empty for now' : "Ton panier est vide pour l'instant"}
            </h2>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              {lang === 'en'
                ? 'Your team deserves better than t-shirts without a logo.'
                : 'Ton équipe mérite mieux que des t-shirts sans logo.'}
            </p>
            <Link
              to="/products"
              className="inline-flex items-center gap-2 text-sm font-extrabold text-primary-foreground gradient-navy px-8 py-3.5 rounded-full shadow-navy hover:-translate-y-0.5 transition-transform focus:outline-none focus-visible:ring-4 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2"
            >
              {lang === 'en' ? 'Browse products →' : 'Parcourir les produits →'}
            </Link>
            <p className="text-[11px] text-muted-foreground/70 mt-4">
              {lang === 'en' ? 'Made in Québec · Free standard shipping' : 'Fabriqué au Québec · Livraison standard gratuite'}
            </p>

            <RecentlyViewed limit={4} />
          </div>
        ) : (
          <ul className="space-y-3 list-none p-0" aria-label={lang === 'en' ? 'Cart items' : 'Articles au panier'}>
            {items.map((item) => {
              const pending = !!pendingRows[item.cartId];
              return (
              <li
                key={item.cartId}
                className={`flex gap-4 p-4 rounded-2xl border border-border bg-card transition-opacity ${pending ? 'opacity-80' : ''}`}
              >
                {/* Preview image — logo preview or product photo */}
                <div className="w-20 h-20 bg-secondary rounded-xl overflow-hidden flex-shrink-0">
                  {item.previewSnapshot && (
                    <img
                      src={item.previewSnapshot}
                      alt={item.productName}
                      width={80}
                      height={80}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                      onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-bold truncate text-foreground">{item.productName}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {item.totalQuantity} {lang === 'en'
                      ? `unit${item.totalQuantity !== 1 ? 's' : ''}`
                      : `unité${item.totalQuantity !== 1 ? 's' : ''}`}
                  </p>
                  <p className="font-extrabold text-primary mt-1.5">
                    {fmtMoney(item.totalPrice)} $
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                      ({fmtMoney(item.unitPrice)} $ / {lang === 'en' ? 'unit' : 'unité'})
                    </span>
                  </p>
                  {/* Quantity stepper — optimistic: local state updates
                      instantly, Shopify sync fires in the background,
                      revert + toast if the sync fails. aria-live on the
                      value so screen readers announce the update
                      without having to re-focus the row. */}
                  <div className="flex items-center gap-2 mt-2">
                    <div className="inline-flex items-center rounded-full border border-border bg-secondary/60 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(item.cartId, -1)}
                        disabled={pending || item.totalQuantity <= 1}
                        aria-label={lang === 'en' ? `Decrease quantity for ${item.productName}` : `Diminuer la quantité de ${item.productName}`}
                        className="w-9 h-9 flex items-center justify-center text-foreground hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors"
                      >
                        <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <span
                        className="min-w-[2.25rem] text-center text-sm font-bold tabular-nums select-none"
                        aria-live="polite"
                        aria-atomic="true"
                      >
                        {item.totalQuantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(item.cartId, +1)}
                        disabled={pending}
                        aria-label={lang === 'en' ? `Increase quantity for ${item.productName}` : `Augmenter la quantité de ${item.productName}`}
                        className="w-9 h-9 flex items-center justify-center text-foreground hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                    {pending && (
                      <span className="text-[10px] text-muted-foreground" aria-hidden="true">
                        {lang === 'en' ? 'Saving…' : 'Enregistrement…'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end justify-between flex-shrink-0">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleSaveForLater(item.cartId)}
                      className="w-11 h-11 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 bg-transparent cursor-pointer transition-colors"
                      aria-label={lang === 'en' ? `Save ${item.productName} for later` : `Sauvegarder ${item.productName} pour plus tard`}
                      title={lang === 'en' ? 'Save for later' : 'Sauvegarder pour plus tard'}
                    >
                      <BookmarkPlus className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => handleRemoveItem(item.cartId)}
                      className="w-11 h-11 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40 bg-transparent cursor-pointer transition-colors"
                      aria-label={lang === 'en' ? `Remove ${item.productName}` : `Retirer ${item.productName}`}
                      title={lang === 'en' ? 'Remove' : 'Supprimer'}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>

                  {/* Logo placement previews — both sides when user ordered
                      Front + Back so they see the full design in the cart. */}
                  <div className="flex gap-1">
                    {item.logoPlacement?.previewUrl && (
                      <img
                        src={item.logoPlacement.previewUrl}
                        alt={lang === 'en' ? 'Front logo' : 'Logo devant'}
                        title={lang === 'en' ? 'Front' : 'Devant'}
                        width={36}
                        height={36}
                        loading="lazy"
                        decoding="async"
                        className="w-9 h-9 object-contain rounded border border-border bg-white"
                        onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                      />
                    )}
                    {item.logoPlacementBack?.previewUrl && (
                      <img
                        src={item.logoPlacementBack.previewUrl}
                        alt={lang === 'en' ? 'Back logo' : 'Logo dos'}
                        title={lang === 'en' ? 'Back' : 'Dos'}
                        width={36}
                        height={36}
                        loading="lazy"
                        decoding="async"
                        className="w-9 h-9 object-contain rounded border border-border bg-white"
                        onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                      />
                    )}
                  </div>
                </div>
              </li>
              );
            })}
          </ul>
        )}

        {/* Task 5.2 — "Complète ta commande" match-style upsell row.
            Lives BELOW the cart items so buyers see category-coherent
            pairings (hoodie → cap+tee, tee → hoodie+cap, cap → tee+hoodie,
            polo → cap+long-sleeve polo) before they hit the totals. We
            pick a dominant category from the cart (the one with the
            most line-items), resolve the seed SKUs from crossSellMap,
            then pad up to 4 by pulling other products in the same
            target categories that aren't already in the cart. Hidden
            entirely when the cart is empty — same guard as items.length
            above. */}
        {items.length > 0 && (() => {
          const categoryCount = new Map<string, number>();
          for (const it of items) {
            const cat = PRODUCTS.find(p => p.id === it.productId)?.category;
            if (!cat) continue;
            categoryCount.set(cat, (categoryCount.get(cat) ?? 0) + 1);
          }
          if (categoryCount.size === 0) return null;
          // Dominant category = most line-items. Stable tie-break on
          // insertion order so the UI doesn't flicker between equal
          // categories across renders.
          let dominant: string | null = null;
          let topCount = 0;
          for (const [cat, count] of categoryCount) {
            if (count > topCount) { dominant = cat; topCount = count; }
          }
          if (!dominant) return null;
          const seedSkus = crossSellMap[dominant];
          if (!seedSkus || seedSkus.length === 0) return null;

          const inCartIds = new Set(items.map(it => it.productId));
          const picks: typeof PRODUCTS = [];
          // 1. Seed SKUs from the map in order, skipping any that are
          //    already in the cart (recommending what the buyer just
          //    added is noise).
          for (const sku of seedSkus) {
            const prod = PRODUCTS.find(p => p.sku === sku);
            if (prod && !inCartIds.has(prod.id) && !picks.some(x => x.id === prod.id)) {
              picks.push(prod);
            }
          }
          // 2. Pad up to 4 with other products sharing the same target
           //    categories as the seeds (e.g. seed = ATC6606 cap → pad
           //    with other caps). Keeps recommendations category-coherent
           //    with the pairing intent even when a seed was filtered out.
          const targetCategories = new Set(
            seedSkus
              .map(s => PRODUCTS.find(p => p.sku === s)?.category)
              .filter((c): c is Product['category'] => !!c),
          );
          for (const p of PRODUCTS) {
            if (picks.length >= 4) break;
            if (inCartIds.has(p.id)) continue;
            if (picks.some(x => x.id === p.id)) continue;
            if (targetCategories.has(p.category)) picks.push(p);
          }
          if (picks.length === 0) return null;

          return (
            <section
              aria-label={lang === 'en' ? 'Complete your order' : 'Complète ta commande'}
              className="mt-8"
            >
              <div className="mb-3">
                <h2 className="text-lg font-extrabold tracking-tight text-foreground">
                  {lang === 'en' ? 'Complete your order' : 'Complète ta commande'}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {lang === 'en'
                    ? 'Pairs the team will actually wear together — same kit, one shipment.'
                    : 'Des agencements que l\u2019équipe portera vraiment — même kit, un seul envoi.'}
                </p>
              </div>
              {/* Horizontal scroll on mobile, 3-col grid from md+ up. The
                  overflow strip uses snap-x so the cards align as the
                  user flicks through them on touch. Desktop ignores the
                  snap + overflow entirely because flex-wrap → grid. */}
              <ul
                className="flex md:grid md:grid-cols-3 gap-3 overflow-x-auto md:overflow-visible snap-x snap-mandatory -mx-6 px-6 md:mx-0 md:px-0 pb-2 md:pb-0 list-none"
                role="list"
              >
                {picks.map(p => {
                  const priceFmt = p.basePrice.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  });
                  return (
                    <li
                      key={p.sku}
                      className="snap-start flex-shrink-0 w-[46%] sm:w-[38%] md:w-auto"
                    >
                      <Link
                        to={`/product/${p.shopifyHandle}`}
                        aria-label={`${categoryLabel(p.category, lang)} ${p.sku} — ${lang === 'en' ? 'from' : 'à partir de'} ${priceFmt} $`}
                        className="group block bg-background rounded-xl overflow-hidden border border-border hover:border-[#0052CC]/40 hover:shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
                        <div className="p-2.5">
                          <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/70 truncate">
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
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })()}

        {savedItems.length > 0 && (
          <section
            aria-label={lang === 'en' ? 'Saved for later' : 'Sauvegardés pour plus tard'}
            className="mt-8"
          >
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground">
                {lang === 'en' ? 'Saved for later' : 'Sauvegardés pour plus tard'}
              </h2>
              <span className="text-[11px] text-muted-foreground">
                {savedItems.length}/{SAVED_FOR_LATER_CAP}
              </span>
            </div>
            <ul
              className="space-y-2 list-none p-0"
              aria-label={lang === 'en' ? 'Saved items' : 'Articles sauvegardés'}
            >
              {savedItems.map((saved) => {
                const product = PRODUCTS.find(p => p.id === saved.productId);
                const color = product?.colors.find(c => c.id === saved.colorId);
                return (
                  <li
                    key={saved.cartId}
                    className="flex gap-3 p-3 rounded-xl border border-border/70 bg-muted/30"
                  >
                    <div className="w-14 h-14 bg-secondary rounded-lg overflow-hidden flex-shrink-0">
                      {saved.previewSnapshot && (
                        <img
                          src={saved.previewSnapshot}
                          alt={saved.productName}
                          width={56}
                          height={56}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                          onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                        />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{saved.productName}</p>
                      {color && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full ring-1 ring-border"
                            style={{ background: color.hex }}
                            aria-hidden="true"
                          />
                          <span className="text-[11px] text-muted-foreground">{color.name}</span>
                        </div>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {saved.totalQuantity} {lang === 'en'
                          ? `unit${saved.totalQuantity !== 1 ? 's' : ''}`
                          : `unité${saved.totalQuantity !== 1 ? 's' : ''}`}
                        <span className="mx-1.5">·</span>
                        <span className="font-semibold text-foreground">{fmtMoney(saved.totalPrice)} $</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0 self-center">
                      <button
                        type="button"
                        onClick={() => handleMoveBackToCart(saved.cartId)}
                        className="inline-flex items-center gap-1.5 px-3 h-9 rounded-full bg-primary text-primary-foreground text-[11px] font-bold hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 transition-opacity"
                        aria-label={lang === 'en' ? `Move ${saved.productName} back to cart` : `Remettre ${saved.productName} dans le panier`}
                        title={lang === 'en' ? 'Move back to cart' : 'Remettre dans le panier'}
                      >
                        <ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="hidden sm:inline">
                          {lang === 'en' ? 'Move back' : 'Remettre'}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveSaved(saved.cartId)}
                        className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40 bg-transparent transition-colors"
                        aria-label={lang === 'en' ? `Remove ${saved.productName} from saved` : `Supprimer ${saved.productName} des sauvegardés`}
                        title={lang === 'en' ? 'Remove' : 'Supprimer'}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {items.length > 0 && (
          <div className="space-y-3">
            {/* Clear-cart link — needs to live here (not in the remove
                button per-line) so users can wipe a big cart in one
                click without clicking Trash N times. Confirm first
                since this is destructive. Also clears the Shopify
                shadow cart so checkout doesn't resurrect the lines. */}
            <div className="flex justify-end mt-3">
              <button
                type="button"
                onClick={async () => {
                  const ok = window.confirm(
                    lang === 'en'
                      ? `Empty your cart? This removes all ${items.length} item${items.length > 1 ? 's' : ''} and can\u2019t be undone.`
                      : `Vider ton panier ? ${items.length} article${items.length > 1 ? 's' : ''} sera${items.length > 1 ? 'ont' : ''} retiré${items.length > 1 ? 's' : ''}, c\u2019est irréversible.`,
                  );
                  if (!ok) return;
                  // Capture the Shopify variant IDs BEFORE clearing the
                  // local store — once cleared we can't read them back.
                  const vids = new Set<string>();
                  for (const it of items) {
                    for (const v of it.shopifyVariantIds ?? []) vids.add(v);
                  }
                  clear();
                  for (const variantId of vids) {
                    try { await shopifyCart.removeItem(variantId); }
                    catch (e) { console.warn('Shopify cart removeItem failed during clear', e); }
                  }
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-destructive transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40 focus-visible:ring-offset-1 rounded px-2 py-1"
              >
                <XCircle size={13} aria-hidden="true" />
                {lang === 'en' ? 'Empty cart' : 'Vider le panier'}
              </button>
            </div>
            {/* Cross-sell — placed between cart lines and totals so it
                catches the eye right before the customer commits to pay. */}
            <div className="mt-6">
              <CartRecommendations />
            </div>

            {/* Trust bar — three reassurance pills placed right before the
                order summary so the buyer sees refund, security, and
                local-print story at the point of committing to pay.
                Stacks on mobile, 3-col grid from sm+ up. */}
            <div
              className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3"
              role="list"
              aria-label={lang === 'en' ? 'Shop with confidence' : 'Achète en confiance'}
            >
              <div
                className="rounded-lg bg-muted/30 border border-border p-3 flex items-start gap-2.5"
                role="listitem"
              >
                <ShieldCheck className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-medium text-foreground text-sm leading-tight">
                    {lang === 'en' ? '30-day guarantee' : 'Garantie 30 jours'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                    {lang === 'en' ? 'Full refund if not satisfied' : 'Remboursé si pas satisfait'}
                  </p>
                </div>
              </div>
              <div
                className="rounded-lg bg-muted/30 border border-border p-3 flex items-start gap-2.5"
                role="listitem"
              >
                <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-medium text-foreground text-sm leading-tight">
                    {lang === 'en' ? 'Secure checkout' : 'Paiement sécurisé'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                    SSL + Stripe + Shopify Pay
                  </p>
                </div>
              </div>
              <div
                className="rounded-lg bg-muted/30 border border-border p-3 flex items-start gap-2.5"
                role="listitem"
              >
                <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-medium text-foreground text-sm leading-tight">
                    {lang === 'en' ? 'Printed in Québec' : 'Imprimé au Québec'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                    {lang === 'en' ? 'Local business, 100% Made in Canada' : 'Entreprise locale, 100% Made in Canada'}
                  </p>
                </div>
              </div>
            </div>

            {/* Order summary */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <h2 className="font-extrabold text-sm uppercase tracking-wider text-muted-foreground">
                {lang === 'en' ? 'Order Summary' : 'Résumé de la commande'}
              </h2>

              {(() => {
                // Task 5.8 — compute the pre-discount subtotal and the dollars
                // saved locally so we can render a strike-through original total
                // + a gold "Rabais VISION10 (-10%)" line. The store's getTotal()
                // already factors the discount in, so `totalPrice` == discounted
                // total; we back-derive the gross from the item list.
                const grossSubtotal = items.reduce(
                  (s, it) => s + (Number.isFinite(it.totalPrice) ? it.totalPrice : 0),
                  0,
                );
                const savings = discountApplied && discountCode ? Math.max(0, grossSubtotal - totalPrice) : 0;
                const rate =
                  discountApplied && discountCode
                    ? getSettings().discountCodes[discountCode] ?? 0
                    : 0;
                const ratePct = Math.round(rate * 100);
                return (
                  <>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span>{lang === 'en' ? 'Subtotal' : 'Sous-total'}</span>
                        <span className="font-semibold text-foreground">
                          {fmtMoney(grossSubtotal)} $
                        </span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>{lang === 'en' ? 'Print & personalization' : 'Impression & personnalisation'}</span>
                        <span className="font-semibold text-green-600">
                          {lang === 'en' ? 'Included' : 'Incluse'}
                        </span>
                      </div>
                      {discountApplied && discountCode ? (
                        <div className="flex justify-between items-center -mx-2 px-2 py-1.5 rounded-lg bg-[#E8A838]/10 border border-[#E8A838]/30">
                          <span className="font-semibold text-foreground flex items-baseline gap-1.5">
                            <Tag size={12} className="text-[#E8A838] self-center" aria-hidden="true" />
                            {lang === 'en' ? 'Discount' : 'Rabais'}{' '}
                            <code className="font-mono text-[11px] text-foreground">{discountCode}</code>
                            {ratePct > 0 && (
                              <span className="text-[11px] text-muted-foreground">
                                {lang === 'en' ? `(−${ratePct}%)` : `(−${ratePct} %)`}
                              </span>
                            )}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="font-extrabold text-[#E8A838] tabular-nums">
                              −{fmtMoney(savings)} $
                            </span>
                            <button
                              type="button"
                              onClick={clearDiscount}
                              aria-label={lang === 'en' ? `Remove promo code ${discountCode}` : `Retirer le code promo ${discountCode}`}
                              className="text-[11px] font-bold text-muted-foreground underline hover:no-underline hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838] focus-visible:ring-offset-1 rounded"
                            >
                              {lang === 'en' ? 'Remove' : 'Retirer'}
                            </button>
                          </span>
                        </div>
                      ) : (
                        <PromoCodeInput
                          onApply={applyDiscount}
                          placeholder={lang === 'en' ? 'Promo code' : 'Code promo'}
                          applyLabel={lang === 'en' ? 'Apply' : 'Appliquer'}
                          invalidLabel={lang === 'en' ? 'Invalid code' : 'Code invalide'}
                        />
                      )}
                      <div className="flex justify-between text-muted-foreground">
                        <span>{lang === 'en' ? 'Taxes' : 'Taxes'}</span>
                        <span>{lang === 'en' ? 'Calculated at checkout' : 'Calculées au paiement'}</span>
                      </div>
                    </div>

                    {/* aria-live so screen readers announce the new total when
                        the user removes a line, applies a discount, or clears
                        one — without it, the visual total update was silent. */}
                    <div
                      className="border-t border-border pt-3 flex justify-between items-center gap-3"
                      role="status"
                      aria-live="polite"
                      aria-atomic="true"
                    >
                      <span className="text-base font-extrabold">
                        {lang === 'en' ? 'Estimated total' : 'Total estimé'}
                      </span>
                      {discountApplied && savings > 0 ? (
                        <span className="flex items-baseline gap-2">
                          <s
                            className="text-sm font-semibold text-muted-foreground line-through opacity-50 tabular-nums"
                            aria-label={lang === 'en' ? 'Original total' : 'Total original'}
                          >
                            {fmtMoney(grossSubtotal)} $
                          </s>
                          <span className="text-2xl font-extrabold text-primary tabular-nums">
                            {fmtMoney(totalPrice)} $
                          </span>
                        </span>
                      ) : (
                        <span className="text-2xl font-extrabold text-primary tabular-nums">
                          {fmtMoney(totalPrice)} $
                        </span>
                      )}
                    </div>
                  </>
                );
              })()}

              {/* Concrete ETA above the CTA — urgency + commitment. */}
              <div className="flex justify-center pt-1">
                <DeliveryBadge size="sm" showDate />
              </div>

              <button
                onClick={handleCheckout}
                className="w-full py-4 gradient-navy text-primary-foreground border-none rounded-xl text-[15px] font-extrabold cursor-pointer transition-opacity hover:opacity-85 disabled:opacity-50 flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2"
                style={{ boxShadow: '0 8px 24px hsla(var(--navy), 0.35)' }}
                disabled={checkingOut}
              >
                {lang === 'en' ? 'Place order' : 'Passer la commande'} →
              </button>

              <p className="text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
                <Lock className="w-3 h-3" aria-hidden="true" />
                {lang === 'en'
                  ? 'Secure Shopify checkout · Delivered in 5 business days'
                  : 'Paiement sécurisé Shopify · Livré en 5 jours ouvrables'}
              </p>
            </div>
          </div>
        )}
      </div>

      <AIChat />
      <BottomNav />
    </div>
  );
}
