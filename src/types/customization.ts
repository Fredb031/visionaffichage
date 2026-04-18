export type LogoPlacement = {
  zoneId: string;
  mode: 'preset' | 'manual';
  x?: number;
  y?: number;
  width?: number;
  rotation?: number;
  originalFile?: File;
  processedUrl?: string;
  previewUrl?: string;
};

export type SizeQuantity = {
  size: string;
  quantity: number;
};

export type ProductView = 'front' | 'back';

export type CustomizationState = {
  productId: string | null;
  colorId: string | null;
  logoPlacement: LogoPlacement | null;
  sizeQuantities: SizeQuantity[];
  activeView: ProductView;
  step: 1 | 2 | 3 | 4 | 5;
};

export type CartItemCustomization = CustomizationState & {
  cartId: string;
  productName: string;
  previewSnapshot: string;
  unitPrice: number;
  totalQuantity: number;
  totalPrice: number;
  addedAt: Date;
  /** Shopify variant IDs for each (color, size) sub-line that was synced
   * to the Shopify cart. Used to remove from Shopify when this local
   * cart line is removed. */
  shopifyVariantIds?: string[];
};
