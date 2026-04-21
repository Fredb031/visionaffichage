/**
 * products.ts — Catalogue complet Vision Affichage
 * Couleurs exactes SanMar/ATC avec noms français du site
 * Images CDN visionaffichage.com par couleur (devant + dos)
 */

export type PrintZone = {
  id: string; label: string; labelEn?: string;
  x: number; y: number; width: number; height: number;
  /** Extra cost for this zone (0 = included in base print price) */
  extraPrice?: number;
};

/**
 * Zone IDs that represent a centered front placement. Used by
 * `pickDefaultZone` to avoid landing auto-placed logos on the off-center
 * "coeur-gauche" (left chest) — which is `printZones[0]` on the zip hoodie
 * (ATCF2600) and polos (S445 / L445 / S445LS), where x ≈ 14-16%.
 */
const CENTRAL_ZONE_IDS = new Set(['poitrine-centre', 'panneau-avant', 'face-avant']);

/**
 * Pick a sane default print zone: prefer a centered chest / front-panel
 * zone, fall back to the first zone only when no central zone exists.
 * Keeps the PrintZone shape untouched — this is purely selection logic.
 */
export const pickDefaultZone = (zones: PrintZone[]): PrintZone | undefined =>
  zones.find(z => CENTRAL_ZONE_IDS.has(z.id)) ?? zones[0];

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

const CDN = 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files';

// ── Zones d'impression ────────────────────────────────────────────────────────
const HOODIE_ZONES: PrintZone[] = [
  { id: 'poitrine-centre', label: 'Centre poitrine',           labelEn: 'Center chest',        x:33, y:26, width:34, height:24, extraPrice: 0 },
  { id: 'coeur-gauche',    label: 'Cœur gauche (petit logo)',  labelEn: 'Left chest (small)',   x:16, y:27, width:18, height:14, extraPrice: 0 },
  { id: 'dos-complet',     label: 'Dos complet (grand format)', labelEn: 'Full back (large)',    x:22, y:18, width:56, height:44, extraPrice: 2.00 },
  { id: 'dos-haut',        label: 'Haut du dos',                labelEn: 'Upper back',           x:28, y:16, width:44, height:20, extraPrice: 2.00 },
  { id: 'manche-gauche',   label: 'Manche gauche',              labelEn: 'Left sleeve',          x: 4, y:34, width:13, height:17, extraPrice: 2.00 },
  { id: 'manche-droite',   label: 'Manche droite',              labelEn: 'Right sleeve',         x:83, y:34, width:13, height:17, extraPrice: 2.00 },
];

const SHIRT_ZONES: PrintZone[] = [
  { id: 'poitrine-centre', label: 'Centre poitrine',           labelEn: 'Center chest',         x:32, y:24, width:36, height:26, extraPrice: 0 },
  { id: 'coeur-gauche',    label: 'Cœur gauche (petit logo)',  labelEn: 'Left chest (small)',    x:16, y:25, width:18, height:14, extraPrice: 0 },
  { id: 'dos-complet',     label: 'Dos complet (grand format)', labelEn: 'Full back (large)',    x:20, y:16, width:60, height:48, extraPrice: 2.00 },
  { id: 'dos-haut',        label: 'Haut du dos',                labelEn: 'Upper back',           x:26, y:14, width:48, height:22, extraPrice: 2.00 },
  { id: 'manche-gauche',   label: 'Manche gauche',              labelEn: 'Left sleeve',          x: 3, y:29, width:13, height:16, extraPrice: 2.00 },
  { id: 'manche-droite',   label: 'Manche droite',              labelEn: 'Right sleeve',         x:84, y:29, width:13, height:16, extraPrice: 2.00 },
];

const CAP_ZONES: PrintZone[] = [
  { id: 'panneau-avant', label: 'Panneau avant (recommandé)', labelEn: 'Front panel (recommended)', x:26, y:20, width:48, height:40, extraPrice: 0 },
  { id: 'cote-gauche',   label: 'Côté gauche',                labelEn: 'Left side',                 x: 6, y:26, width:20, height:30, extraPrice: 2.00 },
];

const BEANIE_ZONES: PrintZone[] = [
  { id: 'face-avant', label: 'Face avant (recommandé)', labelEn: 'Front (recommended)', x:26, y:22, width:48, height:38, extraPrice: 0 },
];

// ── Palettes couleurs EXACTES ATC/SanMar (noms FR + hex précis) ──────────────
// Source: SanMar Canada catalogue + visionaffichage.com

const ATCF2500_COLORS: ProductColor[] = [
  { id: 'black',            name: 'Noir',              nameEn: 'Black',            hex: '#141414' },
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
    imageDevant: '/products/ATC1000-Devant-Clean.jpg',
    imageDos:    '/products/ATC1000-Dos-Clean.jpg' },
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
    imageDevant: '/products/ATCF2500-Devant-Clean.jpg',
    imageDos:    '/products/ATCF2500-Dos-Clean.jpg',
    shopifyHandle: 'atcf2500',
    colors: ATCF2500_COLORS,
    sizes: ['XS','S','M','L','XL','2XL','3XL','4XL','5XL'],
    printZones: HOODIE_ZONES,
    description: 'Hoodie unisexe en French Terry 13 oz à molleton 3 épaisseurs, offrant chaleur et durabilité exceptionnelles. Son traitement anti-boulochage et sa certification OEKO-TEX en font un choix fiable. Idéal pour les uniformes d\'équipe, événements corporatifs et vêtements promotionnels.',
    features: ['13 oz French Terry','Molleton 3 épaisseurs','Capuchon doublé avec cordon','Œillets métal argenté','Poche kangourou','Anti-boulochage','OEKO-TEX® Standard 100'],
  },
  {
    id: 'atcy2500', sku: 'ATCY2500',
    name: 'Hoodie à capuche enfant — ATC FY2500', shortName: 'Hoodie Enfant',
    category: 'hoodie', gender: 'enfant', basePrice: 21.39,
    imageDevant: '/products/ATCY2500-Devant-Clean.jpg',
    imageDos:    '/products/ATCY2500-Dos-Clean.jpg',
    shopifyHandle: 'atcy2500-1',
    colors: ATCF2500_COLORS.slice(0, 10),
    sizes: ['XS','S','M','L','XL'],
    printZones: HOODIE_ZONES,
    description: 'Hoodie enfant en French Terry 3 épaisseurs avec capuchon doublé et poche kangourou, conçu pour résister aux journées actives. Même qualité premium que le modèle adulte, dans des tailles jeunesse. Parfait pour les équipes sportives scolaires et les camps.',
    features: ['French Terry 3 épaisseurs','Capuchon doublé','Poche kangourou','Anti-boulochage'],
  },
  {
    id: 'atcf2600', sku: 'ATCF2600',
    name: 'Hoodie avec fermeture éclair — ATC F2600', shortName: 'Hoodie Zip',
    category: 'hoodie', gender: 'unisex', basePrice: 32.49,
    imageDevant: '/products/ATCF2600-Devant-Clean.jpg',
    imageDos:    '/products/ATCF2600-Dos-Clean.jpg',
    shopifyHandle: 'atcf2600-1',
    colors: ATCF2500_COLORS.slice(0, 10),
    sizes: ['XS','S','M','L','XL','2XL','3XL'],
    printZones: [
      { id: 'coeur-gauche', label: 'Cœur gauche', labelEn: 'Left chest',  x:14, y:27, width:20, height:16 , extraPrice: 0 },
      { id: 'dos-complet',  label: 'Dos complet', labelEn: 'Full back', x:22, y:18, width:56, height:44, extraPrice: 2.00 },
      { id: 'manche-gauche',label: 'Manche gauche', labelEn: 'Left sleeve', x: 3, y:34, width:13, height:17, extraPrice: 2.00 },
    ],
    description: 'Veste à capuche avec fermeture éclair YKK pleine longueur en French Terry 3 épaisseurs, alliant confort et allure professionnelle. Ses deux poches latérales ajoutent une touche pratique au quotidien. Conçu pour les représentants terrain, salons et événements corporatifs.',
    features: ['Fermeture éclair YKK pleine longueur','French Terry 3 épaisseurs','Deux poches latérales','Capuchon doublé'],
  },
  {
    id: 'atcf2400', sku: 'ATCF2400',
    name: 'Crewneck épais — ATC F2400', shortName: 'Crewneck',
    category: 'crewneck', gender: 'unisex', basePrice: 16.81,
    imageDevant: '/products/ATCF2400-Devant-Clean.jpg',
    imageDos:    '/products/ATCF2400-Dos-Clean.jpg',
    shopifyHandle: 'atcf2400-1',
    colors: ATCF2500_COLORS.slice(0, 10),
    sizes: ['XS','S','M','L','XL','2XL','3XL'],
    printZones: SHIRT_ZONES,
    description: 'Crewneck unisexe en French Terry 3 épaisseurs avec col rond côtelé et finitions en côte aux poignets et à la taille. Son look épuré sans capuche offre une silhouette professionnelle et polyvalente. Excellent choix pour les tenues corporatives et les cadeaux d\'entreprise.',
    features: ['French Terry 3 épaisseurs','Col rond côtelé','Poignets et taille en côte'],
  },

  // ── T-SHIRTS ─────────────────────────────────────────────────────────────────
  {
    id: 'atc1000', sku: 'ATC1000',
    name: 'T-Shirt — ATC 1000', shortName: 'T-Shirt',
    category: 'tshirt', gender: 'unisex', basePrice: 4.15,
    imageDevant: '/products/ATC1000-Devant-Clean.jpg',
    imageDos:    '/products/ATC1000-Dos-Clean.jpg',
    shopifyHandle: 'atc1000',
    colors: ATC1000_COLORS,
    sizes: ['XS','S','M','L','XL','2XL','3XL','4XL','5XL'],
    printZones: SHIRT_ZONES,
    description: 'T-shirt en coton ringspun 100 % de 9,1 oz avec coutures double aiguille et étiquette détachable pour un rebranding facile. Sa certification OEKO-TEX garantit un produit sûr et responsable. Le choix par excellence pour les équipes, événements et campagnes promotionnelles.',
    features: ['100% coton ringspun 9,1 oz','Col côtelé 1×1','Coutures double aiguille','Étiquette détachable','OEKO-TEX® Standard 100'],
  },
  {
    id: 'atc1000l', sku: 'ATC1000L',
    name: 'T-Shirt femme — ATC 1000L', shortName: 'T-Shirt Femme',
    category: 'tshirt', gender: 'femme', basePrice: 6.65,
    imageDevant: '/products/ATC1000L-Devant-Clean.jpg',
    imageDos:    '/products/ATC1000L-Dos-Clean.jpg',
    shopifyHandle: 'atc1000l',
    colors: ATC1000_COLORS.slice(0, 12),
    sizes: ['XS','S','M','L','XL','2XL'],
    printZones: SHIRT_ZONES,
    description: 'T-shirt coupe ajustée femme en coton ringspun 9,1 oz, offrant une silhouette valorisante sans compromis sur la durabilité. Sa finition soignée assure un rendu d\'impression impeccable. Idéal pour les équipes mixtes et les uniformes professionnels féminins.',
    features: ['100% coton ringspun 9,1 oz','Coupe ajustée femme','Col côtelé','OEKO-TEX®'],
  },
  {
    id: 'atc1000y', sku: 'ATC1000Y',
    name: 'T-Shirt enfant — ATC 1000Y', shortName: 'T-Shirt Enfant',
    category: 'tshirt', gender: 'enfant', basePrice: 4.76,
    imageDevant: `${CDN}/ATCY1000-Devant.jpg?v=1770867607&width=800`,
    imageDos:    `${CDN}/ATCY1000-Dos.jpg?v=1770867606&width=800`,
    shopifyHandle: 'atc1000y-1',
    colors: ATC1000_COLORS.slice(0, 10),
    sizes: ['XS','S','M','L','XL'],
    printZones: SHIRT_ZONES,
    description: 'T-shirt enfant en coton ringspun 100 % avec col côtelé résistant, offrant la même qualité éprouvée que le modèle adulte. Sa construction renforcée résiste aux lavages fréquents. Conçu pour les équipes sportives jeunesse, événements scolaires et camps d\'été.',
    features: ['100% coton ringspun','Coupe enfant','Col côtelé','OEKO-TEX®'],
  },
  {
    id: 'werk250', sku: 'WERK250',
    name: 'T-Shirt Premium — WERK250', shortName: 'T-Shirt Premium',
    category: 'tshirt', gender: 'unisex', basePrice: 16.09,
    imageDevant: '/products/WERK250-Devant-Clean.jpg',
    imageDos:    '/products/WERK250-Dos-Clean.jpg',
    shopifyHandle: 'werk250-1',
    colors: ATC1000_COLORS.slice(0, 8),
    sizes: ['XS','S','M','L','XL','2XL','3XL'],
    printZones: SHIRT_ZONES,
    description: 'T-shirt premium de 250 g/m² au tissu épais et résistant, conçu pour une surface d\'impression optimale et un rendu haut de gamme. Sa construction robuste maintient sa forme lavage après lavage. Parfait pour les environnements de travail exigeants et les collections de marque.',
    features: ['250 g/m² qualité supérieure','Tissu épais et résistant','Surface impression optimale'],
  },
  {
    id: 'atc1015', sku: 'ATC1015',
    name: 'T-Shirt manches longues — ATC 1015', shortName: 'Manches Longues',
    category: 'longsleeve', gender: 'unisex', basePrice: 27.54,
    imageDevant: '/products/ATC1015-Devant-Clean.jpg',
    imageDos:    '/products/ATC1015-Dos-Clean.jpg',
    shopifyHandle: 'atc1015',
    colors: ATC1000_COLORS.slice(0, 10),
    sizes: ['XS','S','M','L','XL','2XL','3XL'],
    printZones: SHIRT_ZONES,
    description: 'T-shirt manches longues en coton ringspun avec col côtelé 1x1, offrant une protection supplémentaire pour les saisons fraîches. Sa coupe classique et ses coutures renforcées garantissent confort et longévité. Idéal pour les chantiers, événements extérieurs et tenues d\'équipe automne-hiver.',
    features: ['100% coton ringspun','Manches longues','Col côtelé 1×1','OEKO-TEX®'],
  },

  // ── POLOS ───────────────────────────────────────────────────────────────────
  {
    id: 's445', sku: 'S445',
    name: 'Polo homme à manches courtes — S445', shortName: 'Polo',
    category: 'polo', gender: 'homme', basePrice: 27.99,
    imageDevant: '/products/S445-Devant-Clean.jpg',
    imageDos:    '/products/S445-Dos-Clean.jpg',
    shopifyHandle: 's445-1',
    colors: POLO_S445_COLORS,
    sizes: ['XS','S','M','L','XL','2XL','3XL','4XL'],
    printZones: [
      { id: 'coeur-gauche',    label: 'Cœur gauche', labelEn: 'Left chest',   x:16, y:25, width:20, height:16 , extraPrice: 0 },
      { id: 'poitrine-centre', label: 'Centre poitrine', labelEn: 'Center chest', x:32, y:26, width:34, height:24, extraPrice: 0 },
      { id: 'dos-complet',     label: 'Dos complet', labelEn: 'Full back', x:20, y:16, width:60, height:48, extraPrice: 2.00 },
      { id: 'manche-gauche',   label: 'Manche gauche', labelEn: 'Left sleeve', x: 3, y:29, width:13, height:16, extraPrice: 2.00 },
    ],
    description: 'Polo homme à manches courtes avec col classique et placket 3 boutons, offrant une allure soignée en toute occasion. Son tissu respirant assure un confort optimal tout au long de la journée. Parfait pour les uniformes d\'entreprise, réceptions et salons professionnels.',
    features: ['Col polo classique','Placket 3 boutons','Coupe droite','Lavable en machine'],
  },
  {
    id: 'l445', sku: 'L445',
    name: 'Polo femme à manches courtes — L445', shortName: 'Polo Femme',
    category: 'polo', gender: 'femme', basePrice: 27.99,
    imageDevant: '/products/L445-Devant-Clean.jpg',
    imageDos:    '/products/L445-Dos-Clean.jpg',
    shopifyHandle: 'l445-1',
    colors: POLO_S445_COLORS,
    sizes: ['XS','S','M','L','XL','2XL'],
    printZones: [
      { id: 'coeur-gauche', label: 'Cœur gauche', labelEn: 'Left chest', x:16, y:25, width:20, height:16 , extraPrice: 0 },
      { id: 'dos-complet',  label: 'Dos complet', labelEn: 'Full back', x:20, y:16, width:60, height:48, extraPrice: 2.00 },
    ],
    description: 'Polo femme coupe ajustée à manches courtes avec col polo et placket 3 boutons, offrant une silhouette élégante et professionnelle. Son tissu léger et respirant garantit un confort toute la journée. Idéal pour les équipes mixtes, réceptions et uniformes corporatifs.',
    features: ['Coupe ajustée femme','Col polo','Placket 3 boutons'],
  },
  {
    id: 's445ls', sku: 'S445LS',
    name: 'Polo manches longues homme — S445LS', shortName: 'Polo Manches Longues',
    category: 'polo', gender: 'homme', basePrice: 33.59,
    imageDevant: '/products/S445LS-Devant-Clean.jpg',
    imageDos:    '/products/S445LS-Dos-Clean.jpg',
    shopifyHandle: 's445ls-1',
    colors: POLO_S445_COLORS.slice(0, 7),
    sizes: ['XS','S','M','L','XL','2XL','3XL'],
    printZones: [
      { id: 'coeur-gauche', label: 'Cœur gauche', labelEn: 'Left chest',  x:16, y:25, width:20, height:16 , extraPrice: 0 },
      { id: 'dos-complet',  label: 'Dos complet', labelEn: 'Full back',   x:20, y:16, width:60, height:48 , extraPrice: 2.00 },
      { id: 'manche-gauche',label: 'Manche gauche', labelEn: 'Left sleeve', x: 3, y:29, width:13, height:16, extraPrice: 2.00 },
    ],
    description: 'Polo manches longues 4 saisons avec col polo et placket 3 boutons, combinant protection contre les éléments et allure professionnelle. Sa coupe structurée garde un look impeccable du matin au soir. Conçu pour les représentants terrain, événements extérieurs et environnements climatisés.',
    features: ['Manches longues','Col polo','Placket 3 boutons','Usage 4 saisons'],
  },

  // ── T-SHIRTS SPORT ──────────────────────────────────────────────────────────
  {
    id: 's350', sku: 'S350',
    name: 'T-Shirt sport homme — S350', shortName: 'T-Shirt Sport',
    category: 'sport', gender: 'homme', basePrice: 13.99,
    imageDevant: '/products/S350-Devant-Clean.jpg',
    imageDos:    '/products/S350-Dos-Clean.jpg',
    shopifyHandle: 's350-1',
    colors: POLO_S445_COLORS,
    sizes: ['XS','S','M','L','XL','2XL','3XL','4XL'],
    printZones: SHIRT_ZONES,
    description: 'T-shirt sport haute performance en tissu technique avec évacuation d\'humidité et séchage rapide, conçu pour les activités intenses. Sa coupe athlétique offre liberté de mouvement et ventilation optimale. Parfait pour les équipes sportives, tournois et événements promotionnels actifs.',
    features: ['Tissu technique respirant','Évacuation humidité','Séchage rapide'],
  },
  {
    id: 'l350', sku: 'L350',
    name: 'T-Shirt sport femme — L350', shortName: 'T-Shirt Sport Femme',
    category: 'sport', gender: 'femme', basePrice: 13.99,
    imageDevant: '/products/L350-Devant-Clean.jpg',
    imageDos:    '/products/L350-Dos-Clean.jpg',
    shopifyHandle: 'l350-1',
    colors: POLO_S445_COLORS,
    sizes: ['XS','S','M','L','XL','2XL'],
    printZones: SHIRT_ZONES,
    description: 'T-shirt sport femme en tissu technique respirant à séchage rapide, avec une coupe ajustée qui épouse la silhouette. Sa technologie d\'évacuation d\'humidité garde au sec pendant l\'effort. Idéal pour les équipes sportives féminines, courses et activités de plein air.',
    features: ['Coupe ajustée femme','Tissu respirant','Séchage rapide'],
  },
  {
    id: 'y350', sku: 'Y350',
    name: 'T-Shirt sport enfant — Y350', shortName: 'T-Shirt Sport Enfant',
    category: 'sport', gender: 'enfant', basePrice: 13.99,
    imageDevant: '/products/Y350-Devant-Clean.jpg',
    imageDos:    '/products/Y350-Dos-Clean.jpg',
    shopifyHandle: 'y350-1',
    colors: POLO_S445_COLORS.slice(0, 7),
    sizes: ['XS','S','M','L','XL'],
    printZones: SHIRT_ZONES,
    description: 'T-shirt sport enfant en tissu technique respirant avec la même technologie de séchage rapide que les modèles adultes. Sa coupe adaptée aux tailles jeunesse assure confort et liberté de mouvement. Conçu pour les ligues sportives scolaires, camps et compétitions jeunesse.',
    features: ['Tissu respirant','Coupe enfant','Séchage rapide'],
  },

  // ── CASQUETTES ──────────────────────────────────────────────────────────────
  {
    id: 'atc6606', sku: 'ATC6606',
    name: 'Casquette Trucker — Yupoong 6606', shortName: 'Casquette Trucker',
    category: 'cap', gender: 'unisex', basePrice: 15.39,
    imageDevant: '/products/ATC6606-Devant-Clean.jpg',
    imageDos:    '/products/ATC6606-Dos-Clean.jpg',
    shopifyHandle: 'atc6606',
    colors: CAP_ATC6606_COLORS,
    sizes: ['Taille unique'],
    printZones: CAP_ZONES,
    description: 'Casquette trucker Yupoong 6606 avec panneau avant structuré en coton et 5 panneaux en maille filet respirante. Son snapback réglable assure un ajustement universel et confortable. Idéale pour la broderie de logos d\'entreprise, équipes sportives et cadeaux promotionnels.',
    features: ['Panneau avant structuré coton','5 panneaux maille filet','Snapback réglable','Zone broderie avant'],
  },
  {
    id: '6245cm', sku: '6245CM',
    name: 'Casquette Baseball Unisexe — 6245CM', shortName: 'Casquette Baseball',
    category: 'cap', gender: 'unisex', basePrice: 15.39,
    imageDevant: '/products/ATC6245CM-Devant-Clean.jpg',
    imageDos:    '/products/ATC6245CM-Dos-Clean.jpg',
    shopifyHandle: '6245cm',
    colors: CAP_ATC6606_COLORS.slice(0, 6),
    sizes: ['Taille unique'],
    printZones: CAP_ZONES,
    description: 'Casquette baseball unisexe à 6 panneaux entièrement structurés offrant une forme classique et durable. Sa fermeture Velcro réglable s\'adapte à toutes les tailles avec facilité. Parfaite pour les uniformes d\'équipe, événements corporatifs et articles promotionnels brodés.',
    features: ['6 panneaux structurés','Fermeture Velcro','Zone broderie avant'],
  },
  {
    id: 'atc6277', sku: 'ATC6277',
    name: 'Casquette Baseball Classique — ATC 6277', shortName: 'Casquette Classique',
    category: 'cap', gender: 'unisex', basePrice: 20.99,
    imageDevant: '/products/ATC6277-Devant-Clean.jpg',
    imageDos:    '/products/ATC6277-Dos-Clean.jpg',
    shopifyHandle: 'atc6277-1',
    colors: CAP_ATC6606_COLORS,
    sizes: ['Taille unique'],
    printZones: CAP_ZONES,
    description: 'Casquette premium ATC 6277 en coton 100 % avec 6 panneaux et construction haut de gamme pour un rendu de broderie impeccable. Sa fermeture à sangle ajustable offre un port confortable et personnalisé. Le choix de référence pour une image de marque professionnelle et soignée.',
    features: ['100% coton panneau avant','6 panneaux premium','Fermeture sangle','Construction supérieure'],
  },

  // ── TUQUES ──────────────────────────────────────────────────────────────────
  {
    id: 'c100', sku: 'C100',
    name: 'Tuque à rebord — C100', shortName: 'Tuque',
    category: 'toque', gender: 'unisex', basePrice: 4.50,
    imageDevant: '/products/C100-Devant-Clean.jpg',
    imageDos:    '/products/C100-Dos-Clean.jpg',
    shopifyHandle: 'c100-1',
    colors: BEANIE_C105_COLORS,
    sizes: ['Taille unique'],
    printZones: BEANIE_ZONES,
    description: 'Tuque à rebord en acrylique 100 % double épaisseur, offrant chaleur et résistance aux intempéries hivernales. Son rebord retroussé constitue la zone idéale pour la broderie de votre logo. Parfaite pour les équipes de chantier, événements hivernaux et cadeaux d\'entreprise saisonniers.',
    features: ['100% acrylique','Double épaisseur','Rebord retroussé','Zone broderie sur rebord'],
  },
  {
    id: 'c105', sku: 'C105',
    name: 'Tuque sans rebords — C105', shortName: 'Tuque Légère',
    category: 'toque', gender: 'unisex', basePrice: 7.13,
    imageDevant: `${CDN}/c105-2_c5d6b8c6-8c32-43f3-851d-f48dd2d35913.jpg?v=1763598172&width=800`,
    imageDos:    `${CDN}/c105-2_c5d6b8c6-8c32-43f3-851d-f48dd2d35913.jpg?v=1763598172&width=800`,
    shopifyHandle: 'c105-1',
    colors: BEANIE_C105_COLORS,
    sizes: ['Taille unique'],
    printZones: BEANIE_ZONES,
    description: 'Tuque sans rebord en acrylique 100 % double épaisseur au style épuré et contemporain, offrant une excellente rétention de chaleur. Sa face avant lisse est optimale pour la broderie de logos et emblèmes. Idéale pour les équipes de travail extérieur, promotions hivernales et événements de fin d\'année.',
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

// ── Per-colour product images from Google Drive ──────────────────────────────
// Keyed by SKU → colour slug → { front, back }
// Generated from public/products/ directory contents
export const COLOR_IMAGES: Record<string, Record<string, { front?: string; back?: string }>> = {
  'ATC1000': {
    'aquatic-blue': { front: '/products/ATC1000-front-aquatic-blue.jpg', back: '/products/ATC1000-back-aquatic-blue.jpg' },
    'aquatic_blue_cil': { front: '/products/ATC1000-front-aquatic_blue_cil.jpg', back: '/products/ATC1000-back-aquatic_blue_cil.jpg' },
    'ash_grey_cil': { front: '/products/ATC1000-front-ash_grey_cil.jpg', back: '/products/ATC1000-back-ash_grey_cil.jpg' },
    'athleticheather_012017': { back: '/products/ATC1000-back-athleticheather_012017.jpg' },
    'athleticrheather_012017': { front: '/products/ATC1000-front-athleticrheather_012017.jpg' },
    'black': { front: '/products/ATC1000-front-black.jpg' },
    'black_012017': { front: '/products/ATC1000-front-black_012017.jpg', back: '/products/ATC1000-back-black_012017.jpg' },
    'bright_aqua_cil': { front: '/products/ATC1000-front-bright_aqua_cil.jpg', back: '/products/ATC1000-back-bright_aqua_cil.jpg' },
    'candy_pink_cil': { front: '/products/ATC1000-front-candy_pink_cil.jpg', back: '/products/ATC1000-back-candy_pink_cil.jpg' },
    'caramel_cil': { front: '/products/ATC1000-front-caramel_cil.jpg', back: '/products/ATC1000-back-caramel_cil.jpg' },
    'carolina_blue_cil': { front: '/products/ATC1000-front-carolina_blue_cil.jpg', back: '/products/ATC1000-back-carolina_blue_cil.jpg' },
    'charcoal_012017': { back: '/products/ATC1000-back-charcoal_012017.jpg' },
    'charcoal_v2_012017': { front: '/products/ATC1000-front-charcoal_v2_012017.jpg' },
    'chocolate_brown_cil': { front: '/products/ATC1000-front-chocolate_brown_cil.jpg', back: '/products/ATC1000-back-chocolate_brown_cil.jpg' },
    'clover_green_cil': { front: '/products/ATC1000-front-clover_green_cil.jpg', back: '/products/ATC1000-back-clover_green_cil.jpg' },
    'coyote_brown_cil': { front: '/products/ATC1000-front-coyote_brown_cil.jpg', back: '/products/ATC1000-back-coyote_brown_cil.jpg' },
    'dark_navy_052019': { front: '/products/ATC1000-front-dark_navy_052019.jpg', back: '/products/ATC1000-back-dark_navy_052019.jpg' },
    'dark_sand_cil': { front: '/products/ATC1000-front-dark_sand_cil.jpg', back: '/products/ATC1000-back-dark_sand_cil.jpg' },
    'darkgreen_022017': { back: '/products/ATC1000-back-darkgreen_022017.jpg' },
    'darkgreen_v5_012017': { front: '/products/ATC1000-front-darkgreen_v5_012017.jpg' },
    'darkheathergrey_012017': { front: '/products/ATC1000-front-darkheathergrey_012017.jpg', back: '/products/ATC1000-back-darkheathergrey_012017.jpg' },
    'fatiguegreen_092019': { front: '/products/ATC1000-front-fatiguegreen_092019.jpg', back: '/products/ATC1000-back-fatiguegreen_092019.jpg' },
    'gold_012017': { front: '/products/ATC1000-front-gold_012017.jpg', back: '/products/ATC1000-back-gold_012017.jpg' },
    'graphite_heather_1': { front: '/products/ATC1000-front-graphite_heather_1.jpg', back: '/products/ATC1000-back-graphite_heather_1.jpg' },
    'graphite_heather_cil': { front: '/products/ATC1000-front-graphite_heather_cil.jpg', back: '/products/ATC1000-back-graphite_heather_cil.jpg' },
    'heather-navy': { front: '/products/ATC1000-front-heather-navy.jpg', back: '/products/ATC1000-back-heather-navy.jpg' },
    'heather-red': { front: '/products/ATC1000-front-heather-red.jpg', back: '/products/ATC1000-back-heather-red.jpg' },
    'heather-royal': { front: '/products/ATC1000-front-heather-royal.jpg', back: '/products/ATC1000-back-heather-royal.jpg' },
    'heather_purple_cil': { front: '/products/ATC1000-front-heather_purple_cil.jpg', back: '/products/ATC1000-back-heather_purple_cil.jpg' },
    'kelly_012017': { front: '/products/ATC1000-front-kelly_012017.jpg', back: '/products/ATC1000-back-kelly_012017.jpg' },
    'laurel_green_cil': { front: '/products/ATC1000-front-laurel_green_cil.jpg', back: '/products/ATC1000-back-laurel_green_cil.jpg' },
    'lavender_cil': { front: '/products/ATC1000-front-lavender_cil.jpg', back: '/products/ATC1000-back-lavender_cil.jpg' },
    'lightblue_112017': { front: '/products/ATC1000-front-lightblue_112017.jpg', back: '/products/ATC1000-back-lightblue_112017.jpg' },
    'lime_112017': { front: '/products/ATC1000-front-lime_112017.jpg', back: '/products/ATC1000-back-lime_112017.jpg' },
    'maroon_012017': { front: '/products/ATC1000-front-maroon_012017.jpg', back: '/products/ATC1000-back-maroon_012017.jpg' },
    'mediumgrey_112017': { front: '/products/ATC1000-front-mediumgrey_112017.jpg', back: '/products/ATC1000-back-mediumgrey_112017.jpg' },
    'military_green_cil': { front: '/products/ATC1000-front-military_green_cil.jpg', back: '/products/ATC1000-back-military_green_cil.jpg' },
    'natural_cil': { front: '/products/ATC1000-front-natural_cil.jpg', back: '/products/ATC1000-back-natural_cil.jpg' },
    'navy': { front: '/products/ATC1000-front-navy.jpg' },
    'navy_012017': { front: '/products/ATC1000-front-navy_012017.jpg', back: '/products/ATC1000-back-navy_012017.jpg' },
    'neon_blue_cil': { front: '/products/ATC1000-front-neon_blue_cil.jpg', back: '/products/ATC1000-back-neon_blue_cil.jpg' },
    'neon_green_cil': { front: '/products/ATC1000-front-neon_green_cil.jpg', back: '/products/ATC1000-back-neon_green_cil.jpg' },
    'neon_orange_cil': { front: '/products/ATC1000-front-neon_orange_cil.jpg', back: '/products/ATC1000-back-neon_orange_cil.jpg' },
    'neon_pink_cil': { front: '/products/ATC1000-front-neon_pink_cil.jpg', back: '/products/ATC1000-back-neon_pink_cil.jpg' },
    'neon_yellow_cil': { front: '/products/ATC1000-front-neon_yellow_cil.jpg', back: '/products/ATC1000-back-neon_yellow_cil.jpg' },
    'neptune_blue_cil': { front: '/products/ATC1000-front-neptune_blue_cil.jpg', back: '/products/ATC1000-back-neptune_blue_cil.jpg' },
    'oatmeal_heather_cil': { front: '/products/ATC1000-front-oatmeal_heather_cil.jpg', back: '/products/ATC1000-back-oatmeal_heather_cil.jpg' },
    'orange_012017': { back: '/products/ATC1000-back-orange_012017.jpg' },
    'orange_v2_012017': { front: '/products/ATC1000-front-orange_v2_012017.jpg' },
    'pale_blush_cil': { front: '/products/ATC1000-front-pale_blush_cil.jpg', back: '/products/ATC1000-back-pale_blush_cil.jpg' },
    'purple_012017': { front: '/products/ATC1000-front-purple_012017.jpg', back: '/products/ATC1000-back-purple_012017.jpg' },
    'red_012017': { front: '/products/ATC1000-front-red_012017.jpg', back: '/products/ATC1000-back-red_012017.jpg' },
    'royal_012017': { front: '/products/ATC1000-front-royal_012017.jpg', back: '/products/ATC1000-back-royal_012017.jpg' },
    'safety_green_cil': { front: '/products/ATC1000-front-safety_green_cil.jpg', back: '/products/ATC1000-back-safety_green_cil.jpg' },
    'safety_orange_cil': { front: '/products/ATC1000-front-safety_orange_cil.jpg', back: '/products/ATC1000-back-safety_orange_cil.jpg' },
    'sangria_012017': { back: '/products/ATC1000-back-sangria_012017.jpg' },
    'sangria_v2_012017': { front: '/products/ATC1000-front-sangria_v2_012017.jpg' },
    'sapphire_012017': { front: '/products/ATC1000-front-sapphire_012017.jpg', back: '/products/ATC1000-back-sapphire_012017.jpg' },
    'silver_012017': { back: '/products/ATC1000-back-silver_012017.jpg' },
    'silver_v2_012017': { front: '/products/ATC1000-front-silver_v2_012017.jpg' },
    'steel_blue_cil': { front: '/products/ATC1000-front-steel_blue_cil.jpg', back: '/products/ATC1000-back-steel_blue_cil.jpg' },
    'teal_cil': { front: '/products/ATC1000-front-teal_cil.jpg', back: '/products/ATC1000-back-teal_cil.jpg' },
    'team_purple_cil': { front: '/products/ATC1000-front-team_purple_cil.jpg', back: '/products/ATC1000-back-team_purple_cil.jpg' },
    'true_celadon_cil': { front: '/products/ATC1000-front-true_celadon_cil.jpg', back: '/products/ATC1000-back-true_celadon_cil.jpg' },
    'true_royal_cil': { front: '/products/ATC1000-front-true_royal_cil.jpg', back: '/products/ATC1000-back-true_royal_cil.jpg' },
    'white_012017': { front: '/products/ATC1000-front-white_012017.jpg', back: '/products/ATC1000-back-white_012017.jpg' },
    'woodland_brown_cil': { front: '/products/ATC1000-front-woodland_brown_cil.jpg', back: '/products/ATC1000-back-woodland_brown_cil.jpg' },
    'yellow_012017': { front: '/products/ATC1000-front-yellow_012017.jpg', back: '/products/ATC1000-back-yellow_012017.jpg' },
  },
  'ATC1000L': {
    'aquatic-blue': { front: '/products/ATC1000L-front-aquatic-blue.jpg', back: '/products/ATC1000L-back-aquatic-blue.jpg' },
    'aquatic_blue_cil': { front: '/products/ATC1000L-front-aquatic_blue_cil.jpg', back: '/products/ATC1000L-back-aquatic_blue_cil.jpg' },
    'ash_grey_cil': { front: '/products/ATC1000L-front-ash_grey_cil.jpg', back: '/products/ATC1000L-back-ash_grey_cil.jpg' },
    'athleticheather_tem': { front: '/products/ATC1000L-front-athleticheather_tem.jpg', back: '/products/ATC1000L-back-athleticheather_tem.jpg' },
    'black_012017': { front: '/products/ATC1000L-front-black_012017.jpg', back: '/products/ATC1000L-back-black_012017.jpg' },
    'candy-pink': { front: '/products/ATC1000L-front-candy-pink.jpg', back: '/products/ATC1000L-back-candy-pink.jpg' },
    'candy_pink_cil': { front: '/products/ATC1000L-front-candy_pink_cil.jpg', back: '/products/ATC1000L-back-candy_pink_cil.jpg' },
    'charcoal_012017': { front: '/products/ATC1000L-front-charcoal_012017.jpg', back: '/products/ATC1000L-back-charcoal_012017.jpg' },
    'dark-heather': { front: '/products/ATC1000L-front-dark-heather.jpg', back: '/products/ATC1000L-back-dark-heather.jpg' },
    'fatiguegreen_092019': { front: '/products/ATC1000L-front-fatiguegreen_092019.jpg', back: '/products/ATC1000L-back-fatiguegreen_092019.jpg' },
    'gold_012017': { front: '/products/ATC1000L-front-gold_012017.jpg', back: '/products/ATC1000L-back-gold_012017.jpg' },
    'heather-navy': { front: '/products/ATC1000L-front-heather-navy.jpg', back: '/products/ATC1000L-back-heather-navy.jpg' },
    'heather-red': { front: '/products/ATC1000L-front-heather-red.jpg', back: '/products/ATC1000L-back-heather-red.jpg' },
    'heather-royal': { front: '/products/ATC1000L-front-heather-royal.jpg', back: '/products/ATC1000L-back-heather-royal.jpg' },
    'kelly_012017': { front: '/products/ATC1000L-front-kelly_012017.jpg', back: '/products/ATC1000L-back-kelly_012017.jpg' },
    'laurel_gree': { front: '/products/ATC1000L-front-laurel_gree.jpg', back: '/products/ATC1000L-back-laurel_gree.jpg' },
    'laurel_green_cil': { front: '/products/ATC1000L-front-laurel_green_cil.jpg', back: '/products/ATC1000L-back-laurel_green_cil.jpg' },
    'lavender_cil': { front: '/products/ATC1000L-front-lavender_cil.jpg', back: '/products/ATC1000L-back-lavender_cil.jpg' },
    'lightblue_112017': { front: '/products/ATC1000L-front-lightblue_112017.jpg', back: '/products/ATC1000L-back-lightblue_112017.jpg' },
    'lime_112017': { front: '/products/ATC1000L-front-lime_112017.jpg', back: '/products/ATC1000L-back-lime_112017.jpg' },
    'maroon_012017': { front: '/products/ATC1000L-front-maroon_012017.jpg', back: '/products/ATC1000L-back-maroon_012017.jpg' },
    'mediumgrey_112017': { front: '/products/ATC1000L-front-mediumgrey_112017.jpg', back: '/products/ATC1000L-back-mediumgrey_112017.jpg' },
    'navy_012017': { front: '/products/ATC1000L-front-navy_012017.jpg', back: '/products/ATC1000L-back-navy_012017.jpg' },
    'oatmeal_heather_cil': { front: '/products/ATC1000L-front-oatmeal_heather_cil.jpg', back: '/products/ATC1000L-back-oatmeal_heather_cil.jpg' },
    'orange_012017': { front: '/products/ATC1000L-front-orange_012017.jpg', back: '/products/ATC1000L-back-orange_012017.jpg' },
    'pale_blush_cil': { front: '/products/ATC1000L-front-pale_blush_cil.jpg', back: '/products/ATC1000L-back-pale_blush_cil.jpg' },
    'purple_012017': { front: '/products/ATC1000L-front-purple_012017.jpg', back: '/products/ATC1000L-back-purple_012017.jpg' },
    'red_012017': { front: '/products/ATC1000L-front-red_012017.jpg', back: '/products/ATC1000L-back-red_012017.jpg' },
    'royal_012017': { front: '/products/ATC1000L-front-royal_012017.jpg', back: '/products/ATC1000L-back-royal_012017.jpg' },
    'sangria_012017': { front: '/products/ATC1000L-front-sangria_012017.jpg', back: '/products/ATC1000L-back-sangria_012017.jpg' },
    'sapphire_012017': { front: '/products/ATC1000L-front-sapphire_012017.jpg', back: '/products/ATC1000L-back-sapphire_012017.jpg' },
    'silver_012017': { front: '/products/ATC1000L-front-silver_012017.jpg', back: '/products/ATC1000L-back-silver_012017.jpg' },
    'teal_cil': { front: '/products/ATC1000L-front-teal_cil.jpg', back: '/products/ATC1000L-back-teal_cil.jpg' },
    'true_celadon_cil': { front: '/products/ATC1000L-front-true_celadon_cil.jpg', back: '/products/ATC1000L-back-true_celadon_cil.jpg' },
    'white_012017': { front: '/products/ATC1000L-front-white_012017.jpg', back: '/products/ATC1000L-back-white_012017.jpg' },
    'yellow_012017': { front: '/products/ATC1000L-front-yellow_012017.jpg', back: '/products/ATC1000L-back-yellow_012017.jpg' },
  },
  'ATC1015': {
    'ash_grey_cil': { front: '/products/ATC1015-front-ash_grey_cil.jpg', back: '/products/ATC1015-back-ash_grey_cil.jpg' },
    'athleticheather_012017': { front: '/products/ATC1015-front-athleticheather_012017.jpg', back: '/products/ATC1015-back-athleticheather_012017.jpg' },
    'black_012017': { front: '/products/ATC1015-front-black_012017.jpg', back: '/products/ATC1015-back-black_012017.jpg' },
    'caramel': { front: '/products/ATC1015-front-caramel.jpg', back: '/products/ATC1015-back-caramel.jpg' },
    'caramel_cil': { front: '/products/ATC1015-front-caramel_cil.jpg', back: '/products/ATC1015-back-caramel_cil.jpg' },
    'dark_navy_052019': { front: '/products/ATC1015-front-dark_navy_052019.jpg', back: '/products/ATC1015-back-dark_navy_052019.jpg' },
    'darkgreen_022017': { front: '/products/ATC1015-front-darkgreen_022017.jpg', back: '/products/ATC1015-back-darkgreen_022017.jpg' },
    'darkheathergrey_012017': { front: '/products/ATC1015-front-darkheathergrey_012017.jpg', back: '/products/ATC1015-back-darkheathergrey_012017.jpg' },
    'fatiguegreen_092019': { front: '/products/ATC1015-front-fatiguegreen_092019.jpg', back: '/products/ATC1015-back-fatiguegreen_092019.jpg' },
    'heather_navy': { front: '/products/ATC1015-front-heather_navy.jpg', back: '/products/ATC1015-back-heather_navy.jpg' },
    'heather_navy_cil': { front: '/products/ATC1015-front-heather_navy_cil.jpg', back: '/products/ATC1015-back-heather_navy_cil.jpg' },
    'kelly_012017': { front: '/products/ATC1015-front-kelly_012017.jpg', back: '/products/ATC1015-back-kelly_012017.jpg' },
    'maroon_012017': { front: '/products/ATC1015-front-maroon_012017.jpg', back: '/products/ATC1015-back-maroon_012017.jpg' },
    'navy_012017': { front: '/products/ATC1015-front-navy_012017.jpg', back: '/products/ATC1015-back-navy_012017.jpg' },
    'orange_012017': { front: '/products/ATC1015-front-orange_012017.jpg', back: '/products/ATC1015-back-orange_012017.jpg' },
    'purple_012017': { front: '/products/ATC1015-front-purple_012017.jpg', back: '/products/ATC1015-back-purple_012017.jpg' },
    'red_012017': { front: '/products/ATC1015-front-red_012017.jpg', back: '/products/ATC1015-back-red_012017.jpg' },
    'royal_012017': { front: '/products/ATC1015-front-royal_012017.jpg', back: '/products/ATC1015-back-royal_012017.jpg' },
    'safety_gree': { front: '/products/ATC1015-front-safety_gree.jpg', back: '/products/ATC1015-back-safety_gree.jpg' },
    'safety_green_cil': { front: '/products/ATC1015-front-safety_green_cil.jpg', back: '/products/ATC1015-back-safety_green_cil.jpg' },
    'safety_orange_cil': { front: '/products/ATC1015-front-safety_orange_cil.jpg', back: '/products/ATC1015-back-safety_orange_cil.jpg' },
    'sangria_012017': { front: '/products/ATC1015-front-sangria_012017.jpg' },
    'sangria_v2_022017': { back: '/products/ATC1015-back-sangria_v2_022017.jpg' },
    'white_012017': { front: '/products/ATC1015-front-white_012017.jpg', back: '/products/ATC1015-back-white_012017.jpg' },
  },
  'ATC6245CM': {
    'black': { front: '/products/ATC6245CM-front-black.jpg', back: '/products/ATC6245CM-back-black.jpg' },
    'darkgrey': { front: '/products/ATC6245CM-front-darkgrey.jpg', back: '/products/ATC6245CM-back-darkgrey.jpg' },
    'khaki': { front: '/products/ATC6245CM-front-khaki.jpg' },
    'navy': { front: '/products/ATC6245CM-front-navy.jpg', back: '/products/ATC6245CM-back-navy.jpg' },
    'white': { front: '/products/ATC6245CM-front-white.jpg', back: '/products/ATC6245CM-back-white.jpg' },
  },
  'ATC6277': {
    'black_042014': { front: '/products/ATC6277-front-black_042014.jpg', back: '/products/ATC6277-back-black_042014.jpg' },
    'black_nosticker_042014': { front: '/products/ATC6277-front-black_nosticker_042014.jpg' },
    'darkgrey_042014': { front: '/products/ATC6277-front-darkgrey_042014.jpg', back: '/products/ATC6277-back-darkgrey_042014.jpg' },
    'darkgrey_nosticker_042014': { front: '/products/ATC6277-front-darkgrey_nosticker_042014.jpg' },
    'darknavy_042015': { front: '/products/ATC6277-front-darknavy_042015.jpg', back: '/products/ATC6277-back-darknavy_042015.jpg' },
    'darknavy_nosticker_042015': { front: '/products/ATC6277-front-darknavy_nosticker_042015.jpg' },
    'freshgreen_042014': { front: '/products/ATC6277-front-freshgreen_042014.jpg', back: '/products/ATC6277-back-freshgreen_042014.jpg' },
    'freshgreen_nosticker_042014': { front: '/products/ATC6277-front-freshgreen_nosticker_042014.jpg' },
    'gold_042014': { front: '/products/ATC6277-front-gold_042014.jpg', back: '/products/ATC6277-back-gold_042014.jpg' },
    'gold_nosticker_042014': { front: '/products/ATC6277-front-gold_nosticker_042014.jpg' },
    'grey_042018': { front: '/products/ATC6277-front-grey_042018.jpg', back: '/products/ATC6277-back-grey_042018.jpg' },
    'grey_nosticker_042018': { front: '/products/ATC6277-front-grey_nosticker_042018.jpg' },
    'khaki_042014': { front: '/products/ATC6277-front-khaki_042014.jpg', back: '/products/ATC6277-back-khaki_042014.jpg' },
    'khaki_nosticker_042014': { front: '/products/ATC6277-front-khaki_nosticker_042014.jpg' },
    'maroon_042015': { front: '/products/ATC6277-front-maroon_042015.jpg', back: '/products/ATC6277-back-maroon_042015.jpg' },
    'maroon_nosticker_042015': { front: '/products/ATC6277-front-maroon_nosticker_042015.jpg' },
    'navy_042014': { front: '/products/ATC6277-front-navy_042014.jpg', back: '/products/ATC6277-back-navy_042014.jpg' },
    'navy_nosticker_042014': { front: '/products/ATC6277-front-navy_nosticker_042014.jpg' },
    'purple_042014': { front: '/products/ATC6277-front-purple_042014.jpg', back: '/products/ATC6277-back-purple_042014.jpg' },
    'purple_nosticker_042014': { front: '/products/ATC6277-front-purple_nosticker_042014.jpg' },
    'red_042016': { front: '/products/ATC6277-front-red_042016.jpg', back: '/products/ATC6277-back-red_042016.jpg' },
    'red_nosticker_042016': { front: '/products/ATC6277-front-red_nosticker_042016.jpg' },
    'royal_042014': { back: '/products/ATC6277-back-royal_042014.jpg' },
    'royal_2014': { front: '/products/ATC6277-front-royal_2014.jpg' },
    'royal_nosticker_042014': { front: '/products/ATC6277-front-royal_nosticker_042014.jpg' },
    'silver_042015': { front: '/products/ATC6277-front-silver_042015.jpg', back: '/products/ATC6277-back-silver_042015.jpg' },
    'silver_nosticker_042015': { front: '/products/ATC6277-front-silver_nosticker_042015.jpg' },
    'spruce_042015': { front: '/products/ATC6277-front-spruce_042015.jpg', back: '/products/ATC6277-back-spruce_042015.jpg' },
    'spruce_nosticker_042015': { front: '/products/ATC6277-front-spruce_nosticker_042015.jpg' },
    'white_042014': { front: '/products/ATC6277-front-white_042014.jpg', back: '/products/ATC6277-back-white_042014.jpg' },
    'white_nosticker_042014': { front: '/products/ATC6277-front-white_nosticker_042014.jpg' },
  },
  'ATC6606': {
    'black_black': { back: '/products/ATC6606-back-black_black.jpg' },
    'black_black_cil': { front: '/products/ATC6606-front-black_black_cil.jpg', back: '/products/ATC6606-back-black_black_cil.jpg' },
    'black_white': { back: '/products/ATC6606-back-black_white.jpg' },
    'black_white_cil': { front: '/products/ATC6606-front-black_white_cil.jpg', back: '/products/ATC6606-back-black_white_cil.jpg' },
    'brown_khaki': { back: '/products/ATC6606-back-brown_khaki.jpg' },
    'brown_khaki_cil': { front: '/products/ATC6606-front-brown_khaki_cil.jpg', back: '/products/ATC6606-back-brown_khaki_cil.jpg' },
    'caramel_black_cil': { front: '/products/ATC6606-front-caramel_black_cil.jpg', back: '/products/ATC6606-back-caramel_black_cil.jpg' },
    'charcoal_black_cil': { front: '/products/ATC6606-front-charcoal_black_cil.jpg', back: '/products/ATC6606-back-charcoal_black_cil.jpg' },
    'charcoal_charcoal_cil': { front: '/products/ATC6606-front-charcoal_charcoal_cil.jpg', back: '/products/ATC6606-back-charcoal_charcoal_cil.jpg' },
    'charcoal_white_cil': { front: '/products/ATC6606-front-charcoal_white_cil.jpg', back: '/products/ATC6606-back-charcoal_white_cil.jpg' },
    'heather_white_cil': { front: '/products/ATC6606-front-heather_white_cil.jpg', back: '/products/ATC6606-back-heather_white_cil.jpg' },
    'multicam_black_black_cil': { front: '/products/ATC6606-front-multicam_black_black_cil.jpg', back: '/products/ATC6606-back-multicam_black_black_cil.jpg' },
    'multicam_black_cil': { back: '/products/ATC6606-back-multicam_black_cil.jpg' },
    'navy_navy_cil': { front: '/products/ATC6606-front-navy_navy_cil.jpg', back: '/products/ATC6606-back-navy_navy_cil.jpg' },
    'navy_silver_cil': { front: '/products/ATC6606-front-navy_silver_cil.jpg', back: '/products/ATC6606-back-navy_silver_cil.jpg' },
    'navy_white_cil': { front: '/products/ATC6606-front-navy_white_cil.jpg', back: '/products/ATC6606-back-navy_white_cil.jpg' },
    'realtree_edge_brown_cil': { front: '/products/ATC6606-front-realtree_edge_brown_cil.jpg', back: '/products/ATC6606-back-realtree_edge_brown_cil.jpg' },
    'red_white_cil': { front: '/products/ATC6606-front-red_white_cil.jpg', back: '/products/ATC6606-back-red_white_cil.jpg' },
    'royal_white_cil': { front: '/products/ATC6606-front-royal_white_cil.jpg', back: '/products/ATC6606-back-royal_white_cil.jpg' },
    'white_white_cil': { front: '/products/ATC6606-front-white_white_cil.jpg', back: '/products/ATC6606-back-white_white_cil.jpg' },
  },
  'ATCF2400': {
    'athleticheather_v2': { front: '/products/ATCF2400-front-athleticheather_v2.jpg', back: '/products/ATCF2400-back-athleticheather_v2.jpg' },
    'black_112017': { front: '/products/ATCF2400-front-black_112017.jpg', back: '/products/ATCF2400-back-black_112017.jpg' },
    'caramel': { front: '/products/ATCF2400-front-caramel.jpg', back: '/products/ATCF2400-back-caramel.jpg' },
    'caramel_cil': { front: '/products/ATCF2400-front-caramel_cil.jpg', back: '/products/ATCF2400-back-caramel_cil.jpg' },
    'dark_gree': { front: '/products/ATCF2400-front-dark_gree.jpg', back: '/products/ATCF2400-back-dark_gree.jpg' },
    'dark_green_cil': { front: '/products/ATCF2400-front-dark_green_cil.jpg', back: '/products/ATCF2400-back-dark_green_cil.jpg' },
    'dark_navy_052019': { front: '/products/ATCF2400-front-dark_navy_052019.jpg', back: '/products/ATCF2400-back-dark_navy_052019.jpg' },
    'darkheathergrey_v2': { front: '/products/ATCF2400-front-darkheathergrey_v2.jpg', back: '/products/ATCF2400-back-darkheathergrey_v2.jpg' },
    'maroo': { front: '/products/ATCF2400-front-maroo.jpg', back: '/products/ATCF2400-back-maroo.jpg' },
    'maroon_cil': { front: '/products/ATCF2400-front-maroon_cil.jpg', back: '/products/ATCF2400-back-maroon_cil.jpg' },
    'military_green_cil': { front: '/products/ATCF2400-front-military_green_cil.jpg', back: '/products/ATCF2400-back-military_green_cil.jpg' },
    'navy_112017': { front: '/products/ATCF2400-front-navy_112017.jpg', back: '/products/ATCF2400-back-navy_112017.jpg' },
    'oatmeal_heather_cil': { front: '/products/ATCF2400-front-oatmeal_heather_cil.jpg', back: '/products/ATCF2400-back-oatmeal_heather_cil.jpg' },
    'red_022020': { front: '/products/ATCF2400-front-red_022020.jpg', back: '/products/ATCF2400-back-red_022020.jpg' },
    'royal_022020': { front: '/products/ATCF2400-front-royal_022020.jpg', back: '/products/ATCF2400-back-royal_022020.jpg' },
    'sand_cil': { front: '/products/ATCF2400-front-sand_cil.jpg', back: '/products/ATCF2400-back-sand_cil.jpg' },
    'white_temp_2021': { front: '/products/ATCF2400-front-white_temp_2021.jpg', back: '/products/ATCF2400-back-white_temp_2021.jpg' },
  },
  'ATCF2500': {
    'ash_grey_cil': { front: '/products/ATCF2500-front-ash_grey_cil.jpg', back: '/products/ATCF2500-back-ash_grey_cil.jpg' },
    'athleticheather_012017': { front: '/products/ATCF2500-front-athleticheather_012017.jpg', back: '/products/ATCF2500-back-athleticheather_012017.jpg' },
    'black': { front: '/products/ATCF2500-front-black.jpg', back: '/products/ATCF2500-back-black.jpg' },
    'black_022017': { front: '/products/ATCF2500-front-black_022017.jpg', back: '/products/ATCF2500-back-black_022017.jpg' },
    'caramel': { front: '/products/ATCF2500-front-caramel.jpg', back: '/products/ATCF2500-back-caramel.jpg' },
    'caramel_cil': { front: '/products/ATCF2500-front-caramel_cil.jpg', back: '/products/ATCF2500-back-caramel_cil.jpg' },
    'dark_chocolate_brow': { front: '/products/ATCF2500-front-dark_chocolate_brow.jpg', back: '/products/ATCF2500-back-dark_chocolate_brow.jpg' },
    'dark_chocolate_brown_cil': { front: '/products/ATCF2500-front-dark_chocolate_brown_cil.jpg', back: '/products/ATCF2500-back-dark_chocolate_brown_cil.jpg' },
    'dark_navy_052019': { front: '/products/ATCF2500-front-dark_navy_052019.jpg', back: '/products/ATCF2500-back-dark_navy_052019.jpg' },
    'darkgreen_022017': { front: '/products/ATCF2500-front-darkgreen_022017.jpg', back: '/products/ATCF2500-back-darkgreen_022017.jpg' },
    'darkheathergrey_012017': { front: '/products/ATCF2500-front-darkheathergrey_012017.jpg', back: '/products/ATCF2500-back-darkheathergrey_012017.jpg' },
    'darkheathergrey_1': { front: '/products/ATCF2500-front-darkheathergrey_1.jpg' },
    'gold_022017': { front: '/products/ATCF2500-front-gold_022017.jpg', back: '/products/ATCF2500-back-gold_022017.jpg' },
    'heathernavy_112017': { front: '/products/ATCF2500-front-heathernavy_112017.jpg', back: '/products/ATCF2500-back-heathernavy_112017.jpg' },
    'heatherred_112017': { front: '/products/ATCF2500-front-heatherred_112017.jpg', back: '/products/ATCF2500-back-heatherred_112017.jpg' },
    'heatherroyal_112017': { front: '/products/ATCF2500-front-heatherroyal_112017.jpg', back: '/products/ATCF2500-back-heatherroyal_112017.jpg' },
    'kelly_022017': { front: '/products/ATCF2500-front-kelly_022017.jpg', back: '/products/ATCF2500-back-kelly_022017.jpg' },
    'light-blue': { front: '/products/ATCF2500-front-light-blue.jpg', back: '/products/ATCF2500-back-light-blue.jpg' },
    'light_blue_cil': { front: '/products/ATCF2500-front-light_blue_cil.jpg', back: '/products/ATCF2500-back-light_blue_cil.jpg' },
    'maroon_022017': { front: '/products/ATCF2500-front-maroon_022017.jpg', back: '/products/ATCF2500-back-maroon_022017.jpg' },
    'military_green_cil': { front: '/products/ATCF2500-front-military_green_cil.jpg', back: '/products/ATCF2500-back-military_green_cil.jpg' },
    'navy': { front: '/products/ATCF2500-front-navy.jpg', back: '/products/ATCF2500-back-navy.jpg' },
    'navy_022017': { front: '/products/ATCF2500-front-navy_022017.jpg', back: '/products/ATCF2500-back-navy_022017.jpg' },
    'oatmeal_heather_cil': { front: '/products/ATCF2500-front-oatmeal_heather_cil.jpg', back: '/products/ATCF2500-back-oatmeal_heather_cil.jpg' },
    'orange_022017': { front: '/products/ATCF2500-front-orange_022017.jpg', back: '/products/ATCF2500-back-orange_022017.jpg' },
    'purple_022017': { front: '/products/ATCF2500-front-purple_022017.jpg', back: '/products/ATCF2500-back-purple_022017.jpg' },
    'red_022017': { front: '/products/ATCF2500-front-red_022017.jpg', back: '/products/ATCF2500-back-red_022017.jpg' },
    'royal_022017': { front: '/products/ATCF2500-front-royal_022017.jpg', back: '/products/ATCF2500-back-royal_022017.jpg' },
    'sand_cil': { front: '/products/ATCF2500-front-sand_cil.jpg', back: '/products/ATCF2500-back-sand_cil.jpg' },
    'sangria_022017': { front: '/products/ATCF2500-front-sangria_022017.jpg', back: '/products/ATCF2500-back-sangria_022017.jpg' },
    'sapphire_022017': { front: '/products/ATCF2500-front-sapphire_022017.jpg', back: '/products/ATCF2500-back-sapphire_022017.jpg' },
    'white_022017': { front: '/products/ATCF2500-front-white_022017.jpg', back: '/products/ATCF2500-back-white_022017.jpg' },
  },
  'ATCF2600': {
    'athleticheather_012017': { front: '/products/ATCF2600-front-athleticheather_012017.jpg', back: '/products/ATCF2600-back-athleticheather_012017.jpg' },
    'black_022017': { front: '/products/ATCF2600-front-black_022017.jpg', back: '/products/ATCF2600-back-black_022017.jpg' },
    'caramel': { front: '/products/ATCF2600-front-caramel.jpg', back: '/products/ATCF2600-back-caramel.jpg' },
    'caramel_cil': { front: '/products/ATCF2600-front-caramel_cil.jpg', back: '/products/ATCF2600-back-caramel_cil.jpg' },
    'dark_navy_052019': { front: '/products/ATCF2600-front-dark_navy_052019.jpg', back: '/products/ATCF2600-back-dark_navy_052019.jpg' },
    'darkheathergrey_012017': { front: '/products/ATCF2600-front-darkheathergrey_012017.jpg', back: '/products/ATCF2600-back-darkheathergrey_012017.jpg' },
    'maroo': { front: '/products/ATCF2600-front-maroo.jpg', back: '/products/ATCF2600-back-maroo.jpg' },
    'maroon_cil': { front: '/products/ATCF2600-front-maroon_cil.jpg', back: '/products/ATCF2600-back-maroon_cil.jpg' },
    'military_gree': { front: '/products/ATCF2600-front-military_gree.jpg', back: '/products/ATCF2600-back-military_gree.jpg' },
    'military_green_cil': { front: '/products/ATCF2600-front-military_green_cil.jpg', back: '/products/ATCF2600-back-military_green_cil.jpg' },
    'navy_022017': { front: '/products/ATCF2600-front-navy_022017.jpg', back: '/products/ATCF2600-back-navy_022017.jpg' },
    'oatmeal_heather_cil': { front: '/products/ATCF2600-front-oatmeal_heather_cil.jpg', back: '/products/ATCF2600-back-oatmeal_heather_cil.jpg' },
    'orange_cil': { front: '/products/ATCF2600-front-orange_cil.jpg', back: '/products/ATCF2600-back-orange_cil.jpg' },
    'red_022017': { front: '/products/ATCF2600-front-red_022017.jpg', back: '/products/ATCF2600-back-red_022017.jpg' },
    'royal_022017': { front: '/products/ATCF2600-front-royal_022017.jpg', back: '/products/ATCF2600-back-royal_022017.jpg' },
    'sand_cil': { front: '/products/ATCF2600-front-sand_cil.jpg', back: '/products/ATCF2600-back-sand_cil.jpg' },
    'white_temp_2021': { front: '/products/ATCF2600-front-white_temp_2021.jpg', back: '/products/ATCF2600-back-white_temp_2021.jpg' },
  },
  'ATCY2500': {
    'athleticheather_012017': { front: '/products/ATCY2500-front-athleticheather_012017.jpg', back: '/products/ATCY2500-back-athleticheather_012017.jpg' },
    'black_022017': { front: '/products/ATCY2500-front-black_022017.jpg', back: '/products/ATCY2500-back-black_022017.jpg' },
    'caramel': { front: '/products/ATCY2500-front-caramel.jpg', back: '/products/ATCY2500-back-caramel.jpg' },
    'caramel_cil': { front: '/products/ATCY2500-front-caramel_cil.jpg', back: '/products/ATCY2500-back-caramel_cil.jpg' },
    'darkgreen_022017': { front: '/products/ATCY2500-front-darkgreen_022017.jpg', back: '/products/ATCY2500-back-darkgreen_022017.jpg' },
    'darkheathergrey_012017': { front: '/products/ATCY2500-front-darkheathergrey_012017.jpg', back: '/products/ATCY2500-back-darkheathergrey_012017.jpg' },
    'gold_022017': { front: '/products/ATCY2500-front-gold_022017.jpg', back: '/products/ATCY2500-back-gold_022017.jpg' },
    'kelly_022017': { front: '/products/ATCY2500-front-kelly_022017.jpg', back: '/products/ATCY2500-back-kelly_022017.jpg' },
    'maroon_022017': { front: '/products/ATCY2500-front-maroon_022017.jpg', back: '/products/ATCY2500-back-maroon_022017.jpg' },
    'military_gree': { front: '/products/ATCY2500-front-military_gree.jpg', back: '/products/ATCY2500-back-military_gree.jpg' },
    'military_green_cil': { front: '/products/ATCY2500-front-military_green_cil.jpg', back: '/products/ATCY2500-back-military_green_cil.jpg' },
    'navy_022017': { front: '/products/ATCY2500-front-navy_022017.jpg', back: '/products/ATCY2500-back-navy_022017.jpg' },
    'oatmeal-heather': { front: '/products/ATCY2500-front-oatmeal-heather.jpg', back: '/products/ATCY2500-back-oatmeal-heather.jpg' },
    'oatmeal_heather_cil': { front: '/products/ATCY2500-front-oatmeal_heather_cil.jpg', back: '/products/ATCY2500-back-oatmeal_heather_cil.jpg' },
    'orange_022017': { front: '/products/ATCY2500-front-orange_022017.jpg', back: '/products/ATCY2500-back-orange_022017.jpg' },
    'purple_022017': { front: '/products/ATCY2500-front-purple_022017.jpg', back: '/products/ATCY2500-back-purple_022017.jpg' },
    'red_022017': { front: '/products/ATCY2500-front-red_022017.jpg', back: '/products/ATCY2500-back-red_022017.jpg' },
    'royal_022017': { front: '/products/ATCY2500-front-royal_022017.jpg', back: '/products/ATCY2500-back-royal_022017.jpg' },
    'sand_cil': { front: '/products/ATCY2500-front-sand_cil.jpg', back: '/products/ATCY2500-back-sand_cil.jpg' },
    'sangria_022017': { front: '/products/ATCY2500-front-sangria_022017.jpg', back: '/products/ATCY2500-back-sangria_022017.jpg' },
    'sapphire_022017': { front: '/products/ATCY2500-front-sapphire_022017.jpg', back: '/products/ATCY2500-back-sapphire_022017.jpg' },
    'white_022017': { front: '/products/ATCY2500-front-white_022017.jpg', back: '/products/ATCY2500-back-white_022017.jpg' },
  },
  'C100': {
    'athletic_gold_cil': { front: '/products/C100-front-athletic_gold_cil.jpg' },
    'athletic_green_cil': { front: '/products/C100-front-athletic_green_cil.jpg' },
    'athletic_oxford_cil': { front: '/products/C100-front-athletic_oxford_cil.jpg' },
    'black': { front: '/products/C100-front-black.jpg' },
    'black_cil': { front: '/products/C100-front-black_cil.jpg' },
    'black_heather_cil': { front: '/products/C100-front-black_heather_cil.jpg' },
    'camo_cil': { front: '/products/C100-front-camo_cil.jpg' },
    'caramel_cil': { front: '/products/C100-front-caramel_cil.jpg' },
    'concrete_cil': { front: '/products/C100-front-concrete_cil.jpg' },
    'dark_chocolate_brown_cil': { front: '/products/C100-front-dark_chocolate_brown_cil.jpg' },
    'light_blue_cil': { front: '/products/C100-front-light_blue_cil.jpg' },
    'maroon_cil': { front: '/products/C100-front-maroon_cil.jpg' },
    'military_green_cil': { front: '/products/C100-front-military_green_cil.jpg' },
    'navy': { front: '/products/C100-front-navy.jpg' },
    'navy_cil': { front: '/products/C100-front-navy_cil.jpg' },
    'neon_blue_cil': { front: '/products/C100-front-neon_blue_cil.jpg' },
    'neon_lime_cil': { front: '/products/C100-front-neon_lime_cil.jpg' },
    'neon_pink_cil': { front: '/products/C100-front-neon_pink_cil.jpg' },
    'oatmeal_heather_cil': { front: '/products/C100-front-oatmeal_heather_cil.jpg' },
    'orange_cil': { front: '/products/C100-front-orange_cil.jpg' },
    'purple_cil': { front: '/products/C100-front-purple_cil.jpg' },
    'red_cil': { front: '/products/C100-front-red_cil.jpg' },
    'royal_cil': { front: '/products/C100-front-royal_cil.jpg' },
    'sand_cil': { front: '/products/C100-front-sand_cil.jpg' },
    'white': { front: '/products/C100-front-white.jpg' },
    'white_cil': { front: '/products/C100-front-white_cil.jpg' },
  },
  // C105 (tuque sans rebord) doesn't have per-colour photography of its own yet.
  // Reuse C100 beanie imagery for the core palette so the swatches render instead
  // of being filtered out entirely by hasRealColorImage().
  'C105': {
    'black':        { front: '/products/C100-front-black.jpg' },
    'navy':         { front: '/products/C100-front-navy.jpg' },
    'white':        { front: '/products/C100-front-white.jpg' },
    'red':          { front: '/products/C100-front-red_cil.jpg' },
    'maroon':       { front: '/products/C100-front-maroon_cil.jpg' },
    'royal':        { front: '/products/C100-front-royal_cil.jpg' },
    'forestgreen':  { front: '/products/C100-front-military_green_cil.jpg' },
    'gold':         { front: '/products/C100-front-athletic_gold_cil.jpg' },
    'steel_grey':   { front: '/products/C100-front-athletic_oxford_cil.jpg' },
  },
  'L350': {
    'black_102015': { front: '/products/L350-front-black_102015.jpg' },
    'black_2013': { back: '/products/L350-back-black_2013.jpg' },
    'carolinablue_102015': { front: '/products/L350-front-carolinablue_102015.jpg' },
    'carolinablue_2013': { back: '/products/L350-back-carolinablue_2013.jpg' },
    'coalgrey_102015': { front: '/products/L350-front-coalgrey_102015.jpg' },
    'coalgrey_2013': { back: '/products/L350-back-coalgrey_2013.jpg' },
    'deeporange_102015': { front: '/products/L350-front-deeporange_102015.jpg' },
    'deeporange_2013': { back: '/products/L350-back-deeporange_2013.jpg' },
    'extremeorange_webonly': { front: '/products/L350-front-extremeorange_webonly.jpg' },
    'extremeorangwebonly': { back: '/products/L350-back-extremeorangwebonly.jpg' },
    'extremepink_webonly': { front: '/products/L350-front-extremepink_webonly.jpg', back: '/products/L350-back-extremepink_webonly.jpg' },
    'extremeyellow_webonly': { front: '/products/L350-front-extremeyellow_webonly.jpg', back: '/products/L350-back-extremeyellow_webonly.jpg' },
    'forestgreen_102015': { front: '/products/L350-front-forestgreen_102015.jpg' },
    'forestgreen_2013': { back: '/products/L350-back-forestgreen_2013.jpg' },
    'gold_102014': { back: '/products/L350-back-gold_102014.jpg' },
    'gold_102015': { front: '/products/L350-front-gold_102015.jpg' },
    'kellygreen_102014': { back: '/products/L350-back-kellygreen_102014.jpg' },
    'kellygreen_102015': { front: '/products/L350-front-kellygreen_102015.jpg' },
    'lightpink_2013': { back: '/products/L350-back-lightpink_2013.jpg' },
    'limeshock_102015': { front: '/products/L350-front-limeshock_102015.jpg' },
    'limeshock_2013': { back: '/products/L350-back-limeshock_2013.jpg' },
    'maroon_102015': { front: '/products/L350-front-maroon_102015.jpg' },
    'maroon_2013': { back: '/products/L350-back-maroon_2013.jpg' },
    'purple_102015': { front: '/products/L350-front-purple_102015.jpg' },
    'purple_2013': { back: '/products/L350-back-purple_2013.jpg' },
    'truenavy_102015': { front: '/products/L350-front-truenavy_102015.jpg' },
    'truenavy_2013': { back: '/products/L350-back-truenavy_2013.jpg' },
    'truered_102015': { front: '/products/L350-front-truered_102015.jpg' },
    'truered_2014': { back: '/products/L350-back-truered_2014.jpg' },
    'trueroyal_102015': { front: '/products/L350-front-trueroyal_102015.jpg' },
    'trueroyal_2013': { back: '/products/L350-back-trueroyal_2013.jpg' },
    'white_102015': { front: '/products/L350-front-white_102015.jpg' },
    'white_2013': { back: '/products/L350-back-white_2013.jpg' },
    'wildraspberry_102015': { front: '/products/L350-front-wildraspberry_102015.jpg' },
    'wildraspberry_2013': { back: '/products/L350-back-wildraspberry_2013.jpg' },
  },
  'L445': {
    'black_082015': { front: '/products/L445-front-black_082015.jpg' },
    'black_2010': { back: '/products/L445-back-black_2010.jpg' },
    'bluelake_082015': { front: '/products/L445-front-bluelake_082015.jpg' },
    'bluelake_2010': { back: '/products/L445-back-bluelake_2010.jpg' },
    'gold_021612': { back: '/products/L445-back-gold_021612.jpg' },
    'gold_082015': { front: '/products/L445-front-gold_082015.jpg' },
    'greenoasis_032014': { back: '/products/L445-back-greenoasis_032014.jpg' },
    'greenoasis_082015': { front: '/products/L445-front-greenoasis_082015.jpg' },
    'greyconcrete_092015': { front: '/products/L445-front-greyconcrete_092015.jpg', back: '/products/L445-back-greyconcrete_092015.jpg' },
    'irongrey_082015': { front: '/products/L445-front-irongrey_082015.jpg' },
    'irongrey_2010': { back: '/products/L445-back-irongrey_2010.jpg' },
    'kellygreen_021612': { back: '/products/L445-back-kellygreen_021612.jpg' },
    'kellygreen_082015': { front: '/products/L445-front-kellygreen_082015.jpg' },
    'orange_032014': { back: '/products/L445-back-orange_032014.jpg' },
    'orange_082015': { front: '/products/L445-front-orange_082015.jpg' },
    'pinkraspberry_021612': { back: '/products/L445-back-pinkraspberry_021612.jpg' },
    'purple_021612': { back: '/products/L445-back-purple_021612.jpg' },
    'purple_082015': { front: '/products/L445-front-purple_082015.jpg' },
    'safetygreen_021612': { back: '/products/L445-back-safetygreen_021612.jpg' },
    'safetygreen_webonly': { front: '/products/L445-front-safetygreen_webonly.jpg' },
    'safetyorange_021612': { back: '/products/L445-back-safetyorange_021612.jpg' },
    'safetyorange_webonly': { front: '/products/L445-front-safetyorange_webonly.jpg' },
    'tropicblue_021612': { back: '/products/L445-back-tropicblue_021612.jpg' },
    'tropicblue_082015': { front: '/products/L445-front-tropicblue_082015.jpg' },
    'truenavy_082015': { front: '/products/L445-front-truenavy_082015.jpg' },
    'truenavy_2010': { back: '/products/L445-back-truenavy_2010.jpg' },
    'truered_082015': { front: '/products/L445-front-truered_082015.jpg' },
    'trueroyal_021612': { back: '/products/L445-back-trueroyal_021612.jpg' },
    'trueroyal_082015': { front: '/products/L445-front-trueroyal_082015.jpg' },
    'white_082015': { front: '/products/L445-front-white_082015.jpg' },
    'white_2010': { back: '/products/L445-back-white_2010.jpg' },
  },
  'S350': {
    'atomicblue_122019': { front: '/products/S350-front-atomicblue_122019.jpg' },
    'black_012015': { front: '/products/S350-front-black_012015.jpg' },
    'black_2024': { back: '/products/S350-back-black_2024.jpg' },
    'carolinablue_012015': { front: '/products/S350-front-carolinablue_012015.jpg' },
    'carolineblue_2024': { back: '/products/S350-back-carolineblue_2024.jpg' },
    'coal_grey_2024': { back: '/products/S350-back-coal_grey_2024.jpg' },
    'coalgrey_012015': { front: '/products/S350-front-coalgrey_012015.jpg' },
    'deep_orange_2024': { back: '/products/S350-back-deep_orange_2024.jpg' },
    'deeporange_012015': { front: '/products/S350-front-deeporange_012015.jpg' },
    'extreme_orange_2024': { back: '/products/S350-back-extreme_orange_2024.jpg' },
    'extreme_pink_2024': { back: '/products/S350-back-extreme_pink_2024.jpg' },
    'extreme_yellow_2024': { back: '/products/S350-back-extreme_yellow_2024.jpg' },
    'extremeorange_webonly': { front: '/products/S350-front-extremeorange_webonly.jpg' },
    'extremepink_webonly': { front: '/products/S350-front-extremepink_webonly.jpg' },
    'extremeyellow_webonly': { front: '/products/S350-front-extremeyellow_webonly.jpg' },
    'foredtgreen_012015': { front: '/products/S350-front-foredtgreen_012015.jpg' },
    'forest_2024': { back: '/products/S350-back-forest_2024.jpg' },
    'gold_012015': { front: '/products/S350-front-gold_012015.jpg' },
    'gold_2024': { back: '/products/S350-back-gold_2024.jpg' },
    'kelly_green_2024': { back: '/products/S350-back-kelly_green_2024.jpg' },
    'kellygreen_012015': { front: '/products/S350-front-kellygreen_012015.jpg' },
    'lime_shock_2024': { back: '/products/S350-back-lime_shock_2024.jpg' },
    'limeshock_012015': { front: '/products/S350-front-limeshock_012015.jpg' },
    'maroon_012015': { front: '/products/S350-front-maroon_012015.jpg' },
    'maroon_2024': { back: '/products/S350-back-maroon_2024.jpg' },
    'purple_012015': { front: '/products/S350-front-purple_012015.jpg' },
    'purple_2024': { back: '/products/S350-back-purple_2024.jpg' },
    'silver_022016': { front: '/products/S350-front-silver_022016.jpg' },
    'silver_2024': { back: '/products/S350-back-silver_2024.jpg' },
    'true_navy_2024': { back: '/products/S350-back-true_navy_2024.jpg' },
    'true_red_2024': { back: '/products/S350-back-true_red_2024.jpg' },
    'true_royal_2024': { back: '/products/S350-back-true_royal_2024.jpg' },
    'truenavy_012015': { front: '/products/S350-front-truenavy_012015.jpg' },
    'truered_012015': { front: '/products/S350-front-truered_012015.jpg' },
    'trueroyal_012015': { front: '/products/S350-front-trueroyal_012015.jpg' },
    'white_012015': { front: '/products/S350-front-white_012015.jpg' },
    'white_2024': { back: '/products/S350-back-white_2024.jpg' },
    'wild_raspberry_2024': { back: '/products/S350-back-wild_raspberry_2024.jpg' },
    'wildraspberry_012015': { front: '/products/S350-front-wildraspberry_012015.jpg' },
  },
  'S445': {
    'black_082015': { front: '/products/S445-front-black_082015.jpg' },
    'black_2010': { back: '/products/S445-back-black_2010.jpg' },
    'bluelake_021612': { back: '/products/S445-back-bluelake_021612.jpg' },
    'bluelake_082015': { front: '/products/S445-front-bluelake_082015.jpg' },
    'gold_021612': { back: '/products/S445-back-gold_021612.jpg' },
    'gold_082015': { front: '/products/S445-front-gold_082015.jpg' },
    'greenoasis_032014': { back: '/products/S445-back-greenoasis_032014.jpg' },
    'greenoasis_082015': { front: '/products/S445-front-greenoasis_082015.jpg' },
    'greyconcrete_092015': { front: '/products/S445-front-greyconcrete_092015.jpg', back: '/products/S445-back-greyconcrete_092015.jpg' },
    'irongrey_082015': { front: '/products/S445-front-irongrey_082015.jpg' },
    'irongrey_2010': { back: '/products/S445-back-irongrey_2010.jpg' },
    'kellygreen_021612': { back: '/products/S445-back-kellygreen_021612.jpg' },
    'kellygreen_082015': { front: '/products/S445-front-kellygreen_082015.jpg' },
    'orange_082015': { front: '/products/S445-front-orange_082015.jpg' },
    'purple_021612': { back: '/products/S445-back-purple_021612.jpg' },
    'purple_082015': { front: '/products/S445-front-purple_082015.jpg' },
    'safetygreen_webonly': { front: '/products/S445-front-safetygreen_webonly.jpg', back: '/products/S445-back-safetygreen_webonly.jpg' },
    'safetyorange_021612': { back: '/products/S445-back-safetyorange_021612.jpg' },
    'safetyorange_webonly': { front: '/products/S445-front-safetyorange_webonly.jpg', back: '/products/S445-back-safetyorange_webonly.jpg' },
    'tropicblue_021612': { back: '/products/S445-back-tropicblue_021612.jpg' },
    'tropicblue_082015': { front: '/products/S445-front-tropicblue_082015.jpg' },
    'truenavy_021612': { back: '/products/S445-back-truenavy_021612.jpg' },
    'truenavy_082015': { front: '/products/S445-front-truenavy_082015.jpg' },
    'truered_021612': { back: '/products/S445-back-truered_021612.jpg' },
    'truered_082015': { front: '/products/S445-front-truered_082015.jpg' },
    'trueroyal_021612': { back: '/products/S445-back-trueroyal_021612.jpg' },
    'trueroyal_082015': { front: '/products/S445-front-trueroyal_082015.jpg' },
    'white_021612': { back: '/products/S445-back-white_021612.jpg' },
    'white_082015': { front: '/products/S445-front-white_082015.jpg' },
  },
  'S445LS': {
    'black': { front: '/products/S445LS-front-black.jpg' },
    'black_1': { front: '/products/S445LS-front-black_1.jpg' },
    'black_2013': { back: '/products/S445LS-back-black_2013.jpg' },
    'irongrey_082015': { front: '/products/S445LS-front-irongrey_082015.jpg' },
    'irongrey_2013': { back: '/products/S445LS-back-irongrey_2013.jpg' },
    'truenavy_082015': { front: '/products/S445LS-front-truenavy_082015.jpg' },
    'truenavy_2013': { back: '/products/S445LS-back-truenavy_2013.jpg' },
    'truered_032014': { back: '/products/S445LS-back-truered_032014.jpg' },
    'truered_082015': { front: '/products/S445LS-front-truered_082015.jpg' },
    'trueroyal_032014': { back: '/products/S445LS-back-trueroyal_032014.jpg' },
    'trueroyal_082015': { front: '/products/S445LS-front-trueroyal_082015.jpg' },
    'white_2013': { front: '/products/S445LS-front-white_2013.jpg', back: '/products/S445LS-back-white_2013.jpg' },
  },
  'WERK250': {
    'athletic-grey': { front: '/products/WERK250-front-athletic-grey.jpg', back: '/products/WERK250-back-athletic-grey.jpg' },
    'athletic_grey_cil': { front: '/products/WERK250-front-athletic_grey_cil.jpg', back: '/products/WERK250-back-athletic_grey_cil.jpg' },
    'black': { front: '/products/WERK250-front-black.jpg', back: '/products/WERK250-back-black.jpg' },
    'black_cil': { front: '/products/WERK250-front-black_cil.jpg', back: '/products/WERK250-back-black_cil.jpg' },
    'caramel_cil': { front: '/products/WERK250-front-caramel_cil.jpg', back: '/products/WERK250-back-caramel_cil.jpg' },
    'dark_navy_cil': { front: '/products/WERK250-front-dark_navy_cil.jpg', back: '/products/WERK250-back-dark_navy_cil.jpg' },
    'safety_orange_cil': { front: '/products/WERK250-front-safety_orange_cil.jpg', back: '/products/WERK250-back-safety_orange_cil.jpg' },
    'safety_yellow_cil': { front: '/products/WERK250-front-safety_yellow_cil.jpg', back: '/products/WERK250-back-safety_yellow_cil.jpg' },
    'sand_cil': { front: '/products/WERK250-front-sand_cil.jpg', back: '/products/WERK250-back-sand_cil.jpg' },
    'white': { front: '/products/WERK250-front-white.jpg', back: '/products/WERK250-back-white.jpg' },
    'white_cil': { front: '/products/WERK250-front-white_cil.jpg', back: '/products/WERK250-back-white_cil.jpg' },
  },
  'Y350': {
    'atomicblue_122019': { front: '/products/Y350-front-atomicblue_122019.jpg', back: '/products/Y350-back-atomicblue_122019.jpg' },
    'black_082015': { front: '/products/Y350-front-black_082015.jpg' },
    'black_2013': { back: '/products/Y350-back-black_2013.jpg' },
    'carolinablue_082015': { front: '/products/Y350-front-carolinablue_082015.jpg' },
    'carolinablue_2013': { back: '/products/Y350-back-carolinablue_2013.jpg' },
    'coalgrey_082015': { front: '/products/Y350-front-coalgrey_082015.jpg' },
    'coalgrey_2013': { back: '/products/Y350-back-coalgrey_2013.jpg' },
    'deeporange_082015': { front: '/products/Y350-front-deeporange_082015.jpg' },
    'deeporange_2013': { back: '/products/Y350-back-deeporange_2013.jpg' },
    'extremeorange_webonly': { front: '/products/Y350-front-extremeorange_webonly.jpg' },
    'extremeorangwebonly': { back: '/products/Y350-back-extremeorangwebonly.jpg' },
    'extremepink_webonly': { front: '/products/Y350-front-extremepink_webonly.jpg', back: '/products/Y350-back-extremepink_webonly.jpg' },
    'extremeyellow_webonly': { front: '/products/Y350-front-extremeyellow_webonly.jpg', back: '/products/Y350-back-extremeyellow_webonly.jpg' },
    'forestgreen_082015': { front: '/products/Y350-front-forestgreen_082015.jpg' },
    'forestgreen_2013': { back: '/products/Y350-back-forestgreen_2013.jpg' },
    'gold_082015': { front: '/products/Y350-front-gold_082015.jpg' },
    'gold_102014': { back: '/products/Y350-back-gold_102014.jpg' },
    'kellygreen_082015': { front: '/products/Y350-front-kellygreen_082015.jpg' },
    'kellygreen_102014': { back: '/products/Y350-back-kellygreen_102014.jpg' },
    'lightpink_2013': { back: '/products/Y350-back-lightpink_2013.jpg' },
    'limeshock_082015': { front: '/products/Y350-front-limeshock_082015.jpg' },
    'limeshock_2013': { back: '/products/Y350-back-limeshock_2013.jpg' },
    'maroon_082015': { front: '/products/Y350-front-maroon_082015.jpg' },
    'maroon_2013': { back: '/products/Y350-back-maroon_2013.jpg' },
    'purple_082015': { front: '/products/Y350-front-purple_082015.jpg' },
    'purple_2013': { back: '/products/Y350-back-purple_2013.jpg' },
    'silver_1': { front: '/products/Y350-front-silver_1.jpg', back: '/products/Y350-back-silver_1.jpg' },
    'truenavy_082015': { front: '/products/Y350-front-truenavy_082015.jpg' },
    'truenavy_2013': { back: '/products/Y350-back-truenavy_2013.jpg' },
    'truered_082015': { front: '/products/Y350-front-truered_082015.jpg' },
    'truered_2014': { back: '/products/Y350-back-truered_2014.jpg' },
    'trueroyal_082015': { front: '/products/Y350-front-trueroyal_082015.jpg' },
    'trueroyal_2013': { back: '/products/Y350-back-trueroyal_2013.jpg' },
    'white_082015': { front: '/products/Y350-front-white_082015.jpg' },
    'white_2013': { back: '/products/Y350-back-white_2013.jpg' },
    'wildraspberry_082015': { front: '/products/Y350-front-wildraspberry_082015.jpg' },
    'wildraspberry_2013': { back: '/products/Y350-back-wildraspberry_2013.jpg' },
  },
};

/**
 * Alternate slugs to try when the primary slug doesn't match anything in
 * COLOR_IMAGES[sku]. The image filenames are inconsistent — some use
 * `forest_green`, others `forestgreen`, others `darkgreen`. This table lets
 * us cast a wider net without compromising the word-boundary guards.
 *
 * Order matters: earlier entries win over later ones. Keys are primary slugs
 * (post-translation, post-slugify).
 */
const COLOR_ALT_SLUGS: Record<string, readonly string[]> = {
  // Green family — "Vert forêt" (#14532D) maps to many filename variants:
  // forestgreen_* (S350/L350/Y350/ATC1000), darkgreen_* (ATC1000/ATC1015/
  // ATCF2500/ATCY2500), dark_green_cil (ATCF2400), dark_gree (truncated on
  // ATCF2400/ATCF2600), greenoasis_* (S445/L445), freshgreen (ATC6277),
  // spruce (ATC6277). We list all of them so any SKU with *a* dark-green
  // image wins. Compound (underscore) and concat variants are both tried.
  // `military_green` is kept last as a deep fallback for bodies (C100 beanie,
  // caps) that only ship with a military/olive green and no true forest.
  forest_green: ['forestgreen', 'darkgreen', 'dark_green', 'dark_gree', 'forest', 'spruce', 'greenoasis', 'green_oasis', 'freshgreen', 'fresh_green', 'military_green', 'militarygreen'],
  forestgreen:  ['forestgreen', 'darkgreen', 'dark_green', 'dark_gree', 'forest', 'spruce', 'greenoasis', 'green_oasis', 'freshgreen', 'fresh_green', 'military_green', 'militarygreen'],
  darkgreen:    ['darkgreen', 'forestgreen', 'forest', 'dark_green', 'dark_gree'],
  // Grey family — order matters: closest visual match first. "Steel Grey"
  // (Gris acier, #6E7278) has no direct image in any SKU, so we fall back to
  // iron/coal/darkgrey variants, and finally to darkheathergrey which is
  // visually the closest remaining option on most SKUs. `concrete` covers
  // the C100 beanie's concrete_cil swatch (a warm mid-grey).
  steel_grey:   ['irongrey', 'coalgrey', 'darkgrey', 'iron_grey', 'coal_grey', 'dark_grey', 'graphite_heather', 'grey', 'darkheathergrey', 'concrete'],
  steelgrey:    ['irongrey', 'coalgrey', 'darkgrey', 'iron_grey', 'coal_grey', 'dark_grey', 'graphite_heather', 'grey', 'darkheathergrey', 'concrete'],
  grey:         ['irongrey', 'coalgrey', 'darkgrey', 'grey', 'graphite_heather', 'mediumgrey', 'darkheathergrey', 'concrete'],
  // Royal / navy family
  true_red:     ['truered', 'red'],
  truered:      ['truered', 'red'],
  true_royal:   ['trueroyal', 'royal'],
  trueroyal:    ['trueroyal', 'royal'],
  royal:        ['trueroyal', 'royal'],
  navy:         ['truenavy', 'dark_navy', 'darknavy', 'navy'],
  light_blue:   ['lightblue', 'light_blue'],
  lightblue:    ['lightblue', 'light_blue'],
  red:          ['truered', 'red'],
  // Heather family
  black_heather:['black_heather', 'heather'],
  athleticheather: ['athletic_heather', 'athleticheather', 'athletic_grey', 'athleticheather'],
  // Military / lime
  military_green: ['military_green', 'fatiguegreen', 'fatigue_green'],
  militarygreen:  ['military_green', 'fatiguegreen', 'fatigue_green'],
  lime_shock:   ['limeshock', 'lime_shock', 'lime'],
  limeshock:    ['limeshock', 'lime_shock', 'lime'],
  lime:         ['limeshock', 'lime_shock', 'lime'],
  // Other
  cardinal:     ['cardinal', 'maroon', 'sangria'],
  natural:      ['natural', 'sand', 'oatmeal_heather', 'oatmealheather'],
  charcoal:     ['charcoal', 'coalgrey', 'coal_grey', 'darkgrey', 'dark_grey', 'darkheathergrey', 'greyconcrete', 'irongrey'],
  maroon:       ['maroon', 'burgundy'],
  kelly:        ['kellygreen', 'kelly_green', 'kelly'],
  black:        ['black'],
  white:        ['white'],
  black_white:  ['black_white'],
  navy_white:   ['navy_white'],
};

// French→English colour name translation for matching Shopify names to Drive filenames.
// Keys are lowercase French names; values must align with the prefixes used in
// COLOR_IMAGES keys (see `src/data/products.ts` COLOR_IMAGES). Keep accents —
// they're preserved through toLowerCase() and stripped from keys only after
// translation fails.
const FR_EN_COLORS: Record<string, string> = {
  // Primaries
  'noir': 'black', 'blanc': 'white', 'marine': 'navy', 'rouge': 'red',
  'bleu royal': 'royal', 'royal franc': 'royal', 'vert foncé': 'darkgreen',
  'vert forêt': 'forestgreen', 'bourgogne': 'maroon', 'bordeaux': 'maroon',
  'mauve': 'purple', 'or': 'gold', 'gris acier': 'steel_grey',
  'gris foncé chiné': 'darkheathergrey', 'gris pâle chiné': 'athleticheather',
  'gris chiné': 'athleticheather', 'gris sportif chiné': 'athleticheather',
  'gris cendré': 'ash_grey', 'gris': 'grey',
  'charbon': 'charcoal', 'sable': 'sand', 'caramel': 'caramel',
  'orange': 'orange', 'jaune': 'yellow', 'lime': 'lime', 'vert lime': 'lime_shock',
  'saphir': 'sapphire', 'sangria': 'sangria', 'kelly': 'kelly',
  'vert kelly': 'kellygreen',
  'marine foncé': 'dark_navy', 'marine chiné': 'heather_navy',
  'royal chiné': 'heather_royal', 'rouge chiné': 'heather_red',
  'vert militaire': 'military_green', 'bleu aquatique': 'aquatic_blue',
  'rose bonbon': 'candy_pink', 'vert laurel': 'laurel_green',
  'bleu pâle': 'light_blue', 'avoine chiné': 'oatmeal_heather',
  'brun chocolat foncé': 'dark_chocolate_brown', 'gris cendré athlétique': 'ash_grey',
  'chiné athlétique': 'athleticheather', 'vert sécurité': 'safety_green',
  'orange sécurité': 'safety_orange', 'argent': 'silver',
  'kaki': 'khaki', 'naturel': 'natural', 'lavande': 'lavender',
  // Heather / chiné variants missing from earlier table
  'noir chiné': 'black_heather',
  'rouge vif': 'true_red', 'vrai rouge': 'true_red',
  'vrai bleu royal': 'true_royal',
  'cardinal': 'cardinal',
  // Two-tone trucker caps
  'noir/blanc': 'black_white', 'noir/noir': 'black_black',
  'marine/blanc': 'navy_white', 'marine/marine': 'navy_navy',
  'marine/argent': 'navy_silver', 'charbon/blanc': 'charcoal_white',
  'charbon/charbon': 'charcoal_charcoal', 'charbon/noir': 'charcoal_black',
  'caramel/noir': 'caramel_black', 'rouge/blanc': 'red_white',
  'royal/blanc': 'royal_white', 'blanc/blanc': 'white_white',
  'brun/kaki': 'brown_khaki',
};

/**
 * Some products use a SKU that doesn't line up with the filename prefix used
 * in `public/products/`, or they don't have their own image set and should
 * inherit from a sibling SKU (youth → adult). These are tried in addition to
 * the automatic trailing-letter fallback (e.g. ATC1000Y → ATC1000).
 *
 * The value may be a single SKU (string) or an ordered list (array) of SKUs
 * to try as successive fallbacks. Array form is used when one parent covers
 * most of the palette and a second one fills the last remaining gaps — e.g.
 * 6245CM: [ATC6245CM for its own 5 colours, ATC6606 for the red/royal the
 * supplier hasn't photographed on the 6245CM body yet].
 */
const SKU_ALIASES: Record<string, string | readonly string[]> = {
  // Catalog uses "6245CM" but image files live under "ATC6245CM-*".
  // ATC6606 is a close-silhouette trucker cap that covers the few palette
  // colours (red, true-royal) the supplier hasn't photographed on 6245CM.
  '6245CM': ['ATC6245CM', 'ATC6606'],
  // Youth tee shares garment silhouette with adult ATC1000
  'ATC1000Y': 'ATC1000',
  // Pocket tee variant reuses the ATC1000 photoset for colours (gold, etc.)
  // the supplier hasn't re-shot on the ATC1015 body.
  'ATC1015': 'ATC1000',
  // Safety/work tee — supplier ships with hi-vis-only imagery. Reuse ATC1000
  // for the core palette (red, royal, forest-green) so swatches don't vanish.
  'WERK250': 'ATC1000',
  // Fleece sweatshirt sibling — forest-green only exists on the ATCF2500 body.
  'ATCF2600': 'ATCF2500',
  // Long-sleeve polo inherits from the ladies polo (L445) which has the
  // greenoasis dark-green the short-sleeve S445 and S445LS both lack.
  'S445LS': ['S445', 'L445'],
  // Trucker cap pair: ATC6277 and ATC6606 each photograph a disjoint subset
  // of the two-tone palette. Alias both directions so every swatch renders.
  'ATC6277': 'ATC6606',
  'ATC6606': 'ATC6277',
};

/**
 * Resolve a SKU to the list of COLOR_IMAGES keys to try, in priority order.
 * Example: "ATC1000Y" → ["ATC1000Y", "ATC1000"] (explicit alias + trailing-letter strip).
 */
function resolveColorImageSkus(sku: string): string[] {
  const candidates = [sku];
  const aliased = SKU_ALIASES[sku];
  if (aliased) {
    const aliases = Array.isArray(aliased) ? aliased : [aliased];
    for (const a of aliases) {
      if (a && !candidates.includes(a)) candidates.push(a);
    }
  }
  // Trailing single-letter size/age variant (Y=youth, L=ladies) → try base SKU
  const trimmed = sku.replace(/[A-Z]$/, '');
  if (trimmed !== sku && trimmed.length >= 3 && !candidates.includes(trimmed)) {
    candidates.push(trimmed);
  }
  return candidates;
}

/**
 * Minimum slug length for fuzzy (prefix / whole-word / first-word) match.
 *
 * We want to allow "red" (3) and "gold" (4) but NOT "or" (2) — "or" is the
 * French word for "gold" and if it were accepted as a prefix it would match
 * "orange_012017". 3 is the sweet spot.
 */
const MIN_FUZZY_LEN = 3;

/** Prefer entries that have a `front` image — hasRealColorImage() treats a
 *  front as the signal that a colour swatch is "real". */
function hasFront(entry: { front?: string; back?: string } | undefined): boolean {
  return !!entry?.front;
}

/**
 * Find the best per-colour image for a product + colour name.
 *
 * Accepts French or English names (e.g. "Rouge", "Red", "Or", "Gold").
 * Returns `null` when no image can be confidently matched — callers MUST
 * handle this (the customizer falls back to the default tinted product image).
 * See `colorFilter.ts` and `ProductCustomizer.tsx` for null-handling call-sites.
 *
 * Matching runs in four tiers, from strict to fuzzy. Each tier respects
 * word boundaries so short tokens like "or" never bleed into "orange":
 *   1. Exact slug match against COLOR_IMAGES[sku]
 *   2. Slug-prefix match (key = slug OR key startsWith slug + "_"), with
 *      front-image preference and back-sibling merge
 *   3. Whole-word `_`-token match (compound keys like "military_green")
 *   4. Translated first-word fallback (single-word English names only —
 *      e.g. "Rouge" → "red" → first image whose first token is "red"). We
 *      deliberately skip this tier for compound translations (e.g.
 *      "Noir chiné" → "black_heather") so an unknown compound doesn't
 *      silently collapse to its first word.
 */
export function findColorImage(sku: string, colorName: string): { front?: string; back?: string } | null {
  if (!sku || !colorName) return null;
  // Try the SKU itself first, then aliases / trimmed-letter fallbacks.
  for (const candidateSku of resolveColorImageSkus(sku)) {
    const hit = findColorImageInMap(candidateSku, colorName);
    if (hit) return hit;
  }
  return null;
}

/** Internal: lookup within a single SKU's COLOR_IMAGES map. */
function findColorImageInMap(sku: string, colorName: string): { front?: string; back?: string } | null {
  const skuMap = COLOR_IMAGES[sku];
  if (!skuMap) return null;

  const raw = colorName.toLowerCase().trim();
  if (!raw) return null;

  // French→English translation (keys preserve diacritics, e.g. "vert forêt")
  const enName = FR_EN_COLORS[raw] ?? raw;

  // Slugify: strip diacritics, collapse spaces/dashes/slashes to `_`, keep [a-z0-9_]
  const slugify = (s: string): string =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[\s\-/]+/g, '_')
      .replace(/[^a-z0-9_]/g, '');

  const enKey = slugify(enName);
  const rawKey = slugify(raw);
  const baseKeys = [enKey, rawKey];

  // Expand with alternate slugs so e.g. "steel_grey" also searches for
  // "irongrey" / "coalgrey" / "darkgrey". Look up both the underscore
  // ("forest_green") and concatenated ("forestgreen") forms so the table
  // can use whichever spelling is most natural.
  const concat = (s: string): string => s.replace(/_/g, '');
  const expanded: string[] = [];
  for (const k of baseKeys) {
    if (!k) continue;
    expanded.push(k);
    expanded.push(concat(k));
    for (const lookup of [k, concat(k)]) {
      const alts = COLOR_ALT_SLUGS[lookup];
      if (alts) for (const a of alts) {
        const s = slugify(a);
        if (s) { expanded.push(s); expanded.push(concat(s)); }
      }
    }
  }
  const keys = Array.from(new Set(expanded)).filter(Boolean);
  if (keys.length === 0) return null;

  const mapKeys = Object.keys(skuMap);
  const tokensOf = (k: string): string[] => k.split('_').filter(Boolean);

  // 1. Exact match on any key
  for (const key of keys) {
    if (skuMap[key]) return skuMap[key];
  }

  // 2. Prefix match: `key` equals the entry key, or is followed by `_`.
  //    This prevents "or" (< MIN_FUZZY_LEN) from matching "orange_012017".
  //    When multiple keys match (e.g. back-only `gold_021612` vs front
  //    `gold_082015`), prefer the front-bearing entry and merge in a
  //    back-only sibling when possible so both views render.
  for (const key of keys) {
    if (key.length < MIN_FUZZY_LEN) continue;
    let frontHit: { front?: string; back?: string } | null = null;
    let anyHit: { front?: string; back?: string } | null = null;
    for (const k of mapKeys) {
      if (/^\d+$/.test(k)) continue;  // skip date-only keys
      if (k === key || k.startsWith(key + '_')) {
        const entry = skuMap[k];
        if (!anyHit) anyHit = entry;
        if (hasFront(entry)) { frontHit = entry; break; }
      }
    }
    if (frontHit) {
      if (!frontHit.back) {
        for (const k of mapKeys) {
          if (/^\d+$/.test(k)) continue;
          const entry = skuMap[k];
          if (!entry.back || entry === frontHit) continue;
          if (k === key || k.startsWith(key + '_')) {
            return { front: frontHit.front, back: entry.back };
          }
        }
      }
      return frontHit;
    }
    if (anyHit) return anyHit;
  }

  // 3. Whole-word / compound match on `_`-delimited tokens.
  for (const key of keys) {
    if (key.length < MIN_FUZZY_LEN) continue;
    for (const k of mapKeys) {
      if (/^\d+$/.test(k)) continue;
      const toks = tokensOf(k);
      if (toks.includes(key)) return skuMap[k];
      // Compound keys: "military_green" must appear as a contiguous sub-string
      if (key.includes('_') && k.includes(key)) return skuMap[k];
    }
  }

  // 4. First-word fallback — ONLY for single-word English translations.
  //    Catches cases where the exact slug doesn't exist but the image
  //    filename is datecoded (e.g. "red" → "red_022017"). Compound names
  //    ("black_heather") are NOT eligible — if the compound isn't in the
  //    map we return null rather than collapsing to its first word.
  if (enKey && !enKey.includes('_') && enKey.length >= MIN_FUZZY_LEN) {
    let frontHit: { front?: string; back?: string } | null = null;
    let anyHit: { front?: string; back?: string } | null = null;
    for (const k of mapKeys) {
      if (/^\d+$/.test(k)) continue;
      if (tokensOf(k)[0] === enKey) {
        const entry = skuMap[k];
        if (!anyHit) anyHit = entry;
        if (hasFront(entry)) { frontHit = entry; break; }
      }
    }
    if (frontHit) return frontHit;
    if (anyHit) return anyHit;
  }

  return null;
}
// ── Curation lists ──────────────────────────────────────────────────────────
// Centralized so editors can update featured/popular products in one place.

/** SKUs shown in the homepage "Most ordered" hero grid (4 max). */
export const FEATURED_SKUS = ['ATC1000', 'ATCF2500', 'L445', 'ATC6606'] as const;

/** SKUs that get a "⭐ Populaire" badge on catalog cards. */
export const POPULAR_SKUS = new Set(['ATC1000', 'S445LS', 'L445', 'ATCF2500']);
