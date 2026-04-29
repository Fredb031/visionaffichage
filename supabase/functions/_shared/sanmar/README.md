# SanMar Canada PromoStandards — Shared Server-Side Library

This directory holds the shared SOAP client + service modules used by every
`sanmar-*` Supabase edge function. Code here runs server-side only (Deno
edge runtime). It must NEVER be imported from `src/` (browser code).

## Why server-side only

1. **Static-IP whitelisting.** SanMar gates every PromoStandards endpoint
   on a fixed set of IPs registered with their EDI team. Browser fetches
   from arbitrary client IPs are rejected at the perimeter, regardless of
   credentials. Supabase edge functions egress from a small fixed pool —
   we register that pool with SanMar, then traffic is allowed.
2. **Credentials.** The customer ID, API password, and media password
   would be bundled into the JS chunk if read with `VITE_*` env vars.
3. **CORS.** SanMar's gateway does not set `Access-Control-Allow-Origin`,
   so a browser fetch would fail before TLS even completes the handshake.

## Files

| File             | Responsibility                                                        |
| ---------------- | --------------------------------------------------------------------- |
| `client.ts`      | SOAP envelope builder, fetch + parse + error mapping, env config.     |
| `products.ts`    | `getProduct`, `getProductSellable`, `getAllActiveParts`.              |
| `inventory.ts`   | `getInventoryLevels` (per-warehouse breakdown).                       |
| `pricing.ts`     | `getPricing` (CAD, customer pricing, blank configuration).            |
| `media.ts`       | `getProductImages` (separate `SANMAR_MEDIA_PASSWORD`).                |
| `orders.ts`      | `submitOrder`, `getOrderStatus` + status enum mapping.                |

## Environment variables

Set these as Supabase secrets (NOT in `.env`, which is browser-visible):

```bash
supabase secrets set \
  SANMAR_CUSTOMER_ID=<your-canada-customer-id> \
  SANMAR_PASSWORD=<edi-registered-email> \
  SANMAR_MEDIA_PASSWORD=<media-content-password> \
  SANMAR_ENV=UAT
```

Flip `SANMAR_ENV=PROD` only after Step 5 of the operator action queue.

## Operator action queue (PDF "Establishing Web Services Access process")

Operator steps required before this integration can talk to live SanMar:

1. **Request credentials.** Email SanMar Canada's EDI team to request
   PromoStandards API access. Provide your customer account number and
   the technical contact email. They issue:
   - `customerId`
   - registered EDI email (used as the SOAP `password`)
   - separate Media Content password (used only by `media.ts`)
2. **Submit static IPs for whitelisting.** SanMar requires a fixed set
   of egress IPs. Get the Supabase edge runtime egress range from
   Supabase support and submit it to SanMar.
3. **UAT testing window.** SanMar opens UAT access first. Test every
   service module against UAT data — this Step 1 library plus the Step
   3+ edge functions exercise all six services. Verify ServiceMessages,
   timeouts, image URL parsing, order submission validation.
4. **Submit a test order.** SanMar requires a successful test PO
   submission against UAT before they'll grant production access.
5. **Cut over to PROD.** Once SanMar approves, flip `SANMAR_ENV=PROD`
   in Supabase secrets. No code changes required — the base URL switch
   is config-driven in `client.ts`.

## Step roadmap

- **Step 1 (this PR).** Build the shared library — all six service
  modules, types, error class, README. No edge functions yet.
- **Step 2.** Unit tests with mocked SOAP responses (recorded golden
  fixtures from the PDF examples).
- **Step 3.** Deploy six edge functions (`sanmar-products`,
  `sanmar-inventory`, `sanmar-pricing`, `sanmar-media`,
  `sanmar-submit-order`, `sanmar-order-status`) that import these
  shared modules and expose them over HTTP with auth + rate limiting.
- **Step 4.** Wire client UI to the live edge functions via
  `src/lib/sanmar/client.ts`. Flip `VITE_SANMAR_NEXT_GEN=true` to
  switch from stubs to real calls.
- **Step 5.** Background jobs (catalog sync, inventory poller, order
  status reconciler).

## Error handling

Every entry point throws `SanmarApiError` from `client.ts` on:

- HTTP-level network failures (with `code='network'`)
- SOAP Faults (with `code=<faultcode>`)
- ServiceMessages with severity `Error` or known error codes
  (100, 104, 105, 110, 115, 120, 125, 130, 135, 140, 145, 150,
   300, 301, 302, 600, 610, 620, 630, 999)
- Local validation failures (e.g. forbidden character in companyName,
  invalid postal code) which throw before the request goes out

Wrap edge function handlers in try/catch and surface `error.code` to
clients so they can branch on the failure shape (retry transient 600s,
flag 100s for ops, etc.).

## Step 6 — pg_cron schedules

The `*_sanmar_pg_cron.sql` migration registers three recurring jobs that
hit the Step 5 sync edge functions on a schedule via `pg_net.http_post`.

### Schedules

| Job name                  | Cron           | Cadence rationale                                                  |
| ------------------------- | -------------- | ------------------------------------------------------------------ |
| `sanmar-sync-catalog`     | `0 3 * * 0`    | Sunday 03:00 UTC — weekly full-catalog refresh in low-traffic hrs. |
| `sanmar-sync-inventory`   | `15 5 * * *`   | Daily 05:15 UTC — runs after SanMar's overnight stocking updates.  |
| `sanmar-reconcile-orders` | `*/30 * * * *` | Every 30 min — order statuses move fast (ship/track/cancel).       |

### Required Supabase secrets / GUC vars

The cron jobs read three GUC (per-database) settings to authenticate
calls to the edge functions. The operator must set them once on the
Supabase Postgres database:

```sql
ALTER DATABASE postgres
  SET app.settings.supabase_url       = 'https://<project-ref>.supabase.co';
ALTER DATABASE postgres
  SET app.settings.service_role_key   = '<service-role JWT from Supabase dashboard>';
ALTER DATABASE postgres
  SET app.settings.cron_secret        = '<random 32-char string>';
```

After running these `ALTER DATABASE` statements, the Supabase dashboard
will auto-reconnect the pg_cron worker so the new GUCs are visible.

The `cron_secret` value must also be set as a Supabase function secret
so the Step 5 edge functions can validate the inbound `x-cron-secret`
header:

```bash
supabase secrets set CRON_SECRET=<same random 32-char string>
```

### Applying the migration

```bash
# from repo root, with Supabase CLI logged in to the right project
supabase db push
```

Or, if managing migrations through Supabase dashboard, paste the contents
of `supabase/migrations/<timestamp>_sanmar_pg_cron.sql` into the SQL
editor and run.

### Verifying schedules

```sql
-- list registered jobs (should show all three sanmar-* schedules)
SELECT jobid, schedule, jobname, command, active
FROM cron.job
WHERE jobname LIKE 'sanmar-%';

-- inspect the most recent runs (success / failure / payload)
SELECT jobid, runid, job_pid, status, return_message, start_time, end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;
```

### Manual trigger (smoke test)

You can fire any of the jobs ad-hoc by calling the same `net.http_post`
the schedule runs, e.g.:

```sql
SELECT net.http_post(
  url := current_setting('app.settings.supabase_url') || '/functions/v1/sanmar-sync-inventory',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
    'x-cron-secret', current_setting('app.settings.cron_secret')
  ),
  body := jsonb_build_object('triggered_by', 'manual')
);
```
