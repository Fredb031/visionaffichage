export interface ProductVariant {
  id: string;
  title: string;
  price: number;
  sku: string;
  color: string;
  colorHex: string;
  availableSizes: string[];
}

export interface Product {
  id: string;
  handle: string;
  title: string;
  description: string;
  category: 'tshirt' | 'hoodie' | 'polo' | 'casquette' | 'tote' | 'kit';
  basePrice: number;
  variants: ProductVariant[];
  images: string[];
  modelUrl?: string; // URL du modèle 3D (.glb)
  printZones: PrintZone[];
}

export interface PrintZone {
  id: string;
  label: string;
  position: [number, number, number]; // x, y, z sur le modèle 3D
  maxWidth: number;
  maxHeight: number;
}

export type ProductCategory = Product['category'];
