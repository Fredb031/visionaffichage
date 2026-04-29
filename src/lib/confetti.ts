/**
 * fireConfetti — imperative confetti burst (Volume II Section 13 #20).
 *
 * Pure DOM helper: spawns N <span> particles inside a fixed-position
 * container at the top of the viewport, animates each via inline
 * keyframes injected once, then removes the container after the
 * longest particle has finished.
 *
 * Sibling to <Confetti /> in src/components/Confetti.tsx — that React
 * component covers the existing call sites (customizer threshold cross,
 * checkout success). This helper exists so future non-React callers
 * (or React callers that find it awkward to wire a `fire` boolean +
 * `onDone` lifecycle) can trigger a burst with a single function call.
 *
 * Trajectory math, brand colors and timing mirror the React component
 * so the visual identity stays consistent regardless of which entry
 * point the caller picks.
 *
 * No external library, no canvas — just `position: fixed` divs with
 * CSS transforms. Respects `prefers-reduced-motion` (no-op).
 */

// Frozen brand palette so a future bug somewhere in the SPA can't do
// `COLORS[0] = '#ff0000'` and recolour every confetti burst that fires
// after the mutation (checkout success, customizer threshold cross,
// future imperative callers). Mirrors the runtime-immutability pattern
// applied across the data/ tree (pricing, caseStudies, productLabels)
// — same readonly guarantee the visual identity of the brand depends on.
const COLORS: readonly string[] = Object.freeze(['#E8A838', '#1B3A6B', '#F5F2E8']);
const KEYFRAMES_ID = 'va-confetti-keyframes';

function injectKeyframesOnce() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(KEYFRAMES_ID)) return;
  const style = document.createElement('style');
  style.id = KEYFRAMES_ID;
  style.textContent = `
    @keyframes va-confetti-fly-imperative {
      0%   { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 1; }
      100% { transform: translate3d(var(--vc-dx), var(--vc-dy), 0) rotate(var(--vc-rot)); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

export function fireConfetti(opts?: { count?: number; durationMs?: number }): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // Honour reduced-motion: no particles, no DOM churn.
  // Defensive: `window.matchMedia?.(...)` short-circuits to `undefined` when
  // `matchMedia` is missing (older Safari iframes, some jsdom setups, embedded
  // webviews), and `undefined.matches` would throw. Guard the whole chain.
  try {
    if (typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
  } catch {
    // matchMedia threw (sandbox / CSP / exotic env) — fall through and animate.
  }

  injectKeyframesOnce();

  const count = Math.max(1, Math.min(120, opts?.count ?? 26));
  const baseDuration = Math.max(300, Math.min(4000, opts?.durationMs ?? 1500));

  const container = document.createElement('div');
  container.setAttribute('aria-hidden', 'true');
  container.style.cssText = [
    'position:fixed', 'left:0', 'right:0', 'top:0', 'height:0',
    'pointer-events:none', 'z-index:700', 'overflow:visible',
  ].join(';');

  let maxLifetime = 0;
  let longestPiece: HTMLSpanElement | null = null;
  for (let i = 0; i < count; i++) {
    const color = COLORS[i % COLORS.length];
    const dx = Math.round((Math.random() - 0.5) * 440);
    const dy = 160 + Math.round(Math.random() * 200);
    const rot = Math.round(Math.random() * 720 - 360);
    const duration = Math.round(baseDuration * (0.6 + Math.random() * 0.4));
    const delay = Math.round(Math.random() * 150);
    const size = 6 + Math.round(Math.random() * 6);
    const left = 40 + Math.random() * 20;
    const radius = Math.random() > 0.5 ? '1px' : '50%';

    const lifetime = duration + delay;
    const piece = document.createElement('span');
    piece.style.cssText = [
      'position:absolute', `left:${left}%`, 'top:0',
      `width:${size}px`, `height:${size}px`,
      `background:${color}`, `border-radius:${radius}`,
      'will-change:transform,opacity',
      'box-shadow:0 1px 2px rgba(0,0,0,0.08)',
      `animation:va-confetti-fly-imperative ${duration}ms cubic-bezier(.22,.61,.36,1) ${delay}ms forwards`,
    ].join(';');
    piece.style.setProperty('--vc-dx', `${dx}px`);
    piece.style.setProperty('--vc-dy', `${dy}px`);
    piece.style.setProperty('--vc-rot', `${rot}deg`);
    container.appendChild(piece);

    if (lifetime > maxLifetime) {
      maxLifetime = lifetime;
      longestPiece = piece;
    }
  }

  document.body.appendChild(container);

  // Prefer the actual `animationend` event on the longest-lived piece for
  // tight cleanup, with a setTimeout safety net so we never leak the
  // container if the event is missed (tab backgrounding, animation cancel,
  // external DOM mutation, etc.).
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    container.remove();
  };
  if (longestPiece) {
    longestPiece.addEventListener('animationend', cleanup, { once: true });
  }
  window.setTimeout(cleanup, maxLifetime + 200);
}
