import { useEffect } from 'react';

/**
 * Lock the document body's scroll while `active` is true. Used by
 * modals and drawers to prevent the page underneath from scrolling
 * when the user moves their wheel over the overlay.
 *
 * Saves the prior value of body.style.overflow so nested/stacked
 * overlays restore to the right state instead of clobbering each
 * other.
 */
export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [active]);
}
