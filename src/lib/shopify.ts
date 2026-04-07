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

// ── Colour name → hex (ATC / SanMar colour codes) ─────────────────────────
const COLOUR_HEX_MAP: Record<string, string> = {
  // Neutrals
  'Black': '#1a1a1a', 'Noir': '#1a1a1a',
  'White': '#f5f5f0', 'Blanc': '#f5f5f0',
  'Natural': '#f0ead6', 'Naturel': '#f0ead6',
  'Off White': '#f5f2e8',
  // Greys
  'Heather Grey': '#b8b8b8', 'Gris chiné': '#b8b8b8',
  'Steel Grey': '#6b6b6b', 'Gris acier': '#6b6b6b',
  'Charcoal': '#3d3d3d', 'Charbon': '#3d3d3d',
  'Dark Heather': '#4a4a4a',
  // Blues
  'Navy': '#1B3A6B', 'Marine': '#1B3A6B',
  'Royal': '#1a3a8b', 'Bleu royal': '#1a3a8b',
  'Light Blue': '#4a90d9', 'Bleu pâle': '#4a90d9',
  'Sky Blue': '#6bb5e8',
  'Athletic Blue': '#1a5caf',
  // Reds
  'Red': '#cc1a1a', 'Rouge': '#cc1a1a',
  'Dark Red': '#8b1a1a', 'Rouge foncé': '#8b1a1a',
  'Cardinal': '#7a1f2e',
  'Maroon': '#5c1420', 'Bordeaux': '#5c1420',
  // Greens
  'Forest Green': '#1a3d2e', 'Vert forêt': '#1a3d2e',
  'Kelly Green': '#1a7a2e',
  'Bottle Green': '#0f4020',
  'Military Green': '#3d4a2e',
  // Purples / Burgundy
  'Purple': '#4a1a7a', 'Mauve': '#4a1a7a',
  'Burgundy': '#5c1a2e', 'Bourgogne': '#5c1a2e',
  'Vintage Purple': '#5c2a6b',
  // Browns / Neutrals
  'Caramel Brown': '#4a3728', 'Brun caramel': '#4a3728',
  'Khaki': '#6b6b3a', 'Kaki': '#6b6b3a',
  'Tan': '#c4a882',
  'Camo Green': '#5a6040',
  // Warm
  'Gold': '#B8860B', 'Or': '#B8860B',
  'Orange': '#d4621a',
  'Athletic Gold': '#C08B14',
  // Pink
  'Hot Pink': '#d4186c',
  'Pink': '#e87aaa',
  // Special
  'Heather': '#b8aacc',
};

function colorNameToHex(name: string): string {
  if (COLOUR_HEX_MAP[name]) return COLOUR_HEX_MAP[name];
  // Fuzzy match
  for (const [key, val] of Object.entries(COLOUR_HEX_MAP)) {
    if (name.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(name.toLowerCase())) {
      return val;
    }
  }
  return '#888888'; // fallback
}

// ── Storefront API request ─────────────────────────────────────────────────
export async function storefrontApiRequest(query: string, variables: Record<string, unknown> = {}) {
  const response = await fetch(SHOPIFY_STOREFRONT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': SHOPIFY_STOREFRONT_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (response.status === 402) {
    toast.error("Shopify: Paiement requis", {
      description: "Votre boutique Shopify nécessite un plan actif.",
    });
    return;
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

// ── Parse Shopify product into organised color structure ───────────────────
export function parseProductColors(raw: any): ShopifyVariantColor[] {
  if (!raw?.variants?.edges) return [];

  const colorMap = new Map<string, ShopifyVariantColor>();

  for (const { node: variant } of raw.variants.edges) {
    const colorOpt = variant.selectedOptions.find(
      (o: any) => o.name.toLowerCase() === 'color' || o.name.toLowerCase() === 'couleur' || o.name.toLowerCase() === 'colour'
    );
    const sizeOpt = variant.selectedOptions.find(
      (o: any) => o.name.toLowerCase() === 'size' || o.name.toLowerCase() === 'taille'
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
