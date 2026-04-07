export interface LogoPlacement {
  zoneId: string;
  logoUrl: string;
  originalUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface SizeQuantity {
  size: string;
  quantity: number;
}

export interface Customization {
  productId: string;
  variantId: string;
  color: string;
  colorHex: string;
  logos: LogoPlacement[];
  sizeQuantities: SizeQuantity[];
  totalQuantity: number;
  unitPrice: number;
  discount: number; // pourcentage
  totalPrice: number;
}

export type CustomizerStep = 'color' | 'logo' | 'placement' | 'sizes' | 'summary';

export const CUSTOMIZER_STEPS: { id: CustomizerStep; label: string }[] = [
  { id: 'color', label: 'Couleur' },
  { id: 'logo', label: 'Logo' },
  { id: 'placement', label: 'Emplacement' },
  { id: 'sizes', label: 'Tailles & Quantités' },
  { id: 'summary', label: 'Résumé' },
];

export const VOLUME_DISCOUNTS = [
  { minQty: 1, discount: 0 },
  { minQty: 6, discount: 10 },
  { minQty: 25, discount: 15 },
  { minQty: 50, discount: 20 },
  { minQty: 100, discount: 25 },
] as const;
