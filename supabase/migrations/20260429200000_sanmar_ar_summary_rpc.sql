-- SanMar AR Summary RPC — server-side aggregate replacement for the
-- client-side loop in src/pages/admin/AdminSanMar.tsx.
--
-- Rationale (Wave 13):
--   The Wave 12 widget pulled every "open" sanmar_orders row and folded
--   the totals client-side. That works while volume is small but
--   (a) ships all per-order PII to the browser and (b) blocks
--   non-admin role-views (e.g. president dashboards) from seeing
--   aggregate AR without inheriting RLS-level row visibility.
--
--   This RPC executes one aggregate scan in Postgres and returns a
--   single summary row. Because it's SECURITY DEFINER it bypasses RLS
--   on sanmar_orders — but we explicitly gate access to admin / president
--   roles via public.is_admin() (which already covers both — see
--   migrations/0001_auth_quotes_invites.sql:138). Non-admin callers get
--   zero rows back rather than an error so the widget can render an
--   empty state without surfacing a banner.
--
-- Status convention mirrors supabase/functions/_shared/sanmar/digest.ts:
--   status_id IS NULL OR < 80   → "open" (contributing to AR)
--   status_id = 80              → "complete / paid"
--   status_id = 99              → "cancelled"
--
-- Last-30-days window keys off created_at because the migration doesn't
-- carry a separate paid_at / closed_at column.

CREATE OR REPLACE FUNCTION public.get_sanmar_ar_summary()
RETURNS TABLE (
  open_count bigint,
  open_balance_cad numeric(12, 2),
  oldest_open_days int,
  closed_count_30d bigint,
  paid_balance_30d_cad numeric(12, 2)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Gate: admins (which by definition includes presidents per the
  -- is_admin() implementation in 0001) only. Anybody else gets zero
  -- rows back and the widget renders empty-state zeroes.
  IF NOT public.is_admin() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*) FILTER (
      WHERE status_id IS NULL OR status_id < 80
    ) AS open_count,
    COALESCE(
      SUM((order_data->>'totalAmount')::numeric)
        FILTER (WHERE status_id IS NULL OR status_id < 80),
      0
    )::numeric(12, 2) AS open_balance_cad,
    COALESCE(
      EXTRACT(
        DAY FROM
          now() - MIN(created_at) FILTER (
            WHERE status_id IS NULL OR status_id < 80
          )
      )::int,
      0
    ) AS oldest_open_days,
    COUNT(*) FILTER (
      WHERE status_id IN (80, 99)
        AND created_at >= now() - interval '30 days'
    ) AS closed_count_30d,
    COALESCE(
      SUM((order_data->>'totalAmount')::numeric)
        FILTER (
          WHERE status_id = 80
            AND created_at >= now() - interval '30 days'
        ),
      0
    )::numeric(12, 2) AS paid_balance_30d_cad
  FROM public.sanmar_orders;
END;
$$;

REVOKE ALL ON FUNCTION public.get_sanmar_ar_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_sanmar_ar_summary() TO authenticated;

COMMENT ON FUNCTION public.get_sanmar_ar_summary() IS
  'Server-side AR aggregate over sanmar_orders. Returns one row: open count/balance/oldest-days plus 30d closed count + paid balance. SECURITY DEFINER, gated by public.is_admin() (admin OR president).';
