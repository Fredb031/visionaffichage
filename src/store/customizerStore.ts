import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { PRODUCTS, PRINT_PRICE, BULK_DISCOUNT_THRESHOLD, BULK_DISCOUNT_RATE } from '@/data/products';
import type { CustomizationState, LogoPlacement, PlacementSides, ProductView, TextAsset } from '@/types/customization';

interface CustomizerStore extends CustomizationState {
  setProduct: (productId: string) => void;
  setColor: (colorId: string) => void;
  setLogoPlacement: (placement: LogoPlacement | null) => void;
  setLogoPlacementBack: (placement: LogoPlacement | null) => void;
  setPlacementSides: (sides: PlacementSides) => void;
  setTextAssets: (assets: TextAsset[]) => void;
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
  logoPlacementBack: null,
  placementSides: 'front',
  textAssets: [],
  sizeQuantities: [],
  activeView: 'front',
  step: 1,
};

export const useCustomizerStore = create<CustomizerStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setProduct: (productId) => set({
        productId, colorId: null,
        logoPlacement: null, logoPlacementBack: null,
        placementSides: 'front',
        textAssets: [],
        sizeQuantities: [], step: 1,
      }),
      setColor: (colorId) => set({ colorId }),
      setLogoPlacement: (placement) => set({ logoPlacement: placement }),
      setLogoPlacementBack: (placement) => set({ logoPlacementBack: placement }),
      setPlacementSides: (placementSides) => set({ placementSides }),
      setTextAssets: (textAssets) => set({ textAssets }),

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
      version: 2,
      // Migrate old persisted state. v1 had 5 steps (Color/Logo/Where/
      // Sizes/Review); v2 collapsed to 4 (Logo/Where/Sizes/Review).
      // Mapping: v1 step N → v2 max(1, N-1). Returning users see the
      // right screen instead of a blank modal.
      migrate: (persisted: unknown, fromVersion: number) => {
        const state = persisted as Partial<CustomizationState> | null;
        if (!state) return state;
        if (fromVersion < 2) {
          const old = (state.step as unknown as number | undefined) ?? 1;
          const next = Math.max(1, Math.min(4, old - 1)) as 1 | 2 | 3 | 4;
          return { ...state, step: next };
        }
        return state;
      },
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
        logoPlacementBack: state.logoPlacementBack
          ? { ...state.logoPlacementBack, originalFile: undefined }
          : null,
        placementSides: state.placementSides,
        textAssets: state.textAssets,
        sizeQuantities: state.sizeQuantities,
        activeView: state.activeView,
        step: state.step,
      }),
    },
  ),
);
