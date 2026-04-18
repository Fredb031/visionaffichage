import { useQuery } from '@tanstack/react-query';
import { storefrontApiRequest, PRODUCTS_QUERY, ShopifyProduct } from '@/lib/shopify';

// Default 50 — slightly over-fetches today's 22-product catalog so new
// SKUs uploaded to Shopify surface automatically instead of silently
// getting truncated past the hardcoded limit. Storefront caps at 250
// per page regardless; anything higher should paginate.
export function useProducts(first = 50) {
  return useQuery({
    queryKey: ['shopify-products', first],
    queryFn: async (): Promise<ShopifyProduct[]> => {
      const data = await storefrontApiRequest(PRODUCTS_QUERY, { first });
      return data?.data?.products?.edges ?? [];
    },
    // Product catalog rarely changes mid-session — cache for 10 min
    // so swapping pages doesn't re-fetch and flash a skeleton each time.
    staleTime: 10 * 60 * 1000,
    // Retry transient Shopify network blips with exponential backoff
    // before surfacing an error to the user.
    retry: 2,
    retryDelay: attempt => Math.min(1000 * 2 ** attempt, 5000),
  });
}
