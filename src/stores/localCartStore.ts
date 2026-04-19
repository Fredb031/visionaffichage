import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItemCustomization } from '@/types/customization';
import { normalizeInvisible } from '@/lib/utils';

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
        // Trim + normalize + uppercase so "  vision10 " pasted from an
        // email still matches. normalizeInvisible strips zero-width
        // passengers (ZWSP, BOM, etc) that sneak in from Slack/Notion
        // pastes — without it the strict lookup below would miss a
        // code that looks 100% correct to the user.
        const normalized = normalizeInvisible(code).trim().toUpperCase();
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
    {
      name: 'vision-cart',
      // Dedup + drop malformed rows on hydration. A corrupted localStorage
      // (crash during a write, devtools tweak, older build without
      // crypto.randomUUID fallback) could persist items with duplicate
      // or missing cartIds. React's list-key warning fires on the
      // duplicates, and downstream code that maps by cartId silently
      // operates on only the first match. Scrub at load time so the
      // rest of the app sees a clean invariant.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (!Array.isArray(state.items)) { state.items = []; return; }
        const seen = new Set<string>();
        state.items = state.items.filter(it => {
          if (!it || typeof it !== 'object') return false;
          if (typeof it.cartId !== 'string' || !it.cartId) return false;
          if (seen.has(it.cartId)) return false;
          seen.add(it.cartId);
          return true;
        });
        // Scrub blob: previewSnapshots — they were valid at persist
        // time but don't survive a page reload. Replace with undefined
        // so the img tag's onError path shows the container background
        // instead of the native broken-image glyph.
        for (const it of state.items) {
          if (typeof it.previewSnapshot === 'string' && it.previewSnapshot.startsWith('blob:')) {
            it.previewSnapshot = '';
          }
        }
      },
    }
  )
);
