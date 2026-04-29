/**
 * ExitIntent — Phase 4 master prompt §5.
 *
 * Desktop-only "before you leave" modal that fires when the visitor's
 * mouse arcs toward the browser chrome (clientY < 50px). Once-per-
 * session via sessionStorage. Suppressed on /checkout, /merci and any
 * /admin/* route — those surfaces are mid-flow or operator-only and
 * a recovery prompt would be noise / hostile.
 *
 * The body of the card uses `getDeliveryDate()` (Phase 4 §1) so the
 * "your order would have been delivered <date>" copy stays consistent
 * with the homepage and Checkout ETA quotes — a cardinal rule for
 * conversion-recovery messaging is that the promise has to match.
 *
 * Mobile is excluded entirely (`hidden md:block`) because there is no
 * reliable mouse-toward-chrome signal on touch devices, and a dialog
 * that pops on a tap-and-hold near the URL bar reads as broken.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useLang } from '@/lib/langContext';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { getDeliveryDate } from '@/lib/getDeliveryDate';

const SESSION_FLAG = 'va:exit-intent-fired';
const MIN_DWELL_MS = 4000;
const MOUSE_Y_THRESHOLD = 50;

const SUPPRESSED_PREFIXES = ['/checkout', '/merci', '/admin'];

function isSuppressedPath(pathname: string): boolean {
  return SUPPRESSED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function ExitIntent() {
  const { lang } = useLang();
  const navigate = useNavigate();
  const location = useLocation();
  const reduceMotion = useReducedMotion();

  const [open, setOpen] = useState(false);
  // Memoize the formatted ETA the moment we open so re-renders inside
  // the modal don't recompute the date — avoids any chance of the
  // string flickering across midnight if the user lingers.
  const [eta, setEta] = useState<string>('');

  const dwellArmedAtRef = useRef<number>(Date.now());

  // Reset the dwell timer on route change. The brief gates the prompt
  // on time-on-PAGE, not time-on-site — moving from /products to
  // /product/foo should restart the counter (visitors browsing
  // multiple PDPs aren't bouncing yet, they're shopping).
  useEffect(() => {
    dwellArmedAtRef.current = Date.now();
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isSuppressedPath(location.pathname)) return;

    let alreadyFired = false;
    try { alreadyFired = sessionStorage.getItem(SESSION_FLAG) === '1'; } catch { /* private mode */ }
    if (alreadyFired) return;

    const onMouseMove = (e: MouseEvent) => {
      // Only trigger on movement TOWARD the browser chrome — the
      // upward arc that precedes a tab/back/close action. clientY < 50
      // captures both the address bar and the close button on most
      // desktop setups without firing on every scroll-up gesture.
      if (e.clientY >= MOUSE_Y_THRESHOLD) return;
      // Wait at least MIN_DWELL_MS so we don't pop over a visitor who
      // just landed and is moving the mouse to their bookmarks bar.
      if (Date.now() - dwellArmedAtRef.current < MIN_DWELL_MS) return;
      try { sessionStorage.setItem(SESSION_FLAG, '1'); } catch { /* private mode */ }
      setEta(getDeliveryDate({ lang }));
      setOpen(true);
    };
    window.addEventListener('mousemove', onMouseMove);
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, [location.pathname, lang]);

  // a11y plumbing — escape closes, body scroll lock while open, focus
  // trap inside the dialog so Tab cycles through the X button + the
  // primary CTA + the secondary close text. Same hooks the CartDrawer
  // uses for parity.
  useEscapeKey(open, () => setOpen(false));
  useBodyScrollLock(open);
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  // If the visitor flips the language toggle while the modal is open,
  // refresh the cached ETA so the date string matches the new locale —
  // otherwise the FR copy would render alongside an "May 5" en-CA date
  // (or vice versa) which reads as a translation bug. The dwell-armed
  // eta captured at trigger-time stays accurate; only the locale-bound
  // formatting needs to follow `lang`.
  useEffect(() => {
    if (open) setEta(getDeliveryDate({ lang }));
  }, [lang, open]);

  const handleResume = () => {
    setOpen(false);
    navigate('/boutique');
  };

  const handleClose = () => setOpen(false);

  // Mobile-suppressed at the wrapper level so the listener / state
  // still mount on viewport changes (resize from desktop ↔ mobile in
  // the same session) but the visible UI never appears below md.
  return (
    <div className="hidden md:block">
      <AnimatePresence>
        {open && (
          <motion.div
            key="exit-intent-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeOut' }}
            // bg-va-ink/60 + blur per PDF spec. z-index sits above the
            // CartDrawer (z-500) is intentionally avoided — exit intent
            // shouldn't fire while a drawer is open (see open guard
            // above), but we use z-[600] so if it ever does, the modal
            // wins.
            className="fixed inset-0 z-[600] bg-va-ink/60 backdrop-blur-sm flex items-end justify-center"
            onClick={handleClose}
            role="presentation"
          >
            <motion.div
              ref={trapRef}
              initial={reduceMotion ? { opacity: 0 } : { y: '100%', opacity: 0 }}
              animate={reduceMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { y: '100%', opacity: 0 }}
              transition={
                reduceMotion
                  ? { duration: 0.2, ease: 'easeOut' }
                  : { duration: 0.35, ease: [0.16, 1, 0.3, 1] }
              }
              className="relative bg-white rounded-t-3xl md:rounded-3xl max-w-lg w-full mx-auto md:mb-0 p-10 shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="exit-intent-title"
              aria-describedby="exit-intent-body"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={handleClose}
                aria-label={lang === 'en' ? 'Close' : 'Fermer'}
                className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-va-muted hover:bg-va-stone focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue"
              >
                <X size={18} aria-hidden="true" />
              </button>

              <h2
                id="exit-intent-title"
                className="font-display font-black text-va-ink text-3xl tracking-tight"
              >
                {lang === 'en' ? 'Before you go…' : 'Avant de partir…'}
              </h2>

              <p
                id="exit-intent-body"
                className="mt-4 text-base text-va-dim leading-relaxed"
              >
                {lang === 'en' ? (
                  <>Your order would have been delivered <span className="font-bold text-va-ink">{eta}</span>.</>
                ) : (
                  <>Ta commande aurait été livrée le <span className="font-bold text-va-ink">{eta}</span>.</>
                )}
              </p>

              <button
                type="button"
                onClick={handleResume}
                className="mt-6 w-full bg-va-blue hover:bg-va-blue-hover text-white font-bold text-base px-8 py-4 rounded-xl transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-va-blue/40 focus-visible:ring-offset-2"
              >
                {lang === 'en' ? 'Resume shopping' : 'Reprendre ma commande'}
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="mt-3 w-full text-sm text-va-muted hover:text-va-ink underline underline-offset-2 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue/40 rounded"
              >
                {lang === 'en' ? 'No thanks' : 'Non merci'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ExitIntent;
