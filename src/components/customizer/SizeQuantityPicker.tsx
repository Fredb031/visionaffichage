import { Minus, Plus } from 'lucide-react';
import { useCustomizerStore } from '@/store/customizerStore';
import { PRODUCTS, PRINT_PRICE, BULK_DISCOUNT_THRESHOLD, BULK_DISCOUNT_RATE } from '@/data/products';

export function SizeQuantityPicker() {
  const { productId, sizeQuantities, setSizeQuantity, getTotalQuantity, getEstimatedPrice } = useCustomizerStore();
  const product = PRODUCTS.find((p) => p.id === productId);
  if (!product) return null;

  const totalQty = getTotalQuantity();
  const discount = totalQty >= BULK_DISCOUNT_THRESHOLD ? BULK_DISCOUNT_RATE * 100 : 0;
  const unitPrice = product.basePrice + PRINT_PRICE;
  const estimatedTotal = getEstimatedPrice();

  return (
    <div className="p-5">
      <h3 className="text-sm font-bold text-foreground mb-1">Tailles & Quantités</h3>
      <p className="text-xs text-muted-foreground mb-4">Minimum 1 unité · 15% dès 12 unités</p>

      <div className="space-y-2">
        {product.sizes.map((size) => {
          const qty = sizeQuantities.find((s) => s.size === size)?.quantity ?? 0;
          return (
            <div key={size} className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-sm font-semibold w-12">{size}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSizeQuantity(size, Math.max(0, qty - 1))}
                  className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-8 text-center text-sm font-bold">{qty}</span>
                <button
                  onClick={() => setSizeQuantity(size, qty + 1)}
                  className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 bg-secondary rounded-xl p-4 space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total unités</span>
          <span className="font-bold text-foreground">{totalQty}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between font-bold" style={{ color: '#1B7A3E' }}>
            <span>Rabais volume</span>
            <span>-{discount}%</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Prix unitaire</span>
          <span className="font-bold text-foreground">{unitPrice.toFixed(2)} $</span>
        </div>
        <div className="flex justify-between text-sm font-bold text-navy pt-2 border-t border-border">
          <span>Total estimé</span>
          <span>{estimatedTotal.toFixed(2)} $</span>
        </div>
      </div>
    </div>
  );
}
