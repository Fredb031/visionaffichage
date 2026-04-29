/**
 * Unit tests for the SanMar sync-failure alert helper (notify.ts).
 *
 * Coverage:
 *   1. SANMAR_ALERT_WEBHOOK_URL unset → no fetch, no throw (no-op)
 *   2. Webhook returns 200 → success path, fetch called once with the
 *      Slack-compatible payload shape
 *   3. Webhook returns 500 → caught, no throw, retried once (Wave 8 dedup
 *      patch added a single retry on 5xx). Total fetch count: 2.
 *   4. (NEW, Wave 8) Dedup: with a Supabase client supplied and
 *      sanmar_alert_log already containing a recent failure row for the
 *      same sync_type, notifySyncFailure must NOT POST.
 *   5. (NEW, Wave 8) 5xx retry: with a Supabase client supplied and an
 *      empty audit table, a 500 first response triggers exactly one
 *      retry attempt — no more, no less — and an audit row is written.
 *   6. (NEW, Wave 8) 4xx never retried: a 400/404 is treated as a
 *      configuration problem, not a transient one. fetch called once.
 *
 * Vitest runs in Node; Deno.env is shimmed so the imported module's
 * Deno.env.get() lookups resolve to our test fixtures.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Per-test override for SANMAR_ALERT_WEBHOOK_URL — beforeAll wires the
// shim, individual tests mutate `envOverrides` to flip the value.
const envOverrides: Record<string, string | undefined> = {};

beforeAll(() => {
  (globalThis as any).Deno = {
    env: {
      get: (k: string) => envOverrides[k],
    },
  };
});

beforeEach(() => {
  // Default: webhook URL is unset. Each test opts in.
  for (const k of Object.keys(envOverrides)) delete envOverrides[k];
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function loadNotify() {
  return await import("../notify.ts");
}

const baseInput = {
  sync_type: "catalog" as const,
  error_count: 2,
  errors: [
    { item: { phase: "getProduct", styleId: "PC61" }, message: "SanMar 999: timeout" },
    { item: { phase: "upsert", chunkStart: 0, chunkSize: 500 }, message: "duplicate key" },
  ],
  duration_ms: 4321,
};

/**
 * Minimal stand-in for a Supabase client that exercises the two query
 * shapes notify.ts uses:
 *   - .from('sanmar_alert_log').select(...)... .maybeSingle() — dedup read
 *   - .from('sanmar_alert_log').insert(...)                  — audit write
 *
 * Each method is a vi.fn() so tests can assert call counts/arguments,
 * and the chained-builder pattern returns `self` until a terminal awaits
 * a Promise.
 */
function makeSupabaseStub(opts: {
  /** Row returned by the dedup .maybeSingle() call. null = no recent alert. */
  recentRow?: { sent_at: string } | null;
  /** Force the dedup query to error (tests fail-open behaviour). */
  selectError?: { message: string } | null;
}) {
  const insertSpy = vi.fn().mockResolvedValue({ error: null });
  const maybeSingleSpy = vi.fn().mockResolvedValue({
    data: opts.recentRow ?? null,
    error: opts.selectError ?? null,
  });

  // The select chain is .select().eq().eq().gte().order().limit().maybeSingle()
  // We return an object with each method as a vi.fn returning the same object,
  // and maybeSingle as the terminal awaitable.
  const selectChain: any = {};
  for (const m of ["select", "eq", "gte", "order", "limit"]) {
    selectChain[m] = vi.fn(() => selectChain);
  }
  selectChain.maybeSingle = maybeSingleSpy;

  const fromSpy = vi.fn((_table: string) => ({
    select: selectChain.select,
    insert: insertSpy,
  }));

  return {
    client: { from: fromSpy } as any,
    spies: { fromSpy, insertSpy, maybeSingleSpy },
  };
}

describe("notifySyncFailure", () => {
  it("is a no-op when SANMAR_ALERT_WEBHOOK_URL is unset", async () => {
    // env override deliberately not set → Deno.env.get returns undefined
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { notifySyncFailure } = await loadNotify();

    await expect(notifySyncFailure(baseInput)).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs a Slack-compatible payload when the webhook returns 200", async () => {
    envOverrides.SANMAR_ALERT_WEBHOOK_URL = "https://hooks.slack.test/services/AAA/BBB/CCC";

    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { notifySyncFailure } = await loadNotify();

    await notifySyncFailure(baseInput);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://hooks.slack.test/services/AAA/BBB/CCC");
    expect((init as RequestInit).method).toBe("POST");
    expect(((init as RequestInit).headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json",
    );

    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.text).toBe("🔴 SanMar sync FAILED: catalog");
    expect(Array.isArray(body.attachments)).toBe(true);
    expect(body.attachments[0].color).toBe("danger");
    const fields = body.attachments[0].fields as Array<{ title: string; value: string }>;
    const byTitle = Object.fromEntries(fields.map((f) => [f.title, f.value]));
    expect(byTitle.Errors).toBe("2");
    expect(byTitle.Duration).toBe("4321ms");
    expect(byTitle["First error"]).toContain("SanMar 999: timeout");
  });

  it("does not throw when the webhook returns 500 (no client → no audit, but retries once)", async () => {
    envOverrides.SANMAR_ALERT_WEBHOOK_URL = "https://hooks.slack.test/services/AAA/BBB/CCC";

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Both attempts return 500 — verifying we still don't throw and we
    // make exactly the post + 1 retry the new policy promises.
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("upstream exploded", { status: 500 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { notifySyncFailure } = await loadNotify();

    // The whole point: the sync run keeps going even when the receiver
    // is on fire. So this must resolve, not reject.
    await expect(notifySyncFailure(baseInput)).resolves.toBeUndefined();
    // Wave 8 patch: 5xx → 1 initial + 1 retry = 2 fetch calls.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalled();
    // And critically the console.error must not contain the webhook URL
    // (it embeds an authz token in the path on Slack and Zapier).
    for (const call of errorSpy.mock.calls) {
      const joined = call.map((a) => String(a)).join(" ");
      expect(joined).not.toContain("hooks.slack.test");
      expect(joined).not.toContain("AAA/BBB/CCC");
    }
  });

  // ────────────────────────────────────────────────────────────────────
  // Wave 8: dedup + retry + audit
  // ────────────────────────────────────────────────────────────────────

  it("(dedup) skips the POST when a failure alert was already sent within 30 min", async () => {
    envOverrides.SANMAR_ALERT_WEBHOOK_URL = "https://hooks.slack.test/services/AAA/BBB/CCC";

    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    // Recent row is 5 minutes old → well inside the 30-min window.
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { client, spies } = makeSupabaseStub({ recentRow: { sent_at: fiveMinAgo } });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { notifySyncFailure } = await loadNotify();
    await notifySyncFailure(baseInput, client);

    // The whole point of dedup: zero outbound webhook calls.
    expect(fetchMock).not.toHaveBeenCalled();
    // We did query the audit table.
    expect(spies.maybeSingleSpy).toHaveBeenCalledTimes(1);
    // We did NOT write a new audit row when deduped — the existing one
    // is still the most recent and a duplicate would just clutter the log.
    expect(spies.insertSpy).not.toHaveBeenCalled();
    // Operator-visible breadcrumb so log diving reveals the dedup decision.
    expect(logSpy).toHaveBeenCalled();
  });

  it("(retry) on 5xx, retries exactly once and writes one audit row", async () => {
    envOverrides.SANMAR_ALERT_WEBHOOK_URL = "https://hooks.slack.test/services/AAA/BBB/CCC";

    vi.spyOn(console, "error").mockImplementation(() => {});

    // First call 500 (transient), second call 200 (recovered).
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("upstream blip", { status: 500 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    // No recent alert → dedup gate lets us through.
    const { client, spies } = makeSupabaseStub({ recentRow: null });

    const { notifySyncFailure } = await loadNotify();
    await notifySyncFailure(baseInput, client);

    // Exactly one retry: 1 (initial) + 1 (retry) = 2. Not 3.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Audit row records the FINAL attempt's outcome (status 200).
    expect(spies.insertSpy).toHaveBeenCalledTimes(1);
    const inserted = spies.insertSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(inserted.sync_type).toBe("catalog");
    expect(inserted.alert_kind).toBe("failure");
    expect(inserted.webhook_status_code).toBe(200);
  });

  it("(no-retry) on 4xx, does NOT retry — that's a config error, not transient", async () => {
    envOverrides.SANMAR_ALERT_WEBHOOK_URL = "https://hooks.slack.test/services/AAA/BBB/CCC";

    vi.spyOn(console, "error").mockImplementation(() => {});

    // 404 = bad webhook path. Retrying won't fix a typo.
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("not found", { status: 404 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { client, spies } = makeSupabaseStub({ recentRow: null });

    const { notifySyncFailure } = await loadNotify();
    await notifySyncFailure(baseInput, client);

    // Single attempt — no retry on 4xx.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Audit row still written so ops can see the misconfiguration in the log.
    expect(spies.insertSpy).toHaveBeenCalledTimes(1);
    const inserted = spies.insertSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(inserted.webhook_status_code).toBe(404);
  });
});
