/**
 * products.ts — Catalogue complet Vision Affichage
 * Couleurs exactes SanMar/ATC avec noms français du site
 * Images CDN visionaffichage.com par couleur (devant + dos)
 */

export type PrintZone = {
  id: string; label: string;
  x: number; y: number; width: number; height: number;
};

export type ProductColor = {
  id: string;
  name: string;      // Nom affiché en français (comme sur le site)
  nameEn: string;    // Nom anglais ATC/SanMar (pour matching API)
  hex: string;       // Code couleur exact
  imageDevant?: string;
  imageDos?: string;
};

export type Product = {
  id: string; sku: string; name: string; shortName: string;
  category: 'tshirt' | 'hoodie' | 'crewneck' | 'polo' | 'longsleeve' | 'sport' | 'cap' | 'toque';
  gender: 'unisex' | 'homme' | 'femme' | 'enfant';
  basePrice: number;
  imageDevant: string; imageDos: string;
  colors: ProductColor[];
  sizes: string[];
  printZones: PrintZone[];
  description: string;
  shopifyHandle: string;
  features: string[];
};

const CDN = 'https://visionaffichage.com/cdn/shop/files';

// ── Zones d'impression ────────────────────────────────────────────────────────
const HOODIE_ZONES: PrintZone[] = [
  { id: 'poitrine-centre', label: 'Centre poitrine',           x:33, y:26, width:34, height:24 },
  { id: 'coeur-gauche',    label: 'Cœur gauche (petit logo)',  x:16, y:27, width:18, height:14 },
  { id: 'dos-complet',     label: 'Dos complet (grand format)',x:22, y:18, width:56, height:44 },
  { id: 'dos-haut',        label: 'Haut du dos',               x:28, y:16, width:44, height:20 },
  { id: 'manche-gauche',   label: 'Manche gauche',             x: 4, y:34, width:13, height:17 },
  { id: 'manche-droite',   label: 'Manche droite',             x:83, y:34, width:13, height:17 },
];

const SHIRT_ZONES: PrintZone[] = [
  { id: 'poitrine-centre', label: 'Centre poitrine',           x:32, y:24, width:36, height:26 },
  { id: 'coeur-gauche',    label: 'Cœur gauche (petit logo)',  x:16, y:25, width:18, height:14 },
  { id: 'dos-complet',     label: 'Dos complet (grand format)',x:20, y:16, width:60, height:48 },
  { id: 'dos-haut',        label: 'Haut du dos',               x:26, y:14, width:48, height:22 },
  { id: 'manche-gauche',   label: 'Manche gauche',             x: 3, y:29, width:13, height:16 },
  { id: 'manche-droite',   label: 'Manche droite',             x:84, y:29, width:13, height:16 },
];

const CAP_ZONES: PrintZone[] = [
  { id: 'panneau-avant', label: 'Panneau avant (recommandé)', x:26, y:20, width:48, height:40 },
  { id: 'cote-gauche',   label: 'Côté gauche',                x: 6, y:26, width:20, height:30 },
];

const BEANIE_ZONES: PrintZone[] = [
  { id: 'face-avant', label: 'Face avant (recommandé)', x:26, y:22, width:48, height:38 },
];

// ── Palettes couleurs EXACTES ATC/SanMar (noms FR + hex précis) ──────────────
// Source: SanMar Canada catalogue + visionaffichage.com

const ATCF2500_COLORS: ProductColor[] = [
  { id: 'black',            name: 'Noir',              nameEn: 'Black',            hex: '#141414',
    imageDevant: `${CDN}/atcf2500_form_front_black_022017.png`,
    imageDos:    `${CDN}/ATCF2500-Dos.jpg?v=1770866896&width=800` },
  { id: 'white',            name: 'Blanc',             nameEn: 'White',            hex: '#F2F0EB' },
  { id: 'navy',             name: 'Marine',            nameEn: 'Navy',             hex: '#1D2B4F' },
  { id: 'steel-grey',       name: 'Gris acier',        nameEn: 'Steel Grey',       hex: '#6E7278' },
  { id: 'dark-heather',     name: 'Gris foncé chiné',  nameEn: 'Dark Heather',     hex: '#3E3F42' },
  { id: 'light-heather',    name: 'Gris pâle chiné',   nameEn: 'Light Heather',    hex: '#B8B9BC' },
  { id: 'red',              name: 'Rouge',             nameEn: 'Red',              hex: '#B91C1C' },
  { id: 'true-royal',       name: 'Bleu royal',        nameEn: 'True Royal',       hex: '#1E40AF' },
  { id: 'forest-green',     name: 'Vert forêt',        nameEn: 'Forest Green',     hex: '#14532D' },
  { id: 'burgundy',         name: 'Bourgogne',         nameEn: 'Burgundy',         hex: '#7F1D1D' },
  { id: 'purple',           name: 'Mauve',             nameEn: 'Purple',           hex: '#4C1D95' },
  { id: 'gold',             name: 'Or',                nameEn: 'Gold',             hex: '#B45309' },
  { id: 'charcoal',         name: 'Charbon',           nameEn: 'Charcoal',         hex: '#374151' },
  { id: 'military-green',   name: 'Vert militaire',    nameEn: 'Military Green',   hex: '#3F4F2A' },
  { id: 'black-heather',    name: 'Noir chiné',        nameEn: 'Black Heather',    hex: '#2A2A2A' },
  { id: 'true-red',         name: 'Rouge vif',         nameEn: 'True Red',         hex: '#DC2626' },
  { id: 'cardinal',         name: 'Cardinal',          nameEn: 'Cardinal',         hex: '#991B1B' },
  { id: 'natural',          name: 'Naturel',           nameEn: 'Natural',          hex: '#F5F0E8' },
];

const ATC1000_COLORS: ProductColor[] = [
  { id: 'black',            name: 'Noir',              nameEn: 'Black',            hex: '#141414',
    imageDevant: `${CDN}/ATC1000-Devant.jpg?v=1770866927&width=800`,
    imageDos:    `${CDN}/ATC1000-Dos.jpg?v=1770866927&width=800` },
  { id: 'white',            name: 'Blanc',             nameEn: 'White',            hex: '#F2F0EB' },
  { id: 'navy',             name: 'Marine',            nameEn: 'Navy',             hex: '#1D2B4F' },
  { id: 'athletic-heather', name: 'Gris sportif chiné',nameEn: 'Athletic Heather', hex: '#9CA3AF' },
  { id: 'steel-grey',       name: 'Gris acier',        nameEn: 'Steel Grey',       hex: '#6E7278' },
  { id: 'red',              name: 'Rouge',             nameEn: 'Red',              hex: '#B91C1C' },
  { id: 'true-royal',       name: 'Bleu royal',        nameEn: 'True Royal',       hex: '#1E40AF' },
  { id: 'forest-green',     name: 'Vert forêt',        nameEn: 'Forest Green',     hex: '#14532D' },
  { id: 'cardinal',         name: 'Cardinal',          nameEn: 'Cardinal',         hex: '#991B1B' },
  { id: 'gold',             name: 'Or',                nameEn: 'Gold',             hex: '#B45309' },
  { id: 'charcoal',         name: 'Charbon',           nameEn: 'Charcoal',         hex: '#374151' },
  { id: 'purple',           name: 'Mauve',             nameEn: 'Purple',           hex: '#4C1D95' },
  { id: 'orange',           name: 'Orange',            nameEn: 'Orange',           hex: '#C2410C' },
  { id: 'lime-shock',       name: 'Vert lime',         nameEn: 'Lime Shock',       hex: '#65A30D' },
  { id: 'maroon',           name: 'Bordeaux',          nameEn: 'Maroon',           hex: '#6B1B1B' },
  { id: 'light-blue',       name: 'Bleu pâle',         nameEn: 'Light Blue',       hex: '#7DD3FC' },
];

const POLO_S445_COLORS: ProductColor[] = [
  { id: 'black',        name: 'Noir',         nameEn: 'Black',        hex: '#141414' },
  { id: 'white',        name: 'Blanc',        nameEn: 'White',        hex: '#F2F0EB' },
  { id: 'navy',         name: 'Marine',       nameEn: 'Navy',         hex: '#1D2B4F' },
  { id: 'steel-grey',   name: 'Gris acier',   nameEn: 'Steel Grey',   hex: '#6E7278' },
  { id: 'red',          name: 'Rouge',        nameEn: 'Red',          hex: '#B91C1C' },
  { id: 'true-royal',   name: 'Bleu royal',   nameEn: 'True Royal',   hex: '#1E40AF' },
  { id: 'forest-green', name: 'Vert forêt',   nameEn: 'Forest Green', hex: '#14532D' },
  { id: 'gold',         name: 'Or',           nameEn: 'Gold',         hex: '#B45309' },
  { id: 'charcoal',     name: 'Charbon',      nameEn: 'Charcoal',     hex: '#374151' },
  { id: 'cardinal',     name: 'Cardinal',     nameEn: 'Cardinal',     hex: '#991B1B' },
];

const CAP_ATC6606_COLORS: ProductColor[] = [
  { id: 'black',        name: 'Noir',                  nameEn: 'Black',         hex: '#141414' },
  { id: 'white',        name: 'Blanc',                 nameEn: 'White',         hex: '#F2F0EB' },
  { id: 'navy',         name: 'Marine',                nameEn: 'Navy',          hex: '#1D2B4F' },
  { id: 'grey',         name: 'Gris',                  nameEn: 'Grey',          hex: '#9CA3AF' },
  { id: 'red',          name: 'Rouge',                 nameEn: 'Red',           hex: '#B91C1C' },
  { id: 'true-royal',   name: 'Bleu royal',            nameEn: 'True Royal',    hex: '#1E40AF' },
  { id: 'khaki',        name: 'Kaki',                  nameEn: 'Khaki',         hex: '#92835A' },
  { id: 'forest-green', name: 'Vert forêt',            nameEn: 'Forest Green',  hex: '#14532D' },
  { id: 'black-white',  name: 'Noir/Blanc',            nameEn: 'Black/White',   hex: '#141414' },
  { id: 'navy-white',   name: 'Marine/Blanc',          nameEn: 'Navy/White',    hex: '#1D2B4F' },
];

const BEANIE_C105_COLORS: ProductColor[] = [
  { id: 'black',        name: 'Noir',         nameEn: 'Black',        hex: '#141414' },
  { id: 'white',        name: 'Blanc',        nameEn: 'White',        hex: '#F2F0EB' },
  { id: 'navy',         name: 'Marine',       nameEn: 'Navy',         hex: '#1D2B4F' },
  { id: 'steel-grey',   name: 'Gris acier',   nameEn: 'Steel Grey',   hex: '#6E7278' },
  { id: 'red',          name: 'Rouge',        nameEn: 'Red',          hex: '#B91C1C' },
  { id: 'forest-green', name: 'Vert forêt',   nameEn: 'Forest Green', hex: '#14532D' },
  { id: 'maroon',       name: 'Bordeaux',     nameEn: 'Maroon',       hex: '#6B1B1B' },
  { id: 'gold',         name: 'Or',           nameEn: 'Gold',         hex: '#B45309' },
  { id: 'royal',        name: 'Bleu royal',   nameEn: 'Royal',        hex: '#1E40AF' },
];

export const PRODUCTS: Product[] = [
  // ── HOODIES ─────────────────────────────────────────────────────────────────
  {
    id: 'atcf2500', sku: 'ATCF2500',
    name: 'Hoodie à capuche unisexe — ATC F2500', shortName: 'Hoodie',
    category: 'hoodie', gender: 'unisex', basePrice: 27.54,
    imageDevant: `${CDN}/ATCF2500-Devant.jpg?v=1770866896&width=800`,
    imageDos:    `${CDN}/ATCF2500-Dos.jpg?v=1770866896&width=800`,
    shopifyHandle: 'atcf2500',
    colors: ATCF2500_COLORS,
    sizes: ['XS','S','M','L','XL','2XL','3XL','4XL','5XL'],
    printZones: HOODIE_ZONES,
    description: 'Hoodie unisexe French Terry 13 oz, molleton 3 épaisseurs. Capuchon doublé avec cordon, œillets en métal argenté, poche kangourou, poignets côtelés. Anti-boulochage. Certification OEKO-TEX®.',
    features: ['13 oz French Terry','Molleton 3 épaisseurs','Capuchon doublé avec cordon','Œillets métal argenté','Poche kangourou','Anti-boulochage','OEKO-TEX® Standard 100'],
  },
  {
    id: 'atcy2500', sku: 'ATCY2500',
    name: 'Hoodie à capuche enfant — ATC FY2500', shortName: 'Hoodie enfant',
    category: 'hoodie', gender: 'enfant', basePrice: 21.39,
    imageDevant: `${CDN}/ATCFY2500-Devant.jpg?v=1770866961&width=800`,
    imageDos:    `${CDN}/ATCFY2500-Dos.jpg?v=1770866961&width=800`,
    shopifyHandle: 'atcy2500-1',
    colors: ATCF2500_COLORS.slice(0, 10),
    sizes: ['XS','S','M','L','XL'],
    printZones: HOODIE_ZONES,
    description: 'Version enfant du hoodie ATC F2500. Même qualité French Terry 3 épaisseurs, capuchon doublé et poche kangourou. Parfait pour les équipes jeunesse.',
    features: ['French Terry 3 épaisseurs','Capuchon doublé','Poche kangourou','Anti-boulochage'],
  },
  {
    id: 'atcf2600', sku: 'ATCF2600',
    name: 'Hoodie avec fermeture éclair — ATC F2600', shortName: 'Hoodie Zip',
    category: 'hoodie', gender: 'unisex', basePrice: 32.49,
    imageDevant: `${CDN}/ATCF2600-Devant.jpg?v=1770866896&width=800`,
    imageDos:    `${CDN}/ATCF2600-Dos.jpg?v=1770866896&width=800`,
    shopifyHandle: 'atcf2600-1',
    colors: ATCF2500_COLORS.slice(0, 10),
    sizes: ['XS','S','M','L','XL','2XL','3XL'],
    printZones: [
      { id: 'coeur-gauche', label: 'Cœur gauche',  x:14, y:27, width:20, height:16 },
      { id: 'dos-complet',  label: 'Dos complet',   x:22, y:18, width:56, height:44 },
      { id: 'manche-gauche',label: 'Manche gauche', x: 3, y:34, width:13, height:17 },
    ],
    description: 'Veste à capuche fermeture éclair pleine longueur YKK. French Terry 3 épaisseurs, deux poches latérales. Look professionnel pour représentants et équipes terrain.',
    features: ['Fermeture éclair YKK pleine longueur','French Terry 3 épaisseurs','Deux poches latérales','Capuchon doublé'],
  },
  {
    id: 'atcf2400', sku: 'ATCF2400',
    name: 'Crewneck épais — ATC F2400', shortName: 'Crewneck',
    category: 'crewneck', gender: 'unisex', basePrice: 16.81,
    imageDevant: `${CDN}/ATCF2400-Devant.jpg?v=1770866896&width=800`,
    imageDos:    `${CDN}/ATCF2400-Dos.jpg?v=1770867121&width=800`,
    shopifyHandle: 'atcf2400-1',
    colors: ATCF2500_COLORS.slice(0, 10),
    sizes: ['XS','S','M','L','XL','2XL','3XL'],
    printZones: SHIRT_ZONES,
    description: 'Crewneck épais unisexe French Terry 3 épaisseurs. Col rond côtelé, poignets et taille en côte. Alternative sans capuche au hoodie pour un look épuré.',
    features: ['French Terry 3 épaisseurs','Col rond côtelé','Poignets et taille en côte'],
  },

  // ── T-SHIRTS ─────────────────────────────────────────────────────────────────
  {
    id: 'atc1000', sku: 'ATC1000',
    name: 'T-Shirt — ATC 1000', shortName: 'T-Shirt',
    category: 'tshirt', gender: 'unisex', basePrice: 4.15,
    imageDevant: `${CDN}/ATC1000-Devant.jpg?v=1770866927&width=800`,
    imageDos:    `${CDN}/ATC1000-Dos.jpg?v=1770866927&width=800`,
    shopifyHandle: 'atc1000',
    colors: ATC1000_COLORS,
    sizes: ['XS','S','M','L','XL','2XL','3XL','4XL','5XL'],
    printZones: SHIRT_ZONES,
    description: 'T-shirt 100% coton ringspun 9,1 oz. Col côtelé 1×1, double aiguille aux manches et ourlet. Étiquette détachable. Certification OEKO-TEX®. Le t-shirt d\'équipe par excellence.',
    features: ['100% coton ringspun 9,1 oz','Col côtelé 1×1','Coutures double aiguille','Étiquette détachable','OEKO-TEX® Standard 100'],
  },
  {
    id: 'atc1000l', sku: 'ATC1000L',
    name: 'T-Shirt femme — ATC 1000L', shortName: 'T-Shirt femme',
    category: 'tshirt', gender: 'femme', basePrice: 6.65,
    imageDevant: `${CDN}/ATC1000L-Devant.jpg?v=1770867419&width=800`,
    imageDos:    `${CDN}/ATC1000L-Dos.jpg?v=1770867419&width=800`,
    shopifyHandle: 'atc1000l',
    colors: ATC1000_COLORS.slice(0, 12),
    sizes: ['XS','S','M','L','XL','2XL'],
    printZones: SHIRT_ZONES,
    description: 'Version coupe ajustée femme du ATC 1000. Coton ringspun 9,1 oz, silhouette valorisante. Même qualité et durabilité que le modèle unisexe.',
    features: ['100% coton ringspun 9,1 oz','Coupe ajustée femme','Col côtelé','OEKO-TEX®'],
  },
  {
    id: 'atc1000y', sku: 'ATC1000Y',
    name: 'T-Shirt enfant — ATC 1000Y', shortName: 'T-Shirt enfant',
    category: 'tshirt', gender: 'enfant', basePrice: 4.76,
    imageDevant: `${CDN}/ATCY1000-Devant.jpg?v=1770867607&width=800`,
    imageDos:    `${CDN}/ATCY1000-Dos.jpg?v=1770867606&width=800`,
    shopifyHandle: 'atc1000y-1',
    colors: ATC1000_COLORS.slice(0, 10),
    sizes: ['XS','S','M','L','XL'],
    printZones: SHIRT_ZONES,
    description: 'T-shirt enfant 100% coton ringspun, même qualité que le ATC 1000 adulte. Pour équipes sportives jeunesse et événements scolaires.',
    features: ['100% coton ringspun','Coupe enfant','Col côtelé','OEKO-TEX®'],
  },
  {
    id: 'werk250', sku: 'WERK250',
    name: 'T-Shirt Premium — WERK250', shortName: 'T-Shirt Premium',
    category: 'tshirt', gender: 'unisex', basePrice: 16.09,
    imageDevant: `${CDN}/Werk250-Devant.jpg?v=1770867038&width=800`,
    imageDos:    `${CDN}/Werk250-Dos.jpg?v=1770867038&width=800`,
    shopifyHandle: 'werk250-1',
    colors: ATC1000_COLORS.slice(0, 8),
    sizes: ['XS','S','M','L','XL','2XL','3XL'],
    printZones: SHIRT_ZONES,
    description: 'T-shirt premium 250 g/m² pour exigences supérieures. Tissu épais et résistant, surface d\'impression optimale. Idéal pour environnements de travail intensifs.',
    features: ['250 g/m² qualité supérieure','Tissu épais et résistant','Surface impression optimale'],
  },
  {
    id: 'atc1015', sku: 'ATC1015',
    name: 'T-Shirt manches longues — ATC 1015', shortName: 'T-Shirt ML',
    category: 'longsleeve', gender: 'unisex', basePrice: 27.54,
    imageDevant: `${CDN}/ATC1015-Devant.jpg?v=1770866896&width=800`,
    imageDos:    `${CDN}/ATC1015-Dos.jpg?v=1770866896&width=800`,
    shopifyHandle: 'atc1015',
    colors: ATC1000_COLORS.slice(0, 10),
    sizes: ['XS','S','M','L','XL','2XL','3XL'],
    printZones: SHIRT_ZONES,
    description: 'T-shirt manches longues coton ringspun. Même qualité que le ATC 1000, protection supplémentaire pour les saisons intermédiaires et environnements de travail.',
    features: ['100% coton ringspun','Manches longues','Col côtelé 1×1','OEKO-TEX®'],
  },

  // ── POLOS ───────────────────────────────────────────────────────────────────
  {
    id: 's445', sku: 'S445',
    name: 'Polo homme à manches courtes — S445', shortName: 'Polo',
    category: 'polo', gender: 'homme', basePrice: 27.99,
    imageDevant: `${CDN}/S445-Devant.jpg?v=1770866896&width=800`,
    imageDos:    `${CDN}/S445-Dos.jpg?v=1770866896&width=800`,
    shopifyHandle: 's445-1',
    colors: POLO_S445_COLORS,
    sizes: ['XS','S','M','L','XL','2XL','3XL','4XL'],
    printZones: [
      { id: 'coeur-gauche',    label: 'Cœur gauche',   x:16, y:25, width:20, height:16 },
      { id: 'poitrine-centre', label: 'Centre poitrine',x:32, y:26, width:34, height:24 },
      { id: 'dos-complet',     label: 'Dos complet',    x:20, y:16, width:60, height:48 },
      { id: 'manche-gauche',   label: 'Manche gauche',  x: 3, y:29, width:13, height:16 },
    ],
    description: 'Polo homme professionnel manches courtes. Col classique, placket 3 boutons. Idéal pour uniformes d\'entreprise, réceptions et représentants terrain.',
    features: ['Col polo classique','Placket 3 boutons','Coupe droite','Lavable en machine'],
  },
  {
    id: 'l445', sku: 'L445',
    name: 'Polo femme à manches courtes — L445', shortName: 'Polo femme',
    category: 'polo', gender: 'femme', basePrice: 27.99,
    imageDevant: `${CDN}/L445-Devant.jpg?v=1770866896&width=800`,
    imageDos:    `${CDN}/L445-Dos.jpg?v=1770866895&width=800`,
    shopifyHandle: 'l445-1',
    colors: POLO_S445_COLORS,
    sizes: ['XS','S','M','L','XL','2XL'],
    printZones: [
      { id: 'coeur-gauche', label: 'Cœur gauche', x:16, y:25, width:20, height:16 },
      { id: 'dos-complet',  label: 'Dos complet',  x:20, y:16, width:60, height:48 },
    ],
    description: 'Polo femme coupe ajustée manches courtes. Silhouette valorisante, col polo et placket 3 boutons. Parfait pour équipes mixtes professionnelles.',
    features: ['Coupe ajustée femme','Col polo','Placket 3 boutons'],
  },
  {
    id: 's445ls', sku: 'S445LS',
    name: 'Polo manches longues homme — S445LS', shortName: 'Polo ML',
    category: 'polo', gender: 'homme', basePrice: 33.59,
    imageDevant: `${CDN}/S445LS-Devant.jpg?v=1770866896&width=800`,
    imageDos:    `${CDN}/S445LS-Dos.jpg?v=1770866896&width=800`,
    shopifyHandle: 's445ls-1',
    colors: POLO_S445_COLORS.slice(0, 7),
    sizes: ['XS','S','M','L','XL','2XL','3XL'],
    printZones: [
      { id: 'coeur-gauche', label: 'Cœur gauche',  x:16, y:25, width:20, height:16 },
      { id: 'dos-complet',  label: 'Dos complet',   x:20, y:16, width:60, height:48 },
      { id: 'manche-gauche',label: 'Manche gauche', x: 3, y:29, width:13, height:16 },
    ],
    description: 'Polo manches longues 4 saisons. Même qualité professionnelle que le S445, protection supplémentaire contre les éléments tout en maintenant un look soigné.',
    features: ['Manches longues','Col polo','Placket 3 boutons','Usage 4 saisons'],
  },

  // ── T-SHIRTS SPORT ──────────────────────────────────────────────────────────
  {
    id: 's350', sku: 'S350',
    name: 'T-Shirt sport homme — S350', shortName: 'T-Shirt Sport',
    category: 'sport', gender: 'homme', basePrice: 13.99,
    imageDevant: `${CDN}/S350-Devant.jpg?v=1770866896&width=800`,
    imageDos:    `${CDN}/S350-Dos.jpg?v=1770866896&width=800`,
    shopifyHandle: 's350-1',
    colors: POLO_S445_COLORS,
    sizes: ['XS','S','M','L','XL','2XL','3XL','4XL'],
    printZones: SHIRT_ZONES,
    description: 'T-shirt sport haute performance. Tissu technique respirant à évacuation d\'humidité et séchage rapide. Parfait pour équipes sportives, événements et promotions actives.',
    features: ['Tissu technique respirant','Évacuation humidité','Séchage rapide'],
  },
  {
    id: 'l350', sku: 'L350',
    name: 'T-Shirt sport femme — L350', shortName: 'T-Shirt Sport F',
    category: 'sport', gender: 'femme', basePrice: 13.99,
    imageDevant: `${CDN}/L350-Devant.jpg?v=1770867170&width=800`,
    imageDos:    `${CDN}/L350-Dos.jpg?v=1770867170&width=800`,
    shopifyHandle: 'l350-1',
    colors: POLO_S445_COLORS,
    sizes: ['XS','S','M','L','XL','2XL'],
    printZones: SHIRT_ZONES,
    description: 'T-shirt sport performance femme, coupe ajustée. Tissu respirant et séchage rapide. Idéal pour équipes sportives féminines.',
    features: ['Coupe ajustée femme','Tissu respirant','Séchage rapide'],
  },
  {
    id: 'y350', sku: 'Y350',
    name: 'T-Shirt sport enfant — Y350', shortName: 'T-Shirt Sport E',
    category: 'sport', gender: 'enfant', basePrice: 13.99,
    imageDevant: `${CDN}/Y350-Devant.jpg?v=1770867079&width=800`,
    imageDos:    `${CDN}/Y350-Dos.jpg?v=1770867079&width=800`,
    shopifyHandle: 'y350-1',
    colors: POLO_S445_COLORS.slice(0, 7),
    sizes: ['XS','S','M','L','XL'],
    printZones: SHIRT_ZONES,
    description: 'T-shirt sport performance enfant. Même technologie respirante que les adultes, adapté aux tailles jeunesse.',
    features: ['Tissu respirant','Coupe enfant','Séchage rapide'],
  },

  // ── CASQUETTES ──────────────────────────────────────────────────────────────
  {
    id: 'atc6606', sku: 'ATC6606',
    name: 'Casquette Trucker — Yupoong 6606', shortName: 'Casquette Trucker',
    category: 'cap', gender: 'unisex', basePrice: 15.39,
    imageDevant: `${CDN}/yupoong-6606-noir-2_cb488769-745e-41f0-91fd-f317d9787cae.jpg?v=1763598460&width=800`,
    imageDos:    `${CDN}/6sgh1j.png?v=1774840440&width=800`,
    shopifyHandle: 'atc6606',
    colors: CAP_ATC6606_COLORS,
    sizes: ['Taille unique'],
    printZones: CAP_ZONES,
    description: 'Casquette trucker Yupoong 6606. Panneau avant structuré coton, 5 panneaux maille filet respirante à l\'arrière. Snapback réglable. Zone de broderie sur panneau avant.',
    features: ['Panneau avant structuré coton','5 panneaux maille filet','Snapback réglable','Zone broderie avant'],
  },
  {
    id: '6245cm', sku: '6245CM',
    name: 'Casquette Baseball Unisexe — 6245CM', shortName: 'Casquette Baseball',
    category: 'cap', gender: 'unisex', basePrice: 15.39,
    imageDevant: `${CDN}/c7d01dfb7dac4c79bd82abffc68e043c_l_21bd6f74-2540-48fe-bdd9-6d337329a5b5.jpg?v=1763598101&width=800`,
    imageDos:    `${CDN}/c7d01dfb7dac4c79bd82abffc68e043c_l_21bd6f74-2540-48fe-bdd9-6d337329a5b5.jpg?v=1763598101&width=800`,
    shopifyHandle: '6245cm',
    colors: CAP_ATC6606_COLORS.slice(0, 6),
    sizes: ['Taille unique'],
    printZones: CAP_ZONES,
    description: 'Casquette baseball unisexe 6 panneaux entièrement structurés. Fermeture Velcro réglable. Zone de broderie sur panneau avant.',
    features: ['6 panneaux structurés','Fermeture Velcro','Zone broderie avant'],
  },
  {
    id: 'atc6277', sku: 'ATC6277',
    name: 'Casquette Baseball Classique — ATC 6277', shortName: 'Casquette Classique',
    category: 'cap', gender: 'unisex', basePrice: 20.99,
    imageDevant: `${CDN}/atc6277_modl_white_studio-1_2021_cil-_1.jpg?v=1763598029&width=800`,
    imageDos:    `${CDN}/atc6277_modl_white_studio-1_2021_cil-_1.jpg?v=1763598029&width=800`,
    shopifyHandle: 'atc6277-1',
    colors: CAP_ATC6606_COLORS,
    sizes: ['Taille unique'],
    printZones: CAP_ZONES,
    description: 'Casquette ATC 6277 premium. 100% coton panneau avant, 6 panneaux. Fermeture sangle ajustable. Construction supérieure pour une représentation professionnelle.',
    features: ['100% coton panneau avant','6 panneaux premium','Fermeture sangle','Construction supérieure'],
  },

  // ── TUQUES ──────────────────────────────────────────────────────────────────
  {
    id: 'c100', sku: 'C100',
    name: 'Tuque à rebord — C100', shortName: 'Tuque Rebord',
    category: 'toque', gender: 'unisex', basePrice: 4.50,
    imageDevant: `${CDN}/c100-2_ea555bdf-f334-432d-a61e-5ba0cb06692e.jpg?v=1763598117&width=800`,
    imageDos:    `${CDN}/c100-2_ea555bdf-f334-432d-a61e-5ba0cb06692e.jpg?v=1763598117&width=800`,
    shopifyHandle: 'c100-1',
    colors: BEANIE_C105_COLORS,
    sizes: ['Taille unique'],
    printZones: BEANIE_ZONES,
    description: 'Tuque à rebord 100% acrylique, double épaisseur. Rebord retroussé pour broderie logo. Taille universelle.',
    features: ['100% acrylique','Double épaisseur','Rebord retroussé','Zone broderie sur rebord'],
  },
  {
    id: 'c105', sku: 'C105',
    name: 'Tuque sans rebords — C105', shortName: 'Tuque',
    category: 'toque', gender: 'unisex', basePrice: 7.13,
    imageDevant: `${CDN}/c105-2_c5d6b8c6-8c32-43f3-851d-f48dd2d35913.jpg?v=1763598172&width=800`,
    imageDos:    `${CDN}/c105-2_c5d6b8c6-8c32-43f3-851d-f48dd2d35913.jpg?v=1763598172&width=800`,
    shopifyHandle: 'c105-1',
    colors: BEANIE_C105_COLORS,
    sizes: ['Taille unique'],
    printZones: BEANIE_ZONES,
    description: 'Tuque tricotée sans rebords, double épaisseur 100% acrylique. Garde la chaleur, broderie sur face avant. Taille universelle.',
    features: ['100% acrylique','Double épaisseur','Sans rebord','Broderie face avant'],
  },
];

export const PRINT_PRICE             = 3.50;
export const BULK_DISCOUNT_THRESHOLD = 12;
export const BULK_DISCOUNT_RATE      = 0.15;

export function findProductByHandle(handle: string): Product | undefined {
  return PRODUCTS.find(p =>
    p.shopifyHandle === handle ||
    p.id === handle ||
    handle.toLowerCase().includes(p.sku.toLowerCase()) ||
    p.sku.toLowerCase() === handle.toLowerCase()
  );
}

export function matchProductByTitle(title: string): Product | undefined {
  const lower = title.toLowerCase();
  return PRODUCTS.find(p =>
    lower.includes(p.sku.toLowerCase()) || lower.includes(p.id.toLowerCase())
  );
}
