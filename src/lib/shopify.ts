import { toast } from "sonner";

const SHOPIFY_API_VERSION = '2025-07';
const SHOPIFY_STORE_PERMANENT_DOMAIN = 'visionaffichage-com.myshopify.com';
const SHOPIFY_STOREFRONT_URL = `https://${SHOPIFY_STORE_PERMANENT_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`;
const SHOPIFY_STOREFRONT_TOKEN = '7e5f9ba2a85fc405c9e139fb05d52a65';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ShopifyVariantColor {
  variantId: string;
  colorName: string;
  hex: string;                // derived from name mapping
  imageDevant: string | null; // variant-specific image
  imageDos: string | null;
  price: string;
  availableForSale: boolean;
  sizeOptions: Array<{ variantId: string; size: string; available: boolean }>;
}

export interface ShopifyProductFull {
  id: string;
  title: string;
  handle: string;
  description: string;
  colors: ShopifyVariantColor[];
  allImages: string[];
}

export interface ShopifyProduct {
  node: {
    id: string;
    title: string;
    description: string;
    handle: string;
    productType: string;
    tags: string[];
    priceRange: {
      minVariantPrice: { amount: string; currencyCode: string };
    };
    images: { edges: Array<{ node: { url: string; altText: string | null } }> };
    variants: {
      edges: Array<{
        node: {
          id: string;
          title: string;
          price: { amount: string; currencyCode: string };
          availableForSale: boolean;
          selectedOptions: Array<{ name: string; value: string }>;
          image: { url: string; altText: string | null } | null;
        };
      }>;
    };
    options: Array<{ name: string; values: string[] }>;
  };
}

// ── Colour name → hex — complete FR/EN mapping for all 74 Shopify variants ──
const COLOUR_HEX_MAP: Record<string, string> = {
  // Blacks
  'Black': '#1a1a1a', 'Noir': '#1a1a1a',
  'Noir chiné': '#2d2d2d', 'Noir/Noir': '#1a1a1a', 'Noir/Blanc': '#1a1a1a',
  'Graphite Chiné': '#3a3a3a', 'Multicam Noir/Noir': '#1a1a1a', 'Multicam/Noir': '#1a1a1a',
  // Whites / Naturals
  'White': '#f5f5f0', 'Blanc': '#f5f5f0', 'Blanc/Blanc': '#f5f5f0',
  'Natural': '#f0ead6', 'Naturel': '#f0ead6', 'Off White': '#f5f2e8',
  'Sable': '#c4a882', 'Sable Foncé': '#8b7a5e',
  'Avoine Chiné': '#d4c5a8',
  // Greys
  'Gris cendré': '#b8b9bc', 'Heather Grey': '#b8b9bc', 'Gris chiné': '#b8b9bc',
  'Gris Cendré Athlétique': '#b0b8c0', 'Chiné Athlétique': '#9ca3af',
  'Gris Foncé': '#4b5563', 'Gris Foncé Chiné': '#3d4046',
  'Charcoal': '#374151', 'Charbon': '#374151',
  'Charbon/Blanc': '#374151', 'Charbon/Charbon': '#374151', 'Charbon/Noir': '#374151',
  'Steel Grey': '#6b7280', 'Gris acier': '#6b7280',
  'Gris Béton': '#7d7d7d', 'Oxford Athlétique': '#6e7278',
  'Dark Heather': '#4a4a4a', 'Heather': '#b8aacc',
  'Chiné/Blanc': '#b0b0b0', 'Chiné/Noir': '#6b6b6b',
  'Argent': '#a8a9ad',
  // Blues
  'Navy': '#1b3a6b', 'Marine': '#1b3a6b', 'Marine/Marine': '#1b3a6b',
  'Marine Foncé': '#0d2240', 'Marine Chiné': '#2d4a7a',
  'Marine/Blanc': '#1b3a6b', 'Marine/Argent': '#1b3a6b',
  'Royal': '#1a3a8b', 'Royal Franc': '#1a3a8b', 'Royal Chiné': '#1f3d8a',
  'Royal/Blanc': '#1a3a8b', 'Bleu royal': '#1a3a8b',
  'Saphir': '#1560bd',
  'Lac Blue': '#4a8ec2', 'Bleu Caroline': '#4a8ec2',
  'Bleu Aquatique': '#06a3b4', 'Bleu Aqua Brilliant': '#00b4d8',
  'Light Blue': '#93c6e0', 'Bleu Pâle': '#93c6e0',
  'Bleu Fluo': '#00bfff', 'Sky Blue': '#6bb5e8',
  'Athletic Blue': '#1a5caf',
  // Reds
  'Red': '#cc1a1a', 'Rouge': '#cc1a1a',
  'Rouge Chiné': '#a01515', 'Rouge/Blanc': '#cc1a1a',
  'Sangria': '#8b1a3a',
  'Cardinal': '#7a1f2e',
  'Maroon': '#5c1420', 'Bordeaux': '#5c1420',
  'Rose Bonbon': '#ff6eb4', 'Rose Fluo': '#ff1dce',
  'Pink': '#e87aaa', 'Hot Pink': '#d4186c', 'Lavande': '#c4a8e0',
  // Greens
  'Forest Green': '#1a3d2e', 'Vert Foncé': '#14532d',
  'Kelly': '#1a7a2e', 'Kelly Green': '#1a7a2e',
  'Vert Athlétique': '#1a6b2e',
  'Vert Laurel': '#4a7c59',
  'Vert Trèfle': '#1b5e20',
  'Military Green': '#3d4a2e', 'Vert Militaire': '#3f4f2a',
  'Vert Sécurité': '#5c7a1e',
  'Bottle Green': '#0f4020',
  // Purples / Burgundy
  'Purple': '#4a1a7a', 'Mauve': '#9b59b6', 'Mauve chiné': '#8b50a6',
  'Burgundy': '#5c1a2e', 'Bourgogne': '#5c1a2e',
  'Vintage Purple': '#5c2a6b',
  // Browns / Khakis
  'Caramel': '#c19a6b', 'Caramel/Noir': '#c19a6b',
  'Caramel Brown': '#a37c50', 'Brun caramel': '#a37c50',
  'Marron': '#7b4f2e',
  'Brun chocolat foncé': '#3c1f10',
  'Brun coyote': '#81613c', 'Brun/Kaki': '#6b5b3e',
  'Khaki': '#92835a', 'Kaki': '#92835a',
  'Tan': '#c4a882',
  'Camouflage': '#4b5320', 'Camo Green': '#5a6040',
  'Realtree EDGE®**/Brun': '#5b4c37',
  // Golds / Oranges / Yellows
  'Gold': '#b8860b', 'Or': '#b8860b', 'Athletic Gold': '#c08b14',
  'Jaune': '#f5c518', 'Jaune Sécurité': '#ffd700',
  'Citron Vert Fluo': '#adff2f',
  'Orange': '#e8521e', 'Orange Profond': '#d4450c',
  'Orange sécurité': '#ff4500',
  // Common variants merchants type that weren't matching before
  'True Navy': '#1b3a6b', 'True Royal': '#1a3a8b', 'True Red': '#cc1a1a',
  'Royal Blue': '#1a3a8b', 'Navy Blue': '#1b3a6b',
  'Sport Grey': '#b0b0b0', 'Sport Gray': '#b0b0b0',
  'Heather Navy': '#2d4a7a', 'Heather Red': '#a01515',
  'Heather Royal': '#1f3d8a', 'Heather Black': '#2d2d2d',
  'Jet Black': '#0c0c0c', 'Pure White': '#ffffff',
  'Ash': '#c4c4c4', 'Ash Grey': '#c4c4c4',
  'Kelly Heather': '#2d7a42',
  'Forest': '#14532d', 'Kelly Green Heather': '#2d7a42',
  'Bright Blue': '#1e6ee8',
  'Pale Blue': '#a8c8e0',
};

/** Normalize a color name for fuzzy matching: lowercase, strip diacritics,
 * collapse whitespace, drop punctuation. "Vert Forêt" → "vert foret". */
function normalizeColorName(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9/\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Pre-compute a normalized version of the map for O(1) lookups on
// diacritic-insensitive matches.
const NORMALIZED_COLOUR_MAP: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const [key, hex] of Object.entries(COLOUR_HEX_MAP)) {
    m.set(normalizeColorName(key), hex);
  }
  return m;
})();

/** Deterministic fallback: hash unknown names to a muted HSL color so the
 * same unknown color always renders the same swatch (users notice when
 * the same string renders as different grays each load). */
function hashColorName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  const h = Math.abs(hash) % 360;
  // HSL → RGB → hex
  const s = 0.35, l = 0.45;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r1, g1, b1] =
    h < 60  ? [c, x, 0] :
    h < 120 ? [x, c, 0] :
    h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] :
    h < 300 ? [x, 0, c] : [c, 0, x];
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`;
}

export function colorNameToHex(name: string): string {
  if (!name || name === '-') return '#888888';
  // Tier 1: exact match
  if (COLOUR_HEX_MAP[name]) return COLOUR_HEX_MAP[name];
  // Tier 2: diacritic-insensitive exact match ("Vert Foncé" → "vert fonce")
  const norm = normalizeColorName(name);
  const normHit = NORMALIZED_COLOUR_MAP.get(norm);
  if (normHit) return normHit;
  // Tier 3: compound name like "Noir/Blanc" — try primary part both raw and normalized
  const primary = name.split('/')[0].trim();
  if (primary !== name) {
    if (COLOUR_HEX_MAP[primary]) return COLOUR_HEX_MAP[primary];
    const primaryNorm = normalizeColorName(primary);
    const primaryHit = NORMALIZED_COLOUR_MAP.get(primaryNorm);
    if (primaryHit) return primaryHit;
  }
  // Tier 4: fuzzy (longest overlap wins so 'or' doesn't steal 'orange')
  let best: string | null = null;
  let bestLen = 0;
  for (const [key, hex] of NORMALIZED_COLOUR_MAP.entries()) {
    if ((norm.includes(key) || key.includes(norm)) && key.length > bestLen) {
      best = hex;
      bestLen = key.length;
    }
  }
  if (best) return best;
  // Tier 5: deterministic fallback via name hash — better than a constant
  // gray because at least distinct unknowns stay visually distinct.
  return hashColorName(name);
}

// ── Storefront API request ─────────────────────────────────────────────────
// Hard timeout on Storefront calls. Without it a hung Shopify request
// ties up the React Query inflight state indefinitely and the skeleton
// spins forever. 15s is well above the normal ~300ms response time but
// short enough to give users a useful error banner.
const STOREFRONT_TIMEOUT_MS = 15_000;

export async function storefrontApiRequest(query: string, variables: Record<string, unknown> = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), STOREFRONT_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(SHOPIFY_STOREFRONT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': SHOPIFY_STOREFRONT_TOKEN,
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if ((err as Error)?.name === 'AbortError') {
      throw new Error(`Shopify Storefront request timed out after ${STOREFRONT_TIMEOUT_MS}ms`);
    }
    throw err;
  }
  clearTimeout(timeoutId);

  if (response.status === 402) {
    // Read lang from localStorage since this isn't a React component
    let isEn = false;
    try { isEn = localStorage.getItem('vision-lang') === 'en'; } catch { /* private mode */ }
    toast.error(
      isEn ? 'Shopify: Payment required' : 'Shopify : Paiement requis',
      { description: isEn
          ? 'Your Shopify store needs an active plan.'
          : 'Votre boutique Shopify nécessite un plan actif.' },
    );
    return;
  }

  // Storefront enforces a GraphQL cost budget per IP; burst traffic
  // (e.g. a shopper hammering Prev/Next on the PDP variants) returns
  // 429 Too Many Requests. Previously this fell through to the generic
  // `HTTP error! status: 429` throw, which React Query surfaces as a
  // blank skeleton / ErrorBoundary — users had no idea it was transient.
  // Surface a localized toast so they know to wait a moment, mirroring
  // the 402 pattern above. Then THROW a tagged error (retryable: true)
  // instead of returning undefined: returning undefined silently looked
  // like success to callers — cart mutations committed local lines for
  // writes that never reached Shopify, and query hooks cached an empty
  // result for the full staleTime even though the server was back in
  // 200ms. Throwing lets React Query's retry policy honour the backoff,
  // and lets future callers branch on `err.retryable` to decide between
  // auto-retry vs a user-facing failure.
  if (response.status === 429) {
    let isEn = false;
    try { isEn = localStorage.getItem('vision-lang') === 'en'; } catch { /* private mode */ }
    toast.error(
      isEn ? 'Shopify: Too many requests' : 'Shopify : Trop de requêtes',
      { description: isEn
          ? 'Please wait a moment and try again.'
          : 'Veuillez patienter un instant et réessayer.' },
    );
    const err = new Error('HTTP error! status: 429') as Error & { retryable: boolean; status: number };
    err.retryable = true;
    err.status = 429;
    throw err;
  }

  // Shopify Storefront occasionally returns 5xx during deploys, regional
  // outages, or backend incidents. Without a friendly toast these surface
  // as a blank skeleton / ErrorBoundary fallback (via the generic throw
  // below) — users can't tell whether it's their wifi, our site, or
  // Shopify. Announce it in-language so they know to retry in a moment,
  // then rethrow so React Query's retry policy still kicks in.
  if (response.status >= 500 && response.status < 600) {
    let isEn = false;
    try { isEn = localStorage.getItem('vision-lang') === 'en'; } catch { /* private mode */ }
    toast.error(
      isEn ? 'Shopify: Service temporarily unavailable' : 'Shopify : Service temporairement indisponible',
      { description: isEn
          ? 'Retrying… please wait a moment.'
          : 'Nouvelle tentative… veuillez patienter un instant.' },
    );
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

  const data = await response.json();
  if (data.errors) throw new Error(`Shopify error: ${data.errors.map((e: { message: string }) => e.message).join(', ')}`);
  return data;
}

// ── FULL product query — variants with per-color images ────────────────────
export const PRODUCT_FULL_QUERY = `
  query GetProductFull($handle: String!) {
    product(handle: $handle) {
      id
      title
      handle
      description
      images(first: 40) {
        edges {
          node {
            url(transform: { maxWidth: 800 })
            altText
          }
        }
      }
      options {
        name
        values
      }
      variants(first: 100) {
        edges {
          node {
            id
            title
            availableForSale
            price { amount currencyCode }
            selectedOptions { name value }
            image {
              url(transform: { maxWidth: 800 })
              altText
            }
          }
        }
      }
    }
  }
`;

// Shape of the raw Shopify GraphQL product node used by parseProductColors.
// Narrow enough to compile-check against query changes without being
// brittle to extra fields.
type RawShopifyOption = { name: string; value: string };
type RawShopifyVariant = {
  node: {
    id: string;
    title: string;
    availableForSale: boolean;
    price: { amount: string; currencyCode?: string };
    selectedOptions: RawShopifyOption[];
    image?: { url: string; altText?: string | null } | null;
  };
};
type RawShopifyProduct = {
  variants?: { edges: RawShopifyVariant[] };
  images?: { edges: Array<{ node: { url: string; altText?: string | null } }> };
};

// ── Parse Shopify product into organised color structure ───────────────────
export function parseProductColors(raw: RawShopifyProduct | null | undefined): ShopifyVariantColor[] {
  if (!raw?.variants?.edges) return [];

  const colorMap = new Map<string, ShopifyVariantColor>();

  for (const { node: variant } of raw.variants.edges) {
    const colorOpt = variant.selectedOptions.find(
      o => o.name.toLowerCase() === 'color' || o.name.toLowerCase() === 'couleur' || o.name.toLowerCase() === 'colour'
    );
    const sizeOpt = variant.selectedOptions.find(
      o => o.name.toLowerCase() === 'size' || o.name.toLowerCase() === 'taille'
    );

    const colorName = colorOpt?.value ?? variant.title;
    const size = sizeOpt?.value ?? variant.title;

    if (!colorMap.has(colorName)) {
      colorMap.set(colorName, {
        variantId: variant.id,
        colorName,
        hex: colorNameToHex(colorName),
        imageDevant: variant.image?.url ?? null,
        imageDos: null,
        price: variant.price.amount,
        availableForSale: variant.availableForSale,
        sizeOptions: [],
      });
    }

    const existing = colorMap.get(colorName)!;

    // Collect size variants for this colour
    existing.sizeOptions.push({
      variantId: variant.id,
      size,
      available: variant.availableForSale,
    });

    // Use variant image if we don't have one yet
    if (!existing.imageDevant && variant.image?.url) {
      existing.imageDevant = variant.image.url;
    }
  }

  // Try to match back images by alt text
  for (const { node: img } of (raw.images?.edges ?? [])) {
    const alt = (img.altText ?? '').toLowerCase();
    if (alt.includes('dos') || alt.includes('back') || alt.includes('rear')) {
      // Try to match color
      for (const color of colorMap.values()) {
        if (!color.imageDos && alt.includes(color.colorName.toLowerCase())) {
          color.imageDos = img.url;
        }
      }
    }
  }

  return Array.from(colorMap.values());
}

// ── Standard product queries ───────────────────────────────────────────────
export const PRODUCTS_QUERY = `
  query GetProducts($first: Int!, $query: String) {
    products(first: $first, query: $query) {
      edges {
        node {
          id title description handle productType tags
          priceRange { minVariantPrice { amount currencyCode } }
          images(first: 5) { edges { node { url altText } } }
          variants(first: 10) {
            edges {
              node {
                id title availableForSale
                price { amount currencyCode }
                selectedOptions { name value }
                image { url altText }
              }
            }
          }
          options { name values }
        }
      }
    }
  }
`;

export const PRODUCT_BY_HANDLE_QUERY = `
  query GetProductByHandle($handle: String!) {
    product(handle: $handle) {
      id title description handle
      priceRange { minVariantPrice { amount currencyCode } }
      images(first: 10) { edges { node { url altText } } }
      variants(first: 50) {
        edges {
          node {
            id title availableForSale
            price { amount currencyCode }
            selectedOptions { name value }
            image { url altText }
          }
        }
      }
      options { name values }
    }
  }
`;
