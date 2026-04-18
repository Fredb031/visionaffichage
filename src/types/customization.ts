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

/** Which sides the customer wants printed. Drives whether the modal asks
 * for a front placement, a back placement, both, or neither. */
export type PlacementSides = 'none' | 'front' | 'back' | 'both';

/** A text caption added on the canvas. Serializable (no fabric refs)
 * so it survives the trip through the cart and Shopify order metadata. */
export type TextAsset = {
  id: string;
  text: string;
  color: string;
  fontFamily?: string;
  /** Which side this caption belongs to — drives canvas visibility
   * when the user toggles Front ↔ Back. */
  side: ProductView;
  /** Placement in canvas %. Allows re-rendering the caption on any
   * canvas resolution without guessing. */
  x?: number;
  y?: number;
  fontSize?: number;
  angle?: number;
};

export type CustomizationState = {
  productId: string | null;
  colorId: string | null;
  /** Front-side placement (used when placementSides is 'front' or 'both'). */
  logoPlacement: LogoPlacement | null;
  /** Back-side placement (used when placementSides is 'back' or 'both'). */
  logoPlacementBack: LogoPlacement | null;
  /** Chosen printing sides. Default 'front'. */
  placementSides: PlacementSides;
  /** Canvas text captions (bilingual of sides). Persisted through the
   * cart so the production team sees them on the order. */
  textAssets: TextAsset[];
  sizeQuantities: SizeQuantity[];
  activeView: ProductView;
  step: 1 | 2 | 3 | 4;
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
