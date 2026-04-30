# SanMar cache integration (Phase 11)

The TS edge functions can now serve product / inventory / pricing reads
from the FastAPI cache (`sanmar_integration/sanmar/api/`) instead of going
to SanMar's SOAP origin on every call. This doc covers operator-facing
flag flips, monitoring, and rollback.

## Architecture

```
                                                ┌─────────────────────┐
                                                │ Cloudflare Worker   │
                                          ┌────▶│ (30 s edge cache)   │
                                          │     └──────────┬──────────┘
 Storefront ──▶ Supabase edge function ──▶│                │
                (sanmar-products, etc.)   │                ▼
                                          │     ┌─────────────────────┐
                                          │     │ FastAPI sidecar     │
                                          │     │ (SQLite cache)      │
                                          │     └──────────┬──────────┘
                                          │                │
                                          │       (cache miss / 5xx)
                                          │                │
                                          └────────────────┴────▶ SanMar SOAP
                                                       (fallback)
```

The router (`supabase/functions/_shared/sanmar/router.ts`) is the
flag-aware dispatcher. Every response carries `_source: 'cache' | 'soap'`
so we can plot hit ratio without piggybacking on logs.

## Enabling

Set two env vars on the Supabase project:

```bash
supabase secrets set \
  SANMAR_CACHE_API_URL=https://sanmar-cache.visionaffichage.com \
  SANMAR_CACHE_ROUTES=products,inventory,pricing
```

Optional:

```bash
# Bearer auth forwarded to the FastAPI cache as `Authorization: Bearer ...`
supabase secrets set SANMAR_CACHE_API_SECRET=<shared-secret>

# Override the default 3 s abort timeout
supabase secrets set SANMAR_CACHE_API_TIMEOUT_MS=5000
```

### Per-route allowlist

`SANMAR_CACHE_ROUTES` is a comma-separated allowlist. Roll out incrementally:

| Phase     | `SANMAR_CACHE_ROUTES`             | Use case                                        |
|-----------|-----------------------------------|-------------------------------------------------|
| Bake-in   | `products`                        | Watch product reads from cache for 24 h         |
| Expand    | `products,inventory`              | Add inventory once products are stable          |
| Full      | `products,inventory,pricing`      | All three routes served from cache              |
| Drop one  | `products,pricing`                | Inventory regression — pull it back to SOAP     |

A regression on one route never breaks the others. Drop the offender from
the list and the rest keep serving from cache.

## Feature-flag matrix

| `SANMAR_CACHE_API_URL` | route in `SANMAR_CACHE_ROUTES` | Cache response | Result                                  |
|------------------------|--------------------------------|----------------|-----------------------------------------|
| unset                  | (irrelevant)                   | (n/a)          | SOAP, `_source='soap'`                  |
| set                    | yes                            | 200            | cache, `_source='cache'`                |
| set                    | yes                            | 404            | SOAP fallback, `_source='soap'`         |
| set                    | yes                            | 5xx            | warn + SOAP fallback, `_source='soap'`  |
| set                    | yes                            | timeout (3 s)  | abort + SOAP fallback, `_source='soap'` |
| set                    | NO                             | (skipped)      | SOAP, `_source='soap'`                  |

## Monitoring cache hit ratio

Every router response includes a `_source` field: `'cache'` or `'soap'`.
The admin dashboard reads it from a sample of responses and plots:

```
hit_ratio = count(_source='cache') / count(_source IN ('cache','soap'))
```

In Grafana:

1. Pipe edge-function structured logs to a log table (Supabase logs +
   Logflare, or your provider of choice).
2. Add a counter on the response `_source` field.
3. Plot `cache_count / (cache_count + soap_count)` over a 5-minute window.
4. Alert if hit ratio falls below 60 % outside of post-deploy bake-in
   windows — that signals either the FastAPI sync is broken or the edge
   worker is misrouted.

In addition, `wrangler tail` on the Cloudflare worker shows
`x-edge-cache: HIT|MISS|BYPASS` for the second (edge) layer.

## Cloudflare Worker deploy

See [`deploy/cloudflare/README.md`](../deploy/cloudflare/README.md) for the
worker-specific deploy steps.

## Rollback

If the cache misbehaves and you want to revert to SOAP-only:

```bash
supabase secrets unset SANMAR_CACHE_API_URL
```

Or, to keep the cache up but disable it for a single route:

```bash
# Was: products,inventory,pricing
supabase secrets set SANMAR_CACHE_ROUTES=products,pricing
```

Edge functions pick up the new env on the next cold start (typically
seconds). No redeploy needed.

## What's NOT cached through this layer

- **Order submission.** `sanmar-submit-order` always goes to SOAP — orders
  are writes, never read-through.
- **Order status / reconcile.** Live data, never cached.
- **Media / sync jobs.** They populate the SQLite cache; they don't read
  through it.
- **`getProductSellable` / `getAllActiveParts`.** These return a microsyntax
  catalog scan; the FastAPI cache doesn't expose an equivalent endpoint.
  They pass through to SOAP unconditionally.

## Failure modes & what they look like

| Symptom                                        | Likely cause                              | Fix                                                   |
|------------------------------------------------|-------------------------------------------|-------------------------------------------------------|
| `_source` is always `'soap'` after enabling    | env var not propagated, or worker offline | Check `supabase secrets list`; curl the worker        |
| Hit ratio drops to 0 %                         | SQLite cache wiped or sync job dead       | Inspect `sanmar_integration` logs; re-run sync        |
| Edge functions slow + 502s                     | FastAPI cache slow, no 3 s timeout firing | Lower `SANMAR_CACHE_API_TIMEOUT_MS`                   |
| `wrangler tail` shows all `x-edge-cache: BYPASS` | Upstream returning 4xx/5xx              | Look at FastAPI logs; cache only stores 2xx           |

## Testing

```bash
pnpm test --run supabase/functions/_shared/sanmar/__tests__/
```

Covers the cache HTTP client (`cache_api.test.ts`) and the feature-flag
dispatcher (`router.test.ts`). The full feature-flag matrix above is
exercised; a regression in any leg fails one of those tests.
