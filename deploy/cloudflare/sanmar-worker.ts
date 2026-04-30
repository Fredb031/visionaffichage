/**
 * Cloudflare Worker — edge cache for the SanMar FastAPI sidecar.
 *
 * Pattern: read-through cache against `caches.default` keyed on the full
 * request URL. Only GETs against the three cacheable namespaces are cached;
 * everything else is forwarded transparently so admin / metrics / health
 * routes keep working without staleness.
 *
 * TTL is short (30 s) because pricing and inventory shift fast — but even
 * 30 s of edge dedup absorbs an enormous share of identical SKU lookups
 * during a busy quote-builder session. Tune via the `EDGE_TTL_SECONDS`
 * binding if the operator wants longer.
 *
 * Required env (configure in `wrangler.toml` `[vars]`):
 *   - UPSTREAM_URL      base URL of the FastAPI cache (no trailing slash)
 *   - EDGE_TTL_SECONDS  optional override, defaults to 30
 *   - CACHE_API_SECRET  optional bearer forwarded upstream as Authorization
 */

export interface Env {
  UPSTREAM_URL: string;
  EDGE_TTL_SECONDS?: string;
  CACHE_API_SECRET?: string;
}

const CACHEABLE_PREFIXES = ['/products', '/inventory', '/pricing'] as const;

function isCacheable(url: URL, method: string): boolean {
  if (method !== 'GET') return false;
  return CACHEABLE_PREFIXES.some((p) => url.pathname.startsWith(p));
}

function buildUpstream(url: URL, env: Env): string {
  const base = (env.UPSTREAM_URL || '').replace(/\/$/, '');
  return base + url.pathname + url.search;
}

function forwardHeaders(req: Request, env: Env): Headers {
  const out = new Headers();
  // Pass through Accept + If-None-Match for upstream conditional GETs.
  const accept = req.headers.get('accept');
  if (accept) out.set('accept', accept);
  const inm = req.headers.get('if-none-match');
  if (inm) out.set('if-none-match', inm);
  if (env.CACHE_API_SECRET) {
    out.set('authorization', `Bearer ${env.CACHE_API_SECRET}`);
  }
  return out;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Non-cacheable: pass through unchanged.
    if (!isCacheable(url, request.method)) {
      return fetch(buildUpstream(url, env), {
        method: request.method,
        headers: forwardHeaders(request, env),
        body: request.body,
      });
    }

    const cacheKey = new Request(url.toString(), { method: 'GET' });
    const cache = caches.default;

    // Try edge cache.
    const hit = await cache.match(cacheKey);
    if (hit) {
      // Clone so headers can be mutated without affecting the cached copy.
      const out = new Response(hit.body, hit);
      out.headers.set('x-edge-cache', 'HIT');
      return out;
    }

    // Miss → fetch upstream.
    const upstreamUrl = buildUpstream(url, env);
    const upstream = await fetch(upstreamUrl, {
      method: 'GET',
      headers: forwardHeaders(request, env),
    });

    // Only memoise 2xx responses; do not poison the cache with 4xx/5xx.
    if (!upstream.ok) {
      const out = new Response(upstream.body, upstream);
      out.headers.set('x-edge-cache', 'BYPASS');
      return out;
    }

    const ttl = Number(env.EDGE_TTL_SECONDS ?? '30') || 30;
    const cached = new Response(upstream.body, upstream);
    cached.headers.set('cache-control', `public, max-age=${ttl}, s-maxage=${ttl}`);
    cached.headers.set('x-edge-cache', 'MISS');
    // Clone before put so the in-flight response body remains readable.
    await cache.put(cacheKey, cached.clone());
    return cached;
  },
} satisfies ExportedHandler<Env>;
