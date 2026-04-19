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
 */
export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    if (lockCount === 0) {
      priorOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    lockCount += 1;
    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        document.body.style.overflow = priorOverflow ?? '';
        priorOverflow = null;
      }
    };
  }, [active]);
}
