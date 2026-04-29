import { useEffect, useRef, type RefObject } from 'react';

/**
 * Vol III §07 — Magnetic CTA. While the cursor sits within `radius`
 * pixels of the element's center, drift the element a fraction of the
 * cursor offset so it appears to be "pulled" toward the pointer. The
 * effect is gated on:
 *
 *   - `prefers-reduced-motion: reduce` — disabled outright
 *   - `(hover: hover)` — touch devices skip the listener (no cursor)
 *   - the global `pointermove` is throttled to one rAF tick per move so
 *     the transform mutation never runs more than 60×/sec even when
 *     the OS pumps coalesced events at 240Hz
 *
 * The hook owns the transform on the target element. Callers MUST NOT
 * apply `translate-x/y` via Tailwind on the same element or the styles
 * will fight; pair magnetic CTAs with `hover:scale` only. Returns the
 * ref to attach to the element.
 *
 * `radius` — proximity in px at which the pull starts (default 80, per
 * Vol III copy). `strength` — 0..1 fraction of the cursor offset the
 * element drifts toward the pointer (default 0.18, yielding a subtle
 * ~6px max travel within an 80px radius which matches the spec).
 */
export interface UseMagneticOptions {
  radius?: number;
  strength?: number;
}

export function useMagnetic<T extends HTMLElement = HTMLElement>(
  { radius = 80, strength = 0.18 }: UseMagneticOptions = {},
): RefObject<T | null> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window === 'undefined') return;

    // Bail on touch-only devices — no cursor to be magnetic about. The
    // (hover: hover) media query is the canonical "the primary input
    // has hover capability" check; phones return false even when the
    // user's finger is technically hovering above the screen.
    if (typeof window.matchMedia === 'function') {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (!window.matchMedia('(hover: hover)').matches) return;
    }

    let rafId = 0;
    let pendingX = 0;
    let pendingY = 0;
    // Track whether the element currently holds a non-zero translate so
    // the leave handler only writes once (and so we know to clear on
    // unmount even if the cursor never crossed back into the radius).
    let translated = false;

    const applyTransform = (x: number, y: number) => {
      el.style.transform = x === 0 && y === 0 ? '' : `translate3d(${x}px, ${y}px, 0)`;
      translated = x !== 0 || y !== 0;
    };

    const flush = () => {
      rafId = 0;
      applyTransform(pendingX, pendingY);
    };

    const schedule = (x: number, y: number) => {
      pendingX = x;
      pendingY = y;
      if (rafId === 0) rafId = requestAnimationFrame(flush);
    };

    const handlePointerMove = (e: PointerEvent) => {
      // Hover-only path: ignore non-mouse pointers (pen/touch) so a
      // stylus tap doesn't punch the button across the screen.
      if (e.pointerType !== 'mouse') return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      // Snap back to origin once the cursor leaves the influence radius
      // — without this the button would stick to its last drift offset
      // until the user re-entered.
      if (dist > radius) {
        if (translated) schedule(0, 0);
        return;
      }
      schedule(dx * strength, dy * strength);
    };

    // pointerleave on the *element* doesn't help here because the pull
    // starts before the cursor enters the bounding box. Listening on
    // window catches the cursor leaving the document entirely (e.g.
    // tabbing out, switching desktops) which would otherwise leave the
    // button stuck in its translated state.
    const handleWindowLeave = () => {
      if (translated) schedule(0, 0);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerleave', handleWindowLeave);
    window.addEventListener('blur', handleWindowLeave);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', handleWindowLeave);
      window.removeEventListener('blur', handleWindowLeave);
      if (rafId !== 0) cancelAnimationFrame(rafId);
      // Reset the inline transform on unmount so a subsequent re-mount
      // with magnetic disabled (e.g. user enabled reduced-motion mid-
      // session) doesn't inherit a stale translate.
      el.style.transform = '';
    };
  }, [radius, strength]);

  return ref;
}
