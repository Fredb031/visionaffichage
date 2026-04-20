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
      if (typeof x !== 'string' || seen.has(x)) continue;
      seen.add(x);
      out.push(x);
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
    if (!handle) return;
    setHandles(prev => {
      const without = prev.filter(h => h !== handle);
      const next = (without.length === prev.length ? [handle, ...prev] : without).slice(0, MAX);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
      // Broadcast to other useWishlist instances in the SAME tab.
      try { window.dispatchEvent(new CustomEvent(SAME_TAB_EVENT)); } catch { /* noop */ }
      return next;
    });
  }, []);

  const has = useCallback((handle: string) => handles.includes(handle), [handles]);

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
