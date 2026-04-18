import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { PRODUCTS, PRINT_PRICE, BULK_DISCOUNT_THRESHOLD, BULK_DISCOUNT_RATE } from '@/data/products';
import type { CustomizationState, LogoPlacement, ProductView } from '@/types/customization';

interface CustomizerStore extends CustomizationState {
  setProduct: (productId: string) => void;
  setColor: (colorId: string) => void;
  setLogoPlacement: (placement: LogoPlacement | null) => void;
  setSizeQuantity: (size: string, quantity: number) => void;
  setView: (view: ProductView) => void;
  setStep: (step: CustomizationState['step']) => void;
  getTotalQuantity: () => number;
  getEstimatedPrice: () => number;
  reset: () => void;
}

const initialState: CustomizationState = {
  productId: null,
  colorId: null,
  logoPlacement: null,
  sizeQuantities: [],
  activeView: 'front',
  step: 1,
};

export const useCustomizerStore = create<CustomizerStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setProduct: (productId) => set({ productId, colorId: null, logoPlacement: null, sizeQuantities: [], step: 1 }),
      setColor: (colorId) => set({ colorId }),
      setLogoPlacement: (placement) => set({ logoPlacement: placement }),

      setSizeQuantity: (size, quantity) =>
        set((state) => {
          const existing = state.sizeQuantities.filter((s) => s.size !== size);
          if (quantity > 0) return { sizeQuantities: [...existing, { size, quantity }] };
          return { sizeQuantities: existing };
        }),

      setView: (activeView) => set({ activeView }),
      setStep: (step) => set({ step }),

      getTotalQuantity: () => get().sizeQuantities.reduce((sum, s) => sum + s.quantity, 0),

      getEstimatedPrice: () => {
        const { productId, sizeQuantities } = get();
        if (!productId) return 0;
        const product = PRODUCTS.find((p) => p.id === productId);
        if (!product) return 0;
        const total = sizeQuantities.reduce((sum, s) => sum + s.quantity, 0);
        const unitBase = product.basePrice + PRINT_PRICE;
        const discount = total >= BULK_DISCOUNT_THRESHOLD ? 1 - BULK_DISCOUNT_RATE : 1;
        return parseFloat((total * unitBase * discount).toFixed(2));
      },

      reset: () => set(initialState),
    }),
    {
      name: 'va-customizer',
      storage: createJSONStorage(() => localStorage),
      // Don't persist the File blob — it isn't JSON-serializable and the
      // object URL it backs is revoked on unload anyway. We keep the
      // uploaded processedUrl (Supabase) + previewUrl so a reload still
      // shows the placed logo.
      partialize: (state) => ({
        productId: state.productId,
        colorId: state.colorId,
        logoPlacement: state.logoPlacement
          ? { ...state.logoPlacement, originalFile: undefined }
          : null,
        sizeQuantities: state.sizeQuantities,
        activeView: state.activeView,
        step: state.step,
      }),
    },
  ),
);
