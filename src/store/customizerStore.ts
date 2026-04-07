import { create } from 'zustand';
import type { Product } from '@/types/product';
import type { CustomizerStep, LogoPlacement, SizeQuantity, VOLUME_DISCOUNTS } from '@/types/customization';

interface CustomizerState {
  product: Product | null;
  currentStep: CustomizerStep;
  selectedVariantId: string | null;
  selectedColor: string;
  selectedColorHex: string;
  logos: LogoPlacement[];
  sizeQuantities: SizeQuantity[];
  isOpen: boolean;

  // Actions
  openCustomizer: (product: Product) => void;
  closeCustomizer: () => void;
  setStep: (step: CustomizerStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  setColor: (variantId: string, color: string, hex: string) => void;
  addLogo: (logo: LogoPlacement) => void;
  updateLogo: (zoneId: string, updates: Partial<LogoPlacement>) => void;
  removeLogo: (zoneId: string) => void;
  setSizeQuantity: (size: string, quantity: number) => void;
  getTotalQuantity: () => number;
  getDiscount: () => number;
  getUnitPrice: () => number;
  getTotalPrice: () => number;
  reset: () => void;
}

const STEPS: CustomizerStep[] = ['color', 'logo', 'placement', 'sizes', 'summary'];

const DISCOUNTS: typeof VOLUME_DISCOUNTS = [
  { minQty: 1, discount: 0 },
  { minQty: 6, discount: 10 },
  { minQty: 25, discount: 15 },
  { minQty: 50, discount: 20 },
  { minQty: 100, discount: 25 },
];

export const useCustomizerStore = create<CustomizerState>((set, get) => ({
  product: null,
  currentStep: 'color',
  selectedVariantId: null,
  selectedColor: '',
  selectedColorHex: '#000000',
  logos: [],
  sizeQuantities: [],
  isOpen: false,

  openCustomizer: (product) =>
    set({
      product,
      isOpen: true,
      currentStep: 'color',
      selectedVariantId: product.variants[0]?.id ?? null,
      selectedColor: product.variants[0]?.color ?? '',
      selectedColorHex: product.variants[0]?.colorHex ?? '#000000',
      logos: [],
      sizeQuantities: product.variants[0]?.availableSizes.map((s) => ({ size: s, quantity: 0 })) ?? [],
    }),

  closeCustomizer: () => set({ isOpen: false }),

  setStep: (step) => set({ currentStep: step }),

  nextStep: () => {
    const idx = STEPS.indexOf(get().currentStep);
    if (idx < STEPS.length - 1) set({ currentStep: STEPS[idx + 1] });
  },

  prevStep: () => {
    const idx = STEPS.indexOf(get().currentStep);
    if (idx > 0) set({ currentStep: STEPS[idx - 1] });
  },

  setColor: (variantId, color, hex) =>
    set({ selectedVariantId: variantId, selectedColor: color, selectedColorHex: hex }),

  addLogo: (logo) => set((s) => ({ logos: [...s.logos.filter((l) => l.zoneId !== logo.zoneId), logo] })),

  updateLogo: (zoneId, updates) =>
    set((s) => ({ logos: s.logos.map((l) => (l.zoneId === zoneId ? { ...l, ...updates } : l)) })),

  removeLogo: (zoneId) => set((s) => ({ logos: s.logos.filter((l) => l.zoneId !== zoneId) })),

  setSizeQuantity: (size, quantity) =>
    set((s) => ({
      sizeQuantities: s.sizeQuantities.map((sq) => (sq.size === size ? { ...sq, quantity: Math.max(0, quantity) } : sq)),
    })),

  getTotalQuantity: () => get().sizeQuantities.reduce((sum, sq) => sum + sq.quantity, 0),

  getDiscount: () => {
    const qty = get().getTotalQuantity();
    let disc = 0;
    for (const tier of DISCOUNTS) {
      if (qty >= tier.minQty) disc = tier.discount;
    }
    return disc;
  },

  getUnitPrice: () => {
    const base = get().product?.basePrice ?? 0;
    const disc = get().getDiscount();
    return base * (1 - disc / 100);
  },

  getTotalPrice: () => get().getUnitPrice() * get().getTotalQuantity(),

  reset: () =>
    set({
      product: null,
      currentStep: 'color',
      selectedVariantId: null,
      selectedColor: '',
      selectedColorHex: '#000000',
      logos: [],
      sizeQuantities: [],
      isOpen: false,
    }),
}));
