import { useState, useEffect } from "react";
import { Minus, Plus, Trash2, ExternalLink, Loader2, ShoppingCart, X } from "lucide-react";
import { useCartStore } from "@/stores/cartStore";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CartDrawer = ({ isOpen, onClose }: CartDrawerProps) => {
  const { items, isLoading, isSyncing, updateQuantity, removeItem, getCheckoutUrl, syncCart } = useCartStore();
  const [discountCode, setDiscountCode] = useState('');
  const [discountApplied, setDiscountApplied] = useState(false);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.price.amount) * item.quantity), 0);
  const discount = discountApplied ? subtotal * 0.1 : 0;
  const total = subtotal - discount;

  useEffect(() => { if (isOpen) syncCart(); }, [isOpen, syncCart]);

  const handleApplyCode = () => {
    if (discountCode.toUpperCase() === 'VISION10') {
      setDiscountApplied(true);
    }
  };

  const handleCheckout = () => {
    const checkoutUrl = getCheckoutUrl();
    if (checkoutUrl) {
      window.open(checkoutUrl, '_blank');
      onClose();
    }
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-[490] bg-foreground/30" onClick={onClose} />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 w-[400px] max-w-full h-screen bg-card z-[500] border-l border-border transition-[right] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] flex flex-col shadow-[-20px_0_60px_rgba(0,0,0,0.12)] ${
          isOpen ? 'right-0' : '-right-[420px]'
        }`}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <span className="text-base font-bold text-foreground">Mon panier</span>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-border bg-transparent cursor-pointer flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              <ShoppingCart className="h-10 w-10 mx-auto mb-3 opacity-40" />
              Ton panier est vide
            </div>
          ) : (
            <div className="space-y-0">
              {items.map((item) => (
                <div key={item.variantId} className="flex gap-3 py-3.5 border-b border-border">
                  <div className="w-[60px] h-[60px] rounded-lg overflow-hidden bg-secondary flex-shrink-0">
                    {item.product.node.images?.edges?.[0]?.node && (
                      <img
                        src={item.product.node.images.edges[0].node.url}
                        alt={item.product.node.title}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-foreground truncate">{item.product.node.title}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {item.selectedOptions.map(o => o.value).join(' · ')}
                    </div>
                    <div className="text-[13px] font-bold text-primary mt-1.5">
                      {parseFloat(item.price.amount).toFixed(2)} {item.price.currencyCode}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <button
                        onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                        className="w-6 h-6 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                        className="w-6 h-6 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => removeItem(item.variantId)}
                        className="text-[11px] text-muted-foreground underline cursor-pointer ml-auto"
                      >
                        Retirer
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="px-6 py-5 border-t border-border">
            {/* Discount code */}
            <div className="flex gap-2 mb-3.5">
              <input
                type="text"
                placeholder="Code promo"
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value)}
                className="flex-1 border border-border rounded-lg px-3 py-2 text-[13px] outline-none bg-background focus:border-primary"
              />
              <button
                onClick={handleApplyCode}
                className="bg-secondary border border-border rounded-lg px-3.5 py-2 text-[12px] font-bold text-foreground cursor-pointer hover:bg-muted transition-colors"
              >
                Appliquer
              </button>
            </div>

            {discountApplied && (
              <div className="text-[12px] text-green font-semibold mb-2.5">
                ✓ Code VISION10 appliqué — 10% de rabais!
              </div>
            )}

            <div className="flex justify-between text-sm mb-4">
              <span className="text-muted-foreground">Sous-total</span>
              <span className="font-bold text-foreground">
                {total.toFixed(2)} {items[0]?.price.currencyCode}
              </span>
            </div>

            <button
              onClick={handleCheckout}
              disabled={isLoading || isSyncing}
              className="w-full py-[15px] gradient-navy text-primary-foreground border-none rounded-xl text-[15px] font-bold cursor-pointer transition-opacity hover:opacity-85 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading || isSyncing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>Passer à la caisse →</>
              )}
            </button>
          </div>
        )}
      </div>
    </>
  );
};
