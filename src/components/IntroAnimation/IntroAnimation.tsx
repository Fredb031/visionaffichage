/**
 * Vision Affichage — Cinematic intro animation
 *
 * 4.2-second sequence: void → horizon line → split → logo emerges →
 * breathe → collapse → reveal main site.
 *
 * GSAP handles every timing; Web Audio API synthesizes 3 sound layers.
 * Skip-on-repeat via localStorage.
 */
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { playHorizonTone, playLogoTone, playExitWhisper, unlockAudio } from './audio';
import './intro.css';

interface IntroAnimationProps {
  onComplete: () => void;
  skipIfSeen?: boolean;
}

const SEEN_KEY = 'va_intro_seen';

export function IntroAnimation({ onComplete, skipIfSeen = true }: IntroAnimationProps) {
  const [showHint, setShowHint] = useState(false);
  const startedRef = useRef(false);
  const completedRef = useRef(false);

  useEffect(() => {
    // Skip path: returning visitor → instant cross-fade
    if (skipIfSeen && typeof window !== 'undefined' && localStorage.getItem(SEEN_KEY)) {
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

      // Audio cues — only if unlocked
      if (audioOk) {
        playHorizonTone(0);   // fires immediately at timeline t=0 (which is phase 1 start)
        playLogoTone(0.95);   // ~1.55s into the visual sequence (phase 1 was already 0.6s in)
        playExitWhisper(2.80); // phase 5 collapse
      }

      // PHASE 1 — Horizon line draws (0.00s relative to timeline = 0.60s after start)
      tl.fromTo(
        ['#va-intro-line-top', '#va-intro-line-bottom'],
        { width: 0 },
        { width: 280, duration: 0.50, ease: 'power4.out', stagger: 0 },
        0,
      );

      // PHASE 2 — Lines split apart (relative t = 0.50)
      tl.to('#va-intro-line-top', {
        y: -28,
        width: 240,
        duration: 0.45,
        ease: 'power2.inOut',
      }, 0.50)
      .to('#va-intro-line-bottom', {
        y: 28,
        width: 240,
        duration: 0.45,
        ease: 'power2.inOut',
      }, 0.50);

      // PHASE 3 — Logo emerges (relative t = 0.95)
      tl.to('#va-mark-1', {
        scale: 1,
        duration: 0.80,
        ease: 'elastic.out(1, 0.75)',
      }, 0.95)
      .to('#va-mark-2', {
        scale: 1,
        duration: 0.80,
        ease: 'elastic.out(1, 0.75)',
      }, 1.05)
      .to(['#va-intro-line-top', '#va-intro-line-bottom'], {
        width: 320,
        duration: 0.60,
        ease: 'power3.out',
      }, 1.05);

      // PHASE 4 — Breathe (relative t = 2.10)
      tl.to(['#va-intro-line-top', '#va-intro-line-bottom'], {
        opacity: 0.4,
        duration: 0.35,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: 1,
      }, 2.10)
      .to('#va-intro-logo', {
        scale: 1.008,
        duration: 0.35,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: 1,
      }, 2.10);

      // PHASE 5 — Collapse (relative t = 2.80)
      tl.to('#va-intro-logo', {
        opacity: 0,
        duration: 0.35,
        ease: 'power2.in',
      }, 2.80)
      .to('#va-intro-line-top', {
        y: 0,
        width: 0,
        duration: 0.40,
        ease: 'power4.in',
      }, 2.80)
      .to('#va-intro-line-bottom', {
        y: 0,
        width: 0,
        duration: 0.40,
        ease: 'power4.in',
      }, 2.80)
      .to('#va-intro-overlay', {
        opacity: 0,
        duration: 0.25,
        ease: 'power1.in',
      }, 3.35);
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
    document.addEventListener('click', onInteract, { once: true });
    document.addEventListener('touchstart', onInteract, { once: true, passive: true });
    document.addEventListener('keydown', onInteract, { once: true });

    return () => {
      if (hintTimer) clearTimeout(hintTimer);
      if (autoTimer) clearTimeout(autoTimer);
      document.removeEventListener('click', onInteract);
      document.removeEventListener('touchstart', onInteract);
      document.removeEventListener('keydown', onInteract);
    };
  }, [onComplete, skipIfSeen]);

  return (
    <div id="va-intro-overlay" aria-hidden="true">
      <div id="va-intro-line-top" className="intro-line" />
      <div id="va-intro-line-bottom" className="intro-line" />

      <svg
        id="va-intro-logo"
        viewBox="0 0 120 80"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Geometric V-A mark recreated as two angular polygons.
            Each polygon scales independently from its own center for staggered emergence. */}
        <polygon
          id="va-mark-1"
          className="va-mark"
          points="8,12 38,12 60,68 50,68 28,28 18,28 32,68 22,68"
        />
        <polygon
          id="va-mark-2"
          className="va-mark"
          points="60,68 80,28 90,28 76,52 90,52 96,40 110,40 100,68 92,68 88,60 80,60 84,68"
        />
      </svg>

      <div id="va-intro-hint" className={showHint ? 'show' : ''}>
        Touche pour commencer
      </div>
    </div>
  );
}
