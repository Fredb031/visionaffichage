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
    <footer className="bg-gradient-to-br from-[#0F2341] via-[#1B3A6B] to-[#0F2341] text-white pt-14 pb-8 px-6 md:px-10 mt-12">
      <div className="max-w-[1100px] mx-auto">
        {/* Newsletter signup band — prominent incentive above the link columns.
            The concrete "what you get" headline and code-reveal-on-submit convert
            meaningfully better than a generic "stay in the loop" eyebrow, and the
            Mail icon anchors the offer visually on mobile where the H3 wraps. */}
        <div className="grid md:grid-cols-2 gap-8 pb-10 border-b border-white/10">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[2px] text-[#E8A838] mb-2">
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
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#E8A838] pointer-events-none"
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
                  className={`w-full pl-9 pr-4 py-3 bg-white/10 border rounded-l-xl text-sm placeholder:text-white/40 outline-none focus:bg-white/15 focus-visible:ring-2 focus-visible:ring-[#E8A838]/50 transition-shadow ${
                    emailErr ? 'border-rose-400/70 focus:border-rose-300' : 'border-white/20 focus:border-[#E8A838]'
                  }`}
                  autoComplete="email"
                  required
                />
              </div>
              <SubmitButton
                state={submitState}
                disabled={!email.trim()}
                className="px-5 bg-[#E8A838] text-[#1B3A6B] font-extrabold text-sm rounded-r-xl hover:bg-[#F0B449] disabled:opacity-60 disabled:hover:bg-[#E8A838] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2341]"
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
          {/* Section 09 — column 1 is now the brand description block.
              The existing five-column grid is preserved (we don't
              restructure layout per the brief); the former "Shop" links
              are folded into the "Liens rapides" column below so the
              footer doesn't lose any navigation surface. */}
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-3">
              Vision Affichage
            </h4>
            <p className="text-sm text-white/70 leading-relaxed">
              {lang === 'en'
                ? 'Custom corporate apparel printed in Québec. Your logo on t-shirts, polos, hoodies and caps — delivered in 5 business days, no minimum.'
                : "Vêtements d'entreprise personnalisés imprimés au Québec. Ton logo sur t-shirts, polos, hoodies et casquettes — livré en 5 jours ouvrables, aucun minimum."}
            </p>
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-3">
              {lang === 'en' ? 'Quick links' : 'Liens rapides'}
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/" className="text-white/80 hover:text-[#E8A838]">{lang === 'en' ? 'Home' : 'Accueil'}</Link></li>
              <li><Link to="/products" className="text-white/80 hover:text-[#E8A838]">{lang === 'en' ? 'Shop' : 'Boutique'}</Link></li>
              <li><Link to="/products" className="text-white/80 hover:text-[#E8A838]">{lang === 'en' ? 'Customize' : 'Personnaliser'}</Link></li>
              <li><Link to="/contact" className="text-white/80 hover:text-[#E8A838]">{lang === 'en' ? 'Free quote' : 'Devis gratuit'}</Link></li>
              <li><Link to="/track" className="text-white/80 hover:text-[#E8A838]">{lang === 'en' ? 'Track an order' : 'Suivi de commande'}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-3">
              {lang === 'en' ? 'Information' : 'Informations'}
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/returns" className="text-white/80 hover:text-[#E8A838]">{lang === 'en' ? 'Return policy' : 'Politique de retour'}</Link></li>
              {/* "Garantie" doesn't have a dedicated route; the policy
                  lives on /returns alongside the satisfaction promise.
                  Linking both labels to /returns keeps the spec copy
                  intact without manufacturing a 404. */}
              <li><Link to="/returns" className="text-white/80 hover:text-[#E8A838]">{lang === 'en' ? 'Warranty' : 'Garantie'}</Link></li>
              <li><Link to="/contact" className="text-white/80 hover:text-[#E8A838]">FAQ</Link></li>
              <li><Link to="/contact" className="text-white/80 hover:text-[#E8A838]">Contact</Link></li>
              <li><Link to="/about" className="text-white/80 hover:text-[#E8A838]">{lang === 'en' ? 'About us' : 'À propos'}</Link></li>
            </ul>
          </div>

          {/* Legal column kept so /privacy, /terms, /accessibility stay
              discoverable (Task 14.8). The Section 09 brief calls for
              4 conceptual columns; we keep this 5th legal column for
              regulatory link surface — copy unchanged, layout
              unchanged — and let the contact column sit alongside it. */}
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-3">
              {lang === 'en' ? 'Legal' : 'Légal'}
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/privacy" className="text-white/80 hover:text-[#E8A838] hover:underline underline-offset-4 decoration-[#E8A838]/60">{lang === 'en' ? 'Privacy policy' : 'Politique de confidentialité'}</Link></li>
              <li><Link to="/terms" className="text-white/80 hover:text-[#E8A838] hover:underline underline-offset-4 decoration-[#E8A838]/60">{lang === 'en' ? 'Terms of service' : "Conditions d'utilisation"}</Link></li>
              <li><Link to="/accessibility" className="text-white/80 hover:text-[#E8A838] hover:underline underline-offset-4 decoration-[#E8A838]/60">{lang === 'en' ? 'Accessibility' : 'Accessibilité'}</Link></li>
              <li><Link to="/blog" className="text-white/80 hover:text-[#E8A838] hover:underline underline-offset-4 decoration-[#E8A838]/60">{lang === 'en' ? 'Blog' : 'Blogue'}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-3">
              Contact
            </h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2 text-white/80 break-all">
                <Mail size={12} className="text-[#E8A838]" aria-hidden="true" />
                <a href="mailto:info@visionaffichage.com" className="hover:text-[#E8A838] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2341] rounded">info@visionaffichage.com</a>
              </li>
              <li className="flex items-center gap-2 text-white/80">
                <Phone size={12} className="text-[#E8A838]" aria-hidden="true" />
                <a href="tel:+13673804808" className="hover:text-[#E8A838] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2341] rounded">+1 367-380-4808</a>
              </li>
              <li className="flex items-center gap-2 text-white/80">
                <MapPin size={12} className="text-[#E8A838]" aria-hidden="true" />
                {lang === 'en' ? 'Monday–Friday, 8 a.m.–6 p.m.' : 'Lundi-Vendredi, 8h-18h'}
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
            className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-[#E8A838] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2341] rounded"
          >
            <Instagram size={18} aria-hidden="true" />
            <span>@visionaffichage</span>
          </a>
          <a
            href="https://facebook.com/visionaffichage"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook @visionaffichage"
            className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-[#E8A838] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2341] rounded"
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
          {/* Section 09 — bottom-bar copy. Year stays computed from
              new Date() so the footer doesn't drift into a stale
              copyright on Jan 1; the rest of the line matches the
              brief verbatim ("© 2025 Vision Affichage. Tous droits
              réservés. Fait au Québec."). */}
          <div className="text-[11px] text-white/40">
            {lang === 'en'
              ? `© ${new Date().getFullYear()} Vision Affichage. All rights reserved. Made in Québec.`
              : `© ${new Date().getFullYear()} Vision Affichage. Tous droits réservés. Fait au Québec.`}
          </div>
        </div>

        {/* Trust line — Section 09 calls for the three reassurance
            beats ("Livraison gratuite dès 300 $ · Garantie 1 an ·
            Satisfait ou remboursé") right under the copyright. We keep
            the payment-methods row inside the same band so checkout
            trust signals stay grouped at the bottom of the footer. */}
        <div className="pt-3 text-[11px] text-white/50 tracking-wide text-center md:text-right">
          {lang === 'en'
            ? 'Free shipping over $300 · 1-year warranty · Satisfaction guaranteed'
            : 'Livraison gratuite dès 300 $ · Garantie 1 an · Satisfait ou remboursé'}
        </div>

        {/* Payment methods — text-only row to avoid shipping unlicensed
            brand marks. Signals checkout trust (the #1 cart-abandonment
            friction surveyed by Baymard) without a logo wall, and mirrors
            the accepted tenders already listed at /checkout. */}
        <div className="pt-2 text-[11px] text-white/50 tracking-wide text-center md:text-right">
          <span>
            {lang === 'en' ? 'Secure payments:' : 'Paiements sécurisés :'}
          </span>
          <span className="ml-1">Visa · Mastercard · AMEX · Interac · PayPal</span>
        </div>
      </div>
    </footer>
  );
}
