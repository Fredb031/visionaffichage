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
  });
}
