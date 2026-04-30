'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type CartItem = {
  productId: string;
  variantKey: string;
  productSlug: string;
  titleFr: string;
  titleEn: string;
  color: string;
  size: string;
  qty: number;
  unitPriceCents: number;
};

type CartState = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, variantKey: string) => void;
  updateQty: (productId: string, variantKey: string, qty: number) => void;
  clear: () => void;
  subtotalCents: () => number;
  itemCount: () => number;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (incoming) =>
        set((state) => {
          const existingIdx = state.items.findIndex(
            (i) =>
              i.productId === incoming.productId &&
              i.variantKey === incoming.variantKey,
          );
          if (existingIdx >= 0) {
            const next = state.items.slice();
            const existing = next[existingIdx];
            if (existing) {
              next[existingIdx] = {
                ...existing,
                qty: existing.qty + incoming.qty,
              };
            }
            return { items: next };
          }
          return { items: [...state.items, incoming] };
        }),
      removeItem: (productId, variantKey) =>
        set((state) => ({
          items: state.items.filter(
            (i) => !(i.productId === productId && i.variantKey === variantKey),
          ),
        })),
      updateQty: (productId, variantKey, qty) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.productId === productId && i.variantKey === variantKey
              ? { ...i, qty: Math.max(0, qty) }
              : i,
          ),
        })),
      clear: () => set({ items: [] }),
      subtotalCents: () =>
        get().items.reduce((sum, i) => sum + i.unitPriceCents * i.qty, 0),
      itemCount: () => get().items.reduce((sum, i) => sum + i.qty, 0),
    }),
    {
      name: 'va-cart-v1',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
