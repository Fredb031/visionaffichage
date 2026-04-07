export type PrintZone = {
  id: string; name: string; label: string; x: number; y: number; width: number; height: number;
};
export type ProductColor = {
  id: string; name: string; hex: string; imageDevant?: string; imageDos?: string;
};
export type ProductVariant = { size: string; price: number; };
export type Product = {
  id: string; sku: string; name: string; shortName: string;
  category: 'tshirt' | 'hoodie' | 'cap' | 'toque' | 'manteau' | 'polo';
  basePrice: number; imageDevant: string; imageDos: string; imageGauche?: string; imageDroite?: string;
  colors: ProductColor[]; sizes: string[]; printZones: PrintZone[]; description: string; model3dUrl?: string;
};

export const PRODUCTS: Product[] = [
  {
    id: 'atcf2500', sku: 'ATCF2500',
    name: 'Hoodie à capuche unisexe — ATC F2500',
    shortName: 'Hoodie',
    category: 'hoodie', basePrice: 27.54,
    description: 'Coupe unisexe confortable, tissu French Terry 320 g/m². Poche ventrale et capuche doublée. Idéal pour les uniformes d\'équipe et la promotion de marque. Certification OEKO-TEX®.',
    imageDevant: 'https://visionaffichage.com/cdn/shop/files/ATCF2500-Devant.jpg?v=1770866896&width=800',
    imageDos: 'https://visionaffichage.com/cdn/shop/files/ATCF2500-Dos.jpg?v=1770866896&width=800',
    colors: [
      { id: 'noir', name: 'Noir', hex: '#1a1a1a', imageDevant: 'https://visionaffichage.com/cdn/shop/files/ATCF2500-Devant.jpg?v=1770866896&width=800', imageDos: 'https://visionaffichage.com/cdn/shop/files/ATCF2500-Dos.jpg?v=1770866896&width=800' },
      { id: 'blanc', name: 'Blanc', hex: '#f5f5f0' },
      { id: 'marine', name: 'Marine', hex: '#1B3A6B' },
      { id: 'gris-acier', name: 'Gris acier', hex: '#6b6b6b' },
      { id: 'rouge-fonce', name: 'Rouge foncé', hex: '#8b1a1a' },
      { id: 'vert-foret', name: 'Vert forêt', hex: '#1a3d2e' },
      { id: 'bourgogne', name: 'Bourgogne', hex: '#5c1a2e' },
      { id: 'brun-caramel', name: 'Brun caramel', hex: '#4a3728' },
    ],
    sizes: ['XS','S','M','L','XL','XXL','3XL'],
    printZones: [
      { id: 'poitrine-centre', name: 'Poitrine centre', label: 'Centre poitrine', x: 35, y: 28, width: 30, height: 22 },
      { id: 'poitrine-gauche', name: 'Poitrine gauche', label: 'Poitrine gauche (petit logo)', x: 18, y: 28, width: 18, height: 14 },
      { id: 'dos-complet', name: 'Dos complet', label: 'Dos complet (grand format)', x: 25, y: 20, width: 50, height: 40 },
      { id: 'dos-haut', name: 'Haut du dos', label: 'Haut du dos', x: 30, y: 18, width: 40, height: 18 },
      { id: 'manche-gauche', name: 'Manche gauche', label: 'Manche gauche', x: 5, y: 35, width: 14, height: 18 },
      { id: 'manche-droite', name: 'Manche droite', label: 'Manche droite', x: 81, y: 35, width: 14, height: 18 },
    ],
  },
  {
    id: 'atcf2600', sku: 'ATCF2600',
    name: 'Hoodie avec fermeture éclair — ATC F2600',
    shortName: 'Hoodie Zip',
    category: 'hoodie', basePrice: 32.49,
    description: 'Veste à capuche avec fermeture éclair pleine longueur YKK. Tissu French Terry 320 g/m², poche à glissière sur chaque côté. Look soigné, idéal pour les représentants et techniciens.',
    imageDevant: 'https://visionaffichage.com/cdn/shop/files/ATCF2600-Devant.jpg?v=1770866896&width=800',
    imageDos: 'https://visionaffichage.com/cdn/shop/files/ATCF2600-Dos.jpg?v=1770866896&width=800',
    colors: [
      { id: 'noir', name: 'Noir', hex: '#1a1a1a' },
      { id: 'marine', name: 'Marine', hex: '#1B3A6B' },
      { id: 'gris-acier', name: 'Gris acier', hex: '#6b6b6b' },
      { id: 'vert-foret', name: 'Vert forêt', hex: '#1a3d2e' },
    ],
    sizes: ['XS','S','M','L','XL','XXL'],
    printZones: [
      { id: 'poitrine-gauche', name: 'Poitrine gauche', label: 'Poitrine gauche', x: 15, y: 28, width: 20, height: 16 },
      { id: 'dos-complet', name: 'Dos complet', label: 'Dos complet', x: 25, y: 20, width: 50, height: 40 },
      { id: 'manche-gauche', name: 'Manche gauche', label: 'Manche gauche', x: 4, y: 35, width: 13, height: 18 },
    ],
  },
  {
    id: 'atc1000', sku: 'ATC1000',
    name: 'T-Shirt — ATC 1000',
    shortName: 'T-Shirt',
    category: 'tshirt', basePrice: 4.15,
    description: 'T-shirt 100% coton ringspun 180 g/m², col rond côtelé, coutures doubles sur les manches et l\'encolure. L\'essentiel de tout uniforme d\'équipe. Lavable à la machine, garde ses couleurs après de nombreux lavages.',
    imageDevant: 'https://visionaffichage.com/cdn/shop/files/ATC1000-Devant.jpg?v=1770866927&width=800',
    imageDos: 'https://visionaffichage.com/cdn/shop/files/ATC1000-Dos.jpg?v=1770866927&width=800',
    colors: [
      { id: 'noir', name: 'Noir', hex: '#1a1a1a', imageDevant: 'https://visionaffichage.com/cdn/shop/files/ATC1000-Devant.jpg?v=1770866927&width=800' },
      { id: 'blanc', name: 'Blanc', hex: '#f5f5f0' },
      { id: 'marine', name: 'Marine', hex: '#1B3A6B' },
      { id: 'rouge-fonce', name: 'Rouge foncé', hex: '#8b1a1a' },
      { id: 'gris-acier', name: 'Gris acier', hex: '#6b6b6b' },
      { id: 'vert-foret', name: 'Vert forêt', hex: '#1a3d2e' },
      { id: 'bleu-royal', name: 'Bleu royal', hex: '#1a3a8b' },
      { id: 'or', name: 'Or', hex: '#C08B14' },
    ],
    sizes: ['XS','S','M','L','XL','XXL','3XL'],
    printZones: [
      { id: 'poitrine-centre', name: 'Poitrine centre', label: 'Centre poitrine', x: 33, y: 25, width: 34, height: 25 },
      { id: 'poitrine-gauche', name: 'Poitrine gauche', label: 'Poitrine gauche (petit logo)', x: 18, y: 26, width: 18, height: 14 },
      { id: 'dos-complet', name: 'Dos complet', label: 'Dos complet', x: 22, y: 18, width: 56, height: 44 },
      { id: 'dos-haut', name: 'Haut du dos', label: 'Haut du dos', x: 28, y: 16, width: 44, height: 20 },
      { id: 'manche-gauche', name: 'Manche gauche', label: 'Manche gauche', x: 4, y: 30, width: 13, height: 16 },
      { id: 'manche-droite', name: 'Manche droite', label: 'Manche droite', x: 83, y: 30, width: 13, height: 16 },
    ],
  },
  {
    id: 'atc6606', sku: 'ATC6606',
    name: 'Casquette Trucker — Yupoong 6606',
    shortName: 'Casquette',
    category: 'cap', basePrice: 15.39,
    description: 'Casquette trucker avec panneau avant structuré, ajustement à l\'arrière par bande plastique (snapback). Combinaison coton/filet pour une ventilation optimale. Impression brodée ou sérigraphiée sur le panneau avant.',
    imageDevant: 'https://visionaffichage.com/cdn/shop/files/yupoong-6606-noir-2_cb488769-745e-41f0-91fd-f317d9787cae.jpg?v=1763598460&width=800',
    imageDos: 'https://visionaffichage.com/cdn/shop/files/6sgh1j.png?v=1774840440&width=800',
    colors: [
      { id: 'noir', name: 'Noir', hex: '#1a1a1a' },
      { id: 'blanc', name: 'Blanc', hex: '#f5f5f0' },
      { id: 'marine', name: 'Marine', hex: '#1B3A6B' },
      { id: 'gris-acier', name: 'Gris acier', hex: '#6b6b6b' },
      { id: 'rouge-fonce', name: 'Rouge foncé', hex: '#8b1a1a' },
      { id: 'kaki', name: 'Kaki', hex: '#6b6b3a' },
    ],
    sizes: ['Taille unique'],
    printZones: [
      { id: 'panneau-avant', name: 'Panneau avant', label: 'Panneau avant (recommandé)', x: 28, y: 22, width: 44, height: 38 },
      { id: 'cote-gauche', name: 'Côté gauche', label: 'Côté gauche', x: 8, y: 28, width: 18, height: 28 },
    ],
  },
  {
    id: 'c105', sku: 'C105',
    name: 'Tuque sans rebords — C105',
    shortName: 'Tuque',
    category: 'toque', basePrice: 7.13,
    description: 'Tuque tricotée double épaisseur sans rebords, 100% acrylique. Garde la chaleur en hiver tout en restant légère. Format universel s\'adapte à toutes les têtes. Zone de broderie sur la face avant.',
    imageDevant: 'https://visionaffichage.com/cdn/shop/files/c105-2_c5d6b8c6-8c32-43f3-851d-f48dd2d35913.jpg?v=1763598172&width=800',
    imageDos: 'https://visionaffichage.com/cdn/shop/files/c105-2_c5d6b8c6-8c32-43f3-851d-f48dd2d35913.jpg?v=1763598172&width=800',
    colors: [
      { id: 'noir', name: 'Noir', hex: '#1a1a1a' },
      { id: 'marine', name: 'Marine', hex: '#1B3A6B' },
      { id: 'gris-acier', name: 'Gris acier', hex: '#6b6b6b' },
      { id: 'rouge-fonce', name: 'Rouge foncé', hex: '#8b1a1a' },
      { id: 'blanc', name: 'Blanc', hex: '#f5f5f0' },
      { id: 'vert-foret', name: 'Vert forêt', hex: '#1a3d2e' },
    ],
    sizes: ['Taille unique'],
    printZones: [
      { id: 'face-avant', name: 'Face avant', label: 'Face avant (recommandé)', x: 28, y: 25, width: 44, height: 35 },
    ],
  },
];

export const PRINT_PRICE = 3.50;
export const BULK_DISCOUNT_THRESHOLD = 12;
export const BULK_DISCOUNT_RATE = 0.15;
