-- SanMar sync schedules via pg_cron + pg_net
--
-- This migration registers three recurring jobs that POST to the SanMar
-- edge functions on a schedule:
--   - sanmar-sync-catalog       (Sunday 03:00 UTC, weekly full refresh)
--   - sanmar-sync-inventory     (daily 05:15 UTC, post-stocking levels)
--   - sanmar-reconcile-orders   (every 30 min, fast-moving order status)
--
-- The functions are invoked with the project's service-role key in the
-- Authorization header plus an additional `x-cron-secret` header that the
-- edge functions can use to assert the request originated from pg_cron.
--
-- Required GUC variables (set via `ALTER DATABASE postgres SET ...`):
--   * app.settings.supabase_url
--   * app.settings.service_role_key
--   * app.settings.cron_secret

-- Enable required extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ---------------------------------------------------------------------------
-- sanmar-sync-catalog : weekly full-catalog refresh
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  PERFORM cron.unschedule('sanmar-sync-catalog');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'sanmar-sync-catalog',
  '0 3 * * 0',  -- Sunday 03:00 UTC = ~22:00 EST Saturday (off-peak)
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/sanmar-sync-catalog',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'x-cron-secret', current_setting('app.settings.cron_secret')
    ),
    body := jsonb_build_object('triggered_by', 'pg_cron')
  );
  $$
);

-- ---------------------------------------------------------------------------
-- sanmar-sync-inventory : daily inventory level refresh
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  PERFORM cron.unschedule('sanmar-sync-inventory');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'sanmar-sync-inventory',
  '15 5 * * *',  -- Daily 05:15 UTC = ~00:15 EST (post-overnight stocking)
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/sanmar-sync-inventory',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'x-cron-secret', current_setting('app.settings.cron_secret')
    ),
    body := jsonb_build_object('triggered_by', 'pg_cron')
  );
  $$
);

-- ---------------------------------------------------------------------------
-- sanmar-reconcile-orders : every 30 min, reconcile open PO statuses
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  PERFORM cron.unschedule('sanmar-reconcile-orders');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'sanmar-reconcile-orders',
  '*/30 * * * *',  -- Every 30 minutes (orders move fast)
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/sanmar-reconcile-orders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'x-cron-secret', current_setting('app.settings.cron_secret')
    ),
    body := jsonb_build_object('triggered_by', 'pg_cron')
  );
  $$
);

-- Annotate the extension with our schedule for quick `\dx+ pg_cron` inspection
COMMENT ON EXTENSION pg_cron IS
  'SanMar sync schedules: catalog Sunday 03:00 UTC, inventory daily 05:15 UTC, order-status every 30 min';
