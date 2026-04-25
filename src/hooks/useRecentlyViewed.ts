import { useCallback, useEffect, useState } from 'react';

const KEY = 'vision-recently-viewed';
const MAX = 8;

// Same-tab sync channel — native 'storage' event doesn't fire in the
// tab that wrote, so two instances of this hook in the same tab
// (RecentlyViewed empty-cart strip + PDP tracker on a tab where both
// are visible momentarily) can get out of sync. Bounce a custom
// event on every write so siblings re-read storage.
const SAME_TAB_EVENT = 'vision-recently-viewed-change';

function readStorage(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    // Dedup + filter non-strings + cap. track() maintains uniqueness
    // on the write path, but a devtools edit or older build could
    // persist duplicates. Dup handles would double-render a product
    // in the RecentlyViewed component and trip React's list-key warning.
    const seen = new Set<string>();
    const out: string[] = [];
    for (const x of raw) {
      if (typeof x !== 'string') continue;
      // Normalize on read too — an older build (pre-91ea359) could have
      // persisted untrimmed / mixed-case handles, and a devtools edit
      // could have slipped a whitespace-only entry past the write path.
      // Without trim+lower+empty-guard here, a stale '  ' in storage
      // would render an empty product card in the RecentlyViewed strip
      // and a stale 'Hoodie' would double-render alongside 'hoodie'.
      const norm = x.trim().toLowerCase();
      if (!norm || seen.has(norm)) continue;
      seen.add(norm);
      out.push(norm);
      if (out.length >= MAX) break;
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Track + read the list of Shopify product handles the user has
 * recently viewed on this device. Most-recent first, deduped, capped
 * at MAX. Persists to localStorage so the list survives refreshes
 * and is cleared by authStore.signOut along with the rest of the
 * customer-scoped state.
 *
 * Use the `track(handle)` callback on ProductDetail so the current
 * product moves to the front of the list on each visit.
 */
export function useRecentlyViewed() {
  const [handles, setHandles] = useState<string[]>(readStorage);

  const remove = useCallback((handle: string) => {
    // Mirror the normalization used on the write path — a caller that
    // hands us 'Hoodie' or '  hoodie  ' should still find and drop the
    // stored 'hoodie' entry. Without this, remove() would silently
    // no-op on any non-canonical input and the consumer would assume
    // the handle stuck around by design.
    const norm = handle.trim().toLowerCase();
    if (!norm) return;
    setHandles(prev => {
      if (!prev.includes(norm)) return prev;
      const next = prev.filter(h => h !== norm);
      try {
        if (next.length === 0) {
          localStorage.removeItem(KEY);
        } else {
          localStorage.setItem(KEY, JSON.stringify(next));
        }
      } catch { /* private mode */ }
      try { window.dispatchEvent(new CustomEvent(SAME_TAB_EVENT)); } catch { /* noop */ }
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    // Wipe storage + state + broadcast in one step so consumers don't
    // re-implement the dance. RecentlyViewed.tsx currently duplicates
    // this exact sequence (localStorage.removeItem + CustomEvent
    // dispatch) because no clear() existed — now they can migrate.
    try { localStorage.removeItem(KEY); } catch { /* private mode */ }
    try { window.dispatchEvent(new CustomEvent(SAME_TAB_EVENT)); } catch { /* noop */ }
    setHandles([]);
  }, []);

  const track = useCallback((handle: string) => {
    // Normalize before dedupe/storage — Shopify handles are ASCII
    // lowercase by spec, but callers sometimes hand us a trailing space
    // from a copy-paste or mixed case from a hand-built URL. Without
    // trim+lower, track('  hoodie  ') and track('hoodie') land in two
    // separate entries and the RecentlyViewed strip renders the same
    // product twice (with a duplicate React list key). Mirrors the
    // normalization useWishlist + useProductColors already apply.
    const norm = handle.trim().toLowerCase();
    if (!norm) return;
    setHandles(prev => {
      // Re-tracking the handle that's already at the front is a no-op:
      // the user navigated back to the same product, the list ordering
      // wouldn't change. Bail early to avoid (a) a redundant array
      // allocation that re-renders every consumer, (b) a synchronous
      // localStorage.setItem write, and (c) a same-tab event broadcast
      // that re-runs readStorage() on every sibling instance. Without
      // this, a user clicking the same PDP card twice still pays for
      // the full write+broadcast loop.
      if (prev[0] === norm) return prev;
      const next = [norm, ...prev.filter(h => h !== norm)].slice(0, MAX);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
      try { window.dispatchEvent(new CustomEvent(SAME_TAB_EVENT)); } catch { /* noop */ }
      return next;
    });
  }, []);

  // Re-read when another tab / authStore clears the list so the in-
  // memory view stays in sync. Also listen for the same-tab event
  // so sibling hook instances pick up track() calls immediately.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      // e.key === null fires when another tab calls localStorage.clear()
      // — re-read in that case too so this tab doesn't keep rendering
      // recently-viewed cards for handles whose entry was just wiped.
      // Mirrors the same e.key === null guard useWishlist applies.
      if (e.key === KEY || e.key === null) setHandles(readStorage());
    };
    const onLocal = () => setHandles(readStorage());
    window.addEventListener('storage', onStorage);
    window.addEventListener(SAME_TAB_EVENT, onLocal);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(SAME_TAB_EVENT, onLocal);
    };
  }, []);

  return { handles, track, remove, clear };
}

// Public shape of the hook's return value, exported so consumers that
// accept the handle as a prop (e.g. a shared Toolbar that needs to
// call clear() from deep in the tree) can type it without redeclaring
// the record inline. Derived from the hook itself so adding a method
// above automatically flows through without a second source of truth.
export type RecentlyViewed = ReturnType<typeof useRecentlyViewed>;
