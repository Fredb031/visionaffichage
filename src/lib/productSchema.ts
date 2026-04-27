// Mega Blueprint Section 08.1 — per-product JSON-LD builder.
//
// Builds a Product schema that Google's rich-result crawler turns into
// the price/image/availability card on SERPs. Pulled out of
// ProductDetail.tsx into its own module so the schema shape can be
// unit-tested and reused by any future SSR/prerender path without
// dragging the whole page component along. The shape follows
// schema.org/Product:
//   - sku (catalogue lookup)
//   - brand (Organization)
//   - offers.priceCurrency = CAD (Shopify Canada storefront)
//   - offers.shippingDetails — 5-day businessDays, $0 shipping, matches
//     the "livré en 5 jours" promise on the homepage so Merchant Center
//     doesn't flag a price/shipping mismatch when the feed gets imported
//   - offers.availability InStock — POD model means we never go OOS at
//     the product level; per-variant availability is handled separately
//     via the variant selector.
//
// Returns a plain object so callers can JSON.stringify it into the
// <script type="application/ld+json"> body. Returns null when the input
// product is missing required fields (no priceRange, NaN price); the
// caller skips injection in that case rather than emitting an invalid
// schema that Google would warn about in Search Console.

import type { ShopifyProduct } from '@/lib/shopify';
import type { Product as LocalProduct } from '@/data/products';

export interface BuildProductSchemaInput {
  product: ShopifyProduct['node'];
  localProduct?: LocalProduct;
  /** PDP image URL — falls back to the first Shopify image when omitted. */
  image?: string;
  /** Canonical URL of the PDP, fed into offers.url. */
  url?: string;
}

export type ProductSchema = {
  '@context': 'https://schema.org';
  '@type': 'Product';
  name: string;
  sku?: string;
  image?: string[];
  description?: string;
  brand: { '@type': 'Brand'; name: string };
  offers: {
    '@type': 'Offer';
    priceCurrency: string;
    price: string;
    availability: 'https://schema.org/InStock';
    url?: string;
    shippingDetails: {
      '@type': 'OfferShippingDetails';
      shippingRate: { '@type': 'MonetaryAmount'; value: '0'; currency: 'CAD' };
      shippingDestination: { '@type': 'DefinedRegion'; addressCountry: 'CA' };
      deliveryTime: {
        '@type': 'ShippingDeliveryTime';
        handlingTime: { '@type': 'QuantitativeValue'; minValue: 0; maxValue: 1; unitCode: 'DAY' };
        transitTime: { '@type': 'QuantitativeValue'; minValue: 1; maxValue: 5; unitCode: 'DAY' };
        businessDays: { '@type': 'OpeningHoursSpecification'; dayOfWeek: string[] };
      };
    };
  };
};

export function buildProductSchema(input: BuildProductSchemaInput): ProductSchema | null {
  const { product, localProduct, image, url } = input;
  const amount = product.priceRange?.minVariantPrice?.amount;
  const currency = product.priceRange?.minVariantPrice?.currencyCode;
  if (amount === undefined || currency === undefined) return null;
  const price = parseFloat(amount);
  // Reject non-finite *and* non-positive prices: Google's Merchant Center
  // rejects offers with price <= 0 (it reads them as "free", which conflicts
  // with InStock + a paid-shipping promise) so emitting the schema would
  // earn a Search Console warning rather than a rich result.
  if (!Number.isFinite(price) || price <= 0) return null;
  // `name` is a required field on schema.org/Product. An empty or
  // whitespace-only title produces `name: ""`, which Google's rich-result
  // validator rejects outright (logged as ITEM_NAME_MISSING in Search
  // Console). Bail to null so the caller skips injection entirely rather
  // than shipping a schema that's guaranteed to fail validation.
  const trimmedName = product.title?.trim();
  if (!trimmedName) return null;
  const resolvedImage = image ?? product.images?.edges?.[0]?.node?.url;
  // Treat empty/whitespace description the same as missing — Google flags
  // `description: ""` as an invalid value rather than silently dropping it.
  const trimmedDescription = product.description?.trim();
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: trimmedName,
    sku: localProduct?.sku,
    image: resolvedImage ? [resolvedImage] : undefined,
    description: trimmedDescription ? trimmedDescription : undefined,
    brand: { '@type': 'Brand', name: 'Vision Affichage' },
    offers: {
      '@type': 'Offer',
      priceCurrency: currency,
      price: price.toFixed(2),
      availability: 'https://schema.org/InStock',
      url,
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: { '@type': 'MonetaryAmount', value: '0', currency: 'CAD' },
        shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'CA' },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
          transitTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 5, unitCode: 'DAY' },
          businessDays: {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          },
        },
      },
    },
  };
}
