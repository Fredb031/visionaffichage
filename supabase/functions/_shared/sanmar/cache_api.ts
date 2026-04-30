/**
 * Thin HTTP client for the FastAPI SanMar cache (Phase 11).
 *
 * The Python sidecar (`sanmar_integration/sanmar/api/`) exposes the
 * SQLite-backed catalog at `/products/{style}`, `/products/{style}/inventory`,
 * and `/products/{style}/pricing`. This module is the TS-side adapter the
 * edge functions use to read from that cache instead of going to SOAP.
 *
 * Behaviour contract:
 *   - 200 → return parsed JSON
 *   - 404 → return null (not in cache; caller falls back to SOAP)
 *   - 5xx / network / timeout → throw (caller logs + falls back to SOAP)
 *
 * All requests are bounded by an AbortController with a default 3 s timeout
 * so a misbehaving cache can't stall the edge function past the Supabase
 * 10 s wall.
 */

export type CacheApiConfig = {
  /** Base URL of the FastAPI cache, e.g. `https://sanmar-cache.example.com`. */
  baseUrl: string;
  /** Per-request abort timeout. Default 3000 ms. */
  timeout_ms?: number;
  /** Optional bearer token sent as `Authorization: Bearer <token>`. */
  cron_secret?: string;
};

/** Loose product DTO — matches `sanmar.dto.ProductResponse` (Python side). */
export interface CachedProductResponse {
  style: string;
  title?: string;
  brand?: string;
  category?: string;
  variants?: Array<Record<string, unknown>>;
  [k: string]: unknown;
}

/** Loose inventory DTO — matches `sanmar.dto.InventoryResponse`. */
export interface CachedInventoryResponse {
  style: string;
  parts?: Array<Record<string, unknown>>;
  [k: string]: unknown;
}

/** Loose pricing DTO — matches `sanmar.dto.PricingResponse`. */
export interface CachedPricingResponse {
  style: string;
  parts?: Array<Record<string, unknown>>;
  [k: string]: unknown;
}

const DEFAULT_TIMEOUT_MS = 3000;

/**
 * Issue a GET against the cache with abort + auth wiring. Returns null on
 * 404, throws on 5xx / network / timeout / non-2xx.
 */
async function cacheGet<T>(config: CacheApiConfig, path: string): Promise<T | null> {
  const timeout = config.timeout_ms ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  const url = config.baseUrl.replace(/\/$/, '') + path;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (config.cron_secret) {
    headers['Authorization'] = `Bearer ${config.cron_secret}`;
  }

  let res: Response;
  try {
    res = await fetch(url, { method: 'GET', headers, signal: controller.signal });
  } catch (e) {
    clearTimeout(timer);
    const msg = (e as Error)?.message ?? 'unknown';
    // AbortError surfaces as DOMException with name 'AbortError' in Deno
    // and as Error('The operation was aborted') in some node-fetch impls.
    if ((e as Error)?.name === 'AbortError' || /abort/i.test(msg)) {
      throw new Error(`cache_api: request to ${path} aborted after ${timeout}ms`);
    }
    throw new Error(`cache_api: network error for ${path}: ${msg}`);
  }
  clearTimeout(timer);

  if (res.status === 404) return null;
  if (res.status >= 500) {
    throw new Error(`cache_api: upstream ${res.status} for ${path}`);
  }
  if (!res.ok) {
    // 4xx other than 404 — treat as cache miss (caller falls back to SOAP).
    // Log via thrown error so router can record it.
    throw new Error(`cache_api: unexpected ${res.status} for ${path}`);
  }

  try {
    return (await res.json()) as T;
  } catch (e) {
    throw new Error(`cache_api: failed to parse JSON from ${path}: ${(e as Error).message}`);
  }
}

/**
 * Fetch a product (style + variants) from the cache.
 *
 * @returns parsed product, or `null` when the cache returns 404.
 * @throws on 5xx / network / timeout — caller must handle and fall back.
 */
export async function fetchProductFromCache(
  config: CacheApiConfig,
  style_number: string,
): Promise<CachedProductResponse | null> {
  const path = `/products/${encodeURIComponent(style_number)}`;
  return cacheGet<CachedProductResponse>(config, path);
}

/**
 * Fetch inventory rows for a style from the cache.
 */
export async function fetchInventoryFromCache(
  config: CacheApiConfig,
  style_number: string,
): Promise<CachedInventoryResponse | null> {
  const path = `/products/${encodeURIComponent(style_number)}/inventory`;
  return cacheGet<CachedInventoryResponse>(config, path);
}

/**
 * Fetch pricing rows for a style from the cache.
 */
export async function fetchPricingFromCache(
  config: CacheApiConfig,
  style_number: string,
): Promise<CachedPricingResponse | null> {
  const path = `/products/${encodeURIComponent(style_number)}/pricing`;
  return cacheGet<CachedPricingResponse>(config, path);
}
