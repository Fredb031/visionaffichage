/**
 * Proactive failure alerts for the SanMar sync edge functions.
 *
 * The dashboard surfaces sync failures retrospectively (operators have to
 * remember to look). This helper pushes a Slack-compatible payload to a
 * webhook URL the moment a sync run finishes with errors, so an operator
 * gets pinged in real time.
 *
 * The payload shape is the standard Slack incoming-webhook
 * "text + attachments" envelope — Zapier "Catch Hook" triggers happily
 * accept the same JSON, so a single env var (SANMAR_ALERT_WEBHOOK_URL)
 * works for both routing options.
 *
 * Design rules:
 *   - Optional. If the env var is unset, this is a no-op (don't crash).
 *   - Non-blocking. The webhook POST is bounded by a short timeout so it
 *     can't hold the sync run open if the receiver is slow.
 *   - Non-cascading. Any failure (network, non-2xx, timeout) is caught
 *     and logged — never re-thrown. The sync result must not depend on
 *     a third-party webhook being healthy.
 *   - No secret leakage. Neither the webhook URL nor any other secret
 *     is echoed in the payload or the console logs we emit.
 *   - Deduped. If we already alerted for this sync_type within the last
 *     DEDUP_WINDOW_MS (30 min), skip the outbound POST. Wave 8 noticed
 *     a 12-hour outage was paging ops 12 times.
 *   - Resilient on transient failures. On a 5xx from the webhook we retry
 *     once after a short backoff; on a 4xx we give up immediately (4xx
 *     is a config issue — retrying won't fix a bad URL).
 *   - Audited. Every outbound attempt (success or failure) writes a row
 *     to sanmar_alert_log with the response status_code + body snippet.
 *     That same table is the source of truth for the dedup check.
 */

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import type { SyncType } from './sync.ts';

export interface NotifySyncFailureInput {
  sync_type: SyncType;
  error_count: number;
  errors: Array<{ item?: unknown; message: string }>;
  duration_ms: number;
}

/** Bound how long we'll wait on the webhook before giving up. The sync
 * caller is `await`ing us, so we can't hang forever. 3s is plenty for a
 * Slack/Zapier ingest endpoint; anything slower is a receiver problem
 * the sync job shouldn't be punished for. */
const WEBHOOK_TIMEOUT_MS = 3000;

/** Cooldown window for dedup. If the most recent failure alert for the
 * same sync_type is younger than this, we skip the outbound POST. 30 min
 * is the smallest window that defuses Wave 8's "12 alerts in 12 hours"
 * scenario while still catching genuinely fresh recurrences (e.g. a
 * partial recovery followed by a re-failure later that day). */
const DEDUP_WINDOW_MS = 30 * 60 * 1000;

/** Backoff before the single 5xx retry. Short on purpose — the sync run
 * is `await`ing us and we already paid one WEBHOOK_TIMEOUT_MS. */
const RETRY_BACKOFF_MS = 1000;

/** Cap on the response body we persist into sanmar_alert_log so a chatty
 * 5xx HTML page doesn't bloat the audit table. */
const RESPONSE_BODY_MAX = 2000;

/** Truncate a long error string for the Slack attachment "First error"
 * field — Slack will render the full string but ops only need the lede. */
function snippet(s: string, max = 300): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

/** Sleep helper for the retry backoff. Kept tiny so tests can override
 * via vi.useFakeTimers() if they want zero-wait runs. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface RecentAlertRow {
  sent_at: string;
}

/**
 * Has there been a 'failure' alert for this sync_type within the dedup
 * window? Returns the timestamp of the most recent row if so, otherwise
 * null. A query failure is treated as "no recent alert" (fail-open) —
 * we'd rather double-page than silently swallow a genuine failure
 * because the audit table is briefly unavailable.
 */
async function findRecentFailureAlert(
  supabase: SupabaseClient,
  sync_type: SyncType,
): Promise<string | null> {
  const cutoff = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();
  const { data, error } = await supabase
    .from('sanmar_alert_log')
    .select('sent_at')
    .eq('sync_type', sync_type)
    .eq('alert_kind', 'failure')
    .gte('sent_at', cutoff)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle<RecentAlertRow>();
  if (error) {
    console.error(
      `[sanmar-notify] dedup query failed for ${sync_type}: ${error.message} — falling open`,
    );
    return null;
  }
  return data?.sent_at ?? null;
}

/**
 * Persist one row describing the outbound webhook attempt. Best-effort:
 * any insert error is logged but never re-thrown. The audit row is nice
 * to have, but the sync run must not fail because the audit table is
 * unreachable.
 */
async function recordAlert(
  supabase: SupabaseClient,
  sync_type: SyncType,
  alert_kind: 'failure' | 'recovery' | 'transition',
  payload: unknown,
  webhook_status_code: number | null,
  webhook_response_body: string | null,
): Promise<void> {
  const { error } = await supabase.from('sanmar_alert_log').insert({
    sync_type,
    alert_kind,
    payload,
    webhook_status_code,
    webhook_response_body: webhook_response_body
      ? webhook_response_body.slice(0, RESPONSE_BODY_MAX)
      : null,
  });
  if (error) {
    console.error(
      `[sanmar-notify] failed to record alert for ${sync_type}: ${error.message}`,
    );
  }
}

interface AttemptResult {
  status: number | null;
  body: string | null;
  /** True when the response was a 5xx — caller decides whether to retry. */
  retryable: boolean;
}

/**
 * One POST to the webhook with an abort-controlled timeout. Returns a
 * structured result rather than throwing so the caller can decide on
 * retry vs. give-up without try/catch gymnastics. A network error or
 * timeout is reported as `status=null, retryable=true` (we treat
 * connection-level failures the same as 5xx — almost always transient).
 */
async function postWebhookOnce(
  webhookUrl: string,
  payload: unknown,
  sync_type: SyncType,
): Promise<AttemptResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    let body: string | null = null;
    try {
      body = await res.text();
    } catch {
      // Body read failure is non-fatal — we still got a status code.
      body = null;
    }
    if (!res.ok) {
      // Note: deliberately do NOT log webhookUrl — it is a secret-bearing
      // URL (Slack and Zapier both embed an authz token in the path).
      console.error(
        `[sanmar-notify] alert webhook returned non-2xx for ${sync_type}: ${res.status}`,
      );
    }
    return { status: res.status, body, retryable: res.status >= 500 && res.status < 600 };
  } catch (e) {
    // Same caveat re: not logging the URL. We only log the error message.
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[sanmar-notify] alert webhook failed for ${sync_type}: ${message}`);
    // Network/timeout errors are treated as transient → retryable.
    return { status: null, body: message, retryable: true };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * POST a failure summary to `SANMAR_ALERT_WEBHOOK_URL` if configured.
 *
 * No-op when:
 *   - the env var is unset (intentionally optional in dev / pre-go-live)
 *   - `error_count` is 0 (callers are expected to gate on this anyway,
 *     but we double-check so accidental empty-error notifications never
 *     spam the channel)
 *   - we already alerted for this `sync_type` within DEDUP_WINDOW_MS and
 *     a Supabase client was provided to query the audit table
 *
 * On a 5xx response or network error, we retry exactly once after
 * RETRY_BACKOFF_MS. 4xx responses are NOT retried — they indicate a
 * misconfigured webhook URL or invalid payload, and retrying won't fix
 * either.
 *
 * Slack-compatible JSON shape:
 * ```json
 * {
 *   "text": "🔴 SanMar sync FAILED: catalog",
 *   "attachments": [{
 *     "color": "danger",
 *     "fields": [
 *       {"title": "Errors",     "value": "3",      "short": true},
 *       {"title": "Duration",   "value": "1234ms", "short": true},
 *       {"title": "First error","value": "...",    "short": false}
 *     ]
 *   }]
 * }
 * ```
 *
 * @param input  Failure summary to format into the webhook payload.
 * @param supabase Optional service-role client. When provided we (a) skip
 *   the POST if the dedup window says we already alerted, and (b) record
 *   each outbound attempt in `sanmar_alert_log` for audit. When omitted
 *   the function falls back to its pre-dedup behaviour (one POST, no
 *   audit row) — kept for unit tests and for any caller that doesn't yet
 *   thread an admin client through.
 */
export async function notifySyncFailure(
  input: NotifySyncFailureInput,
  supabase?: SupabaseClient,
): Promise<void> {
  const { sync_type, error_count, errors, duration_ms } = input;

  // Skip silently — no env var configured.
  const webhookUrl = Deno.env.get('SANMAR_ALERT_WEBHOOK_URL') ?? '';
  if (!webhookUrl) return;

  // Defensive: caller is meant to gate on errors.length > 0 but if a
  // zero-error notification slips through we silently skip.
  if (error_count <= 0) return;

  // Dedup gate: only effective when the caller wired through a client.
  if (supabase) {
    const recent = await findRecentFailureAlert(supabase, sync_type);
    if (recent) {
      console.log(
        `[sanmar-notify] deduped ${sync_type} failure alert (last sent ${recent}, window=${DEDUP_WINDOW_MS}ms)`,
      );
      return;
    }
  }

  const firstErrorMessage = errors[0]?.message ?? '(no error detail captured)';

  const payload = {
    text: `🔴 SanMar sync FAILED: ${sync_type}`,
    attachments: [
      {
        color: 'danger',
        fields: [
          { title: 'Errors', value: String(error_count), short: true },
          { title: 'Duration', value: `${duration_ms}ms`, short: true },
          { title: 'First error', value: snippet(firstErrorMessage), short: false },
        ],
      },
    ],
  };

  // First attempt.
  let result = await postWebhookOnce(webhookUrl, payload, sync_type);

  // 5xx / network-error retry path. 4xx is NOT retried.
  if (result.retryable) {
    await sleep(RETRY_BACKOFF_MS);
    result = await postWebhookOnce(webhookUrl, payload, sync_type);
  }

  // Audit row, regardless of outcome — service role writes bypass RLS.
  if (supabase) {
    await recordAlert(
      supabase,
      sync_type,
      'failure',
      payload,
      result.status,
      result.body,
    );
  }
}
