import { Minus, Plus, Check } from 'lucide-react';
import { useState } from 'react';
import type { Product } from '@/data/products';
import { BULK_DISCOUNT_THRESHOLD, BULK_DISCOUNT_RATE } from '@/data/products';
import { useLang } from '@/lib/langContext';
import type { ShopifyVariantColor } from '@/lib/shopify';

export interface VariantQty {
  colorId: string;
  colorName: string;
  hex: string;
  size: string;
  qty: number;
}

interface Props {
  product: Product;
  /** Colors from Shopify (preferred) or local. Always show all. */
  colors: Pick<ShopifyVariantColor, 'variantId' | 'colorName' | 'hex'>[];
  /** Already-picked variants (color × size cells). */
  variants: VariantQty[];
  onChange: (next: VariantQty[]) => void;
}

export function MultiVariantPicker({ product, colors, variants, onChange }: Props) {
  const { lang } = useLang();

  // Derive list of colors the user has activated (added at least one of)
  // PLUS a single "active" color for new picks via the color row above.
  const [activeColorId, setActiveColorId] = useState<string>(
    variants[0]?.colorId ?? colors[0]?.variantId ?? '',
  );
  const activeColor = colors.find(c => c.variantId === activeColorId) ?? colors[0];

  const totalQty = variants.reduce((s, v) => s + v.qty, 0);
  const hasDiscount = totalQty >= BULK_DISCOUNT_THRESHOLD;
  const pct = Math.round(BULK_DISCOUNT_RATE * 100);

  const getQty = (colorId: string, size: string) =>
    variants.find(v => v.colorId === colorId && v.size === size)?.qty ?? 0;

  const setQty = (color: typeof activeColor, size: string, qty: number) => {
    if (!color) return;
    const filtered = variants.filter(v => !(v.colorId === color.variantId && v.size === size));
    const next = qty > 0
      ? [...filtered, { colorId: color.variantId, colorName: color.colorName, hex: color.hex, size, qty }]
      : filtered;
    onChange(next);
  };

  // Group variants by color for the summary chips
  const colorGroups = colors
    .map(c => ({
      color: c,
      qty: variants.filter(v => v.colorId === c.variantId).reduce((s, v) => s + v.qty, 0),
    }))
    .filter(g => g.qty > 0);

  if (!activeColor || colors.length === 0) {
    return (
      <div className="text-xs text-muted-foreground text-center py-4">
        {lang === 'en' ? 'No colors available' : 'Aucune couleur disponible'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Discount banner */}
      <div className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
        hasDiscount ? 'bg-emerald-600/10 text-emerald-700' : 'bg-secondary text-muted-foreground'
      }`}>
        <span>
          {hasDiscount
            ? (lang === 'en' ? `${pct}% discount applied!` : `${pct}% de rabais appliqué !`)
            : (lang === 'en' ? `Order ${BULK_DISCOUNT_THRESHOLD}+ for -${pct}%` : `${BULK_DISCOUNT_THRESHOLD}+ unités pour -${pct}%`)}
        </span>
        <span className="font-black">
          {totalQty} {lang === 'en' ? (totalQty !== 1 ? 'units' : 'unit') : (totalQty !== 1 ? 'unités' : 'unité')}
        </span>
      </div>

      {/* Color picker row — pick which color you're adding sizes to */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
          {lang === 'en' ? 'Choose color, then add sizes below' : 'Choisis la couleur, puis ajoute les tailles'}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {colors.map(c => {
            const isActive = c.variantId === activeColorId;
            const colorTotal = variants.filter(v => v.colorId === c.variantId).reduce((s, v) => s + v.qty, 0);
            return (
              <button
                key={c.variantId}
                type="button"
                onClick={() => setActiveColorId(c.variantId)}
                title={c.colorName}
                className={`relative w-9 h-9 rounded-full transition-all ${
                  isActive
                    ? 'ring-2 ring-primary ring-offset-2 scale-110'
                    : 'ring-1 ring-border hover:ring-primary/50'
                }`}
                style={{ background: c.hex }}
              >
                {isActive && (
                  <Check size={13} className="absolute inset-0 m-auto text-white drop-shadow" strokeWidth={3} />
                )}
                {colorTotal > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-primary text-primary-foreground text-[10px] font-extrabold rounded-full flex items-center justify-center px-1 shadow-sm">
                    {colorTotal}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="text-[11px] font-bold text-foreground mt-2">
          {activeColor.colorName}
        </div>
      </div>

      {/* Size quantity stepper for the ACTIVE color */}
      <div>
        <div className={`grid gap-2 ${product.sizes.length === 1 ? 'grid-cols-1' : 'grid-cols-3 sm:grid-cols-4'}`}>
          {product.sizes.map(size => {
            const qty = getQty(activeColor.variantId, size);
            return (
              <div
                key={size}
                className={`rounded-xl border p-2 transition-all ${
                  qty > 0 ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <div className="text-xs font-black text-foreground mb-1.5 text-center">{size}</div>
                <div className="flex items-center justify-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setQty(activeColor, size, Math.max(0, qty - 1))}
                    disabled={qty === 0}
                    className="w-6 h-6 rounded-full border border-border flex items-center justify-center text-muted-foreground disabled:opacity-30 hover:border-primary transition-all"
                  >
                    <Minus size={10} />
                  </button>
                  <span className={`w-7 text-center text-sm font-black ${qty > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                    {qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQty(activeColor, size, qty + 1)}
                    className="w-6 h-6 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-all"
                  >
                    <Plus size={10} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary of all picked color × size combinations */}
      {colorGroups.length > 0 && (
        <div className="bg-secondary/50 rounded-xl p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            {lang === 'en' ? 'Your order' : 'Ta commande'}
          </div>
          <div className="space-y-1.5">
            {colorGroups.map(g => {
              const sizes = variants
                .filter(v => v.colorId === g.color.variantId)
                .map(v => `${v.size}×${v.qty}`)
                .join(' · ');
              return (
                <div key={g.color.variantId} className="flex items-center gap-2 text-xs">
                  <span className="w-3 h-3 rounded-full ring-1 ring-border flex-shrink-0" style={{ background: g.color.hex }} />
                  <span className="font-bold flex-shrink-0">{g.color.colorName}</span>
                  <span className="text-muted-foreground truncate">{sizes}</span>
                  <span className="ml-auto font-extrabold text-primary">{g.qty}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
