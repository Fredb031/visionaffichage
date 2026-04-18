import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItemCustomization } from '@/types/customization';

interface CartStore {
  items: CartItemCustomization[];
  isOpen: boolean;
  discountCode: string | null;
  discountApplied: boolean;
  addItem: (item: Omit<CartItemCustomization, 'cartId' | 'addedAt'>) => void;
  removeItem: (cartId: string) => void;
  toggleCart: () => void;
  applyDiscount: (code: string) => boolean;
  clearDiscount: () => void;
  getTotal: () => number;
  getItemCount: () => number;
  clear: () => void;
}

const VALID_DISCOUNT_CODES: Record<string, number> = {
  'VISION10': 0.10,
  'VISION15': 0.15,
  'VISION20': 0.20,
};

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      discountCode: null,
      discountApplied: false,

      addItem: (item) => {
        const cartId = crypto.randomUUID();
        set((state) => ({
          items: [...state.items, { ...item, cartId, addedAt: new Date() }],
          isOpen: true,
        }));
      },

      removeItem: (cartId) =>
        set((state) => ({ items: state.items.filter((i) => i.cartId !== cartId) })),

      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),

      applyDiscount: (code) => {
        const rate = VALID_DISCOUNT_CODES[code.toUpperCase()];
        if (rate) {
          set({ discountCode: code.toUpperCase(), discountApplied: true });
          return true;
        }
        return false;
      },

      clearDiscount: () => set({ discountCode: null, discountApplied: false }),

      getTotal: () => {
        const { items, discountApplied, discountCode } = get();
        // Guard against corrupted localStorage from older app versions
        // that might have items missing totalPrice (NaN propagates through reduce).
        const subtotal = items.reduce((sum, item) => sum + (Number.isFinite(item.totalPrice) ? item.totalPrice : 0), 0);
        if (discountApplied && discountCode) {
          const rate = VALID_DISCOUNT_CODES[discountCode] ?? 0;
          return parseFloat((subtotal * (1 - rate)).toFixed(2));
        }
        return parseFloat(subtotal.toFixed(2));
      },

      getItemCount: () => get().items.reduce((sum, i) => sum + (Number.isFinite(i.totalQuantity) ? i.totalQuantity : 0), 0),
      clear: () => set({ items: [], discountCode: null, discountApplied: false }),
    }),
    { name: 'vision-cart' }
  )
);
