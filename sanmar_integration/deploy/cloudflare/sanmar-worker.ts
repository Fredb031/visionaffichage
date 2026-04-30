/**
 * SanMar edge cache Cloudflare Worker (Phase 11) + Analytics Engine
 * telemetry (Phase 14).
 *
 * Sits in front of the FastAPI origin and caches read-only operations
 * (products / inventory / pricing) at Cloudflare's edge. Every response
 * carries an `x-edge-cache: HIT|MISS|BYPASS` header so operators can
 * see what happened without parsing access logs.
 *
 * Phase 14: each request also writes one data point to a Workers
 * Analytics Engine dataset (`sanmar_edge_cache`) so the
 * `python -m sanmar edge-report` command can render a 24h hit-ratio
 * table sourced from Cloudflare's GraphQL API. The binding is
 * null-safe — when `env.ANALYTICS` is undefined (local `wrangler dev`
 * without the binding) the worker degrades to a no-op write.
 *
 * Schema written per request:
 *   blobs   = [http_method, url_pathname, outcome]
 *             outcome ∈ {"hit", "miss", "bypass"}
 *   doubles = [timestamp_ms]
 *   indexes = [operation]   ← first path segment, e.g. "products"
 */

export interface Env {
  /** Origin URL of the FastAPI app (e.g. https://sanmar-api.visionaffichage.ca). */
  ORIGIN_URL: string;
  /** Optional Workers Analytics Engine dataset. Unbound in dev. */
  ANALYTICS?: AnalyticsEngineDataset;
}

/** Minimal type for the Analytics Engine binding so we don't need the
 * full @cloudflare/workers-types dep. */
interface AnalyticsEngineDataset {
  writeDataPoint(point: {
    blobs?: string[];
    doubles?: number[];
    indexes?: string[];
  }): void;
}

type CacheStatus = "HIT" | "MISS" | "BYPASS";

const CACHEABLE_OPERATIONS = new Set([
  "products",
  "inventory",
  "pricing",
]);

const DEFAULT_TTL_SECONDS = 300; // 5 minutes — matches FastAPI LRU TTL.

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const operation = url.pathname.split("/").filter(Boolean)[0] || "unknown";

    // Non-GET requests bypass the cache entirely (writes must always
    // hit origin) — same for any operation we haven't whitelisted.
    if (request.method !== "GET" || !CACHEABLE_OPERATIONS.has(operation)) {
      const upstream = await fetch(buildOriginUrl(env, url), request);
      const response = withEdgeHeader(upstream, "BYPASS");
      logTelemetry(env, request, url, "BYPASS", operation, ctx);
      return response;
    }

    const cache = caches.default;
    const cacheKey = new Request(url.toString(), { method: "GET" });

    let edgeStatus: CacheStatus;
    let response = await cache.match(cacheKey);

    if (response) {
      edgeStatus = "HIT";
    } else {
      edgeStatus = "MISS";
      const upstream = await fetch(buildOriginUrl(env, url), {
        method: "GET",
        headers: request.headers,
      });
      // Only cache 200s — never poison the cache with a 5xx.
      if (upstream.ok) {
        response = new Response(upstream.body, upstream);
        response.headers.set(
          "cache-control",
          `public, max-age=${DEFAULT_TTL_SECONDS}`
        );
        // Clone before write — body can only be consumed once.
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
      } else {
        response = upstream;
      }
    }

    const finalResponse = withEdgeHeader(response, edgeStatus);
    logTelemetry(env, request, url, edgeStatus, operation, ctx);
    return finalResponse;
  },
};

function buildOriginUrl(env: Env, incoming: URL): string {
  const origin = new URL(env.ORIGIN_URL);
  origin.pathname = incoming.pathname;
  origin.search = incoming.search;
  return origin.toString();
}

function withEdgeHeader(resp: Response, status: CacheStatus): Response {
  // Headers are immutable on the original Response — clone first.
  const out = new Response(resp.body, resp);
  out.headers.set("x-edge-cache", status);
  return out;
}

/**
 * Fire-and-forget telemetry write. Null-safe — `env.ANALYTICS` is
 * undefined when the binding isn't configured (local dev).
 */
function logTelemetry(
  env: Env,
  request: Request,
  url: URL,
  status: CacheStatus,
  operation: string,
  ctx: ExecutionContext
): void {
  if (!env.ANALYTICS) return;
  try {
    env.ANALYTICS.writeDataPoint({
      blobs: [
        request.method,
        url.pathname,
        status === "HIT" ? "hit" : status === "MISS" ? "miss" : "bypass",
      ],
      doubles: [Date.now()],
      indexes: [operation],
    });
  } catch {
    // Never let telemetry failures take down the request path.
  }
}
