// Outlook / Zapier send-test helper.
//
// The admin email template editor needs a way to fire a real test
// message off to Outlook so the admin can verify what the recipient
// actually sees (line breaks, image hosting, spam posture) instead of
// just the in-browser preview. Outlook itself has no public send-from-
// browser API that works without an auth dance we don't want the admin
// to walk through every session. The practical integration is:
//
//   1. Admin sets up a Zapier "Catch Hook" trigger.
//   2. The Zap's action is "Send Outlook Email" with fields mapped from
//      the hook payload (to / subject / body).
//   3. We POST { to, subject, html, sentBy, sentAt } at the webhook URL.
//
// The webhook URL is admin-configurable — we never bake a personal
// endpoint into the bundle. Resolution order:
//   a) VITE_ZAPIER_MAIL_WEBHOOK (build-time env)
//   b) vision-zapier-mail-webhook localStorage key (runtime, per-device)
//   c) reject with a readable error asking the admin to configure one
//
// Every attempt is appended to a capped ring-buffer in localStorage
// (`vision-email-sent-log`, cap 200) so the editor page can show a
// recent-sends panel without needing a round-trip to a backend log.

export interface SendTestEmailArgs {
  to: string;
  subject: string;
  html: string;
  /** Optional override; defaults to resolving via env/localStorage. */
  webhookUrl?: string;
  /** Optional override; defaults to empty. */
  sentBy?: string;
}

export type SendTestEmailResult =
  | { ok: true; messageId?: string }
  | { ok: false; error: string };

export interface SentLogEntry {
  /** ISO-8601 timestamp. */
  sentAt: string;
  to: string;
  subject: string;
  /** Template identifier if known, else a best-effort label. */
  template?: string;
  /** 'ok' on 2xx, 'fail' on network/4xx/5xx. */
  status: 'ok' | 'fail';
  /** Server-returned message id when available. */
  messageId?: string;
  /** Human-readable error when status === 'fail'. */
  error?: string;
}

export const SENT_LOG_KEY = 'vision-email-sent-log';
export const WEBHOOK_KEY = 'vision-zapier-mail-webhook';
const SENT_LOG_CAP = 200;

/** Resolve the configured Zapier webhook URL, or null if none set. */
export function getConfiguredWebhook(): string | null {
  // Build-time env wins — the site owner can bake their preferred
  // endpoint into a deploy without relying on localStorage that might
  // be wiped between browser sessions.
  const envUrl = typeof import.meta !== 'undefined' ? (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_ZAPIER_MAIL_WEBHOOK : undefined;
  if (typeof envUrl === 'string' && envUrl.trim().length > 0) return envUrl.trim();
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(WEBHOOK_KEY);
      if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim();
    }
  } catch {
    // private mode / disabled storage — fall through to null
  }
  return null;
}

/** Persist the admin-provided webhook URL. Pass null/empty to clear. */
export function setConfiguredWebhook(url: string | null): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (!url || url.trim().length === 0) {
      localStorage.removeItem(WEBHOOK_KEY);
      return;
    }
    localStorage.setItem(WEBHOOK_KEY, url.trim());
  } catch (err) {
    console.warn('[outlook] failed to persist webhook url:', err);
  }
}

function isHttpsUrl(raw: string): boolean {
  // HTTPS-only by design — the request body carries the rendered email
  // (recipient, subject, full HTML), so allowing http:// would let a
  // misconfigured or hijacked endpoint receive admin email content over
  // plaintext. Zapier "Catch Hook" URLs are always https://hooks.zapier
  // .com/..., and every other realistic webhook host (Make, n8n cloud,
  // self-hosted behind a proxy) terminates TLS, so this is a strict
  // tightening with no legitimate caller affected.
  try {
    const u = new URL(raw);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

function readLog(): SentLogEntry[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SENT_LOG_KEY) : null;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Defensive filter — a malformed devtools write could slip a
    // non-object through and crash the Recent sends panel render.
    return parsed.filter((e): e is SentLogEntry =>
      !!e && typeof e === 'object' &&
      typeof (e as SentLogEntry).sentAt === 'string' &&
      typeof (e as SentLogEntry).to === 'string' &&
      typeof (e as SentLogEntry).subject === 'string' &&
      ((e as SentLogEntry).status === 'ok' || (e as SentLogEntry).status === 'fail'),
    );
  } catch {
    return [];
  }
}

function writeLog(entries: SentLogEntry[]): void {
  try {
    // Cap at SENT_LOG_CAP, newest first — drop the oldest by slicing
    // from the start of the tail. We keep newest-first so the "last 10"
    // consumer can just slice(0, 10) without sorting.
    const capped = entries.slice(0, SENT_LOG_CAP);
    localStorage.setItem(SENT_LOG_KEY, JSON.stringify(capped));
  } catch (err) {
    console.warn('[outlook] failed to persist sent log:', err);
  }
}

/** Append an entry to the sent log (newest first). Exported so callers
 * can stamp extra metadata (e.g. the template id) alongside the send. */
export function appendSentLog(entry: SentLogEntry): SentLogEntry[] {
  const existing = readLog();
  const next = [entry, ...existing].slice(0, SENT_LOG_CAP);
  writeLog(next);
  return next;
}

/** Read the current sent-log tail, newest first. */
export function readSentLog(): SentLogEntry[] {
  return readLog();
}

/** Clear the sent log. Used by the admin 'Clear log' affordance. */
export function clearSentLog(): void {
  try {
    localStorage.removeItem(SENT_LOG_KEY);
  } catch (err) {
    console.warn('[outlook] failed to clear sent log:', err);
  }
}

/**
 * Fire a test email via the configured Zapier webhook. Returns a
 * discriminated-union result rather than throwing so the caller can
 * toast success/fail without wrapping every call in try/catch.
 *
 * A log entry is appended on both success and failure so the admin can
 * see the attempt regardless of outcome.
 */
export async function sendTestEmail(
  args: SendTestEmailArgs & { template?: string },
): Promise<SendTestEmailResult> {
  const { to, subject, html, webhookUrl, sentBy, template } = args;
  const sentAt = new Date().toISOString();

  const trimmedTo = (to ?? '').trim();
  if (!trimmedTo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedTo)) {
    const error = 'Adresse de destination invalide.';
    appendSentLog({ sentAt, to: trimmedTo, subject, template, status: 'fail', error });
    return { ok: false, error };
  }

  const url = (webhookUrl && webhookUrl.trim().length > 0 ? webhookUrl.trim() : getConfiguredWebhook()) ?? '';
  if (!url) {
    const error = 'Aucun webhook Zapier configuré. Ajoute l\'URL dans Paramètres → Intégrations.';
    appendSentLog({ sentAt, to: trimmedTo, subject, template, status: 'fail', error });
    return { ok: false, error };
  }
  if (!isHttpsUrl(url)) {
    const error = 'URL de webhook invalide (https:// requis).';
    appendSentLog({ sentAt, to: trimmedTo, subject, template, status: 'fail', error });
    return { ok: false, error };
  }

  const body = {
    to: trimmedTo,
    subject,
    html,
    sentBy: sentBy ?? '',
    sentAt,
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      // Zapier Catch Hooks return JSON like { status: 'success', id: '...' }.
      // Surface the server's own error text when we can — it's usually
      // more actionable than a bare "HTTP 500".
      let serverMsg = '';
      try {
        serverMsg = (await res.text()).slice(0, 240);
      } catch { /* ignore */ }
      const error = `Envoi échoué (HTTP ${res.status})${serverMsg ? ` — ${serverMsg}` : ''}`;
      appendSentLog({ sentAt, to: trimmedTo, subject, template, status: 'fail', error });
      return { ok: false, error };
    }
    let messageId: string | undefined;
    try {
      const payload = await res.json() as { id?: string; request_id?: string };
      messageId = payload?.id ?? payload?.request_id;
    } catch {
      // Zapier occasionally responds with an empty body on success —
      // that's fine, we just won't have a messageId to show.
    }
    appendSentLog({ sentAt, to: trimmedTo, subject, template, status: 'ok', messageId });
    return { ok: true, messageId };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Erreur réseau inconnue';
    appendSentLog({ sentAt, to: trimmedTo, subject, template, status: 'fail', error });
    return { ok: false, error };
  }
}
