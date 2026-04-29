-- SanMar Step 5 — supporting indexes for the background sync edge functions.
--
-- The new partial indexes target the two hottest reads issued by the
-- background workers on every cron tick:
--
--   sanmar-reconcile-orders : SELECT WHERE (status_id IS NULL OR status_id < 80)
--                             AND created_at > now() - interval '30 days'
--   sanmar-sync-inventory   : SELECT DISTINCT style_id WHERE is_active = TRUE

-- Speed up the order reconciler query
CREATE INDEX IF NOT EXISTS idx_sanmar_orders_open ON public.sanmar_orders(status_id, created_at)
  WHERE status_id IS NULL OR status_id < 80;

-- Speed up the inventory poll active-style scan
CREATE INDEX IF NOT EXISTS idx_sanmar_catalog_style_active ON public.sanmar_catalog(style_id)
  WHERE is_active = TRUE;
