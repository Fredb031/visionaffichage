import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { CartDrawer } from '@/components/CartDrawer';
import { useCartStore } from '@/stores/localCartStore';
import { useCartStore as useShopifyCartStore } from '@/stores/cartStore';
import { useLang } from '@/lib/langContext';
import { Trash2, ShoppingCart, ArrowLeft, Lock, Tag, XCircle, ShieldCheck, MapPin, Truck } from 'lucide-react';
import { AIChat } from '@/components/AIChat';
import { CartRecommendations } from '@/components/CartRecommendations';
import { DeliveryBadge } from '@/components/DeliveryBadge';
import { RecentlyViewed } from '@/components/RecentlyViewed';

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
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  // Ref-tracked so parent unmount + rapid re-submit don't leak / fight.
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  const submit = () => {
    if (!code.trim()) return;
    const ok = onApply(code.trim());
    if (!ok) {
      setError(true);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => {
        setError(false);
        errorTimerRef.current = null;
      }, 2500);
    } else {
      setCode('');
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <Tag size={13} className="text-muted-foreground flex-shrink-0" aria-hidden="true" />
        <input
          type="text"
          value={code}
          onChange={e => { setCode(e.target.value.toUpperCase()); setError(false); }}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-invalid={error || undefined}
          autoComplete="off"
          className={`flex-1 bg-secondary border rounded-lg px-2.5 py-1.5 text-xs uppercase tracking-wider outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/25 ${
            error ? 'border-rose-300 focus:border-rose-500' : 'border-border focus:border-primary'
          }`}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!code.trim()}
          className="px-3 py-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-lg hover:opacity-90 disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
        >
          {applyLabel}
        </button>
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
  const { items, removeItem, getTotal, getItemCount, discountCode, discountApplied, applyDiscount, clearDiscount, clear } = useCartStore();
  const shopifyCart = useShopifyCartStore();
  const [cartOpen, setCartOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

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

  useEffect(() => {
    const prev = document.title;
    const count = totalQty > 0 ? ` (${totalQty})` : '';
    document.title = lang === 'en'
      ? `Cart${count} — Vision Affichage`
      : `Panier${count} — Vision Affichage`;
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

        <div className="flex items-baseline gap-3 mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight">
            {lang === 'en' ? 'Your cart' : 'Ton panier'}
          </h1>
          {totalQty > 0 && (
            <span className="text-lg font-semibold text-muted-foreground">
              ({totalQty} {lang === 'en'
                ? `item${totalQty !== 1 ? 's' : ''}`
                : `article${totalQty !== 1 ? 's' : ''}`})
            </span>
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
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground mb-2">
              {lang === 'en' ? 'Your cart is empty' : 'Ton panier est vide'}
            </h2>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              {lang === 'en'
                ? 'Pick a product, drop in your logo, and we ship in 5 business days. No minimum order.'
                : "Choisis un produit, ajoute ton logo, et on livre en 5 jours ouvrables. Aucun minimum."}
            </p>
            <Link
              to="/products"
              className="inline-flex items-center gap-2 text-sm font-extrabold text-primary-foreground gradient-navy px-8 py-3.5 rounded-full shadow-navy hover:-translate-y-0.5 transition-transform focus:outline-none focus-visible:ring-4 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2"
            >
              {lang === 'en' ? 'Browse products →' : 'Voir les produits →'}
            </Link>
            <p className="text-[11px] text-muted-foreground/70 mt-4">
              {lang === 'en' ? 'Made in Québec · Free standard shipping' : 'Fabriqué au Québec · Livraison standard gratuite'}
            </p>

            <RecentlyViewed limit={4} />
          </div>
        ) : (
          <ul className="space-y-3 list-none p-0" aria-label={lang === 'en' ? 'Cart items' : 'Articles au panier'}>
            {items.map((item) => (
              <li
                key={item.cartId}
                className="flex gap-4 p-4 rounded-2xl border border-border bg-card"
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
                </div>

                <div className="flex flex-col items-end justify-between flex-shrink-0">
                  <button
                    onClick={() => handleRemoveItem(item.cartId)}
                    className="w-11 h-11 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40 bg-transparent cursor-pointer transition-colors"
                    aria-label={lang === 'en' ? `Remove ${item.productName}` : `Retirer ${item.productName}`}
                    title={lang === 'en' ? 'Remove' : 'Supprimer'}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>

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
            ))}
          </ul>
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

            {/* Trust bar — reinforces key reassurances right before the
                total + CTA so hesitation at the payment step is minimized.
                Visually connected to the order-summary card via shared
                rounded-top and seamless -mb-px to the card below. */}
            <div
              className="mt-6 -mb-px rounded-t-2xl border border-b-0 border-border bg-secondary/40 px-4 py-2.5 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[11px] font-semibold text-muted-foreground"
              role="list"
              aria-label={lang === 'en' ? 'Shop with confidence' : 'Achète en confiance'}
            >
              <span className="inline-flex items-center gap-1.5" role="listitem">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                {lang === 'en' ? 'Secure payment' : 'Paiement sécurisé'}
              </span>
              <span className="inline-flex items-center gap-1.5" role="listitem">
                <MapPin className="w-3.5 h-3.5 text-[#0052CC]" aria-hidden="true" />
                {lang === 'en' ? 'Printed in Québec' : 'Imprimé au Québec'}
              </span>
              <span className="inline-flex items-center gap-1.5" role="listitem">
                <Truck className="w-3.5 h-3.5 text-[#E8A838]" aria-hidden="true" />
                {lang === 'en' ? '5-day shipping' : 'Livraison 5 jours'}
              </span>
            </div>

            {/* Order summary */}
            <div className="rounded-2xl rounded-t-none border border-border bg-card p-5 space-y-3">
              <h2 className="font-extrabold text-sm uppercase tracking-wider text-muted-foreground">
                {lang === 'en' ? 'Order Summary' : 'Résumé de la commande'}
              </h2>

              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>{lang === 'en' ? 'Subtotal' : 'Sous-total'}</span>
                  <span className="font-semibold text-foreground">
                    {fmtMoney(totalPrice)} $
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>{lang === 'en' ? 'Print & personalization' : 'Impression & personnalisation'}</span>
                  <span className="font-semibold text-green-600">
                    {lang === 'en' ? 'Included' : 'Incluse'}
                  </span>
                </div>
                {discountApplied && discountCode ? (() => {
                  // Show the actual dollars saved so the discount badge
                  // reads as a concrete win, not just a code sticker.
                  const subtotal = items.reduce((s, it) => s + (Number.isFinite(it.totalPrice) ? it.totalPrice : 0), 0);
                  const savings = Math.max(0, subtotal - totalPrice);
                  return (
                    <div className="flex justify-between items-center text-emerald-700 bg-emerald-50 -mx-2 px-2 py-1.5 rounded-lg">
                      <span className="font-semibold">
                        ✓ {lang === 'en' ? 'Discount' : 'Rabais'} <code className="font-mono text-[11px]">{discountCode}</code>
                        {savings > 0 && <span className="ml-2 text-[11px] text-emerald-800">-{fmtMoney(savings)} $</span>}
                      </span>
                      <button
                        type="button"
                        onClick={clearDiscount}
                        aria-label={lang === 'en' ? `Remove promo code ${discountCode}` : `Retirer le code promo ${discountCode}`}
                        className="text-[11px] font-bold underline hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1 rounded"
                      >
                        {lang === 'en' ? 'Remove' : 'Retirer'}
                      </button>
                    </div>
                  );
                })() : (
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
                className="border-t border-border pt-3 flex justify-between items-center"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                <span className="text-base font-extrabold">
                  {lang === 'en' ? 'Estimated total' : 'Total estimé'}
                </span>
                <span className="text-2xl font-extrabold text-primary">
                  {fmtMoney(totalPrice)} $
                </span>
              </div>

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
