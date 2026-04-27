/**
 * Vision Affichage — Cinematic intro animation
 *
 * Apple-tier 2.4-second sequence:
 *   0.00–0.20s   anticipation hold (dark surface, no motion)
 *   0.20–0.55s   horizon line draws out from center
 *   0.45–0.75s   line splits vertically into top + bottom
 *   0.70–1.30s   wordmark scales 1.05 → 1.00 + fades in (parallax depth)
 *   1.05–1.55s   gold accent line draws under the wordmark
 *   1.50–1.95s   sustain — let it breathe for one beat
 *   1.95–2.40s   fade-to-light: overlay washes from near-black to white
 *                so the user lands on a familiar surface, not a hard cut.
 *
 * Easing: ease-out cubic-bezier(0.16, 1, 0.3, 1) on every reveal —
 * fast attack, gentle settle, no elastic bounce.
 *
 * GSAP handles every timing; Web Audio API plays a single low chord
 * at the visual peak (the wordmark settle, t≈0.70s).
 * Skip-on-repeat via localStorage; reduced-motion + saveData fully bail.
 */
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { playLogoTone, unlockAudio, stopAllScheduledAudio } from './audio';
import './intro.css';

// Apple-tier ease-out — fast attack, gentle settle. Shared across every
// reveal tween for consistency. expo.out closely matches the
// cubic-bezier(0.16, 1, 0.3, 1) curve Apple uses for product reveals,
// without requiring the paid CustomEase plugin.
const EASE_OUT_EXPO = 'expo.out';

export interface IntroAnimationProps {
  onComplete: () => void;
  skipIfSeen?: boolean;
}

const SEEN_KEY = 'va_intro_seen';

export function IntroAnimation({ onComplete, skipIfSeen = true }: IntroAnimationProps) {
  const [showHint, setShowHint] = useState(false);
  const startedRef = useRef(false);
  const completedRef = useRef(false);
  // Snapshot the seen flag at construction time — not inside the
  // useEffect which runs after the first render. Returning visitors
  // used to see a ~16 ms flash of the black intro overlay before
  // the useEffect fired onComplete and the parent unmounted us.
  // Reading the flag before first render lets us skip rendering the
  // overlay body entirely on the 'already seen' path.
  const seenOnMountRef = useRef<boolean>(false);
  if (seenOnMountRef.current === false && !startedRef.current) {
    try { seenOnMountRef.current = typeof window !== 'undefined' && !!localStorage.getItem(SEEN_KEY); }
    catch { /* private mode — play the intro */ }
  }
  // Respect prefers-reduced-motion: a 4-second GSAP sequence with
  // elastic scales + yoyo breathe pulses is exactly the kind of
  // motion vestibular-sensitive users opt out of. The CSS-only guard
  // we had before only softened the exit fade — the full timeline
  // still played. Snapshot the media query at construction so we can
  // skip rendering the overlay entirely on this path, matching the
  // returning-visitor short-circuit.
  const reduceMotionOnMountRef = useRef<boolean>(false);
  if (reduceMotionOnMountRef.current === false && !startedRef.current) {
    try {
      reduceMotionOnMountRef.current =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch { /* older browser without matchMedia — play the intro */ }
  }
  // Low-power / data-saver mode: if the user has Data Saver turned on
  // (Chrome/Edge expose it via navigator.connection.saveData), they've
  // explicitly asked the browser to cut non-essential payloads. A 4s
  // branded intro with Web Audio synthesis is exactly that kind of
  // non-essential payload. Skipping here lines up with how we already
  // bail for prefers-reduced-motion and prevents a phone on cellular
  // from burning CPU + battery on the elastic/yoyo tween chain.
  const saveDataOnMountRef = useRef<boolean>(false);
  if (saveDataOnMountRef.current === false && !startedRef.current) {
    try {
      const conn = typeof navigator !== 'undefined'
        ? (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
        : undefined;
      saveDataOnMountRef.current = conn?.saveData === true;
    } catch { /* connection API not available — play the intro */ }
  }
  const skipOnMount =
    (skipIfSeen && seenOnMountRef.current) ||
    reduceMotionOnMountRef.current ||
    saveDataOnMountRef.current;
  // Track the live GSAP timeline so we can kill it on unmount. Without
  // this, a user who clicks through to /products before the 3.35s
  // intro completes triggers the timeline's onComplete callback on an
  // already-unmounted Index (setShowLoader(false) → stale-setState
  // warning + wasted tween work running in the background).
  const timelineRef = useRef<ReturnType<typeof gsap.timeline> | null>(null);
  // Shared skip handler, installed by the effect and invoked by the
  // on-screen "Passer / Skip" button. Ref so the render path can read
  // it without needing to re-subscribe the effect on every render.
  const skipFnRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Skip path: returning visitor → instant cross-fade. The setter
    // already try/catches for private mode (line 61), so mirror that
    // on the reader — Safari private windows throw SecurityError here
    // too and the resulting uncaught exception blocked onComplete
    // from firing, leaving the page stuck behind the intro overlay.
    let seen = false;
    try { seen = typeof window !== 'undefined' && !!localStorage.getItem(SEEN_KEY); }
    catch { /* private mode — treat as never seen so the intro still plays once */ }
    // Skip path: prefers-reduced-motion user → instant onComplete, no
    // GSAP timeline, no audio cues. Also mark as seen so a later
    // preference flip back to 'no-preference' doesn't replay the
    // intro unexpectedly on the next visit.
    let reduceMotion = false;
    try {
      reduceMotion =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch { /* older browser — play the intro */ }
    // Skip path: Data Saver / low-power mode → mirror reduced-motion
    // behavior. Mark as seen so flipping Data Saver off later doesn't
    // replay the intro on the next visit.
    let saveData = false;
    try {
      const conn = typeof navigator !== 'undefined'
        ? (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
        : undefined;
      saveData = conn?.saveData === true;
    } catch { /* connection API not available — play the intro */ }
    if ((skipIfSeen && seen) || reduceMotion || saveData) {
      if (reduceMotion || saveData) {
        try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* noop */ }
      }
      const overlay = document.getElementById('va-intro-overlay');
      if (overlay) overlay.style.display = 'none';
      onComplete();
      return;
    }

    const startIntro = async () => {
      if (startedRef.current) return;
      startedRef.current = true;
      setShowHint(false);

      // Try to unlock audio. Doesn't matter if it fails — visuals carry it alone.
      const audioOk = await unlockAudio();

      buildAndPlay(audioOk);
    };

    const buildAndPlay = (audioOk: boolean) => {
      const tl = gsap.timeline({
        onComplete: () => {
          // GUARD: if unmount killed the timeline, skip the parent
          // onComplete callback — it would setState on a dead Index.
          if (timelineRef.current !== tl) return;
          if (completedRef.current) return;
          completedRef.current = true;
          try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* noop */ }
          const overlay = document.getElementById('va-intro-overlay');
          if (overlay) {
            overlay.style.display = 'none';
            overlay.style.pointerEvents = 'none';
          }
          onComplete();
        },
      });
      timelineRef.current = tl;

      // Single audio cue — one low chord at the visual peak (when the
      // wordmark settles into place). No multi-note jingle. The horizon
      // tone + exit whisper layers are intentionally dropped: restraint
      // is what reads as premium.
      if (audioOk) {
        playLogoTone(0.70);
      }

      // ANTICIPATION — 0.00–0.20s. No motion. The waiting beat is what
      // makes the reveal feel intentional. We register a do-nothing
      // tween so the timeline has a concrete starting offset.
      tl.to({}, { duration: 0.20 }, 0);

      // STAGE 1 — 0.20–0.55s. Horizon line draws out from center.
      // 320ms feels like a confident draw without dragging.
      tl.fromTo(
        ['#va-intro-line-top', '#va-intro-line-bottom'],
        { width: 0, y: 0, opacity: 1 },
        { width: 280, duration: 0.35, ease: EASE_OUT_EXPO },
        0.20,
      );

      // STAGE 2 — 0.45–0.75s. Lines split vertically. Slight overlap
      // with the draw-in (10ms) so the split feels like a continuation,
      // not a stop-and-restart.
      tl.to('#va-intro-line-top', {
        y: -22,
        width: 220,
        duration: 0.30,
        ease: EASE_OUT_EXPO,
      }, 0.45)
      .to('#va-intro-line-bottom', {
        y: 22,
        width: 220,
        duration: 0.30,
        ease: EASE_OUT_EXPO,
      }, 0.45);

      // STAGE 3 — 0.70–1.30s. Wordmark reveal. Parallax depth: scale
      // 1.05 → 1.00 (subtle zoom-out) while fading in. 600ms is long
      // enough that the eye registers the settle, short enough not to
      // drag. Single tween on the parent SVG — the marks ride along.
      // Stagger of 350ms after Stage 1 satisfies the "one hero element
      // at a time" principle.
      tl.fromTo(
        '#va-intro-logo',
        { scale: 1.05, opacity: 0 },
        { scale: 1.0, opacity: 1, duration: 0.60, ease: EASE_OUT_EXPO },
        0.70,
      );

      // STAGE 4 — 1.05–1.55s. Gold accent line draws under the
      // wordmark, 350ms after the wordmark started its reveal.
      tl.fromTo(
        '#va-intro-accent',
        { width: 0, opacity: 0 },
        { width: 88, opacity: 1, duration: 0.50, ease: EASE_OUT_EXPO },
        1.05,
      );

      // STAGE 5 — 1.50–1.95s. Sustain. Hold the composed frame for
      // ~450ms. Without this beat the fade-to-light feels rushed.
      tl.to({}, { duration: 0.45 }, 1.50);

      // STAGE 6 — 1.95–2.40s. Fade-to-light. Cross-fade the overlay
      // from the dark radial to white, then fade overlay opacity at
      // the very end. Lines + accent gracefully thin to zero opacity
      // so they don't get stranded mid-frame as the bg whitens.
      tl.to('#va-intro-overlay', {
        background: 'radial-gradient(circle at 50% 50%, #ffffff 0%, #f7f7f7 70%)',
        duration: 0.40,
        ease: 'power2.inOut',
      }, 1.95)
      .to(['#va-intro-line-top', '#va-intro-line-bottom', '#va-intro-accent'], {
        opacity: 0,
        duration: 0.30,
        ease: 'power2.in',
      }, 1.95)
      .to('#va-intro-logo', {
        opacity: 0,
        duration: 0.25,
        ease: 'power2.in',
      }, 2.10)
      .to('#va-intro-overlay', {
        opacity: 0,
        duration: 0.30,
        ease: 'power1.inOut',
      }, 2.10);
    };

    // Try to auto-start (works on most desktop browsers)
    let hintTimer: ReturnType<typeof setTimeout> | null = null;
    let autoTimer: ReturnType<typeof setTimeout> | null = null;

    autoTimer = setTimeout(() => {
      if (!startedRef.current) startIntro();
    }, 200);

    hintTimer = setTimeout(() => {
      if (!startedRef.current) setShowHint(true);
    }, 1500);

    const onInteract = () => startIntro();
    // Shared short-circuit: kill timeline, cancel audio, mark seen,
    // hide overlay, fire onComplete exactly once. Used by both the
    // Escape-key handler and the on-screen Skip button.
    const shortCircuitToComplete = () => {
      if (timelineRef.current) {
        timelineRef.current.kill();
        timelineRef.current = null;
      }
      stopAllScheduledAudio();
      if (!completedRef.current) {
        completedRef.current = true;
        try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* noop */ }
        const overlay = document.getElementById('va-intro-overlay');
        if (overlay) {
          overlay.style.display = 'none';
          overlay.style.pointerEvents = 'none';
        }
        onComplete();
      }
    };
    skipFnRef.current = shortCircuitToComplete;
    // Escape skips straight to the main site — both before the
    // timeline has auto-started (impatient returning visitor who
    // landed during the 200ms pre-roll window) and mid-playback
    // (anyone who'd rather not watch the 2.4s sequence a second time).
    // We short-circuit the GSAP timeline by killing it and invoking
    // the same onComplete path the natural finish uses.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        shortCircuitToComplete();
        return;
      }
      // Modifier-only / navigation keys aren't a real "begin" gesture —
      // a user pressing Tab to focus the Skip button or holding Shift
      // shouldn't kick off the audio-unlock + timeline path early.
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' ||
          e.key === 'Meta' || e.key === 'Tab') {
        return;
      }
      // Any other key counts as a "begin" gesture (unlocks audio the
      // same way click / touchstart do).
      startIntro();
    };
    document.addEventListener('click', onInteract, { once: true });
    document.addEventListener('touchstart', onInteract, { once: true, passive: true });
    document.addEventListener('keydown', onKeyDown);

    return () => {
      if (hintTimer) clearTimeout(hintTimer);
      if (autoTimer) clearTimeout(autoTimer);
      document.removeEventListener('click', onInteract);
      document.removeEventListener('touchstart', onInteract);
      document.removeEventListener('keydown', onKeyDown);
      // Kill the GSAP timeline so its onComplete doesn't fire after
      // unmount — would otherwise call onComplete() on a dead Index.
      if (timelineRef.current) {
        timelineRef.current.kill();
        timelineRef.current = null;
      }
      // Cancel still-pending audio cues. The exit whisper is scheduled
      // 2.80s into the timeline, so an early click-through used to
      // play it over the freshly-rendered next page.
      stopAllScheduledAudio();
      // Drop the skip handler — it closes over the unmounted onComplete.
      skipFnRef.current = null;
    };
  }, [onComplete, skipIfSeen]);

  // Resolve display language the same way the hint does, so the
  // Skip button label matches the rest of the intro for bilingual
  // users.
  const resolveIsEn = (): boolean => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('vision-lang') : null;
      if (stored === 'en') return true;
      if (stored === 'fr') return false;
      return typeof navigator !== 'undefined' && /^en/.test(navigator.language);
    } catch {
      return typeof navigator !== 'undefined' && /^en/.test(navigator.language);
    }
  };

  // Returning visitor: skip rendering the overlay entirely so there's
  // no single-frame flash while the useEffect runs onComplete.
  if (skipOnMount) return null;

  return (
    <div id="va-intro-overlay" role="dialog" aria-label={resolveIsEn() ? 'Brand intro animation' : "Animation d'introduction"}>
      <div id="va-intro-line-top" className="intro-line" aria-hidden="true" />
      <div id="va-intro-line-bottom" className="intro-line" aria-hidden="true" />

      <svg
        id="va-intro-logo"
        viewBox="0 0 181.1 85.73"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Real Vision Affichage VA mark — exact paths from brand SVG */}
        <polygon
          id="va-mark-1"
          className="va-mark"
          points="0 0 33.76 0 66.38 56.58 77.83 37.15 111.02 37.15 124.85 61.46 96.71 61.46 82.98 85.73 50.04 85.73 0 0"
        />
        <polygon
          id="va-mark-2"
          className="va-mark"
          points="98.99 0 131.42 0 181.1 85.73 147.78 85.73 98.99 0"
        />
      </svg>
      {/* Subtle gold accent line that draws under the logo at exit — premium signature */}
      <div id="va-intro-accent" />

      {/* Skip button — lets users bail without waiting the full 2.4s.
          Mirrors the Escape key + reduced-motion / saveData skip paths
          and runs through the same completion handler so the parent
          sees exactly one onComplete invocation. stopPropagation
          prevents the document-level click listener from also firing
          startIntro() mid-teardown. */}
      <button
        type="button"
        aria-label={resolveIsEn() ? 'Skip intro animation' : "Passer l'animation d'introduction"}
        onClick={(e) => {
          e.stopPropagation();
          skipFnRef.current?.();
        }}
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          padding: '8px 14px',
          background: 'transparent',
          color: 'rgba(255, 255, 255, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          borderRadius: 999,
          fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          fontSize: 11,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          pointerEvents: 'auto',
        }}
        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 hover:text-white/90 hover:border-white/40 transition-colors"
      >
        {resolveIsEn() ? 'Skip' : 'Passer'}
      </button>

      <div id="va-intro-hint" className={showHint ? 'show' : ''}>
        {(() => {
          // Honor the user's chosen site language (stored by langContext
          // under 'vision-lang') instead of navigator.language. A French-
          // speaking user on an EN-locale browser who toggled to FR would
          // otherwise see 'Tap to begin' here while the rest of the site
          // is in French. Fall back to navigator.language when the user
          // has not picked a language yet (first visit, before the toggle).
          let isEn = false;
          try {
            const stored = typeof window !== 'undefined' ? localStorage.getItem('vision-lang') : null;
            if (stored === 'en') isEn = true;
            else if (stored === 'fr') isEn = false;
            else isEn = typeof navigator !== 'undefined' && /^en/.test(navigator.language);
          } catch {
            isEn = typeof navigator !== 'undefined' && /^en/.test(navigator.language);
          }
          return isEn ? 'Tap to begin' : 'Touche pour commencer';
        })()}
      </div>
    </div>
  );
}
