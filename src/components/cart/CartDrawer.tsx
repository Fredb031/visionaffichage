/**
 * CartDrawer — Panier avec aperçu produit live (devant + logo)
 * Chaque article montre l'image devant avec le logo overlaid.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingBag, Trash2, Tag, ChevronRight } from 'lucide-react';
import { useCartStore } from '@/stores/localCartStore';
import { useCartStore as useShopifyCartStore } from '@/stores/cartStore';
import { useLang } from '@/lib/langContext';
import { PRODUCTS } from '@/data/products';
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
      {img && <img src={img} alt={alt} className="w-full h-full object-cover" />}
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
  const handleRemoveItem = async (cartId: string) => {
    const item = cart.items.find(i => i.cartId === cartId);
    cart.removeItem(cartId);
    if (item?.shopifyVariantIds && item.shopifyVariantIds.length > 0) {
      for (const variantId of item.shopifyVariantIds) {
        try { await shopifyCart.removeItem(variantId); } catch (e) { console.warn('Shopify cart removeItem failed', e); }
      }
    }
  };
  const [codeInput, setCodeInput] = useState('');
  const [codeMsg, setCodeMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const applyCode = () => {
    const ok = cart.applyDiscount(codeInput.toUpperCase());
    setCodeMsg(
      ok
        ? { ok: true, text: lang === 'en' ? `Code ${codeInput.toUpperCase()} applied!` : `Code ${codeInput.toUpperCase()} appliqué !` }
        : { ok: false, text: lang === 'en' ? 'Invalid code' : 'Code invalide' }
    );
    setTimeout(() => setCodeMsg(null), 3000);
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div key="overlay" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            className="fixed inset-0 bg-foreground/25 z-[490] backdrop-blur-[2px]" onClick={onClose} />
        )}
      </AnimatePresence>

      <motion.div
        initial={{ x:'100%' }} animate={{ x: isOpen ? '0%' : '100%' }}
        transition={{ type:'spring', stiffness:300, damping:32 }}
        className="fixed top-0 right-0 h-full w-full max-w-sm bg-card z-[500] shadow-2xl flex flex-col border-l border-border"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag size={16} className="text-primary" />
            <h2 className="text-base font-extrabold text-foreground">{t('monPanier')}</h2>
            {cart.getItemCount() > 0 && (
              <span className="bg-primary text-primary-foreground text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center">
                {cart.getItemCount()}
              </span>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary">
            <X size={14} />
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
                    <ShoppingBag size={32} className="text-[#0052CC]" strokeWidth={1.5} />
                  </div>
                </div>
                <h3 className="text-lg font-extrabold text-foreground mb-1">{t('panierVide')}</h3>
                <p className="text-xs text-muted-foreground mb-5 max-w-[240px] leading-relaxed">
                  {t('explorerProduits')}
                  {' — '}
                  {lang === 'en' ? 'delivered in 5 days, no minimum.' : 'livré en 5 jours, aucun minimum.'}
                </p>
                <button
                  onClick={onClose}
                  className="text-sm font-extrabold text-primary-foreground gradient-navy px-5 py-2.5 rounded-full shadow-navy"
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
                        <p className="text-xs font-extrabold text-primary">{item.totalPrice.toFixed(2)} $</p>
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
          <div className="p-4 border-t border-border space-y-3 bg-card">
            {!cart.discountApplied ? (
              <div className="flex gap-2">
                <input
                  value={codeInput}
                  onChange={e => setCodeInput(e.target.value.toUpperCase())}
                  placeholder={t('codeRabais')}
                  className="flex-1 border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary font-mono bg-secondary"
                />
                <button onClick={applyCode} className="bg-secondary border border-border rounded-xl px-4 py-2.5 text-xs font-extrabold text-foreground hover:border-primary transition-colors">
                  {t('appliquer')}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-xl">
                <Tag size={11} className="text-green-700" />
                <span className="text-xs font-bold text-green-700">
                  {lang === 'en' ? `Code ${cart.discountCode} applied` : `Code ${cart.discountCode} appliqué`}
                </span>
                <button onClick={() => cart.clearDiscount()} className="ml-auto text-green-500"><X size={11} /></button>
              </div>
            )}
            {codeMsg && <p className={`text-xs font-bold px-1 ${codeMsg.ok ? 'text-green-700' : 'text-destructive'}`}>{codeMsg.text}</p>}

            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t('totalEstimeLabel')}</span>
              <span className="text-lg font-extrabold text-foreground">{cart.getTotal().toFixed(2)} $</span>
            </div>

            <button
              className="w-full bg-primary text-primary-foreground font-extrabold text-sm py-3.5 rounded-full flex items-center justify-center gap-2 hover:opacity-90 transition-all"
              style={{ boxShadow: '0 6px 20px rgba(27,58,107,0.3)' }}
              onClick={() => { onClose(); navigate('/cart'); }}
            >
              {t('passerCaisse')} <ChevronRight size={15} />
            </button>
            <p className="text-center text-[11px] text-muted-foreground">{t('livraisonNote')}</p>
          </div>
        )}
      </motion.div>
    </>
  );
}

export { CartDrawer as default };

