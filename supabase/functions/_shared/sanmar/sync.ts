/**
 * Shared sync infra for the SanMar background edge functions
 * (sanmar-sync-catalog, sanmar-sync-inventory, sanmar-reconcile-orders).
 *
 * These functions are invoked by pg_cron (Step 6 dispatches the SQL) and
 * are not user-facing — they authenticate via a shared secret in the
 * `x-cron-secret` header rather than a Supabase JWT. The catalog rebuild
 * is *also* operator-triggered from the AdminSanMar dashboard, but the
 * dashboard simply forwards the same `x-cron-secret` header.
 *
 * Three primitives:
 *   simplePool       — bounded promise pool (concurrency cap 4 by default)
 *   requireCronSecret — header check, throws CronAuthError on mismatch
 *   logSyncRun       — standard insert into public.sanmar_sync_log
 */

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

// ── Cron auth ─────────────────────────────────────────────────────────────

/** Thrown when the `x-cron-secret` header is missing or wrong. The edge
 * function dispatcher converts this into a 401 response. */
export class CronAuthError extends Error {
  constructor(message = 'Invalid or missing cron secret') {
    super(message);
    this.name = 'CronAuthError';
  }
}

/**
 * Verify the request carries the shared cron secret. Compares the
 * `x-cron-secret` request header against the `CRON_SECRET` env var. Throws
 * `CronAuthError` if the env var is unset or the header doesn't match.
 *
 * The comparison is constant-time-ish: we always compare the full strings
 * even if lengths differ (no early return on length mismatch) to avoid
 * trivial timing leaks. The secret is shared between pg_cron and the
 * AdminSanMar "Synchroniser maintenant" button — both must send the same
 * value.
 */
export function requireCronSecret(req: Request): void {
  const expected = Deno.env.get('CRON_SECRET') ?? '';
  if (!expected) {
    throw new CronAuthError('CRON_SECRET env var is not configured');
  }
  const provided = req.headers.get('x-cron-secret') ?? '';
  // Constant-time compare on equal-length strings; for unequal lengths we
  // still walk the shorter one so total work is bounded but the result is
  // always false.
  let mismatch = expected.length === provided.length ? 0 : 1;
  const len = Math.min(expected.length, provided.length);
  for (let i = 0; i < len; i++) {
    mismatch |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  if (mismatch !== 0) {
    throw new CronAuthError();
  }
}

// ── Concurrency pool ──────────────────────────────────────────────────────

export interface PoolResult<T, R> {
  ok: R[];
  errors: Array<{ item: T; error: unknown }>;
}

/**
 * Run `fn(item)` for each item in `items` with at most `concurrency`
 * promises in flight. Failures are collected into the `errors` array
 * rather than aborting the run — sync jobs prefer "best effort across the
 * full set" over "fail fast on first error".
 *
 * Maintains result ordering by index so callers can correlate `ok[i]`
 * with `items[i]` after filtering errors out — actually, since errors
 * are pulled out, the `ok` array contains only successful results in
 * the order they completed. Use the `errors` array if you need the
 * failed items.
 *
 * Concurrency cap of 4 keeps us comfortably under SanMar's per-IP limit
 * and avoids exhausting the edge function's outbound socket pool.
 */
export async function simplePool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<PoolResult<T, R>> {
  const ok: R[] = [];
  const errors: Array<{ item: T; error: unknown }> = [];
  const cap = Math.max(1, Math.floor(concurrency));
  let cursor = 0;

  async function worker(): Promise<void> {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      const item = items[idx];
      try {
        const result = await fn(item);
        ok.push(result);
      } catch (error) {
        errors.push({ item, error });
      }
    }
  }

  const workerCount = Math.min(cap, items.length);
  const workers: Promise<void>[] = [];
  for (let i = 0; i < workerCount; i++) workers.push(worker());
  await Promise.all(workers);

  return { ok, errors };
}

// ── Sync log ──────────────────────────────────────────────────────────────

export type SyncType = 'catalog' | 'inventory' | 'order_status';

export interface SyncRunSummary {
  totalProcessed: number;
  errors: Array<{ item?: unknown; message: string }>;
  durationMs: number;
}

/**
 * Insert a row into `public.sanmar_sync_log`. We swallow insert failures
 * (logged to console) so an observability outage never tanks the actual
 * sync — the data has already been written to its target table.
 */
export async function logSyncRun(
  supabase: SupabaseClient,
  syncType: SyncType,
  summary: SyncRunSummary,
): Promise<void> {
  const { error } = await supabase.from('sanmar_sync_log').insert({
    sync_type: syncType,
    total_processed: summary.totalProcessed,
    errors: summary.errors.length ? summary.errors : null,
    duration_ms: summary.durationMs,
  });
  if (error) {
    console.error(`[sanmar-sync] sanmar_sync_log insert failed for ${syncType}:`, error);
  }
}

/** Normalise an unknown error into a structured `{ item, message }` row
 * suitable for the sanmar_sync_log JSONB column. */
export function summariseError(item: unknown, error: unknown): { item: unknown; message: string } {
  let message: string;
  if (error instanceof Error) message = error.message;
  else if (typeof error === 'string') message = error;
  else {
    try {
      message = JSON.stringify(error);
    } catch {
      message = String(error);
    }
  }
  return { item, message };
}
