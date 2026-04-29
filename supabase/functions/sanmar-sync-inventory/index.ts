/**
 * Edge function: sanmar-sync-inventory
 *
 * Daily inventory poll. Walks every active style in `sanmar_catalog`,
 * pulls live inventory from SanMar (concurrency 4), and updates each
 * part row's `quantity_available` (totalQty across warehouses) and
 * `quantity_by_warehouse` (JSONB array of per-location detail).
 *
 * Cron-secret authenticated. Step 6 schedules this at e.g. 06:00 daily.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { errorBody } from '../_shared/sanmar-http.ts';
import { getInventoryLevels } from '../_shared/sanmar/inventory.ts';
import {
  CronAuthError,
  logSyncRun,
  requireCronSecret,
  simplePool,
  summariseError,
} from '../_shared/sanmar/sync.ts';

const CONCURRENCY = 4;

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
    console.error('[sanmar-sync-inventory] Supabase env vars not configured');
    return jsonResponse(errorBody(999, 'Internal error', 'Error'), 500);
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const startedAtMs = Date.now();
  const errors: Array<{ item: unknown; message: string }> = [];

  try {
    // ── Pull every distinct active style from the catalogue ──────────────
    // We over-fetch (style_id is stored per part so it repeats) and dedupe
    // in memory rather than relying on `.select('style_id', { distinct: true })`
    // which the supabase-js client doesn't support directly.
    const { data: catalogRows, error: selErr } = await supabase
      .from('sanmar_catalog')
      .select('style_id')
      .eq('is_active', true);
    if (selErr) {
      throw new Error(`Failed to read sanmar_catalog: ${selErr.message}`);
    }
    const styleIds = Array.from(
      new Set((catalogRows ?? []).map((r: { style_id: string }) => r.style_id).filter(Boolean)),
    );

    // ── Concurrency-capped fan-out to SanMar's inventory service ─────────
    const pool = await simplePool(styleIds, CONCURRENCY, async (s: string) => ({
      styleId: s,
      parts: await getInventoryLevels(s),
    }));
    pool.errors.forEach(({ item, error }) =>
      errors.push(summariseError({ phase: 'getInventoryLevels', styleId: item }, error)),
    );

    // ── Update each part's qty + per-warehouse JSON ──────────────────────
    let totalProcessed = 0;
    const nowIso = new Date().toISOString();
    for (const { parts } of pool.ok) {
      for (const part of parts) {
        if (!part.partId) continue;
        const { error: updErr } = await supabase
          .from('sanmar_catalog')
          .update({
            quantity_available: part.totalQty,
            quantity_by_warehouse: part.locations,
            last_synced_at: nowIso,
          })
          .eq('part_id', part.partId);
        if (updErr) {
          errors.push(summariseError({ phase: 'update', partId: part.partId }, updErr));
        } else {
          totalProcessed++;
        }
      }
    }

    const durationMs = Date.now() - startedAtMs;
    await logSyncRun(supabase, 'inventory', { totalProcessed, errors, durationMs });

    return jsonResponse({
      ok: true,
      totalStyles: styleIds.length,
      totalParts: totalProcessed,
      errorCount: errors.length,
      durationMs,
    });
  } catch (e) {
    const durationMs = Date.now() - startedAtMs;
    errors.push(summariseError({ phase: 'fatal' }, e));
    await logSyncRun(supabase, 'inventory', { totalProcessed: 0, errors, durationMs });
    console.error('[sanmar-sync-inventory] fatal error:', e);
    return jsonResponse(
      {
        ok: false,
        totalStyles: 0,
        totalParts: 0,
        errorCount: errors.length,
        durationMs,
        message: e instanceof Error ? e.message : String(e),
      },
      500,
    );
  }
});
