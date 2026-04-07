import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Customization } from '@/types/customization';

export interface CustomCartItem {
  id: string;
  customization: Customization;
  productTitle: string;
  productImage: string;
  previewImage?: string; // capture du canvas avec logo
  addedAt: number;
}

interface CartState {
  items: CustomCartItem[];
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (item: CustomCartItem) => void;
  removeItem: (id: string) => void;
  updateItemQuantity: (id: string, sizeQuantities: Customization['sizeQuantities']) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
}

export const useCustomCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),

      addItem: (item) => set((s) => ({ items: [...s.items, item] })),

      removeItem: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),

      updateItemQuantity: (id, sizeQuantities) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.id === id
              ? {
                  ...i,
                  customization: {
                    ...i.customization,
                    sizeQuantities,
                    totalQuantity: sizeQuantities.reduce((sum, sq) => sum + sq.quantity, 0),
                  },
                }
              : i
          ),
        })),

      clearCart: () => set({ items: [] }),

      getTotalItems: () => get().items.reduce((sum, i) => sum + i.customization.totalQuantity, 0),

      getTotalPrice: () => get().items.reduce((sum, i) => sum + i.customization.totalPrice, 0),
    }),
    {
      name: 'vision-custom-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    }
  )
);
