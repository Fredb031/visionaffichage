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
  return useQuery<ShopifyVariantColor[]>({
    queryKey: ['product-colors', handle],
    queryFn: async () => {
      if (!handle) return [];
      const data = await storefrontApiRequest(PRODUCT_FULL_QUERY, { handle });
      const product = data?.data?.product;
      if (!product) return [];
      return parseProductColors(product);
    },
    enabled: !!handle,
    staleTime: 5 * 60 * 1000, // 5 min cache
    // Retry transient Shopify blips with exponential backoff before
    // locking in an empty list for the 5-min staleTime. Without this,
    // a dropped fetch during PDP load showed no colour swatches for
    // five full minutes even if Shopify was up the whole time after.
    retry: 2,
    retryDelay: attempt => Math.min(1000 * 2 ** attempt, 5000),
  });
}
