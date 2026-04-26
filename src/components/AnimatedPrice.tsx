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

// Animation timing constants. Kept in one place so the inline keyframes
// and the cleanup timeout can't drift apart silently. The cleanup is
// intentionally a touch longer than the keyframe so any sub-frame jitter
// at the end of the transition still finishes painting before we yank
// the outgoing clone out of the DOM.
const ANIMATED_PRICE_DURATION_MS = 220;
const ANIMATED_PRICE_CLEANUP_MS = 260;

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
  // If the upstream value is non-finite (NaN/Infinity briefly emitted by
  // the customizer while a qty input is mid-edit) fmtMoney resolves to an
  // em-dash. Showing that em-dash mid-keystroke makes the running total
  // flicker to "—" and back, which is exactly the silent-twitch problem
  // this component was meant to mask. Pin the displayed label to the last
  // good formatted value instead, so a non-finite blip is visually a no-op.
  // Seed lazily and only from finite values: if the very first `value` is
  // NaN, eagerly storing fmtMoney(NaN) would lock the cache to "—" and
  // defeat the guard for every subsequent non-finite render.
  const lastGoodFormattedRef = useRef<string | null>(null);
  if (Number.isFinite(value)) {
    lastGoodFormattedRef.current = fmtMoney(value, lang);
  }
  const formatted = Number.isFinite(value)
    ? (lastGoodFormattedRef.current as string)
    : (lastGoodFormattedRef.current ?? fmtMoney(value, lang));

  // Track the previous value so we can decide whether to animate and what
  // to render for the outgoing clone.
  const prevValueRef = useRef<number>(value);
  const prevFormattedRef = useRef<string>(formatted);
  const isFirstMountRef = useRef<boolean>(true);

  // Bump each time a new flip begins so React remounts the incoming span.
  const [flipKey, setFlipKey] = useState<number>(0);
  // Snapshot of the outgoing formatted label, shown briefly above the new one.
  const [outgoing, setOutgoing] = useState<string | null>(null);

  // Reduced-motion: subscribe to the media query so a mid-session toggle
  // (System Preferences → Accessibility → Reduce Motion, or per-tab
  // emulation in DevTools) takes effect without a reload. Reading once
  // on mount left motion-sensitive users with bouncing prices for the
  // rest of the session if they enabled the preference after landing.
  const prefersReducedRef = useRef<boolean>(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedRef.current = mql.matches;
    const onChange = (e: MediaQueryListEvent) => {
      prefersReducedRef.current = e.matches;
    };
    // Older Safari (<14) only exposes addListener/removeListener.
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
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

    // NaN/Infinity guard: upstream price math can briefly emit NaN while a
    // qty input is being edited (empty string parsed as NaN, division by
    // zero on tier breakpoints, etc.). NaN !== NaN would otherwise trigger
    // a flip every keystroke, and screen-reader users would hear the
    // aria-live region announce "NaN" each time. Treat any non-finite
    // value as "no change" — keep the last good label on screen.
    if (!Number.isFinite(value)) return;

    if (value === prevValueRef.current) {
      // Value is unchanged but the formatted label may not be — e.g. the
      // user just toggled fr ↔ en, so the locale changed under us. Refresh
      // the cached label so the next genuine value flip animates from the
      // current-language string, not a stale fr/en snapshot.
      prevFormattedRef.current = formatted;
      return;
    }

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
    const timer = window.setTimeout(() => setOutgoing(null), ANIMATED_PRICE_CLEANUP_MS);

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
            animation: `animated-price-out ${ANIMATED_PRICE_DURATION_MS}ms cubic-bezier(.4,0,.2,1) forwards`,
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
            : { animation: `animated-price-in ${ANIMATED_PRICE_DURATION_MS}ms cubic-bezier(.4,0,.2,1) forwards` }
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
