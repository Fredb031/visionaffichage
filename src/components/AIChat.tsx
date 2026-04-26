import { lazy, Suspense, useEffect, useState } from 'react';

// AIChat is mounted on every page (Index, Products, ProductDetail, Cart,
// Checkout, Account, TrackOrder, NotFound) but initially renders nothing
// more than a floating button that only opens on user click. The panel
// body ships ~23 KB of source (8 lucide icons, bilingual menu + chat
// UI, transcript plumbing) that otherwise lands in the eager route
// chunks — inflating the initial JS every visitor downloads before
// first paint.
//
// Defer the implementation: `@/components/AIChat` is now a tiny shim
// that lazy-loads the real panel in its own chunk. The Suspense
// fallback is null — the FAB was never above-the-fold (bottom-right
// floating element), so briefly omitting it while the chunk streams
// in is invisible to the user. The first render of Index drops the
// AIChat weight entirely.
const AIChatPanel = lazy(() =>
  import('./AIChatPanel').then(m => ({ default: m.AIChatPanel })),
);

// Mega Blueprint §3.2 — proactive triggers fire `va:chat-prefill`
// before the user has clicked the FAB, which means the lazy panel
// chunk hasn't loaded yet. The shim eagerly listens for the event,
// flips a state flag that triggers the lazy import, and re-fires the
// event after the panel mounts so its own listener can post the
// suggestion. Without the re-fire the prefill is lost in the gap
// between the lazy chunk fetch and the panel's effect mount.
export function AIChat() {
  const [primed, setPrimed] = useState(false);
  useEffect(() => {
    const timers = new Set<number>();
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ message?: string }>;
      // Force-mount the panel if it isn't already loaded so the panel's
      // own listener attaches and sees the (re-)dispatched event.
      if (!primed) {
        setPrimed(true);
        // Re-dispatch on the next animation frame so the lazy chunk
        // has time to resolve and the panel's effect attaches its
        // listener before we fire again. requestAnimationFrame +
        // microtask chain is heuristic but works because the lazy
        // chunk is small (~23 KB) and was already preloaded by the
        // browser if the user had any interaction earlier.
        const message = ce.detail?.message;
        if (typeof message === 'string' && message.length > 0) {
          // Wait for next microtask cycle, then refire. We try a few
          // times in case the chunk is still loading on a cold start.
          let attempts = 0;
          const refire = () => {
            attempts += 1;
            window.dispatchEvent(new CustomEvent('va:chat-prefill', { detail: { message } }));
            if (attempts < 5) {
              const id = window.setTimeout(refire, 200);
              timers.add(id);
            }
          };
          const id = window.setTimeout(refire, 50);
          timers.add(id);
        }
      }
    };
    window.addEventListener('va:chat-prefill', handler);
    return () => {
      window.removeEventListener('va:chat-prefill', handler);
      timers.forEach(id => window.clearTimeout(id));
      timers.clear();
    };
  }, [primed]);

  return (
    <Suspense fallback={null}>
      <AIChatPanel />
    </Suspense>
  );
}
