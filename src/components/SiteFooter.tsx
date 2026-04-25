import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Gift, Instagram, Facebook } from 'lucide-react';
import { toast } from 'sonner';
import { useLang } from '@/lib/langContext';
import { isValidEmail, normalizeInvisible } from '@/lib/utils';
import { SubmitButton, type SubmitButtonState } from '@/components/SubmitButton';

// Shape of a single subscriber row persisted to localStorage. Keeping
// the captured-at timestamp alongside the email lets a future backend
// swap deduplicate by address while still ordering by signup recency
// (and makes the ledger self-describing for manual inspection).
type NewsletterRow = { email: string; at: number };
const NEWSLETTER_KEY = 'vision-newsletter-subscribers';

export function SiteFooter() {
  const { lang } = useLang();
  const [email, setEmail] = useState('');
  // Surfaces a soft-error line when isValidEmail rejects the submitted
  // address. Before this, the form swallowed "a@b.c"-style inputs that
  // pass the browser's type=email check but fail our stricter regex —
  // the user saw nothing, assumed it worked, and never got a newsletter.
  const [emailErr, setEmailErr] = useState(false);
  // Task 17.4 — morphing submit: loading spinner during the synchronous
  // dedupe/write beat, then a gold check for 2s before reverting so the
  // signup feels acknowledged instead of silently toast-only.
  const [submitState, setSubmitState] = useState<SubmitButtonState>('idle');
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  // Track the two pending setTimeouts that walk submitState through
  // loading → success → idle. Without this, an unmount mid-flight (or
  // a rapid second submit) left orphaned timers that fired
  // setState on an unmounted component — React's
  // "Can't perform a state update on an unmounted component" warning,
  // plus stacked timers if the user resubmitted before the 350 ms
  // dwell expired.
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
  }, []);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    // Use the same full normalization pipeline as isValidEmail applies
    // internally (normalizeInvisible + trim + lower). Without this step,
    // a paste with a zero-width space would pass isValidEmail (which
    // strips invisibles before the regex check) but we'd then store the
    // RAW pasted value in localStorage — the backend would bounce that
    // address when a real newsletter send fires.
    const normalized = normalizeInvisible(email).trim().toLowerCase();
    if (!isValidEmail(normalized)) {
      setEmailErr(true);
      return;
    }
    setEmailErr(false);
    setSubmitState('loading');
    let duplicate = false;
    try {
      const raw = JSON.parse(localStorage.getItem(NEWSLETTER_KEY) ?? '[]');
      // Defensive: only keep rows that match the expected shape so a
      // corrupted entry doesn't poison the dedupe check below. A devtools
      // edit or stale older-schema row (prior builds stored plain strings)
      // could slip in; filtering here means the ledger self-heals.
      const arr: unknown[] = Array.isArray(raw) ? raw : [];
      const clean: NewsletterRow[] = arr.filter(
        (v): v is NewsletterRow =>
          !!v && typeof v === 'object' && typeof (v as { email?: unknown }).email === 'string'
            && typeof (v as { at?: unknown }).at === 'number',
      );
      duplicate = clean.some(row => row.email === normalized);
      if (!duplicate) {
        clean.push({ email: normalized, at: Date.now() });
        // Keep only the most-recent 2000 — a brand-new subscriber
        // is the freshest and stays in the list. Cap AFTER append so
        // boundary case never overflows by one.
        const capped = clean.slice(-2000);
        localStorage.setItem(NEWSLETTER_KEY, JSON.stringify(capped));
      }
    } catch { /* noop */ }

    // Short loading dwell so the spinner is visible before the tick —
    // the write above is synchronous, so without this delay the state
    // flips idle→success in a single frame and the user misses the beat.
    // Cancel any in-flight timer first so a rapid re-submit doesn't
    // stack two success cycles racing each other.
    if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    loadingTimerRef.current = window.setTimeout(() => {
      loadingTimerRef.current = null;
      if (duplicate) {
        toast.success(
          lang === 'en' ? 'Already subscribed — thank you!' : 'Déjà inscrit(e) — merci !',
        );
      } else {
        toast.success(
          lang === 'en'
            ? 'Subscribed! Your code: VISION10'
            : 'Inscription réussie ! Voici ton code : VISION10',
          { duration: 6000 },
        );
      }
      setSubmitState('success');
      setEmail('');
      // Hold the tick for 2s then revert — long enough to read "Envoyé"
      // but short enough that a user who wants to subscribe another
      // address doesn't feel locked out.
      successTimerRef.current = window.setTimeout(() => {
        successTimerRef.current = null;
        setSubmitState('idle');
      }, 2000);
      // Refocus the input so a keyboard / screen-reader user can subscribe
      // another address without tabbing back from <body>.
      emailInputRef.current?.focus();
    }, 350);
  };

  return (
    <footer className="bg-brand-black text-white pt-14 pb-8 px-6 md:px-10 mt-12">
      <div className="max-w-[1100px] mx-auto">
        {/* Newsletter signup band — prominent incentive above the link columns.
            The concrete "what you get" headline and code-reveal-on-submit convert
            meaningfully better than a generic "stay in the loop" eyebrow, and the
            Mail icon anchors the offer visually on mobile where the H3 wraps. */}
        <div className="grid md:grid-cols-2 gap-8 pb-10 border-b border-white/10">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[2px] text-brand-blue mb-2">
              <Gift size={12} aria-hidden="true" className="-mt-px" />
              <span>
                {lang === 'en' ? 'Exclusive promo' : 'Promo exclusive'}
              </span>
            </div>
            <h3 className="text-2xl md:text-3xl font-extrabold tracking-[-0.5px] mb-2">
              {lang === 'en'
                ? '10% off your first order'
                : '10\u00a0% sur ta première commande'}
            </h3>
            <p className="text-sm text-white/60">
              {lang === 'en'
                ? 'Subscribe to get VISION10 and upcoming deals'
                : 'Abonne-toi pour recevoir le code VISION10 + nos promos'}
            </p>
          </div>

          <form
            onSubmit={handleSubscribe}
            className="flex flex-col self-center w-full max-w-md"
            aria-label={lang === 'en' ? 'Newsletter signup' : 'Inscription à l\u2019infolettre'}
          >
            <div className="flex items-stretch">
              <div className="relative flex-1">
                <Mail
                  size={16}
                  aria-hidden="true"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-blue pointer-events-none"
                />
                <input
                  ref={emailInputRef}
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); if (emailErr) setEmailErr(false); }}
                  placeholder={lang === 'en' ? 'your@email.com' : 'ton@courriel.com'}
                  aria-label={lang === 'en' ? 'Email address' : 'Adresse courriel'}
                  aria-required="true"
                  aria-invalid={emailErr || undefined}
                  // Task 6.9 — point the input at the error message id
                  // so SRs re-read the hint when the user refocuses
                  // the field after the role=alert one-shot announce.
                  aria-describedby={emailErr ? 'footer-newsletter-error' : undefined}
                  className={`w-full pl-9 pr-4 py-3 bg-white/10 border rounded-l-xl text-sm placeholder:text-white/40 outline-none focus:bg-white/15 focus-visible:ring-2 focus-visible:ring-brand-blue/50 transition-shadow ${
                    emailErr ? 'border-rose-400/70 focus:border-rose-300' : 'border-white/20 focus:border-brand-blue'
                  }`}
                  autoComplete="email"
                  required
                />
              </div>
              <SubmitButton
                state={submitState}
                disabled={!email.trim()}
                className="px-5 bg-brand-blue text-brand-white font-extrabold text-sm rounded-r-xl hover:bg-brand-blue-hover disabled:opacity-60 disabled:hover:bg-brand-blue transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/60 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-black"
              >
                {lang === 'en' ? 'Subscribe' : "S'abonner"}
              </SubmitButton>
            </div>
            {emailErr ? (
              <p
                id="footer-newsletter-error"
                role="alert"
                aria-live="polite"
                className="text-[11px] text-rose-300 font-semibold mt-1.5 pl-1"
              >
                {lang === 'en'
                  ? 'That email doesn\u2019t look valid — double-check it and try again.'
                  : 'Ce courriel ne semble pas valide — vérifie-le et réessaie.'}
              </p>
            ) : (
              // Privacy microcopy — concrete "what won't happen" beats marketing-speak
              // and matches the unsubscribe escape hatch promised in the toast.
              <p className="text-[11px] text-white/50 mt-1.5 pl-1">
                {lang === 'en'
                  ? 'No spam. One-click unsubscribe.'
                  : 'Pas de spam. Désabonnement en 1 clic.'}
              </p>
            )}
          </form>
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 py-10 border-b border-white/10">
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-3">
              {lang === 'en' ? 'Shop' : 'Boutique'}
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/products" className="text-white/80 hover:text-brand-blue">{lang === 'en' ? 'All products' : 'Tous les produits'}</Link></li>
              <li><Link to="/products?cat=tshirts" className="text-white/80 hover:text-brand-blue">T-Shirts</Link></li>
              <li><Link to="/products?cat=chandails" className="text-white/80 hover:text-brand-blue">Hoodies</Link></li>
              <li><Link to="/products?cat=headwear" className="text-white/80 hover:text-brand-blue">{lang === 'en' ? 'Caps & Beanies' : 'Casquettes & Tuques'}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-3">
              {lang === 'en' ? 'Company' : 'Entreprise'}
            </h4>
            <ul className="space-y-2 text-sm">
              {/* Task 11.9 — "About us" previously pointed to the #about
                  home-page anchor, which 404'd the hash scroll when the
                  visitor was on a subpage. /about is a real route with
                  the founder story, values, and stat tiles. */}
              <li><Link to="/about" className="text-white/80 hover:text-brand-blue">{lang === 'en' ? 'About us' : 'À propos'}</Link></li>
              <li><a href="#testimonials" className="text-white/80 hover:text-brand-blue">{lang === 'en' ? 'Testimonials' : 'Témoignages'}</a></li>
              <li><a href="#how-it-works" className="text-white/80 hover:text-brand-blue">{lang === 'en' ? 'How it works' : 'Comment ça marche'}</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-3">
              {lang === 'en' ? 'Support' : 'Aide'}
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/track" className="text-white/80 hover:text-brand-blue">{lang === 'en' ? 'Track an order' : 'Suivre une commande'}</Link></li>
              <li><Link to="/account" className="text-white/80 hover:text-brand-blue">{lang === 'en' ? 'My account' : 'Mon compte'}</Link></li>
              {/* Task 11.10 — previously this pointed to a raw mailto:,
                  which left mobile users without a Mail client stranded.
                  /contact resolves to a real page with phone, map, hours,
                  and a form fallback; the mailto is still one click
                  deeper in the contact card on that page. */}
              <li><Link to="/contact" className="text-white/80 hover:text-brand-blue">Contact</Link></li>
              {/* Task 11.6 — Blog / content hub entrypoint. Dropped into
                  the Support column (alongside tracking, account, and
                  contact) because merch-tips articles serve the same
                  "helping a buyer succeed post-order" spirit as the
                  other resources here. */}
              <li><Link to="/blog" className="text-white/80 hover:text-brand-blue">{lang === 'en' ? 'Blog' : 'Blogue'}</Link></li>
            </ul>
          </div>

          {/* Legal — Task 14.8. Previously nothing in the footer linked to
              /privacy, /terms, /returns, /accessibility, so those routes
              were undiscoverable and (until this commit) 404'd. Kept as a
              column for parity with the other sections; hover underline
              reinforces "these are terms/agreements you can click to read"
              versus the hue-shift used for marketing links above. */}
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-3">
              {lang === 'en' ? 'Legal' : 'Légal'}
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/privacy" className="text-white/80 hover:text-brand-blue hover:underline underline-offset-4 decoration-brand-blue/60">{lang === 'en' ? 'Privacy policy' : 'Politique de confidentialité'}</Link></li>
              <li><Link to="/terms" className="text-white/80 hover:text-brand-blue hover:underline underline-offset-4 decoration-brand-blue/60">{lang === 'en' ? 'Terms of service' : "Conditions d'utilisation"}</Link></li>
              <li><Link to="/returns" className="text-white/80 hover:text-brand-blue hover:underline underline-offset-4 decoration-brand-blue/60">{lang === 'en' ? 'Return policy' : 'Politique de retour'}</Link></li>
              <li><Link to="/accessibility" className="text-white/80 hover:text-brand-blue hover:underline underline-offset-4 decoration-brand-blue/60">{lang === 'en' ? 'Accessibility' : 'Accessibilité'}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-3">
              {lang === 'en' ? 'Reach us' : 'Nous joindre'}
            </h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2 text-white/80">
                <Phone size={12} className="text-brand-blue" aria-hidden="true" />
                <a href="tel:+13673804808" className="hover:text-brand-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/60 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-black rounded">367-380-4808</a>
              </li>
              <li className="flex items-center gap-2 text-white/80 break-all">
                <Mail size={12} className="text-brand-blue" aria-hidden="true" />
                <a href="mailto:info@visionaffichage.com" className="hover:text-brand-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/60 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-black rounded">info@visionaffichage.com</a>
              </li>
              <li className="flex items-center gap-2 text-white/80">
                <MapPin size={12} className="text-brand-blue" aria-hidden="true" />
                Québec, Canada
              </li>
            </ul>
          </div>
        </div>

        {/* Social row — Task 1.17. One-click bridge from the site to the
            brand's social presence. We show the handle text next to each
            icon rather than fabricating follower counts; a backend resolver
            can later swap the handle for a formatted count (e.g. "2.3k")
            once the Instagram/Facebook Graph tokens are in place.
            TODO(1.17): replace handle text with live follower count via
            a backend fetch (IG Graph API + FB Pages API) when creds land. */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 py-5 border-b border-white/10">
          <span className="text-[11px] font-bold uppercase tracking-[2px] text-white/50">
            {lang === 'en' ? 'Follow us' : 'Suivez-nous'}
          </span>
          <a
            href="https://instagram.com/visionaffichage"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram @visionaffichage"
            className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-brand-blue transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/60 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-black rounded"
          >
            <Instagram size={18} aria-hidden="true" />
            <span>@visionaffichage</span>
          </a>
          <a
            href="https://facebook.com/visionaffichage"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook @visionaffichage"
            className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-brand-blue transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/60 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-black rounded"
          >
            <Facebook size={18} aria-hidden="true" />
            <span>@visionaffichage</span>
          </a>
        </div>

        {/* Bottom row */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-6">
          <div className="flex items-center gap-3">
            <img
              src="https://visionaffichage.com/cdn/shop/files/Logo-vision-horizontal-blanc.png?height=135&v=1694121209"
              alt="Vision Affichage"
              // Footer is always below the fold — lazy + async so it
              // never competes with hero/product images for bandwidth.
              loading="lazy"
              decoding="async"
              className="h-5 opacity-70"
              onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
            />
          </div>
          <div className="text-[11px] text-white/40">
            © {new Date().getFullYear()} Vision Affichage · {lang === 'en' ? 'Made in Québec' : 'Fabriqué au Québec'} · {lang === 'en' ? 'All rights reserved' : 'Tous droits réservés'}
          </div>
        </div>

        {/* Payment methods — text-only row to avoid shipping unlicensed
            brand marks. Signals checkout trust (the #1 cart-abandonment
            friction surveyed by Baymard) without a logo wall, and mirrors
            the accepted tenders already listed at /checkout. */}
        <div className="pt-3 text-[11px] text-white/50 tracking-wide text-center md:text-right">
          <span>
            {lang === 'en' ? 'Secure payments:' : 'Paiements sécurisés :'}
          </span>
          <span className="ml-1">Visa · Mastercard · AMEX · Interac · PayPal</span>
        </div>
      </div>
    </footer>
  );
}
