/**
 * useProductColors — fetches real Shopify colors + front/back images
 * via Storefront API for a given product handle.
 *
 * Returns: live color list with imageDevant/imageDos per color.
 */
import { useQuery } from '@tanstack/react-query';
import { storefrontApiRequest, parseProductColors, PRODUCT_FULL_QUERY } from '@/lib/shopify';
import type { ShopifyVariantColor } from '@/lib/shopify';

export function useProductColors(handle: string | undefined) {
  // Normalize before the cache key so callers that pass 'ATCF2500',
  // ' atcf2500', or 'atcf2500\n' all hit the same React Query entry
  // instead of firing three duplicate Storefront requests for the same
  // product. Shopify handles are always lowercase by Shopify's own
  // rules — sending the normalized form also avoids a 404-on-mismatch
  // from the Storefront API when a stray capital slipped into the data
  // layer.
  const normalized = handle?.trim().toLowerCase() || undefined;
  return useQuery<ShopifyVariantColor[]>({
    queryKey: ['product-colors', normalized],
    queryFn: async () => {
      if (!normalized) return [];
      const data = await storefrontApiRequest(PRODUCT_FULL_QUERY, { handle: normalized });
      const product = data?.data?.product;
      if (!product) return [];
      return parseProductColors(product);
    },
    enabled: !!normalized,
    // Colour/variant data is effectively static per product handle —
    // cache aggressively (30 min) so jumping between PDPs and the
    // catalogue grid doesn't re-hit Storefront for swatches we already
    // have. Shopify admin edits to variants are rare and a full reload
    // bypasses the cache anyway.
    staleTime: 30 * 60 * 1000,
    // Keep swatch data in memory for an hour after unmount so back/forward
    // navigation to a recently-viewed PDP feels instant instead of
    // flashing an empty swatch row while Storefront is re-queried.
    gcTime: 60 * 60 * 1000,
    // Retry transient Shopify blips with exponential backoff before
    // locking in an empty list for the 30-min staleTime. Without this,
    // a dropped fetch during PDP load showed no colour swatches for
    // the full stale window even if Shopify was up the whole time after.
    // The +Math.random()*300 jitter desynchronizes parallel hooks
    // (useProducts + useProductColors fire together on PDP mount) so
    // they don't retry in lock-step and re-trigger the same rate limit.
    retry: 2,
    retryDelay: attempt => Math.min(1000 * 2 ** attempt, 5000) + Math.random() * 300,
  });
}
