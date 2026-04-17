import { Minus, Plus } from 'lucide-react';
import type { Product } from '@/data/products';
import { BULK_DISCOUNT_THRESHOLD, BULK_DISCOUNT_RATE } from '@/data/products';
import type { SizeQuantity } from '@/types/customization';
import { useLang } from '@/lib/langContext';

export function SizeQuantityPicker({
  product,
  sizeQuantities,
  onUpdate,
}: {
  product: Product;
  sizeQuantities: SizeQuantity[];
  onUpdate: (size: string, qty: number) => void;
}) {
  const { lang } = useLang();
  const getQty = (size: string) => sizeQuantities.find((s) => s.size === size)?.quantity ?? 0;
  const totalQty = sizeQuantities.reduce((sum, s) => sum + s.quantity, 0);
  const hasDiscount = totalQty >= BULK_DISCOUNT_THRESHOLD;
  const pct = Math.round(BULK_DISCOUNT_RATE * 100);

  return (
    <div className="space-y-3">
      <div className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
        hasDiscount ? 'bg-green-600/10 text-green-700' : 'bg-secondary text-muted-foreground'
      }`}>
        <span>
          {hasDiscount
            ? (lang === 'en' ? `${pct}% discount applied!` : `${pct}% de rabais appliqué !`)
            : (lang === 'en' ? `Order ${BULK_DISCOUNT_THRESHOLD}+ for -${pct}%` : `Commande ${BULK_DISCOUNT_THRESHOLD}+ pour -${pct}%`)}
        </span>
        <span className="font-black">
          {totalQty} {lang === 'en' ? (totalQty !== 1 ? 'units' : 'unit') : (totalQty !== 1 ? 'unités' : 'unité')}
        </span>
      </div>

      <div className={`grid gap-2 ${product.sizes.length === 1 ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3'}`}>
        {product.sizes.map((size) => {
          const qty = getQty(size);
          return (
            <div
              key={size}
              className={`rounded-xl border p-3 transition-all ${
                qty > 0 ? 'border-navy bg-navy/5' : 'border-border'
              }`}
            >
              <div className="text-xs font-black text-foreground mb-2 text-center">{size}</div>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => onUpdate(size, Math.max(0, qty - 1))}
                  disabled={qty === 0}
                  className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-muted-foreground disabled:opacity-30 hover:border-navy transition-all"
                >
                  <Minus size={12} />
                </button>
                <span className={`w-8 text-center text-sm font-black ${qty > 0 ? 'text-navy' : 'text-muted-foreground'}`}>
                  {qty}
                </span>
                <button
                  onClick={() => onUpdate(size, qty + 1)}
                  className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:border-navy hover:text-navy transition-all"
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
