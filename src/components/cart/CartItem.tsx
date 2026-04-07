import { Trash2 } from 'lucide-react';
import type { CartItemCustomization } from '@/types/customization';

interface CartItemProps {
  item: CartItemCustomization;
  onRemove: (cartId: string) => void;
}

export function CartItemCard({ item, onRemove }: CartItemProps) {
  return (
    <div className="flex gap-3 py-3.5 border-b border-border">
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-foreground truncate">{item.productName}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{item.totalQuantity} unités</div>
        <div className="text-[13px] font-bold text-navy mt-1">{item.totalPrice.toFixed(2)} $</div>
      </div>
      <button onClick={() => onRemove(item.cartId)} className="text-muted-foreground hover:text-destructive self-start mt-1">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
