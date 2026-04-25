import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Star, X } from 'lucide-react';
import { useLang } from '@/lib/langContext';

/**
 * Section 7.2 — Scroll-triggered peer testimonial.
 *
 * Slides in from bottom-right when the visitor passes 60% scroll
 * depth, once per session ("va_testimonial_shown"), never on
 * /checkout. One quote is picked at random from a 3-entry pool so
 * repeat visitors don't always see the same face.
 */

const STORAGE_KEY = 'va_testimonial_shown';

interface Testimonial {
  fr: string;
  en: string;
  name: string;
  industryFr: string;
  industryEn: string;
}

const POOL: Testimonial[] = [
  {
    fr: 'Commande passee mardi, equipe en uniforme lundi suivant. Pas une excuse.',
    en: 'Ordered Tuesday, team in uniform the following Monday. No excuses.',
    name: 'Samuel L.',
    industryFr: 'Paysagement',
    industryEn: 'Landscaping',
  },
  {
    fr: 'Le rendu sur le chantier vaut la difference. Mes gars sont fiers.',
    en: 'The look on-site is worth it. My guys are proud.',
    name: 'William B.',
    industryFr: 'Construction',
    industryEn: 'Construction',
  },
  {
    fr: 'Service rapide, broderie impeccable. Je recommande sans hesiter.',
    en: 'Fast service, flawless embroidery. I recommend without hesitation.',
    name: 'Marie-Eve T.',
    industryFr: 'Services',
    industryEn: 'Services',
  },
];

function readShown(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function markShown() {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* private mode — fine */
  }
}

export function ScrollTestimonial() {
  const { lang } = useLang();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Pick a quote once per mount so it stays stable while visible.
  const pick = useMemo<Testimonial>(
    () => POOL[Math.floor(Math.random() * POOL.length)],
    [],
  );

  useEffect(() => {
    if (location.pathname.startsWith('/checkout')) return;
    if (readShown()) return;
    if (typeof window === 'undefined') return;

    const onScroll = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const ratio = window.scrollY / scrollable;
      if (ratio >= 0.6) {
        setOpen(true);
        markShown();
        window.removeEventListener('scroll', onScroll);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    // Re-check on mount in case the page is already scrolled past the
    // threshold (e.g. anchor navigation).
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [location.pathname]);

  if (!open) return null;

  const isFr = lang === 'fr';
  const quote = isFr ? pick.fr : pick.en;
  const industry = isFr ? pick.industryFr : pick.industryEn;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[55] w-full max-w-xs rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl ring-1 ring-black/5 animate-in slide-in-from-bottom-4 fade-in duration-300"
      style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label={isFr ? 'Fermer' : 'Close'}
        className="absolute right-2 top-2 rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>

      <div className="flex items-center gap-0.5 text-amber-400" aria-label="5 / 5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className="h-4 w-4 fill-current" aria-hidden="true" />
        ))}
      </div>

      <p className="mt-2 pr-4 text-sm leading-relaxed text-zinc-800">
        &ldquo;{quote}&rdquo;
      </p>
      <p className="mt-2 text-xs font-medium text-zinc-500">
        {pick.name} <span aria-hidden="true">·</span> {industry}
      </p>
    </div>
  );
}

export default ScrollTestimonial;
