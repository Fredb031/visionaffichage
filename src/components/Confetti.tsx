/**
 * Confetti — tiny CSS-only celebratory burst.
 *
 * Used by the customizer (Task 17.3) when the user crosses the bulk
 * discount threshold for the first time in a session. Deliberately
 * keeps the dependency footprint flat — no canvas-confetti, no
 * react-confetti — so the bundle doesn't grow for a 1.5s flourish.
 *
 * Implementation notes:
 * - 24 colored particles precomputed once per mount. Trajectories
 *   (dx, dy, rotation, duration, delay) are randomised to look
 *   organic. Math.random is fine; we render once and the visual
 *   doesn't need to be reproducible.
 * - Keyframes are inlined via <style> so the component is fully
 *   self-contained — no index.css edits required, and it cleans up
 *   with the unmount.
 * - Position: `fixed` at the top of the viewport with
 *   `pointer-events: none` so it sits above the modal without
 *   pushing layout or eating clicks.
 * - `prefers-reduced-motion` fallback: the parent should skip
 *   mounting Confetti entirely. As a defensive second layer, the
 *   keyframes themselves are wrapped in a reduced-motion media
 *   query that neutralises the animation — so even an accidental
 *   mount doesn't flash particles at a user who opted out.
 * - Self-unmount: after ~1.5s we call `onDone` so the parent can
 *   flip `fire` back to false and drop the tree.
 */
import { useEffect, useMemo, useRef } from 'react';

interface ConfettiProps {
  fire: boolean;
  onDone?: () => void;
}

// Brand colors (per Task 17.3 spec)
const COLORS = ['#0052CC', '#0A0A0A', '#FFFFFF'];

const DURATION_MS = 1500;

export function Confetti({ fire, onDone }: ConfettiProps) {
  // Precompute particles ONCE per mount. `fire` is in the deps so
  // if the parent re-mounts us we get a fresh randomised burst.
  const particles = useMemo(() => {
    if (!fire) return [];
    return Array.from({ length: 26 }, (_, i) => {
      const color = COLORS[i % COLORS.length];
      // Horizontal drift: -220..220 px from center
      const dx = Math.round((Math.random() - 0.5) * 440);
      // Downward fall: 160..360 px
      const dy = 160 + Math.round(Math.random() * 200);
      const rot = Math.round(Math.random() * 720 - 360);
      const duration = 900 + Math.round(Math.random() * 600); // 0.9–1.5s
      const delay = Math.round(Math.random() * 150);
      const size = 6 + Math.round(Math.random() * 6); // 6–12 px
      const left = 40 + Math.random() * 20; // % — narrow band around center
      const radius = Math.random() > 0.5 ? '1px' : '50%';
      return { id: i, color, dx, dy, rot, duration, delay, size, left, radius };
    });
  }, [fire]);

  // Self-unmount trigger — let the parent drop the subtree.
  // `onDone` is held in a ref so the effect's deps stay stable on
  // [fire] alone. Callers commonly pass an inline arrow ({ onDone:
  // () => setX(false) }) that gets a fresh identity on every parent
  // render. Including it in the dep array used to clear+restart the
  // 1.7 s timer on each parent re-render — which, inside the
  // customizer (re-renders on every keystroke / qty bump), meant the
  // particles flew but onDone never fired and the Confetti subtree
  // stayed mounted indefinitely until the modal closed.
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);
  useEffect(() => {
    if (!fire) return;
    const t = window.setTimeout(() => {
      onDoneRef.current?.();
    }, DURATION_MS + 200); // small cushion past the longest particle
    return () => window.clearTimeout(t);
  }, [fire]);

  if (!fire || particles.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[700] overflow-visible"
      style={{ height: 0 }}
    >
      {/* Scoped keyframes — inline so the component is self-contained.
          Reduced-motion guard keeps this inert for opted-out users
          even if the parent forgets to gate the mount. */}
      <style>{`
        @keyframes va-confetti-fly {
          0% {
            transform: translate3d(0, 0, 0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translate3d(var(--vc-dx), var(--vc-dy), 0) rotate(var(--vc-rot));
            opacity: 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .va-confetti-piece { display: none !important; }
        }
      `}</style>
      {particles.map(p => (
        <span
          key={p.id}
          className="va-confetti-piece absolute block"
          style={{
            left: `${p.left}%`,
            top: 0,
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.radius,
            // Custom properties keep the keyframe rule generic while
            // per-particle trajectories stay inline.
            ['--vc-dx' as string]: `${p.dx}px`,
            ['--vc-dy' as string]: `${p.dy}px`,
            ['--vc-rot' as string]: `${p.rot}deg`,
            animation: `va-confetti-fly ${p.duration}ms cubic-bezier(.22,.61,.36,1) ${p.delay}ms forwards`,
            willChange: 'transform, opacity',
            boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
          }}
        />
      ))}
    </div>
  );
}

export default Confetti;
