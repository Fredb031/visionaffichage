import type { Product } from './types';

export const products: Product[] = [
  {
    styleCode: 'ATC1000',
    slug: 'atc1000-tshirt-essentiel',
    category: 'tshirt',
    brand: 'ATC',
    decorationDefault: 'print',
    priceFromCents: 1295,
    minQuantity: 12,
    leadTimeDays: { min: 5, max: 7 },
    title: {
      'fr-ca': 'T-shirt essentiel ATC1000',
      'en-ca': 'ATC1000 Essential T-shirt',
    },
    identityHook: {
      'fr-ca': "Le t-shirt par défaut pour vos uniformes d'équipe.",
      'en-ca': 'The default tee for your team uniforms.',
    },
    description: {
      'fr-ca':
        "Coton 100 % filé à anneaux, 5,5 oz. Coupe régulière, coutures latérales renforcées, bande de propreté au col. Disponible en 25 couleurs solides. Excellent pour la sérigraphie et le transfert.",
      'en-ca':
        'Ring-spun 100% cotton, 5.5 oz. Regular fit, reinforced side seams, taped neck. 25 solid colors. Excellent for screen printing and transfer.',
    },
    bestFor: {
      'fr-ca': "Quarts d'été, événements, distribution rapide.",
      'en-ca': 'Summer shifts, events, fast distribution.',
    },
    badges: [
      { 'fr-ca': 'Plus vendu', 'en-ca': 'Best seller' },
      { 'fr-ca': '25 couleurs', 'en-ca': '25 colors' },
    ],
    badgeKeys: ['best-screen-print', 'quick-ship', 'kit-friendly'],
    colors: [
      { name: { 'fr-ca': 'Noir', 'en-ca': 'Black' }, hex: '#101114', available: true },
      { name: { 'fr-ca': 'Marine', 'en-ca': 'Navy' }, hex: '#1B2B4B', available: true },
      { name: { 'fr-ca': 'Blanc', 'en-ca': 'White' }, hex: '#FFFFFF', available: true },
    ],
    sizes: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'],
    gallery: [
      'atc1000-tshirt-essentiel',
      'atc1000-tshirt-essentiel-back',
      'atc1000-tshirt-essentiel-detail',
    ],
    careInstructions: {
      'fr-ca':
        'Lavage à la machine à l\'eau froide. Sécher à basse température. Ne pas repasser directement sur l\'impression.',
      'en-ca':
        'Machine wash cold. Tumble dry low. Do not iron directly on print.',
    },
    decorationOptions: ['screenprint', 'embroidery', 'dtg'],
  },
  {
    styleCode: 'ATC1015',
    slug: 'atc1015-tshirt-pre-retreci',
    category: 'tshirt',
    brand: 'ATC',
    decorationDefault: 'print',
    priceFromCents: 1495,
    minQuantity: 12,
    leadTimeDays: { min: 5, max: 7 },
    title: {
      'fr-ca': 'T-shirt pré-rétréci ATC1015',
      'en-ca': 'ATC1015 Pre-shrunk T-shirt',
    },
    identityHook: {
      'fr-ca': 'Conserve sa taille après lavage.',
      'en-ca': 'Holds its size wash after wash.',
    },
    description: {
      'fr-ca':
        'Coton 6 oz pré-rétréci. Plus de tenue que le 1000, idéal pour les milieux où le t-shirt passe à la sécheuse industrielle.',
      'en-ca':
        '6 oz pre-shrunk cotton. More structure than the 1000, ideal where tees go through industrial dryers.',
    },
    bestFor: {
      'fr-ca': 'Restauration, manufacturier, organismes communautaires.',
      'en-ca': 'Food service, manufacturing, community groups.',
    },
    badges: [{ 'fr-ca': 'Pré-rétréci', 'en-ca': 'Pre-shrunk' }],
    badgeKeys: ['heavyweight', 'best-screen-print'],
    colors: [
      { name: { 'fr-ca': 'Noir', 'en-ca': 'Black' }, hex: '#101114', available: true },
      { name: { 'fr-ca': 'Charbon', 'en-ca': 'Charcoal' }, hex: '#3A3A3A', available: true },
      { name: { 'fr-ca': 'Rouge', 'en-ca': 'Red' }, hex: '#B42318', available: true },
    ],
    sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
    gallery: [
      'atc1015-tshirt-pre-retreci',
      'atc1015-tshirt-pre-retreci-back',
      'atc1015-tshirt-pre-retreci-detail',
    ],
    careInstructions: {
      'fr-ca':
        'Lavage industriel toléré. Eau chaude OK. Sécheuse haute température OK.',
      'en-ca':
        'Tolerates industrial laundering. Hot water OK. High-heat dryer OK.',
    },
    decorationOptions: ['screenprint', 'embroidery'],
  },
  {
    styleCode: 'ATCF2400',
    slug: 'atcf2400-chandail-ouate-capuchon',
    category: 'hoodie',
    brand: 'ATC',
    decorationDefault: 'embroidery',
    priceFromCents: 4295,
    minQuantity: 6,
    leadTimeDays: { min: 7, max: 10 },
    title: {
      'fr-ca': 'Chandail à capuchon ATCF2400',
      'en-ca': 'ATCF2400 Pullover Hoodie',
    },
    identityHook: {
      'fr-ca': "L'ouate qui passe l'hiver de chantier.",
      'en-ca': 'The hoodie that survives a Quebec winter on site.',
    },
    description: {
      'fr-ca':
        'Mélange 50/50 coton-polyester, 8,5 oz. Capuchon doublé, poche kangourou double, cordons assortis. Excellent support pour broderie de logo en grande dimension.',
      'en-ca':
        '50/50 cotton-poly blend, 8.5 oz. Lined hood, double kangaroo pocket, matched drawcords. Great backing for large embroidered logos.',
    },
    bestFor: {
      'fr-ca': 'Construction, paysagement, livraison.',
      'en-ca': 'Construction, landscaping, delivery.',
    },
    badges: [
      { 'fr-ca': 'Chaud', 'en-ca': 'Warm' },
      { 'fr-ca': 'Broderie XL', 'en-ca': 'XL embroidery' },
    ],
    badgeKeys: ['best-embroidery', 'heavyweight'],
    colors: [
      { name: { 'fr-ca': 'Noir', 'en-ca': 'Black' }, hex: '#101114', available: true },
      { name: { 'fr-ca': 'Gris athlétique', 'en-ca': 'Athletic grey' }, hex: '#9CA3AF', available: true },
      { name: { 'fr-ca': 'Marine', 'en-ca': 'Navy' }, hex: '#1B2B4B', available: true },
    ],
    sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'],
    gallery: [
      'atcf2400-chandail-ouate-capuchon',
      'atcf2400-chandail-ouate-capuchon-back',
      'atcf2400-chandail-ouate-capuchon-detail',
    ],
    careInstructions: {
      'fr-ca':
        'Lavage à la machine à l\'eau tiède. Sécher à basse température. Retourner avant le lavage pour préserver la broderie.',
      'en-ca':
        'Machine wash warm. Tumble dry low. Turn inside out before washing to preserve embroidery.',
    },
    decorationOptions: ['embroidery', 'screenprint'],
  },
  {
    styleCode: 'ATCF2500',
    slug: 'atcf2500-cardigan-zippe',
    category: 'hoodie',
    brand: 'ATC',
    decorationDefault: 'embroidery',
    priceFromCents: 4895,
    minQuantity: 6,
    leadTimeDays: { min: 7, max: 10 },
    title: {
      'fr-ca': 'Cardigan zippé à capuchon ATCF2500',
      'en-ca': 'ATCF2500 Full-zip Hoodie',
    },
    identityHook: {
      'fr-ca': 'Pour ceux qui mettent et enlèvent leur ouate dix fois par jour.',
      'en-ca': 'For people taking their hoodie off ten times a day.',
    },
    description: {
      'fr-ca':
        'Même tissu que le 2400, fermeture éclair YKK pleine longueur, deux poches latérales. Pratique en cabine de camion ou en bureau au frais.',
      'en-ca':
        'Same fabric as the 2400, full-length YKK zipper, two side pockets. Practical in truck cabs or chilly offices.',
    },
    bestFor: {
      'fr-ca': 'Camionneurs, techniciens en service, bureaux climatisés.',
      'en-ca': 'Truckers, field service techs, cool offices.',
    },
    badges: [{ 'fr-ca': 'Zip YKK', 'en-ca': 'YKK zip' }],
    badgeKeys: ['best-embroidery', 'heavyweight'],
    colors: [
      { name: { 'fr-ca': 'Noir', 'en-ca': 'Black' }, hex: '#101114', available: true },
      { name: { 'fr-ca': 'Marine', 'en-ca': 'Navy' }, hex: '#1B2B4B', available: true },
    ],
    sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
    gallery: [
      'atcf2500-cardigan-zippe',
      'atcf2500-cardigan-zippe-back',
      'atcf2500-cardigan-zippe-detail',
    ],
    careInstructions: {
      'fr-ca':
        'Lavage à la machine à l\'eau tiède. Sécher à basse température. Fermer la fermeture éclair avant le lavage.',
      'en-ca':
        'Machine wash warm. Tumble dry low. Close zipper before washing.',
    },
    decorationOptions: ['embroidery'],
  },
  {
    styleCode: 'L445',
    slug: 'l445-polo-femme',
    category: 'polo',
    brand: 'Port Authority',
    decorationDefault: 'embroidery',
    priceFromCents: 3295,
    minQuantity: 6,
    leadTimeDays: { min: 7, max: 10 },
    title: {
      'fr-ca': 'Polo coupe femme L445',
      'en-ca': "L445 Women's Polo",
    },
    identityHook: {
      'fr-ca': 'Le polo qui ajuste vraiment à la silhouette féminine.',
      'en-ca': "A polo cut that actually fits a woman's shape.",
    },
    description: {
      'fr-ca':
        "Polyester performance avec gestion d'humidité. Coupe galbée à la taille, col à 3 boutons en perle, ourlet courbé. Parfait pour broder un petit logo de poitrine.",
      'en-ca':
        'Moisture-wicking performance polyester. Shaped fit at the waist, 3 pearl-button placket, curved hem. Perfect for a small chest embroidery.',
    },
    bestFor: {
      'fr-ca': 'Réception, vente au détail, équipes mixtes.',
      'en-ca': 'Front desk, retail, mixed teams.',
    },
    badges: [{ 'fr-ca': 'Coupe femme', 'en-ca': "Women's fit" }],
    badgeKeys: ['best-embroidery', 'kit-friendly'],
    colors: [
      { name: { 'fr-ca': 'Marine', 'en-ca': 'Navy' }, hex: '#1B2B4B', available: true },
      { name: { 'fr-ca': 'Blanc', 'en-ca': 'White' }, hex: '#FFFFFF', available: true },
      { name: { 'fr-ca': 'Bourgogne', 'en-ca': 'Burgundy' }, hex: '#6B1E1E', available: true },
    ],
    sizes: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'],
    gallery: [
      'l445-polo-femme',
      'l445-polo-femme-back',
      'l445-polo-femme-detail',
    ],
    careInstructions: {
      'fr-ca':
        'Lavage à la machine à l\'eau froide. Suspendre pour sécher. Repassage à basse température si nécessaire.',
      'en-ca':
        'Machine wash cold. Hang to dry. Iron on low if needed.',
    },
    decorationOptions: ['embroidery'],
  },
  {
    styleCode: 'S445LS',
    slug: 's445ls-chemise-manches-longues',
    category: 'longsleeve',
    brand: 'Port Authority',
    decorationDefault: 'embroidery',
    priceFromCents: 4295,
    minQuantity: 6,
    leadTimeDays: { min: 7, max: 10 },
    title: {
      'fr-ca': 'Chemise manches longues S445LS',
      'en-ca': 'S445LS Long-sleeve Shirt',
    },
    identityHook: {
      'fr-ca': 'Le pas-tout-à-fait-chemise qui sauve le bureau quatre saisons.',
      'en-ca': 'The almost-shirt that saves the office in any season.',
    },
    description: {
      'fr-ca':
        'Tissage à armure unie, 60/40 coton-polyester. Col boutonné, poche poitrine, manches longues ajustables. Tient au repassage à la maison.',
      'en-ca':
        'Plain weave 60/40 cotton-poly. Button-down collar, chest pocket, adjustable cuffs. Holds up to home ironing.',
    },
    bestFor: {
      'fr-ca': 'Vente professionnelle, immobilier, services-conseils.',
      'en-ca': 'B2B sales, real estate, professional services.',
    },
    badges: [{ 'fr-ca': '4 saisons', 'en-ca': 'Four seasons' }],
    badgeKeys: ['best-embroidery'],
    colors: [
      { name: { 'fr-ca': 'Blanc', 'en-ca': 'White' }, hex: '#FFFFFF', available: true },
      { name: { 'fr-ca': 'Bleu ciel', 'en-ca': 'Light blue' }, hex: '#A8C5DA', available: true },
    ],
    sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
    gallery: [
      's445ls-chemise-manches-longues',
      's445ls-chemise-manches-longues-back',
      's445ls-chemise-manches-longues-detail',
    ],
    careInstructions: {
      'fr-ca':
        'Lavage à la machine à l\'eau tiède. Sécheuse basse température. Repassage à la maison toléré.',
      'en-ca':
        'Machine wash warm. Tumble dry low. Home ironing tolerated.',
    },
    decorationOptions: ['embroidery'],
  },
  {
    styleCode: 'ATC6606',
    slug: 'atc6606-veste-coquille-souple',
    category: 'jacket',
    brand: 'ATC',
    decorationDefault: 'embroidery',
    priceFromCents: 7995,
    minQuantity: 6,
    leadTimeDays: { min: 10, max: 14 },
    title: {
      'fr-ca': 'Veste coquille souple ATC6606',
      'en-ca': 'ATC6606 Softshell Jacket',
    },
    identityHook: {
      'fr-ca': 'La veste corporative qui ne fait pas paraître personne « touriste ».',
      'en-ca': 'The corporate jacket nobody mistakes for a tourist windbreaker.',
    },
    description: {
      'fr-ca':
        "Coquille souple 3 couches déperlante, doublure micro-polaire. Coupe athlétique, ajusteurs latéraux, fermeture éclair YKK. Dossard idéal pour broderie de gros logo.",
      'en-ca':
        '3-layer water-repellent softshell, micro-fleece lining. Athletic fit, side adjusters, YKK zip. Great panel for a large embroidered logo.',
    },
    bestFor: {
      'fr-ca': "Cadres, équipes terrain mi-saison, salons d'entreprise.",
      'en-ca': 'Managers, mid-season field teams, trade shows.',
    },
    badges: [
      { 'fr-ca': 'Déperlant', 'en-ca': 'Water-repellent' },
      { 'fr-ca': 'Doublé polaire', 'en-ca': 'Fleece-lined' },
    ],
    badgeKeys: ['best-embroidery', 'heavyweight'],
    colors: [
      { name: { 'fr-ca': 'Noir', 'en-ca': 'Black' }, hex: '#101114', available: true },
      { name: { 'fr-ca': 'Marine', 'en-ca': 'Navy' }, hex: '#1B2B4B', available: true },
      { name: { 'fr-ca': 'Anthracite', 'en-ca': 'Charcoal' }, hex: '#35556D', available: true },
    ],
    sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'],
    gallery: [
      'atc6606-veste-coquille-souple',
      'atc6606-veste-coquille-souple-back',
      'atc6606-veste-coquille-souple-detail',
    ],
    careInstructions: {
      'fr-ca':
        "Lavage à la machine à l'eau froide. Suspendre pour sécher. Ne pas javelliser. Préserve la déperlance.",
      'en-ca':
        'Machine wash cold. Hang to dry. Do not bleach. Preserves DWR finish.',
    },
    decorationOptions: ['embroidery'],
  },
  {
    styleCode: 'C105',
    slug: 'c105-casquette-non-structuree',
    category: 'jacket',
    brand: 'Port & Company',
    decorationDefault: 'embroidery',
    priceFromCents: 1895,
    minQuantity: 12,
    leadTimeDays: { min: 7, max: 10 },
    title: {
      'fr-ca': 'Casquette non structurée C105',
      'en-ca': 'C105 Unstructured Cap',
    },
    identityHook: {
      'fr-ca': 'La casquette qui finit le look uniforme.',
      'en-ca': 'The cap that finishes the uniform.',
    },
    description: {
      'fr-ca':
        "Six panneaux non structurés, sergé de coton lavé, sangle ajustable avec boucle métallique. Profil bas, tient sur la tête sans donner l'air de descendre du chantier.",
      'en-ca':
        'Six-panel unstructured washed cotton twill, adjustable strap with metal buckle. Low profile, sits well without looking too job-site.',
    },
    bestFor: {
      'fr-ca': 'Compléments uniformes, événements, cadeaux clients.',
      'en-ca': 'Uniform add-ons, events, client gifts.',
    },
    badges: [{ 'fr-ca': 'Profil bas', 'en-ca': 'Low profile' }],
    badgeKeys: ['best-embroidery', 'kit-friendly', 'quick-ship'],
    colors: [
      { name: { 'fr-ca': 'Noir', 'en-ca': 'Black' }, hex: '#101114', available: true },
      { name: { 'fr-ca': 'Kaki', 'en-ca': 'Khaki' }, hex: '#9C8B6B', available: true },
      { name: { 'fr-ca': 'Marine', 'en-ca': 'Navy' }, hex: '#1B2B4B', available: true },
    ],
    sizes: ['Unique'],
    gallery: [
      'c105-casquette-non-structuree',
      'c105-casquette-non-structuree-back',
      'c105-casquette-non-structuree-detail',
    ],
    careInstructions: {
      'fr-ca':
        'Lavage à la main à l\'eau froide. Sécher à plat. Ne pas mettre à la sécheuse.',
      'en-ca':
        'Hand wash cold. Lay flat to dry. Do not tumble dry.',
    },
    decorationOptions: ['embroidery'],
  },
  {
    styleCode: 'WERK250',
    slug: 'werk250-chandail-travail',
    category: 'longsleeve',
    brand: 'Werk',
    decorationDefault: 'embroidery',
    priceFromCents: 5495,
    minQuantity: 6,
    leadTimeDays: { min: 10, max: 14 },
    title: {
      'fr-ca': 'Chandail de travail Werk 250',
      'en-ca': 'Werk 250 Workshirt',
    },
    identityHook: {
      'fr-ca': 'Pensé pour ceux qui usent leurs vêtements au travail.',
      'en-ca': 'Made for people who actually wear out their work clothes.',
    },
    description: {
      'fr-ca':
        'Mélange coton-polyester renforcé, 7 oz. Couture triple aux épaules, poche poitrine renforcée, ourlet allongé. Conçu pour les métiers spécialisés et la mécanique.',
      'en-ca':
        'Reinforced cotton-poly blend, 7 oz. Triple-stitched shoulders, reinforced chest pocket, drop tail. Built for skilled trades and mechanics.',
    },
    bestFor: {
      'fr-ca': 'Mécaniciens, électriciens, plombiers.',
      'en-ca': 'Mechanics, electricians, plumbers.',
    },
    badges: [
      { 'fr-ca': 'Renforcé', 'en-ca': 'Reinforced' },
      { 'fr-ca': 'Métiers', 'en-ca': 'Trades' },
    ],
    badgeKeys: ['heavyweight', 'best-embroidery'],
    colors: [
      { name: { 'fr-ca': 'Gris pierre', 'en-ca': 'Stone grey' }, hex: '#7A7368', available: true },
      { name: { 'fr-ca': 'Marine', 'en-ca': 'Navy' }, hex: '#1B2B4B', available: true },
      { name: { 'fr-ca': 'Noir', 'en-ca': 'Black' }, hex: '#101114', available: true },
    ],
    sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'],
    gallery: [
      'werk250-chandail-travail',
      'werk250-chandail-travail-back',
      'werk250-chandail-travail-detail',
    ],
    careInstructions: {
      'fr-ca':
        'Lavage industriel toléré. Eau chaude OK. Préserve la couture renforcée.',
      'en-ca':
        'Tolerates industrial laundering. Hot water OK. Preserves reinforced stitching.',
    },
    decorationOptions: ['embroidery', 'screenprint'],
  },
  {
    styleCode: 'ATC1000Y',
    slug: 'atc1000y-tshirt-jeunesse',
    category: 'youth',
    brand: 'ATC',
    decorationDefault: 'print',
    priceFromCents: 1095,
    minQuantity: 12,
    leadTimeDays: { min: 5, max: 7 },
    title: {
      'fr-ca': 'T-shirt jeunesse ATC1000Y',
      'en-ca': 'ATC1000Y Youth T-shirt',
    },
    identityHook: {
      'fr-ca': 'Le même t-shirt, taille jeunesse.',
      'en-ca': 'Same tee, youth sizing.',
    },
    description: {
      'fr-ca':
        "Identique à l'ATC1000 adulte, en coupes ajustées pour enfants 4 à 16 ans. Idéal pour camps, équipes sportives et événements communautaires.",
      'en-ca':
        'Same construction as the adult ATC1000, sized for ages 4 to 16. Ideal for camps, sports teams, and community events.',
    },
    bestFor: {
      'fr-ca': 'Camps de jour, écoles, ligues sportives.',
      'en-ca': 'Day camps, schools, sports leagues.',
    },
    badges: [{ 'fr-ca': 'Jeunesse', 'en-ca': 'Youth' }],
    badgeKeys: ['quick-ship', 'best-screen-print', 'kit-friendly'],
    colors: [
      { name: { 'fr-ca': 'Noir', 'en-ca': 'Black' }, hex: '#101114', available: true },
      { name: { 'fr-ca': 'Rouge', 'en-ca': 'Red' }, hex: '#B42318', available: true },
      { name: { 'fr-ca': 'Bleu royal', 'en-ca': 'Royal blue' }, hex: '#1B2B4B', available: true },
    ],
    sizes: ['XS-Y', 'S-Y', 'M-Y', 'L-Y', 'XL-Y'],
    gallery: [
      'atc1000y-tshirt-jeunesse',
      'atc1000y-tshirt-jeunesse-back',
      'atc1000y-tshirt-jeunesse-detail',
    ],
    careInstructions: {
      'fr-ca':
        'Lavage à la machine à l\'eau froide. Sécher à basse température. Ne pas repasser directement sur l\'impression.',
      'en-ca':
        'Machine wash cold. Tumble dry low. Do not iron directly on print.',
    },
    decorationOptions: ['screenprint', 'dtg'],
  },
];

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getProductByStyleCode(code: string): Product | undefined {
  return products.find((p) => p.styleCode === code);
}
