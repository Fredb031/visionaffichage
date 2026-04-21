import { useEffect } from 'react';

// Ref-count active locks so stacked overlays (e.g. CartDrawer then
// LoginModal) don't fight each other. Prior naive implementation
// captured prev=body.style.overflow at each open — meaning the second
// lock saved 'hidden' as prev, then on its close restored to 'hidden'
// even though it should have stayed locked until all owners released.
// Closing them out of order (A then B) would leave body unlocked
// while a modal was still visible.
let lockCount = 0;
let priorOverflow: string | null = null;

/**
 * Lock the document body's scroll while `active` is true. Used by
 * modals and drawers to prevent the page underneath from scrolling
 * when the user moves their wheel over the overlay.
 *
 * Uses a module-level ref count so stacked overlays cooperate:
 * body.style.overflow is set once when the first lock mounts and
 * restored only when the last one unmounts.
 *
 * SSR / non-DOM environments: the hook is a no-op when `document` is
 * undefined (prerender, Node-based tests without jsdom). Without this
 * guard, merely importing a component that uses the hook and then
 * calling it during a server render would throw ReferenceError on
 * the `document.body.style.overflow` read.
 */
export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    // Guard against SSR / test runners that execute effects without a
    // DOM. useEffect normally doesn't fire server-side, but defensive
    // libs that polyfill effects (or a jsdom missing document.body)
    // have caused real crashes in this hook's history.
    if (typeof document === 'undefined' || !document.body) return;
    if (lockCount === 0) {
      priorOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    lockCount += 1;
    return () => {
      // Clamp at zero so a stray double-cleanup (React StrictMode's
      // intentional double-invoke in dev, or a component that somehow
      // unmounts twice) can't drive the count negative and permanently
      // desync from the actual number of live locks — which would make
      // the next lock forget to restore the page's original overflow.
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        if (typeof document !== 'undefined' && document.body) {
          document.body.style.overflow = priorOverflow ?? '';
        }
        priorOverflow = null;
      }
    };
  }, [active]);
}
