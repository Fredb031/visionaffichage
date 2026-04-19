import { useCallback, useEffect, useState } from 'react';

const KEY = 'vision-wishlist';
// Hard cap so a bored user smashing hearts on every product doesn't
// push the wishlist into the multi-KB range and blow localStorage
// quota for the cart + customizer state that shares it.
const MAX = 50;

function readStorage(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string').slice(0, MAX) : [];
  } catch {
    return [];
  }
}

/**
 * Persist the customer's wishlist (Shopify product handles) to
 * localStorage. Most-recent first — toggling an already-saved handle
 * moves it to the top, while a fresh save prepends it. Cross-tab sync
 * via the storage event so a like on one tab appears on the others.
 */
export function useWishlist() {
  const [handles, setHandles] = useState<string[]>(readStorage);

  const toggle = useCallback((handle: string) => {
    if (!handle) return;
    setHandles(prev => {
      const without = prev.filter(h => h !== handle);
      const next = (without.length === prev.length ? [handle, ...prev] : without).slice(0, MAX);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
      return next;
    });
  }, []);

  const has = useCallback((handle: string) => handles.includes(handle), [handles]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setHandles(readStorage());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return { handles, toggle, has };
}
