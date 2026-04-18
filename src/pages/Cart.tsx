import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { CartDrawer } from '@/components/CartDrawer';
import { useCartStore } from '@/stores/localCartStore';
import { useCartStore as useShopifyCartStore } from '@/stores/cartStore';
import { useLang } from '@/lib/langContext';
import { Trash2, ShoppingCart, ArrowLeft, Lock, Tag } from 'lucide-react';
import { AIChat } from '@/components/AIChat';
import { CartRecommendations } from '@/components/CartRecommendations';

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

  const submit = () => {
    if (!code.trim()) return;
    const ok = onApply(code.trim());
    if (!ok) {
      setError(true);
      setTimeout(() => setError(false), 2500);
    } else {
      setCode('');
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <Tag size={13} className="text-muted-foreground flex-shrink-0" />
        <input
          type="text"
          value={code}
          onChange={e => { setCode(e.target.value.toUpperCase()); setError(false); }}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          placeholder={placeholder}
          aria-label={placeholder}
          className={`flex-1 bg-secondary border rounded-lg px-2.5 py-1.5 text-xs uppercase tracking-wider outline-none transition-colors ${
            error ? 'border-rose-300 focus:border-rose-500' : 'border-border focus:border-primary'
          }`}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!code.trim()}
          className="px-3 py-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-lg hover:opacity-90 disabled:opacity-30"
        >
          {applyLabel}
        </button>
      </div>
      {error && (
        <p className="text-[10px] text-rose-600 font-semibold pl-5">{invalidLabel}</p>
      )}
    </div>
  );
}
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';

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
  const { items, removeItem, getTotal, getItemCount, discountCode, discountApplied, applyDiscount, clearDiscount } = useCartStore();
  const shopifyCart = useShopifyCartStore();
  const [cartOpen, setCartOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  const totalPrice = getTotal();
  const totalQty = getItemCount();

  useEffect(() => {
    const prev = document.title;
    const count = totalQty > 0 ? ` (${totalQty})` : '';
    document.title = lang === 'en'
      ? `Cart${count} — Vision Affichage`
      : `Panier${count} — Vision Affichage`;
    return () => { document.title = prev; };
  }, [lang, totalQty]);

  const handleCheckout = () => {
    // Send users to our on-site checkout flow (no new tab, no redirect)
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    window.location.href = '/checkout';
  };

  // Remove from BOTH local + Shopify cart so Shopify checkout reflects the
  // user's actual basket. Without this, deleted items still appear at pay.
  const handleRemoveItem = async (cartId: string) => {
    const item = items.find(i => i.cartId === cartId);
    removeItem(cartId);
    if (item?.shopifyVariantIds && item.shopifyVariantIds.length > 0) {
      for (const variantId of item.shopifyVariantIds) {
        try { await shopifyCart.removeItem(variantId); } catch (e) { console.warn('Shopify cart removeItem failed', e); }
      }
    }
  };

  return (
    <div id="main-content" tabIndex={-1} className="min-h-screen bg-background focus:outline-none">
      <Navbar onOpenCart={() => setCartOpen(true)} />
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />

      <div className="max-w-3xl mx-auto px-6 pt-20 pb-32">
        <Link
          to="/products"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
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
            <div className="relative w-32 h-32 mx-auto mb-7">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#0052CC]/10 to-[#E8A838]/10 blur-2xl" aria-hidden="true" />
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
              className="inline-flex items-center gap-2 text-sm font-extrabold text-primary-foreground gradient-navy px-8 py-3.5 rounded-full shadow-navy hover:-translate-y-0.5 transition-transform"
            >
              {lang === 'en' ? 'Browse products →' : 'Voir les produits →'}
            </Link>
            <p className="text-[11px] text-muted-foreground/70 mt-4">
              {lang === 'en' ? 'Made in Québec · Free shipping over $200' : 'Fabriqué au Québec · Livraison gratuite à 200 $+'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.cartId}
                className="flex gap-4 p-4 rounded-2xl border border-border bg-card"
              >
                {/* Preview image — logo preview or product photo */}
                <div className="w-20 h-20 bg-secondary rounded-xl overflow-hidden flex-shrink-0">
                  {item.previewSnapshot && (
                    <img
                      src={item.previewSnapshot}
                      alt={item.productName}
                      className="w-full h-full object-cover"
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
                    {item.totalPrice.toFixed(2)} $
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                      ({item.unitPrice.toFixed(2)} $ / {lang === 'en' ? 'unit' : 'unité'})
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
                        className="w-9 h-9 object-contain rounded border border-border bg-white"
                      />
                    )}
                    {item.logoPlacementBack?.previewUrl && (
                      <img
                        src={item.logoPlacementBack.previewUrl}
                        alt={lang === 'en' ? 'Back logo' : 'Logo dos'}
                        title={lang === 'en' ? 'Back' : 'Dos'}
                        className="w-9 h-9 object-contain rounded border border-border bg-white"
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Cross-sell — placed between cart lines and totals so it
                catches the eye right before the customer commits to pay. */}
            <div className="mt-6">
              <CartRecommendations />
            </div>

            {/* Order summary */}
            <div className="rounded-2xl border border-border bg-card p-5 mt-6 space-y-3">
              <h2 className="font-extrabold text-sm uppercase tracking-wider text-muted-foreground">
                {lang === 'en' ? 'Order Summary' : 'Résumé de la commande'}
              </h2>

              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>{lang === 'en' ? 'Subtotal' : 'Sous-total'}</span>
                  <span className="font-semibold text-foreground">
                    {totalPrice.toFixed(2)} $
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>{lang === 'en' ? 'Print & personalization' : 'Impression & personnalisation'}</span>
                  <span className="font-semibold text-green-600">
                    {lang === 'en' ? 'Included' : 'Incluse'}
                  </span>
                </div>
                {discountApplied && discountCode ? (
                  <div className="flex justify-between text-emerald-700 bg-emerald-50 -mx-2 px-2 py-1.5 rounded-lg">
                    <span className="font-semibold">
                      ✓ {lang === 'en' ? 'Discount' : 'Rabais'} <code className="font-mono text-[11px]">{discountCode}</code>
                    </span>
                    <button
                      type="button"
                      onClick={clearDiscount}
                      className="text-[11px] font-bold underline hover:no-underline"
                    >
                      {lang === 'en' ? 'Remove' : 'Retirer'}
                    </button>
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

              <div className="border-t border-border pt-3 flex justify-between items-center">
                <span className="text-base font-extrabold">
                  {lang === 'en' ? 'Estimated total' : 'Total estimé'}
                </span>
                <span className="text-2xl font-extrabold text-primary">
                  {totalPrice.toFixed(2)} $
                </span>
              </div>

              <button
                onClick={handleCheckout}
                className="w-full py-4 gradient-navy text-primary-foreground border-none rounded-xl text-[15px] font-extrabold cursor-pointer transition-opacity hover:opacity-85 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ boxShadow: '0 8px 24px hsla(var(--navy), 0.35)' }}
                disabled={checkingOut}
              >
                {lang === 'en' ? 'Place order' : 'Passer la commande'} →
              </button>

              <p className="text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
                <Lock className="w-3 h-3" />
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
