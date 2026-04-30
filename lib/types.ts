export type Locale = 'fr-ca' | 'en-ca';

export type Bilingual = {
  'fr-ca': string;
  'en-ca': string;
};

export type ProductCategory =
  | 'polo'
  | 'tshirt'
  | 'longsleeve'
  | 'hoodie'
  | 'jacket'
  | 'youth';

export type BadgeKey =
  | 'quick-ship'
  | 'best-embroidery'
  | 'best-screen-print'
  | 'heavyweight'
  | 'kit-friendly';

export type DecorationOption = 'embroidery' | 'screenprint' | 'dtg';

export type Product = {
  styleCode: string;
  slug: string;
  category: ProductCategory;
  title: Bilingual;
  identityHook: Bilingual;
  description: Bilingual;
  bestFor: Bilingual;
  badges: Bilingual[];
  badgeKeys?: BadgeKey[];
  colors: { name: Bilingual; hex: string; available?: boolean }[];
  sizes: string[];
  brand: string;
  decorationDefault: 'embroidery' | 'print';
  priceFromCents: number;
  minQuantity: number;
  leadTimeDays: { min: number; max: number };
  gallery?: string[];
  careInstructions?: Bilingual;
  decorationOptions?: DecorationOption[];
};

export type Industry = {
  slug: string;
  name: Bilingual;
  shortDescription: Bilingual;
  pitch: Bilingual;
  hookLine?: Bilingual;
  keyProducts: string[];
};

export type Review = {
  id: string;
  productId?: string;
  author: string;
  role: Bilingual;
  company: string;
  industry: string;
  quote: Bilingual;
  rating: 4 | 5;
  date?: string;
};

export type ClientLogo = {
  id: string;
  name: string;
  industry: string;
};
