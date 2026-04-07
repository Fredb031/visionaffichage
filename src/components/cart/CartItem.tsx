import { Trash2 } from 'lucide-react';
import type { CustomCartItem } from '@/store/cartStore';

interface CartItemProps {
  item: CustomCartItem;
  onRemove: (id: string) => void;
}

export function CartItemCard({ item, onRemove }: CartItemProps) {
  const { customization, productTitle, previewImage, productImage } = item;

  return (
    <div className="flex gap-3 py-3.5 border-b border-border">
      <div className="w-[60px] h-[60px] rounded-lg overflow-hidden bg-secondary flex-shrink-0">
        <img
          src={previewImage ?? productImage}
          alt={productTitle}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-foreground truncate">{productTitle}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          {customization.color} · {customization.totalQuantity} unités
        </div>
        {customization.discount > 0 && (
          <span className="text-[10px] font-bold text-green-600">-{customization.discount}% volume</span>
        )}
        <div className="text-[13px] font-bold text-navy mt-1">
          {customization.totalPrice.toFixed(2)} $
        </div>
      </div>
      <button onClick={() => onRemove(item.id)} className="text-muted-foreground hover:text-destructive transition-colors self-start mt-1">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
