import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItemCustomization } from '@/types/customization';

// crypto.randomUUID is not available on every browser we ship to
// (older mobile Safari, some in-app WebViews). Fall back to a
// timestamp + random suffix so addItem never throws and drops the
// user's cart line on the floor.
function newCartId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch { /* ignore — fall through to the suffix version */ }
  return `cart-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

interface CartStore {
  items: CartItemCustomization[];
  discountCode: string | null;
  discountApplied: boolean;
  addItem: (item: Omit<CartItemCustomization, 'cartId' | 'addedAt'>) => void;
  removeItem: (cartId: string) => void;
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
      discountCode: null,
      discountApplied: false,

      addItem: (item) => {
        const cartId = newCartId();
        set((state) => ({
          items: [...state.items, { ...item, cartId, addedAt: new Date() }],
        }));
      },

      removeItem: (cartId) =>
        set((state) => ({ items: state.items.filter((i) => i.cartId !== cartId) })),

      applyDiscount: (code) => {
        // Trim + uppercase so "  vision10 " pasted from an email still
        // matches. Without this the lookup silently fails and the UI
        // flashes 'invalid code' for what looks like a correct code.
        const normalized = code.trim().toUpperCase();
        const rate = VALID_DISCOUNT_CODES[normalized];
        if (rate) {
          set({ discountCode: normalized, discountApplied: true });
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
