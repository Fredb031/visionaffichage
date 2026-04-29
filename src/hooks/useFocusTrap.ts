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
 * users don't have to press Tab once just to enter the modal. Tag any
 * element inside the trap with `data-autofocus` to override that
 * first-focusable default — useful for dialogs whose primary control
 * isn't the visually first one (e.g. a search input sitting below a
 * close button).
 */
// Each native-focusable selector excludes `[tabindex="-1"]` — the dedicated
// `[tabindex]:not([tabindex="-1"])` line below only catches non-natively-
// focusable elements (e.g. <div tabindex="0">). A natively-focusable node
// that the author opted out of the tab order via `tabindex="-1"` (a close
// button kept programmatic-focus-only, a hidden link removed from the
// flow) would otherwise get pulled into the trap and Tab would land on it.
const FOCUSABLE = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
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

    // offsetParent returns null for position:fixed descendants per
     // spec, which would otherwise exclude fixed-positioned close
    // buttons / toolbar chrome living inside the modal from the
    // focus trap. Fall back to getClientRects().length when the
    // offsetParent heuristic rules a node out — any rendered box
    // has at least one client rect, so the extra check catches
    // fixed descendants without false-positiving on display:none.
    //
    // Check aria-hidden VALUE, not mere presence — `aria-hidden="false"`
    // is a legitimate explicit-visible marker, and hasAttribute() would
    // wrongly exclude those elements from the focus trap, trapping focus
    // on a shrunken subset of the modal's actual interactive controls.
    // Also exclude `[hidden]`, `aria-disabled="true"`, and any element
    // nested inside an `inert` subtree — these are non-interactive per
    // their own specs and attempting to focus them either silently no-ops
    // (hidden / inert) or lands focus on a disabled-looking control.
    const isVisible = (n: HTMLElement) =>
      n.getAttribute('aria-hidden') !== 'true' &&
      n.getAttribute('aria-disabled') !== 'true' &&
      !n.hasAttribute('hidden') &&
      !n.closest('[inert]') &&
      (n.offsetParent !== null || n.getClientRects().length > 0);
    const getFocusable = () =>
      Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isVisible);

    // Focus the element flagged with `data-autofocus` if one exists and
    // is itself focusable, else the first focusable child, else the
    // container itself. Keyboard users start inside the modal either way.
    const focusables = getFocusable();
    const autofocus = el.querySelector<HTMLElement>('[data-autofocus]');
    const preferred = autofocus && focusables.includes(autofocus) ? autofocus : null;
    if (preferred) preferred.focus();
    else if (focusables.length > 0) focusables[0].focus();
    else el.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable = getFocusable();
      if (focusable.length === 0) { e.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      // Single focusable: browser would otherwise move focus out of the
      // modal entirely on Tab. Pin it in place.
      if (focusable.length === 1) {
        e.preventDefault();
        first.focus();
        return;
      }
      // If focus somehow escaped the container (e.g. activeElement is
      // the body, the container itself, or a node outside it), pull it
      // back to the appropriate edge instead of letting Tab leak out.
      const current = document.activeElement as HTMLElement | null;
      if (!current || current === el || !el.contains(current)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      if (e.shiftKey && current === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    };

    // Listen on document, not `el`: a keydown event only fires on the
    // container if focus is already inside it, which would make the
    // "focus escaped the container" recovery branch above unreachable.
    // Document-level capture catches Tab presses regardless of where
    // activeElement currently sits, so escape-recovery actually runs.
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      // Restore focus so the SkipLink / opening button regains it.
      if (prevActive && typeof prevActive.focus === 'function') {
        prevActive.focus({ preventScroll: true });
      }
    };
  }, [active]);

  return ref;
}
