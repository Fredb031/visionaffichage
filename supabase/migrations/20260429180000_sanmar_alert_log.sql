-- SanMar alert audit + dedup table.
--
-- Wave 8 noticed `notifySyncFailure` (TS shared layer, commit 49d8d85) has no
-- dedup: a 12-hour catalog outage would page ops 12 separate times. We need a
-- durable record of "when did we last alert for sync_type X" so the helper can
-- skip a fresh POST if it's still inside the cooldown window.
--
-- Design choices:
--   - Append-only log (one row per outbound webhook attempt) instead of a KV
--     "latest state" row. Two reasons:
--       (a) audit value — operators can ask "how many times did we alert this
--           week" and the answer is one COUNT().
--       (b) it captures the webhook's outcome (status_code, response body
--           snippet) so we can spot a misconfigured Slack URL retroactively
--           without trawling edge-function logs.
--   - `sync_type` left as TEXT rather than an enum so adding a new sync type
--     in the TS layer doesn't require a coordinated migration.
--   - `alert_kind` CHECK constrains to the three categories the TS helper
--     emits: 'failure' (the case Wave 8 cares about), plus 'recovery' /
--     'transition' so we don't have to re-migrate when those land.
--   - Index is (sync_type, sent_at DESC) — exactly the dedup query shape
--     ("most recent row for this sync_type"). LIMIT 1 on a btree DESC scan
--     is constant-time regardless of log size.
--   - RLS: admin-only SELECT. Writes happen exclusively from edge functions
--     under the service role, which bypasses RLS — so we deliberately do not
--     define any INSERT/UPDATE/DELETE policy. Anything not covered is denied
--     for non-bypass roles, which is the correct posture for an audit log.

CREATE TABLE IF NOT EXISTS public.sanmar_alert_log (
  id BIGSERIAL PRIMARY KEY,
  sync_type TEXT NOT NULL,
  alert_kind TEXT NOT NULL CHECK (alert_kind IN ('failure', 'recovery', 'transition')),
  payload JSONB NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  webhook_status_code INT,
  webhook_response_body TEXT
);

CREATE INDEX IF NOT EXISTS idx_sanmar_alert_log_sync_type_sent_at
  ON public.sanmar_alert_log (sync_type, sent_at DESC);

ALTER TABLE public.sanmar_alert_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin reads sanmar_alert_log" ON public.sanmar_alert_log;
CREATE POLICY "Admin reads sanmar_alert_log" ON public.sanmar_alert_log
  FOR SELECT TO authenticated
  USING (public.is_admin());

COMMENT ON TABLE public.sanmar_alert_log IS
  'Append-only audit + dedup table for SanMar sync webhook alerts. Service-role writes only; admin SELECT via RLS.';
