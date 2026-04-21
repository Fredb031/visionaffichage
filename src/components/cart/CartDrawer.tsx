/**
 * CartDrawer — Panier avec aperçu produit live (devant + logo)
 * Chaque article montre l'image devant avec le logo overlaid.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, ShoppingBag, Trash2, Tag, ChevronRight } from 'lucide-react';
import { useCartStore } from '@/stores/localCartStore';
import { useCartStore as useShopifyCartStore } from '@/stores/cartStore';
import { useLang } from '@/lib/langContext';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { PRODUCTS } from '@/data/products';
import { getSettings } from '@/lib/appSettings';
import type { CartItemCustomization } from '@/types/customization';

// ── Cart item preview — shows front AND back when ordered with both sides ──
function SideThumb({
  img, color, placement, alt,
}: {
  img?: string;
  color?: { hex: string } | null;
  placement?: { previewUrl?: string; processedUrl?: string; x?: number; y?: number; width?: number } | null;
  alt: string;
}) {
  const logoUrl = placement?.previewUrl ?? placement?.processedUrl;
  const lx = placement?.x ?? 50;
  const ly = placement?.y ?? 32;
  const lw = placement?.width ?? 28;
  return (
    <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-border bg-secondary flex-shrink-0">
      {img && <img src={img} alt={alt} className="w-full h-full object-cover" onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />}
      {color && color.hex !== '#F2F0EB' && (
        <div
          className="absolute inset-0"
          style={{ background: color.hex, opacity: 0.15, mixBlendMode: 'multiply' }}
          aria-hidden="true"
        />
      )}
      {logoUrl && (
        <img
          src={logoUrl}
          alt=""
          className="absolute object-contain pointer-events-none"
          style={{
            left: `${Math.max(0, lx - lw / 2)}%`,
            top:  `${Math.max(0, ly - lw * 0.3)}%`,
            width: `${lw}%`,
            maxWidth: '80%',
          }}
          onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
        />
      )}
    </div>
  );
}

function CartItemPreview({ item }: { item: CartItemCustomization }) {
  const product = PRODUCTS.find(p => p.id === item.productId);
  const color = product?.colors.find(c => c.id === item.colorId);
  const frontImg = color?.imageDevant ?? product?.imageDevant ?? item.previewSnapshot;
  const backImg  = color?.imageDos    ?? product?.imageDos;

  const hasFront = !!item.logoPlacement?.previewUrl || item.placementSides === 'front' || item.placementSides === 'both';
  const hasBack  = !!item.logoPlacementBack?.previewUrl || item.placementSides === 'back'  || item.placementSides === 'both';

  // Single-side: just show that side. Both-sides: show a small stacked pair.
  if (hasBack && !hasFront) {
    return <SideThumb img={backImg} color={color ?? null} placement={item.logoPlacementBack} alt="back" />;
  }
  if (hasFront && hasBack) {
    return (
      <div className="relative flex gap-0.5 flex-shrink-0">
        <SideThumb img={frontImg} color={color ?? null} placement={item.logoPlacement}     alt="front" />
        <SideThumb img={backImg}  color={color ?? null} placement={item.logoPlacementBack} alt="back"  />
        {color && (
          <div className="absolute bottom-1 right-1 z-10 w-2.5 h-2.5 rounded-full ring-1 ring-white/80 shadow-sm" style={{ background: color.hex }} />
        )}
      </div>
    );
  }
  return (
    <div className="relative flex-shrink-0">
      <SideThumb img={frontImg} color={color ?? null} placement={item.logoPlacement} alt="front" />
      {color && (
        <div className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full ring-1 ring-white/80 shadow-sm" style={{ background: color.hex }} />
      )}
    </div>
  );
}

// ── Cart drawer ──────────────────────────────────────────────────────────────
export function CartDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const cart = useCartStore();
  const shopifyCart = useShopifyCartStore();

  // Mirror remove to Shopify cart so the checkout reflects what the user
  // actually has (was a P0 in the audit — local removal alone left ghost
  // items at pay).
  //
  // Only drop Shopify lines for variantIds that NO remaining local line
  // still references. Two local cart rows can share a Shopify variantId
  // when the same colour+size was customized twice (e.g. different logo
  // placements) — removing the Shopify line for the first row would
  // silently wipe the Shopify side for the sibling row that's still
  // on-screen, and the customer would get charged 0 for one of them.
  //
  // Read LIVE store state via getState after the local removal so a
  // second rapid click doesn't see a stale snapshot and skip Shopify
  // removals the first click already committed to dropping.
  //
  // Guard the destructive click with a confirm — trash-icon removal
  // used to be a one-tap hard delete with no undo, and the Shopify
  // mirror below means a misclick genuinely wipes the line from the
  // checkout cart too. A single window.confirm is the minimal safe net
  // without adding a snackbar infra this drawer doesn't already have.
  const handleRemoveItem = async (cartId: string) => {
    const item = useCartStore.getState().items.find(i => i.cartId === cartId);
    if (!item) return;
    const confirmMsg =
      lang === 'en'
        ? `Remove "${item.productName}" from your cart?`
        : `Retirer « ${item.productName} » du panier ?`;
    if (!window.confirm(confirmMsg)) return;
    cart.removeItem(cartId);
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
  const [codeInput, setCodeInput] = useState('');
  const [codeMsg, setCodeMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Tracked so rapid re-submits don't stack timers + cleanup on unmount.
  const codeMsgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (codeMsgTimerRef.current) clearTimeout(codeMsgTimerRef.current);
    };
  }, []);

  // Match the locale-aware money formatting used on the Cart page /
  // FeaturedProducts / WishlistGrid / ProductDetailBulkCalc so French
  // users see "27,54 $" (comma decimal) in the drawer instead of the
  // locale-blind "27.54 $" that .toFixed() renders. Without this the
  // drawer is the odd one out next to the full cart page.
  const fmtMoney = (n: number) =>
    (Number.isFinite(n) ? n : 0).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  // Escape closes drawer — skipInTextInputs so a stray Esc while the
  // user is typing a discount code clears the field instead of killing
  // the whole drawer mid-edit.
  useEscapeKey(isOpen, onClose, { skipInTextInputs: true });

  // Lock body scroll while the drawer is open — otherwise scroll wheel
  // over the overlay keeps moving the page underneath, which reads as
  // broken on mobile especially.
  useBodyScrollLock(isOpen);

  const trapRef = useFocusTrap<HTMLDivElement>(isOpen);

  // Task 17.8 — honour prefers-reduced-motion. framer-motion's hook
  // reads the OS-level media query live, so toggling the system setting
  // while the drawer is open falls back to a plain cross-fade on next
  // open without a reload. Sliding a 24rem panel across the viewport is
  // exactly the kind of motion motion-sensitive users flag.
  const reduceMotion = useReducedMotion();

  const applyCode = () => {
    // No-op on empty — clicking Apply with a blank input used to
    // flash "Code invalide" for 3 seconds, which reads as a rude
    // error for what's clearly a user who just hasn't typed anything.
    const trimmed = codeInput.trim();
    if (!trimmed) return;
    const normalizedDisplay = trimmed.toUpperCase();
    const ok = cart.applyDiscount(trimmed);
    setCodeMsg(
      ok
        ? { ok: true, text: lang === 'en' ? `Code ${normalizedDisplay} applied!` : `Code ${normalizedDisplay} appliqué !` }
        : { ok: false, text: lang === 'en' ? 'Invalid code' : 'Code invalide' }
    );
    if (codeMsgTimerRef.current) clearTimeout(codeMsgTimerRef.current);
    codeMsgTimerRef.current = setTimeout(() => {
      setCodeMsg(null);
      codeMsgTimerRef.current = null;
    }, 3000);
  };

  return (
    <>
      {/* Task 17.8 — backdrop fades in/out over 200ms. AnimatePresence lets
          the exit animation actually play before the node unmounts instead
          of the old snap-cut. */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 bg-foreground/25 z-[490] backdrop-blur-[2px]"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Task 17.8 — panel slides in from the right with a gentle spring
          overshoot on enter; on exit it slides back + fades over 200ms.
          Reduced-motion users get a plain opacity fade with no translate,
          so the panel never sweeps across the viewport for them. The
          ref / role / aria wiring and the focus-trap hook above are all
          untouched so the a11y contract holds. */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={trapRef}
            initial={reduceMotion ? { opacity: 0 } : { x: '100%', opacity: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { x: '0%', opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { x: '100%', opacity: 0 }}
            transition={
              reduceMotion
                ? { duration: 0.2, ease: 'easeOut' }
                : {
                    x: { type: 'spring', stiffness: 320, damping: 32 },
                    opacity: { duration: 0.2, ease: 'easeOut' },
                  }
            }
            className="fixed top-0 right-0 h-full w-full max-w-sm bg-card z-[500] shadow-2xl flex flex-col border-l border-border"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-drawer-title"
          >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag size={16} className="text-primary" aria-hidden="true" />
            <h2 id="cart-drawer-title" className="text-base font-extrabold text-foreground">{t('monPanier')}</h2>
            {cart.getItemCount() > 0 && (
              <span className="bg-primary text-primary-foreground text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center">
                {cart.getItemCount()}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label={lang === 'en' ? 'Close cart' : 'Fermer le panier'}
            className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-auto p-4 space-y-3">
          <AnimatePresence>
            {cart.items.length === 0 ? (
              <motion.div key="empty" initial={{ opacity:0 }} animate={{ opacity:1 }}
                className="flex flex-col items-center justify-center py-12 px-4 text-center"
              >
                <div className="relative w-24 h-24 mb-5">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#0052CC]/10 to-[#E8A838]/10 blur-xl" aria-hidden="true" />
                  <div className="relative w-24 h-24 rounded-full bg-secondary border-2 border-border flex items-center justify-center">
                    <ShoppingBag size={32} className="text-[#0052CC]" strokeWidth={1.5} aria-hidden="true" />
                  </div>
                </div>
                <h3 className="text-lg font-extrabold text-foreground mb-1">{t('panierVide')}</h3>
                <p className="text-xs text-muted-foreground mb-5 max-w-[240px] leading-relaxed">
                  {t('explorerProduits')}
                  {' — '}
                  {lang === 'en' ? 'delivered in 5 days, no minimum.' : 'livré en 5 jours, aucun minimum.'}
                </p>
                <button
                  type="button"
                  onClick={() => { onClose(); navigate('/products'); }}
                  className="text-sm font-extrabold text-primary-foreground gradient-navy px-5 py-2.5 rounded-full shadow-navy focus:outline-none focus-visible:ring-4 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2"
                >
                  {t('explorerProduits')}
                </button>
              </motion.div>
            ) : (
              cart.items.map((item) => {
                const product = PRODUCTS.find(p => p.id === item.productId);
                const color = product?.colors.find(c => c.id === item.colorId);
                return (
                  <motion.div key={item.cartId} layout initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, x:40 }}
                    className="flex gap-3 p-3 border border-border rounded-xl bg-secondary/50"
                  >
                    {/* Product preview with logo */}
                    <CartItemPreview item={item} />

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-extrabold text-foreground truncate">{item.productName}</p>
                      {color && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div className="w-2.5 h-2.5 rounded-full ring-1 ring-border" style={{ background: color.hex }} />
                          <span className="text-[10px] text-muted-foreground">{color.name}</span>
                        </div>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {item.sizeQuantities.filter(s => s.quantity > 0).map(s => `${s.size}×${s.quantity}`).join(' · ')}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs font-extrabold text-primary">{fmtMoney(item.totalPrice)} $</p>
                        <span className="text-[10px] text-muted-foreground">
                          ({item.totalQuantity} {lang === 'en' ? (item.totalQuantity !== 1 ? 'units' : 'unit') : (item.totalQuantity !== 1 ? 'unités' : 'unité')})
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveItem(item.cartId)}
                      aria-label={lang === 'en' ? `Remove ${item.productName}` : `Retirer ${item.productName}`}
                      title={lang === 'en' ? 'Remove' : 'Retirer'}
                      className="w-11 h-11 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/5 active:bg-destructive/10 transition-colors flex-shrink-0 -mr-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        {cart.items.length > 0 && (
          <div
            className="p-4 border-t border-border space-y-3 bg-card"
            // Task 16.10 — pad past the iPhone home-indicator so the
            // "Checkout" CTA isn't half-swallowed by the gesture bar.
            // No-op on non-notched devices (inset resolves to 0px).
            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
          >
            {!cart.discountApplied ? (
              <div className="flex gap-2">
                <input
                  value={codeInput}
                  onChange={e => { setCodeInput(e.target.value.toUpperCase()); if (codeMsg && !codeMsg.ok) setCodeMsg(null); }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyCode(); } }}
                  placeholder={t('codeRabais')}
                  aria-label={t('codeRabais')}
                  aria-invalid={codeMsg?.ok === false || undefined}
                  className={`flex-1 border rounded-xl px-3 py-2.5 text-sm outline-none font-mono bg-secondary ${
                    codeMsg?.ok === false ? 'border-rose-300 focus:border-rose-500' : 'border-border focus:border-primary'
                  }`}
                />
                <button
                  type="button"
                  onClick={applyCode}
                  disabled={!codeInput.trim()}
                  className="bg-secondary border border-border rounded-xl px-4 py-2.5 text-xs font-extrabold text-foreground hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                >
                  {t('appliquer')}
                </button>
              </div>
            ) : (() => {
              // Task 5.8 — gold-highlighted savings line so the drawer
              // also confirms the win (the drawer previously only said
              // "Code X applied" with no dollar context).
              const grossSubtotal = cart.items.reduce(
                (s, it) => s + (Number.isFinite(it.totalPrice) ? it.totalPrice : 0),
                0,
              );
              const discounted = cart.getTotal();
              const savings = Math.max(0, grossSubtotal - discounted);
              const rate = cart.discountCode
                ? getSettings().discountCodes[cart.discountCode] ?? 0
                : 0;
              const ratePct = Math.round(rate * 100);
              return (
                <div className="flex items-center gap-2 px-3 py-2 bg-[#E8A838]/10 border border-[#E8A838]/30 rounded-xl">
                  <Tag size={11} className="text-[#E8A838]" aria-hidden="true" />
                  <span className="text-xs font-bold text-foreground flex-1 truncate">
                    {lang === 'en' ? 'Discount' : 'Rabais'}{' '}
                    <code className="font-mono">{cart.discountCode}</code>
                    {ratePct > 0 && (
                      <span className="ml-1 text-[10px] font-semibold text-muted-foreground">
                        {lang === 'en' ? `(−${ratePct}%)` : `(−${ratePct} %)`}
                      </span>
                    )}
                  </span>
                  {savings > 0 && (
                    <span className="text-xs font-extrabold text-[#E8A838] tabular-nums">
                      −{fmtMoney(savings)} $
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => cart.clearDiscount()}
                    aria-label={lang === 'en' ? 'Remove discount code' : 'Retirer le code de rabais'}
                    className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838]/60"
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </div>
              );
            })()}
            {/* Live region so screen-reader users hear "Code X applied!" /
                "Invalid code" instead of being left to wonder what happened
                after they hit Apply. role=status (polite) — it's advisory
                feedback, not an interruption. */}
            {codeMsg && (
              <p
                role="status"
                aria-live="polite"
                className={`text-xs font-bold px-1 ${codeMsg.ok ? 'text-green-700' : 'text-destructive'}`}
              >
                {codeMsg.text}
              </p>
            )}

            {/* Total line — when a discount is live, the pre-discount
                subtotal shows with strike-through + opacity-50 and the
                discounted total sits next to it, larger + bolder, so
                the buyer sees both numbers and feels the win.
                aria-live=polite so screen-reader users hear the new
                total after quantity edits / discount toggles instead
                of being left with the stale figure. */}
            <div
              className="flex justify-between items-center gap-2"
              aria-live="polite"
              aria-atomic="true"
            >
              <span className="text-sm text-muted-foreground">{t('totalEstimeLabel')}</span>
              {cart.discountApplied ? (() => {
                const grossSubtotal = cart.items.reduce(
                  (s, it) => s + (Number.isFinite(it.totalPrice) ? it.totalPrice : 0),
                  0,
                );
                const discounted = cart.getTotal();
                const savings = Math.max(0, grossSubtotal - discounted);
                return (
                  <span className="flex items-baseline gap-2">
                    {savings > 0 && (
                      <s
                        className="text-xs font-semibold text-muted-foreground line-through opacity-50 tabular-nums"
                        aria-label={lang === 'en' ? 'Original total' : 'Total original'}
                      >
                        {fmtMoney(grossSubtotal)} $
                      </s>
                    )}
                    <span className="text-lg font-extrabold text-primary tabular-nums">
                      {fmtMoney(discounted)} $
                    </span>
                  </span>
                );
              })() : (
                <span className="text-lg font-extrabold text-foreground">{fmtMoney(cart.getTotal())} $</span>
              )}
            </div>

            <button
              type="button"
              className="w-full bg-primary text-primary-foreground font-extrabold text-sm py-3.5 rounded-full flex items-center justify-center gap-2 hover:opacity-90 transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2"
              style={{ boxShadow: '0 6px 20px rgba(27,58,107,0.3)' }}
              onClick={() => { onClose(); navigate('/cart'); }}
            >
              {t('passerCaisse')} <ChevronRight size={15} aria-hidden="true" />
            </button>
            <p className="text-center text-[11px] text-muted-foreground">{t('livraisonNote')}</p>
            <button
              type="button"
              onClick={async () => {
                const count = cart.items.length;
                const ok = window.confirm(
                  lang === 'en'
                    ? `Empty your cart? This removes all ${count} item${count > 1 ? 's' : ''} and can't be undone.`
                    : `Vider ton panier ? ${count} article${count > 1 ? 's' : ''} sera${count > 1 ? 'ont' : ''} retiré${count > 1 ? 's' : ''}, c'est irréversible.`,
                );
                if (!ok) return;
                const vids = new Set<string>();
                for (const it of cart.items) {
                  for (const v of it.shopifyVariantIds ?? []) vids.add(v);
                }
                cart.clear();
                for (const variantId of vids) {
                  try { await shopifyCart.removeItem(variantId); }
                  catch (e) { console.warn('Shopify cart removeItem failed during clear', e); }
                }
              }}
              className="w-full text-[11px] text-muted-foreground hover:text-destructive underline underline-offset-2 py-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40 rounded"
            >
              {lang === 'en' ? 'Empty cart' : 'Vider le panier'}
            </button>
          </div>
        )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export { CartDrawer as default };

