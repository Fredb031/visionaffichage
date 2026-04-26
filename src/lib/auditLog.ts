// Task 9.19 — Audit log for admin actions.
//
// Every mutating admin action (mark shipped, convert quote, settings
// save, role change, …) appends a tiny record to a localStorage key so
// the dashboard can surface a "Recent activity" trail and so an admin
// trying to retrace "what changed last Tuesday?" has somewhere to look.
//
// Deliberately client-side only for now: the app still writes most of
// its state to localStorage, and a server-side audit table is a
// separate task. When the Supabase migration lands, callsites won't
// change — only this module flips from writeLS to an RPC.
//
// Storage contract
// ────────────────
// Key:    `vision-admin-audit-log`
// Shape:  AuditEntry[], freshest at index 0 (FIFO cap at 500).
// Cap:    drops the oldest entries when a write would exceed 500, so
//         the key can't grow unbounded and push us past the ~5MB
//         localStorage quota on long-lived admin sessions.

import { readLS, writeLS } from '@/lib/storage';
import { useAuthStore } from '@/stores/authStore';

export interface AuditEntry {
  /** Monotonic-ish id. `${timestamp}-${random}` — collision-resistant
   * across rapid-fire actions inside the same millisecond without
   * pulling in a uuid dep. */
  id: string;
  /** Namespaced action verb, e.g. `order.mark_shipped`,
   * `quote.convert`, `settings.save`, `user.role_changed`. Kept as a
   * free-form string so new surfaces can add entries without touching
   * this file. */
  action: string;
  /** Per-action payload (orderId, quoteId, from/to role, …). Rendered
   * opportunistically by consumers; unknown keys are tolerated. */
  details?: Record<string, unknown>;
  /** Email of the actor who performed the action, captured from the
   * auth store at call time. Falls back to 'unknown' if no user is
   * logged in (shouldn't happen for an admin action, but we never
   * want the audit write itself to throw). */
  by: string;
  /** ISO-8601 timestamp. */
  at: string;
}

const STORAGE_KEY = 'vision-admin-audit-log';
const MAX_ENTRIES = 500;

/** Peek the current user email without subscribing — we're writing a
 * log entry, not reading in a render. Using useAuthStore.getState()
 * keeps this function callable from any context (callbacks, effects,
 * non-React modules). */
function currentUserEmail(): string {
  try {
    const user = useAuthStore.getState().user;
    return user?.email ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Generate a reasonably-unique id without a uuid dep. Two entries
 * written in the same millisecond still get distinct ids because of
 * the random suffix. */
function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Append a single audit entry. Silent on failure — a quota-exceeded
 * or unavailable localStorage shouldn't interrupt the real admin
 * action that triggered us.
 *
 * Callers pass a stable action verb and a small structured details
 * object. Don't embed user-typed strings verbatim in the action;
 * reserve that for `details`. */
export function logAdminAction(
  action: string,
  details?: Record<string, unknown>,
): void {
  try {
    // Defensive: an empty or non-string action would produce an
    // unidentifiable entry that's worse than no entry at all (it
    // pollutes the trail and breaks group-by-action consumers). Drop
    // silently — same contract as the outer catch: the audit write
    // never interrupts the real action it's observing.
    if (typeof action !== 'string' || action.trim() === '') return;
    const list = readLS<AuditEntry[]>(STORAGE_KEY, []);
    const existing = Array.isArray(list) ? list : [];
    const entry: AuditEntry = {
      id: makeId(),
      action,
      details,
      by: currentUserEmail(),
      at: new Date().toISOString(),
    };
    // Unshift so freshest is at index 0, then trim from the tail. We
    // slice rather than pop() in a loop — one allocation, O(n) worst
    // case which is fine at n ≤ 500.
    const next = [entry, ...existing].slice(0, MAX_ENTRIES);
    writeLS(STORAGE_KEY, next);
  } catch {
    // Defensive: readLS/writeLS already swallow their own errors, but
    // a future refactor might throw in buildEntry (e.g. if Date is
    // stubbed in a test). We never want the audit write to mask the
    // real action it's observing.
  }
}

/** Read the full log, freshest-first. Defensive — returns [] if the
 * key is missing, corrupted, or the shape is unexpected. Consumers
 * that want "last 10" should slice(0, 10) on the result. */
export function getAuditLog(): AuditEntry[] {
  const raw = readLS<unknown>(STORAGE_KEY, []);
  if (!Array.isArray(raw)) return [];
  // Lightweight per-row shape check — tolerate unknown extra fields
  // (forward-compat with future additions) but drop rows missing the
  // required scaffolding so downstream renderers don't have to guard.
  return raw.filter((r): r is AuditEntry => {
    if (!r || typeof r !== 'object') return false;
    const row = r as Partial<AuditEntry>;
    return (
      typeof row.id === 'string' &&
      typeof row.action === 'string' &&
      typeof row.by === 'string' &&
      typeof row.at === 'string'
    );
  });
}

/** Wipe the audit log. Intended as an admin-gated action — the caller
 * is responsible for confirming intent before invoking. */
export function clearAuditLog(): void {
  writeLS(STORAGE_KEY, []);
}
