import { useEffect, useState } from 'react';

/**
 * useDebouncedValue — returns `value` but lagged by `delayMs`.
 *
 * Used to defer expensive downstream work (filter/sort/history pushes)
 * until the user has stopped changing the input for `delayMs`. The
 * caller keeps the live value for the controlled input itself so typing
 * stays responsive; only the lagged copy flows into the heavy pipeline.
 *
 * Cleanup cancels the pending setTimeout on each change, so rapid
 * keystrokes coalesce into a single trailing update once typing settles.
 */
export function useDebouncedValue<T>(value: T, delayMs: number = 200): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const safeDelay = Number.isFinite(delayMs) && delayMs >= 0 ? delayMs : 200;
    const t = setTimeout(() => setDebounced(value), safeDelay);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
