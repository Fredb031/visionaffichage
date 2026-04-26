/**
 * useSanmarInventory — React Query hook for live SanMar Canada stock
 *
 * Pass the SanMar style number (e.g. "ATCF2500") and you get back live
 * inventory across all warehouses, with cross-color/size aggregation.
 *
 * Caches for 5 minutes (staleTime) and keeps the entry in memory for
 * 1 hour after unmount (gcTime) to avoid hammering the API while a user
 * browses. Returns `null` if the edge function isn't deployed yet — the
 * UI degrades gracefully rather than breaking.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { sanmar, summarizeStock, type SanmarInventoryPart, type StockSummary } from '@/lib/sanmar';

export interface SanmarInventoryResult {
  parts: SanmarInventoryPart[] | null;
  summary: StockSummary;
  isLoading: boolean;
  error: unknown;
}

// Stable empty summary reference. Without this, every "no style number"
// or "data not yet loaded" render allocated a fresh StockSummary whose
// byColor / bySize / byColorSize Maps were brand-new identities, which
// defeated `useMemo(..., [stock.byColorSize])` / effect deps in consumers
// like ProductDetail that key variant-stock work on the Map reference.
// Empty Maps are safe to share because the hook never mutates them —
// summarizeStock always constructs its own Maps when `parts` is a real
// array. Frozen to catch any accidental future mutation in dev.
const EMPTY_BY_COLOR: ReadonlyMap<string, number> = new Map();
const EMPTY_BY_SIZE: ReadonlyMap<string, number> = new Map();
const EMPTY_BY_COLOR_SIZE: ReadonlyMap<string, number> = new Map();
const EMPTY_SUMMARY: StockSummary = Object.freeze({
  totalAvailable: 0,
  byColor: EMPTY_BY_COLOR as Map<string, number>,
  bySize: EMPTY_BY_SIZE as Map<string, number>,
  byColorSize: EMPTY_BY_COLOR_SIZE as Map<string, number>,
}) as StockSummary;

export function useSanmarInventory(styleNumber: string | null | undefined): SanmarInventoryResult {
  // Normalize before the cache key so 'ATCF2500', ' atcf2500 ', and
  // 'atcf2500\n' all hit the same React Query entry instead of firing
  // three duplicate edge-function requests for the same product. SanMar
  // style numbers are canonically uppercase per their API docs — sending
  // the normalized form also avoids a 'not found' from the edge function
  // when a stray lowercase / whitespace slipped into a vendor-imported
  // SKU. Mirrors the trim+normalize pattern useProductColors /
  // useWishlist / useRecentlyViewed already apply to handles.
  const normalized = styleNumber?.trim().toUpperCase() || null;
  const enabled = !!normalized;

  const { data, isLoading, error } = useQuery({
    queryKey: ['sanmar-inventory', normalized],
    queryFn: () => (normalized ? sanmar.getInventory(normalized) : Promise.resolve(null)),
    enabled,
    // 5 min — inventory moves when orders settle but not per second, so
    // a slightly longer stale window avoids re-hitting the edge function
    // on every PDP navigation while still reflecting post-checkout stock
    // drops within a reasonable window. Shorter than the 30-min catalog
    // cache because inventory is the one SanMar surface that actually
    // changes during a browsing session.
    staleTime: 5 * 60 * 1000,
    // Keep inventory in memory for 1 hour after unmount so bouncing
    // between a PDP, the cart, and back doesn't re-fetch when the stale
    // window hasn't even closed yet — the query just re-hydrates from
    // the cache instead of sending the edge function another request.
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });

  // Memoize the summary keyed on the data reference — without this,
  // every parent re-render computed a fresh StockSummary object and
  // any downstream useMemo / useEffect depending on `summary` as a
  // reference would re-run unnecessarily. React Query already
  // stabilizes `data` across renders as long as it hasn't refetched.
  // When there's no data (empty style number, pre-fetch, or the edge
  // function returned null) we hand back the module-level EMPTY_SUMMARY
  // so consumers see one stable reference across every such render
  // rather than a churn of brand-new empty Maps.
  const summary = useMemo(
    () => (data ? summarizeStock(data) : EMPTY_SUMMARY),
    [data],
  );

  return {
    parts: data ?? null,
    summary,
    isLoading,
    error,
  };
}
