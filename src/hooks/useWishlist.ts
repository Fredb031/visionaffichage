import { useCallback, useEffect, useState } from 'react';

const KEY = 'vision-wishlist';
// Hard cap so a bored user smashing hearts on every product doesn't
// push the wishlist into the multi-KB range and blow localStorage
// quota for the cart + customizer state that shares it.
const MAX = 50;

// Cross-tab sync goes through the native 'storage' event. Same-tab
// sync (two ProductCard instances, or ProductCard + PDP heart)
// requires its own pub/sub: the browser never fires 'storage' on the
// tab that wrote. Without this, liking a product in a grid card
// didn't flip the heart on its sibling PDP heart button until reload.
const SAME_TAB_EVENT = 'vision-wishlist-change';

function readStorage(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    // Dedup + filter non-strings in one pass. A corrupted list with
    // duplicate handles would otherwise render duplicate cards in the
    // wishlist grid AND trigger React's list-key warning (the grid
    // uses the handle as the key).
    const seen = new Set<string>();
    const out: string[] = [];
    for (const x of raw) {
      if (typeof x !== 'string') continue;
      // Normalize on read too — an older build could have persisted
      // untrimmed / mixed-case handles, and a devtools edit could
      // have slipped a whitespace-only entry past the write path.
      // Without trim+lower+empty-guard here, a stale '  ' in storage
      // would render an empty heart card in the wishlist grid, and
      // a stale 'Hoodie' would double-render alongside 'hoodie'.
      // Mirrors the normalization useRecentlyViewed applies.
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
 * Persist the customer's wishlist (Shopify product handles) to
 * localStorage. Most-recent first — a fresh save prepends the handle,
 * while toggling an already-saved handle removes it (classic heart
 * add/remove behaviour, matching what the Heart button aria-labels
 * promise: "Save to wishlist" ↔ "Remove from wishlist"). Cross-tab
 * sync via the storage event so a like on one tab appears on the
 * others.
 */
export function useWishlist() {
  const [handles, setHandles] = useState<string[]>(readStorage);

  const toggle = useCallback((handle: string) => {
    // Normalize before dedupe/storage — Shopify handles are ASCII
    // lowercase by spec, but callers sometimes hand us a trailing space
    // from a copy-paste or mixed case from a hand-built URL. Without
    // trim+lower, toggle('  hoodie  ') and toggle('hoodie') land in
    // two separate entries and the heart button on the sibling card
    // wouldn't flip off on remove. Matches the normalization the
    // useProductColors cache key uses.
    const norm = handle.trim().toLowerCase();
    if (!norm) return;
    setHandles(prev => {
      const without = prev.filter(h => h !== norm);
      const next = (without.length === prev.length ? [norm, ...prev] : without).slice(0, MAX);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
      // Broadcast to other useWishlist instances in the SAME tab.
      try { window.dispatchEvent(new CustomEvent(SAME_TAB_EVENT)); } catch { /* noop */ }
      return next;
    });
  }, []);

  const has = useCallback((handle: string) => {
    // Match toggle's whitespace guard so has('') / has('   ') returns
    // false instead of silently checking membership of '' in handles.
    // A whitespace-only probe from a hand-built URL or a stale card
    // ref shouldn't claim the wishlist contains the empty string even
    // if storage were somehow corrupted with one.
    const norm = handle.trim().toLowerCase();
    if (!norm) return false;
    return handles.includes(norm);
  }, [handles]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      // e.key === null fires when another tab calls localStorage.clear()
      // — re-read in that case too so this tab doesn't keep rendering
      // hearts for products whose wishlist entry was just wiped.
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

  return { handles, toggle, has };
}
