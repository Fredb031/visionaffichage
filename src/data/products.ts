import type { Product } from '@/types/product';

export const VISION_PRODUCTS: Product[] = [
  {
    id: 'tshirt-premium',
    handle: 'tshirt-premium',
    title: 'T-Shirt Premium',
    description: 'T-shirt unisexe 100% coton peigné, coupe moderne. Parfait pour le branding d\'équipe.',
    category: 'tshirt',
    basePrice: 24.99,
    variants: [
      { id: 'ts-noir', title: 'Noir', price: 24.99, sku: 'TS-BLK', color: 'Noir', colorHex: '#1a1a1a', availableSizes: ['XS', 'S', 'M', 'L', 'XL', '2XL'] },
      { id: 'ts-blanc', title: 'Blanc', price: 24.99, sku: 'TS-WHT', color: 'Blanc', colorHex: '#f5f5f0', availableSizes: ['XS', 'S', 'M', 'L', 'XL', '2XL'] },
      { id: 'ts-navy', title: 'Navy', price: 24.99, sku: 'TS-NVY', color: 'Navy', colorHex: '#1B3A6B', availableSizes: ['XS', 'S', 'M', 'L', 'XL', '2XL'] },
      { id: 'ts-gris', title: 'Gris chiné', price: 24.99, sku: 'TS-GRY', color: 'Gris chiné', colorHex: '#b0b0b0', availableSizes: ['XS', 'S', 'M', 'L', 'XL', '2XL'] },
    ],
    images: [],
    printZones: [
      { id: 'front', label: 'Poitrine (devant)', position: [0, 0.3, 0.15], maxWidth: 30, maxHeight: 30 },
      { id: 'back', label: 'Dos complet', position: [0, 0.3, -0.15], maxWidth: 35, maxHeight: 40 },
      { id: 'sleeve-l', label: 'Manche gauche', position: [-0.18, 0.35, 0], maxWidth: 8, maxHeight: 8 },
    ],
  },
  {
    id: 'hoodie-classic',
    handle: 'hoodie-classic',
    title: 'Hoodie Classique',
    description: 'Hoodie en molleton brossé 80/20, capuche doublée. Confort et style pour votre équipe.',
    category: 'hoodie',
    basePrice: 44.99,
    variants: [
      { id: 'hd-noir', title: 'Noir', price: 44.99, sku: 'HD-BLK', color: 'Noir', colorHex: '#1a1a1a', availableSizes: ['S', 'M', 'L', 'XL', '2XL'] },
      { id: 'hd-navy', title: 'Navy', price: 44.99, sku: 'HD-NVY', color: 'Navy', colorHex: '#1B3A6B', availableSizes: ['S', 'M', 'L', 'XL', '2XL'] },
      { id: 'hd-gris', title: 'Gris', price: 44.99, sku: 'HD-GRY', color: 'Gris', colorHex: '#8a8a8a', availableSizes: ['S', 'M', 'L', 'XL', '2XL'] },
    ],
    images: [],
    printZones: [
      { id: 'front', label: 'Poitrine (devant)', position: [0, 0.25, 0.18], maxWidth: 30, maxHeight: 30 },
      { id: 'back', label: 'Dos complet', position: [0, 0.25, -0.18], maxWidth: 35, maxHeight: 40 },
    ],
  },
  {
    id: 'polo-business',
    handle: 'polo-business',
    title: 'Polo Business',
    description: 'Polo piqué performance, col classique. Idéal pour les événements corporatifs.',
    category: 'polo',
    basePrice: 34.99,
    variants: [
      { id: 'pl-noir', title: 'Noir', price: 34.99, sku: 'PL-BLK', color: 'Noir', colorHex: '#1a1a1a', availableSizes: ['S', 'M', 'L', 'XL', '2XL'] },
      { id: 'pl-blanc', title: 'Blanc', price: 34.99, sku: 'PL-WHT', color: 'Blanc', colorHex: '#f5f5f0', availableSizes: ['S', 'M', 'L', 'XL', '2XL'] },
      { id: 'pl-navy', title: 'Navy', price: 34.99, sku: 'PL-NVY', color: 'Navy', colorHex: '#1B3A6B', availableSizes: ['S', 'M', 'L', 'XL', '2XL'] },
    ],
    images: [],
    printZones: [
      { id: 'front', label: 'Poitrine gauche', position: [-0.08, 0.3, 0.12], maxWidth: 10, maxHeight: 10 },
      { id: 'back', label: 'Dos', position: [0, 0.25, -0.12], maxWidth: 30, maxHeight: 35 },
    ],
  },
  {
    id: 'casquette-snapback',
    handle: 'casquette-snapback',
    title: 'Casquette Snapback',
    description: 'Casquette structurée 6 panneaux, fermeture snapback. Broderie haute définition.',
    category: 'casquette',
    basePrice: 19.99,
    variants: [
      { id: 'cp-noir', title: 'Noir', price: 19.99, sku: 'CP-BLK', color: 'Noir', colorHex: '#1a1a1a', availableSizes: ['Unique'] },
      { id: 'cp-navy', title: 'Navy', price: 19.99, sku: 'CP-NVY', color: 'Navy', colorHex: '#1B3A6B', availableSizes: ['Unique'] },
    ],
    images: [],
    printZones: [
      { id: 'front', label: 'Face avant', position: [0, 0.08, 0.1], maxWidth: 12, maxHeight: 6 },
    ],
  },
  {
    id: 'tote-bag',
    handle: 'tote-bag',
    title: 'Tote Bag Coton',
    description: 'Sac fourre-tout en coton épais 340g. Surface d\'impression large pour votre marque.',
    category: 'tote',
    basePrice: 14.99,
    variants: [
      { id: 'tb-naturel', title: 'Naturel', price: 14.99, sku: 'TB-NAT', color: 'Naturel', colorHex: '#e8dcc8', availableSizes: ['Unique'] },
      { id: 'tb-noir', title: 'Noir', price: 14.99, sku: 'TB-BLK', color: 'Noir', colorHex: '#1a1a1a', availableSizes: ['Unique'] },
    ],
    images: [],
    printZones: [
      { id: 'front', label: 'Face avant', position: [0, 0, 0.01], maxWidth: 28, maxHeight: 28 },
    ],
  },
];

export function getProductByHandle(handle: string): Product | undefined {
  return VISION_PRODUCTS.find((p) => p.handle === handle);
}

export function getProductsByCategory(category: Product['category']): Product[] {
  return VISION_PRODUCTS.filter((p) => p.category === category);
}
