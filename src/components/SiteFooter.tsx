import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Facebook, X as XIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useLang } from '@/lib/langContext';
import { isValidEmail, normalizeInvisible } from '@/lib/utils';

// Shape of a single subscriber row persisted to localStorage. Keeping
// the captured-at timestamp alongside the email lets a future backend
// swap deduplicate by address while still ordering by signup recency
// (and makes the ledger self-describing for manual inspection).
type NewsletterRow = { email: string; at: number };
const NEWSLETTER_KEY = 'vision-newsletter-subscribers';
// Cap kept low enough that JSON.stringify of the ledger stays under the
// ~5 MB localStorage budget even with long emails, while preserving
// enough history that re-signups dedupe correctly across months.
const MAX_SUBSCRIBERS = 2000;
// RFC 5321 §4.5.3.1.3 caps a path (local@domain) at 254 octets. We enforce
// this at submit-time AND on the input's maxLength so a paste of multi-MB
// junk can't (a) feed an unbounded string into the isValidEmail regex
// (ReDoS-adjacent — the engine still runs the pattern even if it ultimately
// rejects) or (b) bloat the localStorage ledger past the ~5 MB browser
// budget with one malicious row. Belt-and-braces: maxLength is the soft
// guard for typed/pasted input, the runtime check below is the hard guard
// against programmatic state mutation (devtools, paste-then-edit, etc.).
const MAX_EMAIL_LENGTH = 254;

/**
 * SiteFooter — Vision Affichage Master Prompt rebuild.
 * Audi-precision tone: black canvas, white type, single accent (va-blue).
 * Four-column link grid → newsletter strip → bottom strip with socials.
 * Bilingual via useLang. Newsletter keeps RFC 5321 254-cap email validation,
 * aria-required / aria-invalid, and a live region for success/error feedback.
 */
export function SiteFooter() {
  const { lang } = useLang();
  const [email, setEmail] = useState('');
  // Surfaces a soft-error line when isValidEmail rejects the submitted
  // address. Before this, the form swallowed "a@b.c"-style inputs that
  // pass the browser's type=email check but fail our stricter regex —
  // the user saw nothing, assumed it worked, and never got a newsletter.
  const [emailErr, setEmailErr] = useState(false);
  // Live-region status text — single source of truth for SR success +
  // error announcements. role=status (polite) so it never interrupts
  // an in-flight screen-reader utterance, but is still announced.
  const [status, setStatus] = useState('');
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  // Auto-clear the live region a few seconds after a success so a later
  // re-focus doesn't re-announce stale state. Tracked in a ref so an
  // unmount mid-flight doesn't fire setState on an unmounted component.
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
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
    // Hard length guard BEFORE isValidEmail so an oversized paste never
    // reaches the regex engine (and never lands in localStorage even if
    // it somehow passed). RFC 5321 limits the full path to 254 octets.
    if (normalized.length === 0 || normalized.length > MAX_EMAIL_LENGTH || !isValidEmail(normalized)) {
      setEmailErr(true);
      setStatus(
        lang === 'en'
          ? 'That email doesn’t look valid. Double-check it and try again.'
          : 'Ce courriel ne semble pas valide. Vérifie-le et réessaie.',
      );
      return;
    }
    setEmailErr(false);

    let duplicate = false;
    try {
      const raw = JSON.parse(localStorage.getItem(NEWSLETTER_KEY) ?? '[]');
      // Defensive: only keep rows that match the expected shape so a
      // corrupted entry doesn't poison the dedupe check below.
      const arr: unknown[] = Array.isArray(raw) ? raw : [];
      const clean: NewsletterRow[] = arr.filter(
        (v): v is NewsletterRow =>
          !!v && typeof v === 'object' && typeof (v as { email?: unknown }).email === 'string'
            && typeof (v as { at?: unknown }).at === 'number',
      );
      duplicate = clean.some(row => row.email === normalized);
      if (!duplicate) {
        clean.push({ email: normalized, at: Date.now() });
        // Cap AFTER append so a brand-new subscriber (freshest) stays
        // in the list and the boundary case never overflows by one.
        const capped = clean.slice(-MAX_SUBSCRIBERS);
        localStorage.setItem(NEWSLETTER_KEY, JSON.stringify(capped));
      }
    } catch { /* noop */ }

    const successMsg = duplicate
      ? (lang === 'en' ? 'Already subscribed — thank you.' : 'Déjà inscrit — merci.')
      : (lang === 'en' ? 'Subscribed. Check your inbox.' : 'Inscription confirmée. Surveille ta boîte.');
    toast.success(successMsg);
    setStatus(successMsg);
    setEmail('');
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = window.setTimeout(() => {
      statusTimerRef.current = null;
      setStatus('');
    }, 5000);
    // Refocus the input so a keyboard / screen-reader user can subscribe
    // another address without tabbing back from <body>.
    emailInputRef.current?.focus();
  };

  const year = new Date().getFullYear();

  // Link tables. Pulled out of JSX so the four columns are scannable
  // and the source structure mirrors the rendered layout.
  const shopLinks: Array<{ label: string; to: string }> = [
    { label: lang === 'en' ? 'T-shirts' : 'T-shirts',                  to: '/products?cat=tshirts' },
    { label: lang === 'en' ? 'Hoodies' : 'Hoodies',                    to: '/products?cat=chandails' },
    { label: lang === 'en' ? 'Polos' : 'Polos',                        to: '/products?cat=polos' },
    { label: lang === 'en' ? 'Caps' : 'Casquettes',                    to: '/products?cat=casquettes' },
    { label: lang === 'en' ? 'Beanies' : 'Tuques',                     to: '/products?cat=tuques' },
  ];
  const industryLinks: Array<{ label: string; to: string }> = [
    { label: lang === 'en' ? 'Construction' : 'Construction',                          to: '/industries/construction' },
    { label: lang === 'en' ? 'Landscaping' : 'Paysagement',                            to: '/industries/paysagement' },
    { label: lang === 'en' ? 'Plumbing & Electrical' : 'Plomberie · Électricité', to: '/industries/plomberie-electricite' },
    { label: lang === 'en' ? 'Corporate' : 'Corporate',                                to: '/industries/corporate' },
    { label: lang === 'en' ? 'Municipalities' : 'Municipalités',                  to: '/industries/municipalites' },
  ];
  const companyLinks: Array<{ label: string; to: string }> = [
    { label: lang === 'en' ? 'About' : 'À propos',                                to: '/about' },
    { label: lang === 'en' ? 'Case studies' : 'Études de cas',                    to: '/case-studies' },
    { label: lang === 'en' ? 'Express quote' : 'Devis express',                        to: '/quote' },
    { label: 'Contact',                                                                to: '/contact' },
    { label: lang === 'en' ? 'Accessibility' : 'Accessibilité',                   to: '/accessibility' },
    { label: lang === 'en' ? 'Privacy' : 'Confidentialité',                       to: '/privacy' },
    { label: lang === 'en' ? 'Terms' : 'Termes',                                       to: '/terms' },
  ];

  const colHeader = 'font-semibold text-white text-sm uppercase tracking-wider mb-4';
  const colLink = 'text-white/60 hover:text-white text-sm transition-colors';

  return (
    <footer className="bg-va-black text-white border-t border-white/10">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10">
        {/* Top row — wordmark + three link columns. py-16, 4-col grid on
            md+, stacks to two columns on small viewports so the link
            tables stay readable without horizontal scroll. */}
        <div className="py-16 grid grid-cols-2 md:grid-cols-4 gap-10">
          <div className="col-span-2 md:col-span-1">
            <div className="font-display font-black text-2xl text-white">
              VISION AFFICHAGE
            </div>
            <p className="text-white/60 text-sm mt-2 leading-relaxed">
              {lang === 'en'
                ? "Quebec's merch studio for serious crews."
                : 'Le studio de merch des entrepreneurs québécois.'}
            </p>
          </div>

          <div>
            <h3 className={colHeader}>
              {lang === 'en' ? 'Shop' : 'Boutique'}
            </h3>
            <ul className="space-y-2">
              {shopLinks.map(l => (
                <li key={l.to}>
                  <Link to={l.to} className={colLink}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className={colHeader}>
              {lang === 'en' ? 'Industries' : 'Industries'}
            </h3>
            <ul className="space-y-2">
              {industryLinks.map(l => (
                <li key={l.to}>
                  <Link to={l.to} className={colLink}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className={colHeader}>
              {lang === 'en' ? 'Company' : 'Compagnie'}
            </h3>
            <ul className="space-y-2">
              {companyLinks.map(l => (
                <li key={l.to}>
                  <Link to={l.to} className={colLink}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Newsletter strip — restrained Audi-style call: one headline,
            one input, one button. The 254-cap and ledger dedupe live in
            handleSubscribe; the visible chrome is intentionally quiet. */}
        <div className="py-12 border-t border-white/10">
          <h2 className="font-display font-bold text-2xl text-white max-w-2xl">
            {lang === 'en'
              ? 'Once a month — what pros are ordering.'
              : 'Reçois une fois par mois ce que les pros commandent.'}
          </h2>
          <form
            onSubmit={handleSubscribe}
            className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-start"
            aria-label={lang === 'en' ? 'Newsletter signup' : 'Inscription à l’infolettre'}
            noValidate
          >
            <div className="flex-1 max-w-md">
              <input
                ref={emailInputRef}
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); if (emailErr) setEmailErr(false); }}
                placeholder={lang === 'en' ? 'your@email.com' : 'ton@courriel.com'}
                aria-label={lang === 'en' ? 'Email address' : 'Adresse courriel'}
                aria-required="true"
                aria-invalid={emailErr || undefined}
                aria-describedby={emailErr ? 'footer-newsletter-error' : undefined}
                className="w-full bg-white text-va-ink rounded-xl px-4 py-3 text-sm placeholder:text-va-muted outline-none focus-visible:ring-2 focus-visible:ring-va-blue/60 transition-shadow"
                autoComplete="email"
                maxLength={MAX_EMAIL_LENGTH}
                required
              />
              {emailErr ? (
                <p
                  id="footer-newsletter-error"
                  className="text-xs text-rose-300 mt-2"
                >
                  {lang === 'en'
                    ? 'That email doesn’t look valid — double-check it and try again.'
                    : 'Ce courriel ne semble pas valide — vérifie-le et réessaie.'}
                </p>
              ) : null}
            </div>
            <button
              type="submit"
              className="bg-va-blue text-white px-6 py-3 rounded-xl font-semibold hover:bg-va-blue-h focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-va-blue/60 focus-visible:ring-offset-2 focus-visible:ring-offset-va-black transition-colors"
            >
              {lang === 'en' ? 'Subscribe' : 'S’abonner'}
            </button>
          </form>
          {/* Live region — covers both success and error announcements
              for screen readers. role=status keeps it polite so it never
              interrupts mid-utterance, and the visually-hidden span
              keeps it out of the layout flow. */}
          <span role="status" aria-live="polite" className="sr-only">
            {status}
          </span>
        </div>

        {/* Bottom strip — copyright on the left, three social marks on
            the right. Icons w-5 h-5 text-white/40 → white on hover, each
            with an aria-label since the lucide glyph is decorative. */}
        <div className="py-8 border-t border-white/10 flex flex-col-reverse sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-white/40 text-xs">
            {`© ${year} Vision Affichage · Saint-Jean-sur-Richelieu, QC`}
          </p>
          <div className="flex items-center gap-5">
            <a
              href="https://x.com/visionaffichage"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="X (Twitter)"
              className="text-white/40 hover:text-white transition-colors"
            >
              <XIcon className="w-5 h-5" aria-hidden="true" />
            </a>
            <a
              href="https://instagram.com/visionaffichage"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="text-white/40 hover:text-white transition-colors"
            >
              <Instagram className="w-5 h-5" aria-hidden="true" />
            </a>
            <a
              href="https://facebook.com/visionaffichage"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              className="text-white/40 hover:text-white transition-colors"
            >
              <Facebook className="w-5 h-5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
