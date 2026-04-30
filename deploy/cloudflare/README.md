# SanMar edge cache — Cloudflare Worker deploy

This worker sits in front of the FastAPI cache (`sanmar_integration/sanmar/api/`)
and adds a 30-second edge cache for the three cacheable namespaces:

- `/products/*`
- `/inventory/*`
- `/pricing/*`

Everything else (admin, metrics, health) is passed through unchanged.

## What this gives you

- **Burst absorption.** A quote builder hammering the same style 50 times in
  20 seconds hits Cloudflare's edge POP for ~49 of those calls. Origin sees one.
- **Geographic latency wins.** Storefront users in Quebec hit a Montreal POP;
  the FastAPI box can stay in one region.
- **Independent failure domain.** If the FastAPI box hiccups, the edge keeps
  serving stale-ish data for the TTL window.

## What this does NOT do

- It does not replace the FastAPI cache — it sits in front of it.
- It does not cache writes (only `GET` is cached). Sync jobs that mutate the
  SQLite cache run separately and don't go through this worker at all.
- It does not authenticate end-users. The Supabase JWT gate happens upstream
  in the edge functions; this worker is a dumb cache.

## Deploy

```bash
cd deploy/cloudflare
npm install -g wrangler          # if you don't have it
wrangler login                   # one-time; opens a browser
```

Edit `wrangler.toml` and set `UPSTREAM_URL` to the public hostname of your
FastAPI cache (e.g. `https://sanmar-api.your-domain.com`). Then:

```bash
wrangler deploy
```

If the FastAPI sidecar is gated by a shared secret:

```bash
wrangler secret put CACHE_API_SECRET
# paste the secret when prompted — same value as the API server expects
```

## Custom domain

Add a `[[routes]]` block to `wrangler.toml`:

```toml
[[routes]]
pattern = "sanmar-cache.visionaffichage.com/*"
zone_name = "visionaffichage.com"
```

You'll need a CNAME record pointing the subdomain at the worker (Cloudflare
adds this automatically when the zone is on Cloudflare DNS).

## Wire the TS edge functions

Once the worker is up, point the Supabase edge functions at it:

```bash
supabase secrets set \
  SANMAR_CACHE_API_URL=https://sanmar-cache.visionaffichage.com \
  SANMAR_CACHE_ROUTES=products,inventory,pricing
```

To roll out incrementally: enable one route at a time
(`SANMAR_CACHE_ROUTES=products`), watch error rates for a day, then add the
next route.

## Observability

- `x-edge-cache: HIT|MISS|BYPASS` header on every response — easy to grep in
  `wrangler tail`.
- TS-side `_source: 'cache' | 'soap'` on every router response — fed into the
  admin dashboard for a hit-ratio chart.

## Rollback

```bash
supabase secrets unset SANMAR_CACHE_API_URL
```

Edge functions immediately revert to direct SOAP. The worker can stay
deployed (it's a no-op if no one calls it) or be removed via:

```bash
wrangler delete
```

## Tuning

- `EDGE_TTL_SECONDS` in `[vars]` — bump to 60–300 if your data freshness
  budget allows it. The FastAPI cache itself refreshes pricing every 24 h
  and inventory every 15 min, so 30 s of edge cache is conservative.
