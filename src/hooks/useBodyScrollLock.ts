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
let priorPaddingRight: string | null = null;
let priorPosition: string | null = null;
let priorTop: string | null = null;
let priorWidth: string | null = null;
let capturedScrollY = 0;

/**
 * Lock the document body's scroll while `active` is true. Used by
 * modals and drawers to prevent the page underneath from scrolling
 * when the user moves their wheel over the overlay.
 *
 * Uses a module-level ref count so stacked overlays cooperate:
 * body styles are set once when the first lock mounts and restored
 * only when the last one unmounts.
 *
 * Preserves the current scroll position: on lock we capture
 * `window.scrollY` and pin the body via `position: fixed; top: -Ny`
 * so the viewport doesn't jump, then restore the scroll on unlock.
 * Without this, `overflow: hidden` alone is enough to block wheel
 * scrolling but iOS Safari and some Androids still reset to the top
 * when the body becomes non-scrollable under a full-screen modal.
 *
 * Compensates for the scrollbar disappearing when overflow is hidden
 * by adding `padding-right` equal to the previous scrollbar width,
 * so the page doesn't jitter horizontally when a modal opens on
 * desktop browsers that reserve scrollbar space.
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
    if (typeof window === 'undefined') return;
    if (typeof document === 'undefined' || !document.body) return;
    if (lockCount === 0) {
      const body = document.body;
      // Measure scrollbar width BEFORE we hide overflow; afterwards
      // window.innerWidth == documentElement.clientWidth and the diff
      // collapses to zero, so compensation would silently no-op.
      const scrollbarWidth = Math.max(
        0,
        window.innerWidth - document.documentElement.clientWidth,
      );
      // Clamp at zero: iOS Safari rubber-band overscroll can momentarily
      // report a negative scrollY, which would produce `top: --Npx`
      // (invalid CSS, silently ignored) and the body would jump to the
      // top of the page instead of staying pinned at the user's scroll.
      const rawScrollY =
        window.scrollY ||
        window.pageYOffset ||
        document.documentElement.scrollTop ||
        0;
      capturedScrollY = Math.max(0, rawScrollY);
      priorOverflow = body.style.overflow;
      priorPaddingRight = body.style.paddingRight;
      priorPosition = body.style.position;
      priorTop = body.style.top;
      priorWidth = body.style.width;
      body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        // Add to any existing padding-right rather than overwriting,
        // so layouts that already reserve space on body keep theirs.
        // Only fold the prior value into a flat px sum when it's
        // unit-less, empty, or already in px — otherwise parseFloat
        // would silently strip the unit (16em → 16) and our `${n}px`
        // template would then write 16+scrollbar as px, collapsing
        // the original em/rem/%/vw layout reservation. For non-px
        // units we hand off to `calc()` so the original value
        // survives unit-intact and the scrollbar compensation just
        // stacks on top.
        const trimmedPrior = (priorPaddingRight ?? '').trim();
        const isPxOrEmpty =
          trimmedPrior === '' || /^-?\d*\.?\d+(px)?$/i.test(trimmedPrior);
        if (isPxOrEmpty) {
          const existing = parseFloat(trimmedPrior) || 0;
          body.style.paddingRight = `${existing + scrollbarWidth}px`;
        } else {
          body.style.paddingRight = `calc(${trimmedPrior} + ${scrollbarWidth}px)`;
        }
      }
      // position:fixed + negative top preserves the visual viewport
      // offset; width:100% keeps the body from collapsing to content
      // width once it's out of normal flow.
      body.style.position = 'fixed';
      body.style.top = `-${capturedScrollY}px`;
      body.style.width = '100%';
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
          const body = document.body;
          body.style.overflow = priorOverflow ?? '';
          body.style.paddingRight = priorPaddingRight ?? '';
          body.style.position = priorPosition ?? '';
          body.style.top = priorTop ?? '';
          body.style.width = priorWidth ?? '';
        }
        if (typeof window !== 'undefined') {
          // Restore the exact scroll the user was at when the first
          // lock engaged. Without this the page would snap to top
          // because position:fixed removed body from normal flow.
          window.scrollTo(0, capturedScrollY);
        }
        priorOverflow = null;
        priorPaddingRight = null;
        priorPosition = null;
        priorTop = null;
        priorWidth = null;
        capturedScrollY = 0;
      }
    };
  }, [active]);
}
