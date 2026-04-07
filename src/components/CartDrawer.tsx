import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingBag, Trash2, Tag, ChevronRight } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const VALID_CODES: Record<string, number> = { VISION10: 0.10, VISION15: 0.15, VISION20: 0.20 };

export const CartDrawer = ({ isOpen, onClose }: CartDrawerProps) => {
  const cart = useCartStore();
  const [discountInput, setDiscountInput] = useState('VISION10');
  const [discountMsg, setDiscountMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const handleApply = () => {
    const ok = cart.applyDiscount(discountInput);
    setDiscountMsg(ok ? { ok: true, text: `Code ${discountInput.toUpperCase()} appliqué !` } : { ok: false, text: 'Code invalide' });
    setTimeout(() => setDiscountMsg(null), 3000);
  };

  const total = cart.getTotal();
  const itemCount = cart.getItemCount();

  return (
    <>
      {/* Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/25 z-[490] backdrop-blur-[2px]"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Drawer */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: isOpen ? '0%' : '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        className="fixed top-0 right-0 h-full w-full max-w-sm bg-card z-[500] shadow-2xl flex flex-col border-l border-border"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag size={18} className="text-primary" />
            <h2 className="text-base font-extrabold text-foreground">Mon panier</h2>
            {itemCount > 0 && (
              <span className="bg-primary text-primary-foreground text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-auto p-5 space-y-3">
          <AnimatePresence>
            {cart.items.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-48 gap-3"
              >
                <ShoppingBag size={40} className="text-border" />
                <p className="text-sm text-muted-foreground font-medium">Ton panier est vide</p>
                <button
                  onClick={onClose}
                  className="text-xs font-bold text-primary underline"
                >
                  Explorer les produits
                </button>
              </motion.div>
            ) : (
              cart.items.map((item) => (
                <motion.div
                  key={item.cartId}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 40 }}
                  className="flex gap-3 p-3 border border-border rounded-xl bg-secondary/50"
                >
                  {/* Product preview with logo overlay */}
                  <div className="w-16 h-16 rounded-lg bg-secondary overflow-hidden flex-shrink-0 relative">
                    <img
                      src={item.previewSnapshot}
                      alt={item.productName}
                      className="w-full h-full object-contain p-1"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-extrabold text-foreground truncate">{item.productName}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {item.sizeQuantities.filter(s => s.quantity > 0).map(s => `${s.size}×${s.quantity}`).join(' · ')}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <p className="text-xs font-extrabold text-primary">
                        {item.totalPrice.toFixed(2)} $
                      </p>
                      <span className="text-[10px] text-muted-foreground">
                        ({item.totalQuantity} unité{item.totalQuantity !== 1 ? 's' : ''})
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => cart.removeItem(item.cartId)}
                    className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 self-start mt-0.5"
                  >
                    <Trash2 size={14} />
                  </button>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        {cart.items.length > 0 && (
          <div className="p-5 border-t border-border space-y-3 bg-card">
            {/* Discount code */}
            {!cart.discountApplied ? (
              <div className="flex gap-2">
                <input
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value.toUpperCase())}
                  placeholder="Code de rabais"
                  className="flex-1 border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary font-mono bg-secondary"
                />
                <button
                  onClick={handleApply}
                  className="bg-secondary border border-border rounded-xl px-4 py-2.5 text-xs font-extrabold text-foreground hover:border-primary transition-colors"
                >
                  Appliquer
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-xl">
                <Tag size={12} className="text-green-700" />
                <span className="text-xs font-bold text-green-700">
                  Code {cart.discountCode} appliqué
                </span>
                <button
                  onClick={() => cart.applyDiscount('')}
                  className="ml-auto text-green-500 hover:text-green-700"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {discountMsg && (
              <p className={`text-xs font-bold px-1 ${discountMsg.ok ? 'text-green-700' : 'text-destructive'}`}>
                {discountMsg.text}
              </p>
            )}

            {/* Total */}
            <div className="flex justify-between items-center py-1">
              <span className="text-sm text-muted-foreground font-medium">Total estimé</span>
              <span className="text-lg font-extrabold text-foreground">{total.toFixed(2)} $</span>
            </div>

            {/* Checkout */}
            <button
              className="w-full gradient-navy-dark text-primary-foreground font-extrabold text-sm py-4 rounded-full flex items-center justify-center gap-2 transition-all hover:opacity-90 hover:-translate-y-px"
              style={{ boxShadow: '0 6px 20px hsla(var(--navy), 0.3)' }}
              onClick={() => alert('→ Shopify Checkout integration — add VITE_SHOPIFY_STOREFRONT_TOKEN to .env')}
            >
              Passer à la caisse
              <ChevronRight size={16} />
            </button>
            <p className="text-center text-[11px] text-muted-foreground">
              Livraison en 5 jours · Paiement sécurisé Shopify
            </p>
          </div>
        )}
      </motion.div>
    </>
  );
};
