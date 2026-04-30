/**
 * Feature-flag aware dispatcher between the FastAPI cache and SOAP origin.
 *
 * Reads two env vars at call time so flag flips don't require a redeploy of
 * the consuming function (Supabase reloads env across cold starts):
 *
 *   - `SANMAR_CACHE_API_URL`    base URL of the FastAPI cache. When unset
 *                               every call goes straight to SOAP.
 *   - `SANMAR_CACHE_ROUTES`     comma-separated allowlist (`products`,
 *                               `inventory`, `pricing`). A regression on
 *                               one route is contained — drop it from the
 *                               list, the others keep serving from cache.
 *   - `SANMAR_CACHE_API_SECRET` optional bearer token forwarded to the
 *                               cache as `Authorization: Bearer <token>`.
 *
 * Every response is tagged with a `_source: 'cache' | 'soap'` field so the
 * admin dashboard can plot cache hit ratio without piggybacking on logs.
 * The tag is observability metadata — never user-facing.
 */

import {
  fetchInventoryFromCache,
  fetchPricingFromCache,
  fetchProductFromCache,
} from './cache_api.ts';
import type { CacheApiConfig } from './cache_api.ts';
import {
  getAllActiveParts as getAllActivePartsSoap,
  getProduct as getProductSoap,
  getProductSellable as getProductSellableSoap,
} from './products.ts';
import type { GetProductOptions, SanmarProduct, SanmarSellableEntry } from './products.ts';
import { getInventoryLevels as getInventoryLevelsSoap } from './inventory.ts';
import type { SanmarInventoryPart } from './inventory.ts';
import { getPricing as getPricingSoap } from './pricing.ts';
import type { SanmarPricingRow } from './pricing.ts';

export type CacheRoute = 'products' | 'inventory' | 'pricing';

/** Source tag attached to every router response for observability. */
export type WithSource<T> = T & { _source: 'cache' | 'soap' };

/** Resolve {baseUrl, routes, secret} from env. Returns null when disabled. */
function readCacheConfig(): { config: CacheApiConfig; routes: Set<CacheRoute> } | null {
  const baseUrl = Deno.env.get('SANMAR_CACHE_API_URL')?.trim();
  if (!baseUrl) return null;
  const raw = Deno.env.get('SANMAR_CACHE_ROUTES') ?? '';
  const routes = new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s): s is CacheRoute => s === 'products' || s === 'inventory' || s === 'pricing'),
  );
  if (routes.size === 0) return null;
  const cron_secret = Deno.env.get('SANMAR_CACHE_API_SECRET')?.trim() || undefined;
  const timeoutRaw = Deno.env.get('SANMAR_CACHE_API_TIMEOUT_MS');
  const timeout_ms = timeoutRaw ? Number(timeoutRaw) : undefined;
  return {
    config: {
      baseUrl,
      cron_secret,
      timeout_ms: Number.isFinite(timeout_ms) ? timeout_ms : undefined,
    },
    routes,
  };
}

/** Logs cache miss/error in a single line so it's grep-able. */
function logCacheFallback(route: CacheRoute, style: string, reason: string): void {
  console.warn(
    `[sanmar/router] cache miss route=${route} style=${style} reason=${reason} — falling back to SOAP`,
  );
}

// ── getProduct ─────────────────────────────────────────────────────────────

/**
 * Fetch product metadata + variants. Tries the cache when enabled, falls
 * back to SOAP on miss / 5xx / timeout / disabled.
 *
 * `color` and `size` are accepted for API symmetry with downstream callers
 * but only `partId` is plumbed into the SOAP path (matching the existing
 * `products.ts` shape) — the cache always returns the full style and the
 * caller filters as needed.
 */
export async function getProduct(
  style_number: string,
  _color?: string,
  _size?: string,
  opts: GetProductOptions = {},
): Promise<WithSource<SanmarProduct> | WithSource<Record<string, unknown>>> {
  const cache = readCacheConfig();
  if (cache && cache.routes.has('products')) {
    try {
      const cached = await fetchProductFromCache(cache.config, style_number);
      if (cached) {
        return { ...(cached as Record<string, unknown>), _source: 'cache' };
      }
      // Cache returned 404 → falls through to SOAP without an error log.
    } catch (e) {
      logCacheFallback('products', style_number, (e as Error).message);
    }
  }
  const soap = await getProductSoap(style_number, opts);
  return { ...soap, _source: 'soap' };
}

/** Pass-through to SOAP — cache doesn't expose this microsyntax endpoint. */
export async function getProductSellable(
  productId: string,
): Promise<WithSource<SanmarSellableEntry[]>> {
  const list = await getProductSellableSoap(productId);
  // Array-with-source via Object.assign to keep array semantics intact.
  return Object.assign(list, { _source: 'soap' as const }) as WithSource<SanmarSellableEntry[]>;
}

/** Pass-through to SOAP — same reason as above. */
export async function getAllActiveParts(): Promise<
  WithSource<Array<{ styleId: string; color: string; size: string }>>
> {
  const list = await getAllActivePartsSoap();
  return Object.assign(list, { _source: 'soap' as const }) as WithSource<typeof list>;
}

// ── getInventory ───────────────────────────────────────────────────────────

/**
 * Fetch live inventory. Cache is preferred when `inventory` is enabled.
 *
 * Returns the SOAP-shaped array (or the raw cache shape) with a `_source`
 * tag spliced onto the array via Object.assign so JSON serialisation stays
 * indistinguishable from the legacy SOAP payload aside from the new field.
 */
export async function getInventory(
  style_number: string,
): Promise<WithSource<SanmarInventoryPart[]> | WithSource<Record<string, unknown>>> {
  const cache = readCacheConfig();
  if (cache && cache.routes.has('inventory')) {
    try {
      const cached = await fetchInventoryFromCache(cache.config, style_number);
      if (cached) {
        return { ...(cached as Record<string, unknown>), _source: 'cache' };
      }
    } catch (e) {
      logCacheFallback('inventory', style_number, (e as Error).message);
    }
  }
  const soap = await getInventoryLevelsSoap(style_number);
  return Object.assign(soap, { _source: 'soap' as const }) as WithSource<SanmarInventoryPart[]>;
}

// ── getPricing ─────────────────────────────────────────────────────────────

/**
 * Fetch tier pricing. Same flag rules as inventory; `partId` is plumbed
 * through to the SOAP fallback only (cache returns the full style).
 */
export async function getPricing(
  style_number: string,
  partId?: string,
): Promise<WithSource<SanmarPricingRow[]> | WithSource<Record<string, unknown>>> {
  const cache = readCacheConfig();
  if (cache && cache.routes.has('pricing')) {
    try {
      const cached = await fetchPricingFromCache(cache.config, style_number);
      if (cached) {
        return { ...(cached as Record<string, unknown>), _source: 'cache' };
      }
    } catch (e) {
      logCacheFallback('pricing', style_number, (e as Error).message);
    }
  }
  const soap = await getPricingSoap(style_number, partId);
  return Object.assign(soap, { _source: 'soap' as const }) as WithSource<SanmarPricingRow[]>;
}
