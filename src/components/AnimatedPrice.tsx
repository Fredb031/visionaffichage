import { useEffect, useRef, useState } from 'react';
import { fmtMoney } from '@/lib/format';
import { useLang } from '@/lib/langContext';

type AnimatedPriceProps = {
  /** Raw amount. Will be passed through fmtMoney for locale-aware display. */
  value: number;
  /** Optional class applied to the outer wrapping span (font, size, color). */
  className?: string;
  /**
   * Reserved for a future override — e.g. if a caller one day wants USD.
   * Today we defer to fmtMoney which is hard-wired to CAD, so this prop
   * is accepted (for forward-compat) but only consumed by a custom formatter
   * if you pass one. When omitted, the currency used is whatever fmtMoney
   * emits for the active lang.
   */
  currency?: string;
};

/**
 * AnimatedPrice — renders a formatted money amount that "flips" whenever
 * the numeric value changes. The old value slides up and fades out while
 * the new value slides in from below, giving the running total a small
 * but reassuring hop every time qty / discounts / print fees change.
 *
 * Why this exists: the customizer total used to change silently. Users
 * would nudge a qty field, the number would snap to a new value, and some
 * doubted whether the math actually reacted. A 180 ms slide+fade makes
 * the reaction legible without becoming visual noise.
 *
 * Implementation: CSS transition + `key` remount pattern. Each time `value`
 * changes we bump a render key so React un-mounts the old span and mounts
 * a new one at the same absolute position. The old one is cloned briefly
 * on top, transitioning to opacity 0 / translateY(-6px). The new one
 * enters from opacity 0 / translateY(6px) and settles.
 *
 * Skipped animations:
 *  - First mount: we stash the initial value in a ref and don't animate
 *    until it differs, so opening the customizer doesn't flash from 0.
 *  - prefers-reduced-motion: instant swap, no transform, no opacity tween.
 *
 * The outer span is relatively positioned so the flying "old" clone can
 * be absolute-positioned over it without disturbing layout. `tabular-nums`
 * keeps digit widths stable mid-flip so the container doesn't twitch.
 */
export function AnimatedPrice({ value, className }: AnimatedPriceProps) {
  const { lang } = useLang();
  const formatted = fmtMoney(value, lang);

  // Track the previous value so we can decide whether to animate and what
  // to render for the outgoing clone.
  const prevValueRef = useRef<number>(value);
  const prevFormattedRef = useRef<string>(formatted);
  const isFirstMountRef = useRef<boolean>(true);

  // Bump each time a new flip begins so React remounts the incoming span.
  const [flipKey, setFlipKey] = useState<number>(0);
  // Snapshot of the outgoing formatted label, shown briefly above the new one.
  const [outgoing, setOutgoing] = useState<string | null>(null);

  // Reduced-motion: resolved once on mount. Matches the pattern used in
  // CountUp.tsx so behaviour stays consistent across the site.
  const prefersReducedRef = useRef<boolean>(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    prefersReducedRef.current = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
  }, []);

  useEffect(() => {
    if (isFirstMountRef.current) {
      // First render: don't animate, just remember what we showed so the
      // next change can animate from here.
      isFirstMountRef.current = false;
      prevValueRef.current = value;
      prevFormattedRef.current = formatted;
      return;
    }

    if (value === prevValueRef.current) return;

    if (prefersReducedRef.current) {
      prevValueRef.current = value;
      prevFormattedRef.current = formatted;
      return;
    }

    // Kick off a flip: capture the previous label for the outgoing clone,
    // then remount the incoming span so its CSS enter transition runs.
    setOutgoing(prevFormattedRef.current);
    setFlipKey((k) => k + 1);

    // Clear the outgoing clone once the transition ends. 220 ms gives the
    // enter/exit motion enough time with a small buffer; any later value
    // change will re-seed outgoing before this fires.
    const timer = window.setTimeout(() => setOutgoing(null), 260);

    prevValueRef.current = value;
    prevFormattedRef.current = formatted;

    return () => window.clearTimeout(timer);
  }, [value, formatted]);

  return (
    <span
      className={`relative inline-block tabular-nums ${className ?? ''}`}
      // Live region so screen-reader users hear the new total. The visual
      // flip is purely decorative.
      aria-live="polite"
      aria-atomic="true"
    >
      {/* Invisible spacer keeps the container sized to the current value
          so outgoing/incoming absolutely-positioned spans don't collapse
          the parent's height or width mid-animation. */}
      <span aria-hidden="true" className="invisible">
        {formatted}
      </span>

      {/* Outgoing clone: only present during a flip, absolutely positioned
          over the spacer. Starts at resting pose, transitions up+fade. */}
      {outgoing !== null && (
        <span
          key={`out-${flipKey}`}
          aria-hidden="true"
          className="absolute inset-0 flex items-baseline justify-end"
          style={{
            animation: 'animated-price-out 220ms cubic-bezier(.4,0,.2,1) forwards',
          }}
        >
          {outgoing}
        </span>
      )}

      {/* Incoming value: remounts on every flip via the key bump, so its
          enter animation re-runs from the start each time. */}
      <span
        key={`in-${flipKey}`}
        className="absolute inset-0 flex items-baseline justify-end"
        style={
          flipKey === 0 || prefersReducedRef.current
            ? undefined
            : { animation: 'animated-price-in 220ms cubic-bezier(.4,0,.2,1) forwards' }
        }
      >
        {formatted}
      </span>

      {/* Scoped keyframes — kept inline so the component is drop-in and
          doesn't require a tailwind.config.ts edit. */}
      <style>{`
        @keyframes animated-price-out {
          0%   { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-6px); }
        }
        @keyframes animated-price-in {
          0%   { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes animated-price-out {
            0%, 100% { opacity: 0; transform: none; }
          }
          @keyframes animated-price-in {
            0%, 100% { opacity: 1; transform: none; }
          }
        }
      `}</style>
    </span>
  );
}

export default AnimatedPrice;
