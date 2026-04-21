// Tiny localStorage wrappers that make a corrupted entry non-fatal.
//
// Every direct `JSON.parse(localStorage.getItem(...))` in the app used
// to grow its own try/catch because a single malformed blob — left
// behind by an older build, a devtools edit during development, or a
// partial write from a crash mid-setItem — would otherwise throw
// synchronously in the hydration path and crash the admin shell on
// first paint.
//
// readLS centralises that guard: on any failure (private-mode throw,
// SyntaxError, null/undefined shape) we return the caller's fallback
// so the app boots with defaults instead of a blank screen.
// writeLS mirrors the pattern for the write path so a quota-exceeded
// exception (common on Safari in private mode, and on mobile when the
// origin has accumulated multi-MB of unrelated state) doesn't escape
// into a render-phase boundary.
//
// These helpers are intentionally schema-agnostic — callers that need
// post-parse validation (e.g. Array.isArray, typeof === 'object') keep
// doing that themselves. The guard here is only about "did parse
// succeed and is there a value at all". zustand's persist() middleware
// handles its own storage access, so its callsites intentionally stay
// out of this helper.

export function readLS<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

export function writeLS(key: string, value: unknown): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Quota exceeded, private-mode Safari throwing on setItem, or a
    // value with a circular ref making JSON.stringify throw. Silent
    // failure is the right call for every current caller — persistence
    // is best-effort; the in-memory state is still correct.
    return false;
  }
}
