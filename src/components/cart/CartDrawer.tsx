import { X, ShoppingCart } from 'lucide-react';
import { Trash2 } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';

export function CustomCartDrawer() {
  const { items, isOpen, toggleCart, removeItem, getTotal, getItemCount } = useCartStore();

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-[590] bg-foreground/25" onClick={toggleCart} />}
      <div
        className={`fixed top-0 w-[400px] max-w-full h-screen bg-background z-[600] border-l border-border transition-[right] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] flex flex-col shadow-[-20px_0_60px_rgba(0,0,0,0.12)] ${
          isOpen ? 'right-0' : '-right-[420px]'
        }`}
      >
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <span className="text-base font-bold text-foreground">Mon panier ({getItemCount()})</span>
          <button onClick={toggleCart} className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-40" />
              Ton panier est vide
            </div>
          ) : (
            items.map((item) => (
              <div key={item.cartId} className="flex gap-3 py-3.5 border-b border-border">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-foreground truncate">{item.productName}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{item.totalQuantity} unités</div>
                  <div className="text-[13px] font-bold text-navy mt-1">{item.totalPrice.toFixed(2)} $</div>
                </div>
                <button onClick={() => removeItem(item.cartId)} className="text-muted-foreground hover:text-destructive self-start mt-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="px-6 py-5 border-t border-border">
            <div className="flex justify-between text-sm mb-4">
              <span className="text-muted-foreground">Total</span>
              <span className="font-bold text-foreground">{getTotal().toFixed(2)} $</span>
            </div>
            <button className="w-full py-[15px] gradient-navy text-white border-none rounded-xl text-[15px] font-bold hover:opacity-85">
              Passer à la caisse →
            </button>
          </div>
        )}
      </div>
    </>
  );
}
