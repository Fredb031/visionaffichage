import { Minus, Plus } from 'lucide-react';
import { useCustomizerStore } from '@/store/customizerStore';

export function SizeQuantityPicker() {
  const { sizeQuantities, setSizeQuantity, getTotalQuantity, getDiscount, getUnitPrice, product } = useCustomizerStore();
  const totalQty = getTotalQuantity();
  const discount = getDiscount();
  const unitPrice = getUnitPrice();

  return (
    <div className="p-5">
      <h3 className="text-sm font-bold text-foreground mb-1">Tailles & Quantités</h3>
      <p className="text-xs text-muted-foreground mb-4">Minimum 1 unité · Rabais volume automatique</p>

      <div className="space-y-2">
        {sizeQuantities.map((sq) => (
          <div key={sq.size} className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-sm font-semibold w-12">{sq.size}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSizeQuantity(sq.size, sq.quantity - 1)}
                className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="w-8 text-center text-sm font-bold">{sq.quantity}</span>
              <button
                onClick={() => setSizeQuantity(sq.size, sq.quantity + 1)}
                className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 bg-secondary rounded-xl p-4 space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Total unités</span>
          <span className="font-bold text-foreground">{totalQty}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-green-600 font-bold">Rabais volume</span>
            <span className="text-green-600 font-bold">-{discount}%</span>
          </div>
        )}
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Prix unitaire</span>
          <span className="font-bold text-foreground">{unitPrice.toFixed(2)} $</span>
        </div>
        <div className="flex justify-between text-sm font-bold text-navy pt-2 border-t border-border">
          <span>Total</span>
          <span>{(unitPrice * totalQty).toFixed(2)} $</span>
        </div>
      </div>
    </div>
  );
}
