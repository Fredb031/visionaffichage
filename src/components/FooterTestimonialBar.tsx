import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';

// Mega Blueprint Section 11 #10 — final-trust signal that sits above
// SiteFooter columns. Shows one short five-star review at a time and
// rotates every 6s so a visitor about to leave the site catches one
// last social-proof beat without reading a wall of testimonials. The
// homepage already has a full carousel; this bar is the tail
// reminder.
//
// Source data is inline because src/data/reviews.ts hasn't been
// created in the homepage rebuild yet — when it lands, this list can
// be swapped for an import without touching the rotation logic.
const REVIEW_LINES = [
  { name: 'Samuel L.', industry: 'Paysagement', text: 'Reçu en 4 jours. Qualité parfaite.' },
  { name: 'William B.', industry: 'Construction', text: 'Le meilleur fournisseur d\u2019uniformes au Québec.' },
  { name: 'Marie-Eve T.', industry: 'Services', text: 'Mon équipe adore les nouveaux uniformes.' },
  { name: 'Jean-Philippe R.', industry: 'Plomberie', text: 'Commande de 20 pièces livrée en seulement 4 jours.' },
  { name: 'Alexandre D.', industry: 'Rénovation', text: 'Super facile à commander, résultat parfait à chaque fois.' },
  { name: 'Maxime L.', industry: '\u00c9lectrique', text: 'Le meilleur fournisseur d\u2019uniformes au Québec. Point final.' },
] as const;

const ROTATION_MS = 6000;
const FADE_MS = 400;

export function FooterTestimonialBar() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // Drives the opacity transition on each swap. We toggle to false
  // briefly before advancing the index, then back to true so the new
  // line fades in — without the staged toggle, swapping content and
  // class in the same frame skips the transition entirely.
  const [visible, setVisible] = useState(true);
  // Pin to the first entry under prefers-reduced-motion. Reading the
  // media query lazily inside the effect avoids a hydration mismatch
  // and keeps the static initial render deterministic.
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion || paused) return;
    // Track the inner timeout so an unmount or pause mid-fade can't
    // leave a pending setState that fires after cleanup.
    let fadeTimeout: number | undefined;
    const tick = window.setInterval(() => {
      // Fade out → swap → fade in. The inner timeout matches the CSS
      // transition duration so the new line never pops in mid-fade.
      setVisible(false);
      fadeTimeout = window.setTimeout(() => {
        setIndex(i => (i + 1) % REVIEW_LINES.length);
        setVisible(true);
      }, FADE_MS);
    }, ROTATION_MS);
    return () => {
      window.clearInterval(tick);
      if (fadeTimeout !== undefined) window.clearTimeout(fadeTimeout);
    };
  }, [reducedMotion, paused]);

  const review = REVIEW_LINES[reducedMotion ? 0 : index];

  return (
    <section
      aria-label="Témoignages clients"
      className="w-full bg-brand-grey-light bg-[#F5F2EC] py-6 px-6"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div
        className="max-w-[1100px] mx-auto flex items-center justify-center text-center"
        // aria-live polite so screen readers pick up the new review
        // when it rotates without interrupting whatever the user is
        // hearing — matches the visual subtlety of the fade.
        aria-live="polite"
      >
        <p
          className="text-sm md:text-base text-[#1B3A6B] flex flex-wrap items-center justify-center gap-x-2 gap-y-1"
          style={{
            opacity: visible ? 1 : 0,
            transition: `opacity ${FADE_MS}ms ease-in-out`,
          }}
        >
          <span className="inline-flex items-center gap-0.5 text-[#E8A838]" aria-label="5 étoiles sur 5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={14} fill="currentColor" strokeWidth={0} aria-hidden="true" />
            ))}
          </span>
          <span className="italic">&laquo;&nbsp;{review.text}&nbsp;&raquo;</span>
          <span className="text-[#1B3A6B]/70">
            &mdash; {review.name}, {review.industry}
          </span>
        </p>
      </div>
    </section>
  );
}
