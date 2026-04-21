import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItemCustomization } from '@/types/customization';
import { normalizeInvisible } from '@/lib/utils';
import { getSettings, DEFAULT_APP_SETTINGS } from '@/lib/appSettings';

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
  /**
   * Optimistic row-level quantity update. Scales sizeQuantities
   * proportionally so Size×Qty breakdown stays consistent, recomputes
   * totalQuantity + totalPrice from unitPrice. Callers that need to
   * mirror to Shopify should read the snapshot BEFORE calling and
   * pass it back to rollbackItem on failure.
   */
  updateItemQuantity: (cartId: string, newTotalQuantity: number) => void;
  /** Restore a previous item snapshot — used to revert an optimistic
   * update when the background Shopify sync fails. No-op if the item
   * has since been removed. */
  rollbackItem: (snapshot: CartItemCustomization) => void;
  applyDiscount: (code: string) => boolean;
  clearDiscount: () => void;
  getTotal: () => number;
  getItemCount: () => number;
  clear: () => void;
}

// Discount codes are admin-editable via /admin/settings. Read through
// getSettings() at call-time so a freshly-saved VISION25 takes effect
// on the next apply without a page reload. Falls back to the hardcoded
// defaults if the settings module or localStorage is unavailable.
function getValidDiscountCodes(): Record<string, number> {
  try {
    const { discountCodes } = getSettings();
    if (discountCodes && Object.keys(discountCodes).length > 0) return discountCodes;
  } catch { /* fall through to defaults */ }
  return { ...DEFAULT_APP_SETTINGS.discountCodes };
}

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
        set((state) => {
          const items = state.items.filter((i) => i.cartId !== cartId);
          // Drop the discount alongside the last item — a promo applied
          // to a cart that's now empty looks stale ("VISION10 applied"
          // on an empty total) and would silently re-apply on the next
          // add. The user can always re-paste the code.
          if (items.length === 0 && state.discountApplied) {
            return { items, discountCode: null, discountApplied: false };
          }
          return { items };
        }),

      // Scale sizeQuantities proportionally to the new row total so the
      // Size×Qty breakdown stays valid (e.g. S:1 M:2 at total=3 → at
      // total=6 becomes S:2 M:4). Rounding can drift by 1 on odd ratios;
      // the final size absorbs the drift so sum(sizeQuantities) exactly
      // matches newTotalQuantity (otherwise totalQuantity and the sum
      // disagree and downstream pricing/Shopify sync gets confused).
      updateItemQuantity: (cartId, newTotalQuantity) =>
        set((state) => {
          const n = Math.max(0, Math.floor(Number.isFinite(newTotalQuantity) ? newTotalQuantity : 0));
          if (n === 0) {
            // Treat a decrement-to-zero as a remove so we don't leave
            // empty rows cluttering the cart page. Mirrors the Shopify
            // updateQuantity behaviour in stores/cartStore.ts.
            const items = state.items.filter(i => i.cartId !== cartId);
            if (items.length === 0 && state.discountApplied) {
              return { items, discountCode: null, discountApplied: false };
            }
            return { items };
          }
          const items = state.items.map(it => {
            if (it.cartId !== cartId) return it;
            const prevTotal = Math.max(1, it.totalQuantity || 1);
            const ratio = n / prevTotal;
            const activeSizes = (it.sizeQuantities ?? []).filter(s => s.quantity > 0);
            let scaled: typeof it.sizeQuantities;
            if (activeSizes.length === 0) {
              // Defensive: no size breakdown to scale. Treat as a single
              // implicit bucket so the update still lands.
              scaled = it.sizeQuantities ?? [];
            } else {
              scaled = (it.sizeQuantities ?? []).map(s =>
                s.quantity > 0 ? { ...s, quantity: Math.max(1, Math.round(s.quantity * ratio)) } : s,
              );
              const sum = scaled.reduce((acc, s) => acc + (s.quantity > 0 ? s.quantity : 0), 0);
              const drift = n - sum;
              if (drift !== 0) {
                // Walk the active sizes from last to first and shift by
                // drift, clamping to >=1 so we never create a phantom row.
                for (let i = scaled.length - 1; i >= 0 && drift !== 0; i--) {
                  if (scaled[i].quantity <= 0) continue;
                  const next = Math.max(1, scaled[i].quantity + drift);
                  const applied = next - scaled[i].quantity;
                  scaled[i] = { ...scaled[i], quantity: next };
                  // Once we've absorbed the full drift, stop.
                  if (applied === drift) break;
                }
              }
            }
            const unitPrice = Number.isFinite(it.unitPrice) ? it.unitPrice : 0;
            return {
              ...it,
              sizeQuantities: scaled,
              totalQuantity: n,
              totalPrice: parseFloat((unitPrice * n).toFixed(2)),
            };
          });
          return { items };
        }),

      // Used by cart-row optimistic UI to revert a failed Shopify sync
      // without having to track the diff by hand. Only rewrites the
      // mutable row fields so we don't clobber any concurrent edits
      // to unrelated rows.
      rollbackItem: (snapshot) =>
        set((state) => {
          const exists = state.items.some(i => i.cartId === snapshot.cartId);
          if (!exists) {
            // Row was removed between the failing request and this
            // rollback. Re-inserting it silently would confuse the user
            // more than the lost revert, so leave the cart alone.
            return state;
          }
          return {
            items: state.items.map(i => (i.cartId === snapshot.cartId ? snapshot : i)),
          };
        }),

      applyDiscount: (code) => {
        // Trim + normalize + uppercase so "  vision10 " pasted from an
        // email still matches. normalizeInvisible strips zero-width
        // passengers (ZWSP, BOM, etc) that sneak in from Slack/Notion
        // pastes — without it the strict lookup below would miss a
        // code that looks 100% correct to the user.
        const normalized = normalizeInvisible(code).trim().toUpperCase();
        const rate = getValidDiscountCodes()[normalized];
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
          const rate = getValidDiscountCodes()[discountCode] ?? 0;
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
