import { useCallback, useEffect, useState } from 'react';

const KEY = 'vision-wishlist';

function readStorage(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
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
      const next = without.length === prev.length ? [handle, ...prev] : without;
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
