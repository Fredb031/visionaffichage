import { useEffect, useRef } from 'react';

/**
 * Trap Tab / Shift+Tab inside the returned ref's element while `active`
 * is true. aria-modal is a hint to screen readers but doesn't enforce
 * focus containment in browsers — a keyboard user can still Tab out of
 * an open modal into the dimmed page underneath. This hook wires up
 * the enforcement.
 *
 * Usage:
 *   const trapRef = useFocusTrap<HTMLDivElement>(isOpen);
 *   return <div ref={trapRef} role="dialog" aria-modal="true">…</div>;
 *
 * Also auto-focuses the first tabbable child on activation so keyboard
 * users don't have to press Tab once just to enter the modal.
 */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useFocusTrap<T extends HTMLElement = HTMLElement>(active: boolean) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!active) return;
    const el = ref.current;
    if (!el) return;

    // Remember where focus was so we can restore on close — standard
    // modal accessibility pattern.
    const prevActive = document.activeElement as HTMLElement | null;

    const getFocusable = () =>
      Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        n => !n.hasAttribute('aria-hidden') && n.offsetParent !== null,
      );

    // Focus the first focusable child (or the container itself) so
    // keyboard users start inside the modal.
    const focusables = getFocusable();
    if (focusables.length > 0) focusables[0].focus();
    else el.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable = getFocusable();
      if (focusable.length === 0) { e.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    el.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('keydown', onKey);
      // Restore focus so the SkipLink / opening button regains it.
      if (prevActive && typeof prevActive.focus === 'function') {
        prevActive.focus({ preventScroll: true });
      }
    };
  }, [active]);

  return ref;
}
