import { useQuery } from '@tanstack/react-query';
import { storefrontApiRequest, PRODUCTS_QUERY, ShopifyError, ShopifyProduct } from '@/lib/shopify';

/**
 * React Query hook that fetches the Shopify storefront product catalog.
 * Returns TanStack's `UseQueryResult` with `data` typed as `ShopifyProduct[]`;
 * 30-minute `staleTime` and 60-minute `gcTime` keep cross-page navigation snappy.
 */
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
    // Product catalog rarely changes mid-session — cache for 30 min
    // so swapping pages doesn't re-fetch and flash a skeleton each time.
    // Catalog edits in Shopify admin are infrequent relative to typical
    // browsing sessions, so a longer staleTime trades near-zero staleness
    // risk for a noticeably snappier UX across navigations.
    staleTime: 30 * 60 * 1000,
    // Keep the cached payload around for 60 min even after all observers
    // unmount, so a user who bounces to cart then back to the listing
    // page re-hydrates instantly instead of hitting Shopify again.
    gcTime: 60 * 60 * 1000,
    // Retry transient Shopify network blips with exponential backoff
    // before surfacing an error to the user. The +Math.random()*300
    // jitter prevents a thundering herd when the tab wakes from
    // sleep / reconnects: without it, every tab the user has open
    // retries at the exact same t=1000/2000/4000ms mark, which just
    // replays the 429 that queued them up in the first place.
    // Honour ShopifyError.retryable=false so 401/403 (rejected
    // Storefront token) short-circuit immediately instead of burning
    // two extra round-trips that will fail identically — the previous
    // bare `retry: 2` ignored the tagged flag and flooded auth-failure
    // logs that the lib/shopify.ts comments explicitly call out.
    retry: (failureCount, error) => {
      if (error instanceof ShopifyError && error.retryable === false) return false;
      return failureCount < 2;
    },
    retryDelay: attempt => Math.min(1000 * 2 ** attempt, 5000) + Math.random() * 300,
  });
}

/**
 * Return type of {@link useProducts} — derived from the hook itself so the
 * full TanStack Query surface (status flags, refetch, etc.) stays in sync.
 */
export type UseProductsResult = ReturnType<typeof useProducts>;
