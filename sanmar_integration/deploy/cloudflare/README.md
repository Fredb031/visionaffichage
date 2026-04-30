# SanMar edge cache — Cloudflare Worker

Phase 11 deployed `sanmar-worker.ts` as a Cloudflare Worker that sits
in front of the FastAPI origin and caches the read-only
`/products`, `/inventory`, and `/pricing` endpoints with a 5-minute
TTL. Every response carries `x-edge-cache: HIT|MISS|BYPASS` so the
cache state is observable from any HTTP client.

Phase 14 added Workers Analytics Engine telemetry — every request
emits one data point so an operator can pull a 24-hour hit ratio
report without scraping logs.

## Files

| Path                  | What it does                                    |
|-----------------------|-------------------------------------------------|
| `sanmar-worker.ts`    | Worker source — proxy + cache + telemetry write |
| `wrangler.toml`       | Cloudflare deployment manifest                  |

## Deploy

```bash
cd sanmar_integration/deploy/cloudflare
wrangler deploy
```

The first deploy auto-creates the `sanmar_edge_cache` Analytics
Engine dataset on the bound account. There is no separate "create
dataset" step — Cloudflare provisions it on first write.

## Enable Analytics Engine on the Worker

Analytics Engine is enabled per-Worker via the `analytics_engine_datasets`
binding block in `wrangler.toml` (already configured here). On a new
account you may need to opt in once via the Cloudflare dashboard:

1. Sign in to the Cloudflare dashboard.
2. Open **Workers & Pages → Analytics Engine**.
3. Click **Enable Analytics Engine** if prompted (free tier covers
   small traffic — first 25M data points / month are free).
4. Re-run `wrangler deploy` to attach the binding.

Verify the binding showed up:

```bash
wrangler tail sanmar-edge-cache
# Hit a route in another terminal — you should see the request logs.
```

## Read the report locally

The report script needs read access to the account's analytics:

1. Generate a scoped API token:
   - Cloudflare dashboard → **My Profile → API Tokens → Create Token**
   - Custom token with permission `Account · Account Analytics · Read`.
   - Scope it to the single account hosting the worker.

2. Export the token + your account ID:

   ```bash
   export CLOUDFLARE_ACCOUNT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   export CLOUDFLARE_API_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

3. Run the report:

   ```bash
   python -m sanmar edge-report
   # or, equivalently:
   python -m scripts.edge_cache_report --days 1
   ```

   Sample output:

   ```
                SanMar edge cache — 24h hit ratio
   ┏━━━━━━━━━━━━━┳━━━━━━━━━━┳━━━━━━━┳━━━━━━━━┳━━━━━━━━┳━━━━━━━━━━━┓
   ┃ Operation   ┃ Requests ┃  Hits ┃ Misses ┃ Bypass ┃ Hit Ratio ┃
   ┡━━━━━━━━━━━━━╇━━━━━━━━━━╇━━━━━━━╇━━━━━━━━╇━━━━━━━━╇━━━━━━━━━━━┩
   │ products    │   12,453 │ 9,234 │  2,891 │    328 │     76.2% │
   │ inventory   │    3,890 │ 1,823 │  1,953 │    114 │     48.3% │
   │ pricing     │    1,240 │   894 │    301 │     45 │     74.8% │
   └─────────────┴──────────┴───────┴────────┴────────┴───────────┘
   ```

   Operations below the 50% hit-ratio threshold are highlighted red
   and the command exits `1` so it can be wired into cron as a
   health check:

   ```cron
   # /etc/cron.d/sanmar-edge-health
   0 * * * * sanmar /opt/sanmar/.venv/bin/python -m sanmar edge-report || \
       systemd-cat -t sanmar-edge -p err
   ```

## Troubleshooting

* **`No edge cache telemetry in the requested window.`** — either no
  traffic is flowing yet, or the worker isn't bound to the
  `ANALYTICS` dataset. Confirm `wrangler.toml` has the
  `analytics_engine_datasets` block and `wrangler deploy` was re-run
  after adding it. Analytics Engine writes are eventually consistent
  with a typical lag of 1-2 minutes.

* **`HTTP 401` from Cloudflare GraphQL** — the API token is missing
  the `Account Analytics:Read` permission. Recreate it with the
  exact permission listed above.

* **Local `wrangler dev` shows no telemetry writes** — by design.
  The `ANALYTICS` binding is unbound in dev so `env.ANALYTICS` is
  `undefined`; the worker degrades to a no-op for telemetry while
  still proxying requests.
