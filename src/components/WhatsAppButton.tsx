import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { WA_MESSAGES, waLink } from '@/lib/whatsapp';
import { useLang } from '@/lib/langContext';

// Volume II §09.1 — floating WhatsApp Business CTA. Sits bottom-right
// above the BottomNav (fixed bottom-20) so it never overlaps the mobile
// nav bar. We hold it back from the initial paint for 10 seconds: a
// visitor who's just landed hasn't earned the interruption yet, and
// surfacing a chat shortcut on top of the hero distracts from the
// primary "Personnaliser" CTA. Once the timer fires we set a
// sessionStorage flag so the button stays visible across SPA route
// changes within the same tab without re-running the timer (and without
// awkwardly re-fading on every navigation).
//
// Suppressed on /checkout (anxiety: don't pull a buyer out of payment
// flow into a chat tool) and any /admin/* surface (operator UI, not
// customer-facing — a WA-Vision link there would be noise).
//
// Icon: lucide-react has no WA glyph; we render an inline SVG of the
// WhatsApp logo (Wikimedia Commons public domain mark) so we don't
// need a new dep. The brand-spec green is #25D366.

const SESSION_FLAG = 'va.wa.shown';
const REVEAL_DELAY_MS = 10_000;

const WhatsAppLogo = () => (
  <svg
    viewBox="0 0 32 32"
    width="28"
    height="28"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.638 3.41 4.547 4.34.616.3 2.94 1.205 3.604 1.205.674 0 1.92-.3 2.4-.78.143-.143.243-.43.243-.617 0-.115-.057-.43-.157-.515-.214-.144-2.18-1.075-2.453-1.075zM16 .5C7.435.5.5 7.435.5 16c0 2.95.85 5.708 2.293 8.045L.785 31.5l7.616-2.476C10.65 30.32 13.252 31 16 31c8.565 0 15.5-6.935 15.5-15.5S24.565.5 16 .5zm0 28c-2.535 0-4.892-.756-6.87-2.06L4.4 28.085l1.65-4.66C4.7 21.42 3.93 18.79 3.93 16 3.93 9.318 9.318 3.93 16 3.93S28.07 9.318 28.07 16 22.682 28.5 16 28.5z" />
  </svg>
);

export function WhatsAppButton() {
  const { pathname } = useLocation();
  const { lang } = useLang();
  // Localized aria-label — EN screen-reader users on the EN-toggled
  // site were hearing the French label, which is the kind of mismatch
  // that quietly tanks accessibility audits. No visible text inside
  // the button (icon only), so the aria-label is the entire a11y
  // surface and must follow `lang`.
  const ariaLabel = lang === 'en' ? 'Contact us on WhatsApp' : 'Contacter par WhatsApp';
  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return sessionStorage.getItem(SESSION_FLAG) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (visible) return;
    const t = window.setTimeout(() => {
      try {
        sessionStorage.setItem(SESSION_FLAG, '1');
      } catch {
        /* private mode / disabled storage — still show the button */
      }
      setVisible(true);
    }, REVEAL_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [visible]);

  // Route-level suppression. We check pathname rather than mounting/
  // unmounting via the router so the 10s timer keeps running when the
  // user is on /checkout — they may bounce back to /cart, and we don't
  // want to reset the gate just because they peeked at payment.
  const suppressed = pathname.startsWith('/checkout') || pathname.startsWith('/admin');
  if (!visible || suppressed) return null;

  return (
    <a
      href={waLink(WA_MESSAGES.default)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
      lang={lang}
      className="fixed bottom-20 right-4 z-30 w-14 h-14 bg-[#25D366] rounded-full flex items-center justify-center text-white shadow-lg hover:scale-110 hover:bg-[#1FB855] transition-all duration-200 animate-in fade-in focus:outline-none focus-visible:ring-4 focus-visible:ring-[#25D366]/40 focus-visible:ring-offset-2"
      style={{ boxShadow: '0 6px 20px rgba(37, 211, 102, 0.45)' }}
    >
      <WhatsAppLogo />
    </a>
  );
}

export default WhatsAppButton;
