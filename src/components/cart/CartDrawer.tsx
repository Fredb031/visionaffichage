/**
 * CartDrawer — Panier avec aperçu produit live (devant + logo)
 * Chaque article montre l'image devant avec le logo overlaid.
 */
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingBag, Trash2, Tag, ChevronRight } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { useLang } from '@/lib/langContext';
import { PRODUCTS } from '@/data/products';
import type { CartItemCustomization } from '@/types/customization';

// ── Cart item preview — product image + logo overlaid ──────────────────────
function CartItemPreview({ item }: { item: CartItemCustomization }) {
  const product = PRODUCTS.find(p => p.id === item.productId);
  const color = product?.colors.find(c => c.id === item.colorId);

  // Use colour-specific front image, fallback to product default
  const frontImg = color?.imageDevant ?? product?.imageDevant ?? item.previewSnapshot;
  const logoUrl  = item.logoPlacement?.previewUrl ?? item.logoPlacement?.processedUrl;

  // Logo position as CSS % over the image
  const lx = item.logoPlacement?.x ?? 50;
  const ly = item.logoPlacement?.y ?? 32;
  const lw = item.logoPlacement?.width ?? 28;

  return (
    <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-border bg-secondary flex-shrink-0">
      {/* Product image */}
      {frontImg && (
        <img src={frontImg} alt="" className="w-full h-full object-cover" />
      )}

      {/* Colour overlay */}
      {color && color.hex !== '#F2F0EB' && (
        <div
          className="absolute inset-0"
          style={{ background: color.hex, opacity: 0.15, mixBlendMode: 'multiply' }}
        />
      )}

      {/* Logo overlay */}
      {logoUrl && (
        <img
          src={logoUrl}
          alt="Logo"
          className="absolute object-contain pointer-events-none"
          style={{
            left:   `${Math.max(0, lx - lw / 2)}%`,
            top:    `${Math.max(0, ly - lw * 0.3)}%`,
            width:  `${lw}%`,
            maxWidth: '80%',
          }}
        />
      )}

      {/* Colour dot */}
      {color && (
        <div className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full ring-1 ring-white/80 shadow-sm" style={{ background: color.hex }} />
      )}
    </div>
  );
}

// ── Cart drawer ──────────────────────────────────────────────────────────────
const VALID_CODES: Record<string, number> = { VISION10: 0.10, VISION15: 0.15, VISION20: 0.20 };

export function CartDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { t } = useLang();
  const cart = useCartStore();
  const [codeInput, setCodeInput] = useState('');
  const [codeMsg, setCodeMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const applyCode = () => {
    const ok = cart.applyDiscount(codeInput.toUpperCase());
    setCodeMsg(ok ? { ok: true, text: `Code ${codeInput.toUpperCase()} appliqué !` } : { ok: false, text: 'Code invalide' });
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
                className="flex flex-col items-center justify-center h-52 gap-3"
              >
                <ShoppingBag size={38} className="text-border" />
                <p className="text-sm text-muted-foreground font-medium">{t('panierVide')}</p>
                <button onClick={onClose} className="text-xs font-bold text-primary underline">{t('explorerProduits')}</button>
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
                          ({item.totalQuantity} {item.totalQuantity !== 1 ? 'unités' : 'unité'})
                        </span>
                      </div>
                    </div>

                    <button onClick={() => cart.removeItem(item.cartId)} className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 self-start mt-0.5">
                      <Trash2 size={14} />
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
                <span className="text-xs font-bold text-green-700">Code {cart.discountCode} appliqué</span>
                <button onClick={() => cart.applyDiscount('')} className="ml-auto text-green-500"><X size={11} /></button>
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
              onClick={() => alert('→ Configure VITE_SHOPIFY_STOREFRONT_TOKEN pour le checkout')}
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
