import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLang } from '@/lib/langContext';

/**
 * Section 7.1 — Exit-intent modal.
 *
 * Fires once per session when a desktop visitor moves the cursor near
 * the top of the viewport (clientY < 50). Skipped on /checkout (we
 * never interrupt a converting visitor) and on touch devices (the
 * mousemove signal is meaningless without a pointer). The
 * "va_exit_shown" localStorage flag gates re-fire across the rest of
 * the session so we don't badger.
 *
 * Copy is anchored on the delivery date the buyer would have received
 * if they finished the order today, computed via a 3pm cutoff +
 * business-day rule (Section 6.3). The CTA recovers the cart at /cart.
 */

const STORAGE_KEY = 'va_exit_shown';

/**
 * Compute the projected delivery date assuming a 3pm America/Toronto
 * cutoff and 5 business days lead time. Orders past the cutoff (or on a
 * weekend) shift to the next business day before counting. Returns a
 * localized "vendredi 2 mai" / "Friday May 2" style string.
 */
function getDeliveryDate(lang: 'fr' | 'en'): string {
  const now = new Date();
  // Start "production-day" cursor at today; bump if past 3pm or weekend.
  const start = new Date(now);
  const isPastCutoff = now.getHours() >= 15;
  if (isPastCutoff) start.setDate(start.getDate() + 1);
  // Skip weekends to land on the next business day before counting lead.
  while (start.getDay() === 0 || start.getDay() === 6) {
    start.setDate(start.getDate() + 1);
  }
  // Add 5 business days for production + shipping.
  let added = 0;
  const delivery = new Date(start);
  while (added < 5) {
    delivery.setDate(delivery.getDate() + 1);
    const d = delivery.getDay();
    if (d !== 0 && d !== 6) added += 1;
  }
  const locale = lang === 'fr' ? 'fr-CA' : 'en-CA';
  return delivery.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

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
    /* private mode — fine, modal will just show again next visit */
  }
}

export function ExitIntent() {
  const { lang } = useLang();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Hard skip on checkout — never interrupt a converting visitor.
    if (location.pathname.startsWith('/checkout')) return;
    // Already shown this session/device.
    if (readShown()) return;
    // Touch-only devices don't generate the mousemove signal we rely
    // on, so don't bother attaching the listener at all.
    if (typeof window === 'undefined') return;
    const isTouchOnly = window.matchMedia?.('(hover: none)').matches;
    if (isTouchOnly) return;

    const onMove = (e: MouseEvent) => {
      if (e.clientY < 50) {
        setOpen(true);
        markShown();
        window.removeEventListener('mousemove', onMove);
      }
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [location.pathname]);

  if (!open) return null;

  const isFr = lang === 'fr';
  const deliveryDate = getDeliveryDate(isFr ? 'fr' : 'en');

  const handleResume = () => {
    setOpen(false);
    navigate('/cart');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-intent-title"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-[#0052CC]">
          {isFr ? 'Avant de partir —' : 'Before you go —'}
        </p>
        <h2
          id="exit-intent-title"
          className="mt-2 text-xl font-bold leading-tight text-zinc-900"
        >
          {isFr ? 'Ta commande aurait ete livree le ' : 'Your order would have arrived '}
          <span className="text-[#0052CC]">{deliveryDate}</span>
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600">
          {isFr
            ? '5 jours, et ton equipe serait en uniforme.'
            : '5 days, and your team would be in uniform.'}
        </p>

        <button
          type="button"
          onClick={handleResume}
          className="mt-5 w-full rounded-md bg-[#0052CC] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#003d99] focus:outline-none focus:ring-2 focus:ring-[#0052CC] focus:ring-offset-2"
        >
          {isFr ? 'Reprendre ma commande' : 'Resume my order'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mt-3 block w-full text-center text-xs text-zinc-500 underline-offset-2 hover:text-zinc-700 hover:underline focus:outline-none focus:ring-2 focus:ring-[#0052CC] rounded"
        >
          {isFr ? 'Non merci, je reviendrai plus tard' : 'No thanks, I will come back later'}
        </button>
      </div>
    </div>
  );
}

export default ExitIntent;
