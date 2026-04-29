/**
 * Edge function: sanmar-reconcile-orders
 *
 * Polls SanMar for the latest status of every open order in our
 * sanmar_orders table. "Open" = status_id IS NULL OR status_id < 80
 * (80 = complete, 99 = cancelled).
 *
 * The PDF says only the past 14 days are queryable on the OrderStatus
 * service; we widen to 30 days as a safety buffer for slow-moving rush
 * orders. Status transitions to 80 (complete) or 99 (cancelled) trigger
 * a notification — sent via the configured Zapier webhook if available,
 * otherwise just logged for the operator to chase.
 *
 * Cron-secret authenticated. Step 6 schedules this hourly (or whatever
 * cadence ops decides on).
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { errorBody } from '../_shared/sanmar-http.ts';
import { getOrderStatus, type SanmarOrderStatus } from '../_shared/sanmar/orders.ts';
import {
  CronAuthError,
  logSyncRun,
  requireCronSecret,
  simplePool,
  summariseError,
} from '../_shared/sanmar/sync.ts';

const CONCURRENCY = 4;
const TERMINAL_STATUS_IDS = new Set([80, 99]);

interface OpenOrderRow {
  id: string;
  va_order_id: string;
  status_id: number | null;
  status_name: string | null;
}

/** Fire-and-forget terminal-status notification. We never let webhook
 * failures bubble up into the sync run — the DB has already been
 * updated, and the sync_log will record the error. */
async function notifyTerminalStatus(
  vaOrderId: string,
  prevStatusId: number | null,
  newStatusId: number,
  newStatusName: string,
): Promise<void> {
  console.log(
    `[sanmar-reconcile-orders] Terminal transition: order=${vaOrderId} ${prevStatusId ?? 'null'} → ${newStatusId} (${newStatusName})`,
  );
  const webhookUrl =
    Deno.env.get('VITE_ZAPIER_MAIL_WEBHOOK') ??
    Deno.env.get('ZAPIER_MAIL_WEBHOOK') ??
    '';
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'sanmar_order_terminal',
        va_order_id: vaOrderId,
        previous_status_id: prevStatusId,
        status_id: newStatusId,
        status_name: newStatusName,
        ts: new Date().toISOString(),
      }),
    });
  } catch (e) {
    console.error('[sanmar-reconcile-orders] Zapier webhook failed:', e);
  }
}

Deno.serve(async (req) => {
  const pre = handleCors(req);
  if (pre) return pre;

  if (req.method !== 'POST') {
    return new Response(JSON.stringify(errorBody(140, 'Method not allowed')), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    requireCronSecret(req);
  } catch (e) {
    if (e instanceof CronAuthError) {
      return jsonResponse(errorBody(300, e.message, 'Error'), 401);
    }
    throw e;
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) {
    console.error('[sanmar-reconcile-orders] Supabase env vars not configured');
    return jsonResponse(errorBody(999, 'Internal error', 'Error'), 500);
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const startedAtMs = Date.now();
  const errors: Array<{ item: unknown; message: string }> = [];

  try {
    // ── Find every open order in the last 30 days ────────────────────────
    // PostgREST doesn't accept a SQL fragment for status_id < 80 OR IS NULL
    // in a single .or() with a bare comparison — split and combine.
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: openRows, error: selErr } = await supabase
      .from('sanmar_orders')
      .select('id, va_order_id, status_id, status_name')
      .gt('created_at', thirtyDaysAgo)
      .or('status_id.is.null,status_id.lt.80');
    if (selErr) {
      throw new Error(`Failed to read sanmar_orders: ${selErr.message}`);
    }
    const openOrders = (openRows ?? []) as OpenOrderRow[];

    // ── Concurrency-capped fan-out to OrderStatus service ────────────────
    const pool = await simplePool(openOrders, CONCURRENCY, async (row: OpenOrderRow) => {
      const statuses = await getOrderStatus(1, row.va_order_id);
      return { row, statuses };
    });
    pool.errors.forEach(({ item, error }) =>
      errors.push(
        summariseError({ phase: 'getOrderStatus', vaOrderId: (item as OpenOrderRow).va_order_id }, error),
      ),
    );

    // ── Persist the latest status per order ──────────────────────────────
    let totalProcessed = 0;
    const nowIso = new Date().toISOString();
    for (const { row, statuses } of pool.ok) {
      // Pick the freshest detail across whatever the service returned.
      // SanMar can return an array of OrderStatus per PO if the order
      // shipped from multiple warehouses — pick the highest statusId
      // (further along in the lifecycle) so we don't regress a partial
      // shipment back to "received".
      const latest = pickLatestStatus(statuses);
      if (!latest) {
        errors.push(summariseError({ phase: 'no-status', vaOrderId: row.va_order_id }, 'No status detail returned'));
        continue;
      }
      const { error: updErr } = await supabase
        .from('sanmar_orders')
        .update({
          status_id: latest.statusId,
          status_name: latest.statusName,
          expected_ship_date: latest.expectedShipDate || null,
          last_polled_at: nowIso,
        })
        .eq('id', row.id);
      if (updErr) {
        errors.push(summariseError({ phase: 'update', vaOrderId: row.va_order_id }, updErr));
        continue;
      }
      totalProcessed++;

      // Terminal-status notification — fire only on the *transition* into
      // 80/99, not every poll once we're already terminal.
      const prev = row.status_id;
      if (TERMINAL_STATUS_IDS.has(latest.statusId) && !TERMINAL_STATUS_IDS.has(prev ?? -1)) {
        await notifyTerminalStatus(row.va_order_id, prev, latest.statusId, latest.statusName);
      }
    }

    const durationMs = Date.now() - startedAtMs;
    await logSyncRun(supabase, 'order_status', { totalProcessed, errors, durationMs });

    return jsonResponse({
      ok: true,
      totalProcessed,
      totalOpen: openOrders.length,
      errorCount: errors.length,
      durationMs,
    });
  } catch (e) {
    const durationMs = Date.now() - startedAtMs;
    errors.push(summariseError({ phase: 'fatal' }, e));
    await logSyncRun(supabase, 'order_status', { totalProcessed: 0, errors, durationMs });
    console.error('[sanmar-reconcile-orders] fatal error:', e);
    return jsonResponse(
      {
        ok: false,
        totalProcessed: 0,
        totalOpen: 0,
        errorCount: errors.length,
        durationMs,
        message: e instanceof Error ? e.message : String(e),
      },
      500,
    );
  }
});

/** Pick the most-advanced statusId from a (potentially multi-warehouse)
 * OrderStatus[] response. Returns null if there's no detail. */
function pickLatestStatus(
  statuses: SanmarOrderStatus[],
): { statusId: number; statusName: string; expectedShipDate: string } | null {
  let best: { statusId: number; statusName: string; expectedShipDate: string } | null = null;
  for (const s of statuses) {
    for (const d of s.orderStatusDetails) {
      if (!best || d.statusId > best.statusId) {
        best = {
          statusId: d.statusId,
          statusName: d.statusName,
          expectedShipDate: d.expectedShipDate,
        };
      }
    }
  }
  return best;
}
