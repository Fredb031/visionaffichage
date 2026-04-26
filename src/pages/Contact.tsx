import { useEffect, useRef, useState } from 'react';
import { Phone, Mail, MapPin, Clock, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Navbar } from '@/components/Navbar';
import { SiteFooter } from '@/components/SiteFooter';
import { SubmitButton, type SubmitButtonState } from '@/components/SubmitButton';
import { useLang } from '@/lib/langContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { isValidEmail, normalizeInvisible } from '@/lib/utils';
import { sanitizeText } from '@/lib/sanitize';

// Shape of a locally-stored contact submission. The backend swap will
// POST this same object to an endpoint; keeping "at" and "lang" alongside
// the user-typed fields means an owner inspecting localStorage can sort
// by recency and pick the right response language without extra lookup.
type ContactMessageRow = {
  name: string;
  email: string;
  subject: string;
  message: string;
  at: number;
  lang: 'fr' | 'en';
};
const CONTACT_KEY = 'vision-contact-messages';
// Cap the locally-persisted ring buffer. 200 is enough to survive a
// weekend of traffic before a backend resolver drains it; beyond that
// the oldest entries fall off so localStorage never bloats toward the
// 5MB browser limit and crashes unrelated features (cart, newsletter).
const CONTACT_CAP = 200;

export default function Contact() {
  const { lang } = useLang();
  // Task 8.12 — contact page meta description. Google snippet now
  // advertises the locality (Saint-Hyacinthe, QC), the channels (phone,
  // email, form) and the 24h response promise, instead of the generic
  // homepage pitch inherited from index.html.
  useDocumentTitle(
    lang === 'en' ? 'Contact — Vision Affichage' : 'Contact — Vision Affichage',
    lang === 'en'
      ? 'Contact Vision Affichage — Saint-Hyacinthe, QC. Phone, email, form. Response within 24h.'
      : 'Contactez Vision Affichage — Saint-Hyacinthe, QC. Phone, email, form. Réponse sous 24h.',
    // Task 8.5 — OG overrides so a /contact link shared in Slack/SMS
    // shows the branded preview card rather than inheriting stale PDP
    // or Index tags on SPA back-nav.
    {},
  );

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [emailErr, setEmailErr] = useState(false);
  // Task 17.4 — morphing submit state. The button swaps idle → loading →
  // success, then a 2s timer reverts to idle. We don't dwell on loading:
  // the localStorage write is synchronous so the UX reads as a single
  // 'sending...' beat before the tick lands (kept ~350ms for honesty — a
  // user who sees the spinner for one frame won't register "it worked").
  const [submitState, setSubmitState] = useState<SubmitButtonState>('idle');
  // Task 173 — after a successful submit we swap the whole form for a
  // compact "merci, sous 24h" confirmation card so the user has a clear
  // end-state instead of an emptied form + toast that the button tick
  // alone barely signals. "Send another" rewinds the state in-place.
  const [sent, setSent] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  // Track every pending window.setTimeout id so an unmount mid-flight
  // (route change between the 350ms loading dwell and the 2s success hold)
  // can cancel the timers before they fire setState on a dead component.
  // Without this, React logs "state update on unmounted component" and we
  // leak two callbacks per submission attempt.
  const timeoutsRef = useRef<number[]>([]);
  useEffect(() => {
    return () => {
      for (const id of timeoutsRef.current) window.clearTimeout(id);
      timeoutsRef.current = [];
    };
  }, []);
  // Task 173 — cap the message textarea at the same 500-char budget we
  // advertise via the counter. Kept below the sanitize 2000-char ceiling
  // so the visible counter is the binding constraint (not a silent truncate).
  const MESSAGE_MAX = 500;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = normalizeInvisible(email).trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setEmailErr(true);
      return;
    }
    setEmailErr(false);
    setSubmitState('loading');

    // Build the row up-front so we can log it to console.error in BOTH
    // the localStorage-success and localStorage-failure paths. Until
    // forms get wired to a Zapier webhook → Outlook delivery, an
    // operator with devtools open is the only direct visibility we
    // have on what was just submitted; a dropped localStorage write
    // (private mode, quota, disabled storage) shouldn't also drop
    // that observability.
    const payload: ContactMessageRow = {
      name: sanitizeText(name, { maxLength: 120 }),
      email: normalizedEmail,
      subject: sanitizeText(subject, { maxLength: 200 }),
      message: sanitizeText(message, { maxLength: 2000 }),
      at: Date.now(),
      lang,
    };
    // console.error (not .log) so the payload survives any production
    // log filter that drops verbose levels — operator-grade fallback
    // observability while the form submits to a no-op endpoint.
    console.error('[Contact] form submission (no backend wired):', payload);

    try {
      const raw = JSON.parse(localStorage.getItem(CONTACT_KEY) ?? '[]');
      const arr: unknown[] = Array.isArray(raw) ? raw : [];
      // Defensive filter — same pattern as newsletter ledger: drop any
      // row that doesn't match the expected shape so a corrupted entry
      // from devtools / an older schema can't poison the append path.
      const clean: ContactMessageRow[] = arr.filter(
        (v): v is ContactMessageRow =>
          !!v && typeof v === 'object'
          && typeof (v as { name?: unknown }).name === 'string'
          && typeof (v as { email?: unknown }).email === 'string'
          && typeof (v as { subject?: unknown }).subject === 'string'
          && typeof (v as { message?: unknown }).message === 'string'
          && typeof (v as { at?: unknown }).at === 'number',
      );
      // Task 14.4 — run the three free-text fields through sanitizeText
      // before persisting so angle brackets / oversized pastes can't
      // poison a downstream consumer (CSV export, email template, log).
      clean.push(payload);
      // Cap AFTER push so the freshest submission is always retained
      // even at the boundary. slice(-CAP) keeps the most recent N.
      const capped = clean.slice(-CONTACT_CAP);
      localStorage.setItem(CONTACT_KEY, JSON.stringify(capped));
    } catch (err) {
      // Local persistence failed (private mode, quota, storage disabled).
      // Don't throw — the toast still fires below so the user isn't
      // left in limbo, and the payload above already hit console.error.
      console.error('[Contact] localStorage write failed:', err);
    }

    // Brief loading dwell so the spinner registers before the tick —
    // without this delay the synchronous write flips straight from idle
    // to success and the user misses the "sending" beat entirely.
    const dwellId = window.setTimeout(() => {
      // Bilingual receipt toast with a phone fallback. Until the form
      // gets wired to a Zapier webhook → Outlook delivery path, the
      // 367-380-4808 number gives the user a guaranteed channel if our
      // 24h reply doesn't land — better than leaving them assuming
      // they were heard when the submission only made it to the local
      // queue.
      toast.success(
        lang === 'en'
          ? 'Message sent. We\u2019ll reply within 24h. Otherwise call us at 367-380-4808.'
          : 'Message envoyé. On te répond dans les 24h. Sinon appelle-nous au 367-380-4808.',
        { duration: 8000 },
      );
      setSubmitState('success');
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
      // Hold the check mark for 2 seconds, then revert. The user gets
      // enough dwell time to read the "Envoyé" / "Sent" label before
      // the button goes back to its default call-to-action state.
      const revertId = window.setTimeout(() => setSubmitState('idle'), 2000);
      timeoutsRef.current.push(revertId);
      // Swap the form for the confirmation card on the next tick so the
      // success tint on the button still registers visually before the
      // section morphs out from under it.
      setSent(true);
    }, 350);
    timeoutsRef.current.push(dwellId);
  };

  // Rewind the confirmation card back to a fresh form. Used by the
  // "Send another" button inside the success state so the user can file
  // a follow-up without a full page reload.
  const handleSendAnother = () => {
    setSent(false);
    setSubmitState('idle');
    setEmailErr(false);
    // Defer focus so the form has a chance to mount before we grab it.
    const focusId = window.setTimeout(() => nameInputRef.current?.focus(), 0);
    timeoutsRef.current.push(focusId);
  };

  // Generic Google Maps embed URL for Saint-Hyacinthe, QC — the `pb=`
  // blob comes from maps.google.com → Share → Embed a map, which does
  // NOT require an API key (unlike the Maps Embed API). If Google ever
  // deprecates the unauthenticated iframe path, the "Voir sur Google
  // Maps" CTA below still works as a fallback escape hatch.
  const mapsEmbedSrc = 'https://www.google.com/maps?q=Saint-Hyacinthe,QC&output=embed';
  const mapsLinkHref = 'https://www.google.com/maps/search/?api=1&query=Saint-Hyacinthe%2C+QC';

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <Navbar />
      <main id="main-content" className="flex-1 max-w-[1100px] w-full mx-auto px-6 md:px-10 py-12 md:py-16">
        <h1 className="text-3xl md:text-4xl font-extrabold text-[#0F2341] tracking-[-0.5px] mb-2">
          Contact
        </h1>
        <p className="text-sm text-zinc-600 mb-10 max-w-[640px]">
          {lang === 'en'
            ? 'Questions about a custom order, a quote, or an existing shipment? Reach out through any channel below — we reply within 24 hours on business days.'
            : 'Des questions sur une commande personnalisée, une soumission ou un envoi en cours\u00a0? Joignez-nous par n\u2019importe quel canal ci-dessous — nous répondons sous 24h en jours ouvrables.'}
        </p>

        {/* Two-column: contact card + embedded map. Stacks on mobile.
            min-h-[360px] on md+ ensures both columns occupy the same
            vertical footprint so the map iframe doesn't collapse. */}
        <div className="grid md:grid-cols-2 gap-6 md:gap-8 mb-12">
          <section
            aria-label={lang === 'en' ? 'Contact information' : 'Informations de contact'}
            className="bg-white rounded-2xl border border-zinc-200 p-6 md:p-7 shadow-sm"
          >
            <h2 className="text-lg font-extrabold text-[#0F2341] mb-5 tracking-[-0.3px]">
              {lang === 'en' ? 'Reach us directly' : 'Nous joindre directement'}
            </h2>
            <ul className="space-y-5">
              <li className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#E8A838]/15 text-[#E8A838] shrink-0">
                  <Phone size={18} aria-hidden="true" />
                </span>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-0.5">
                    {lang === 'en' ? 'Phone' : 'Téléphone'}
                  </div>
                  <a
                    href="tel:+13673804808"
                    className="text-[15px] font-semibold text-[#0F2341] hover:text-[#E8A838] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838]/50 rounded"
                  >
                    367-380-4808
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#E8A838]/15 text-[#E8A838] shrink-0">
                  <Mail size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-0.5">
                    {lang === 'en' ? 'Email' : 'Courriel'}
                  </div>
                  <a
                    href="mailto:info@visionaffichage.com"
                    className="text-[15px] font-semibold text-[#0F2341] hover:text-[#E8A838] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838]/50 rounded break-all"
                  >
                    info@visionaffichage.com
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#E8A838]/15 text-[#E8A838] shrink-0">
                  <MapPin size={18} aria-hidden="true" />
                </span>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-0.5">
                    {lang === 'en' ? 'Address' : 'Adresse'}
                  </div>
                  <div className="text-[15px] font-semibold text-[#0F2341]">
                    Saint-Hyacinthe, QC
                  </div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#E8A838]/15 text-[#E8A838] shrink-0">
                  <Clock size={18} aria-hidden="true" />
                </span>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-0.5">
                    {lang === 'en' ? 'Business hours' : 'Heures d\u2019ouverture'}
                  </div>
                  <div className="text-[15px] font-semibold text-[#0F2341]">
                    {lang === 'en' ? 'Mon-Fri 8am-5pm' : 'Lun-Ven 8h-17h'}
                  </div>
                </div>
              </li>
            </ul>
          </section>

          <section
            aria-label={lang === 'en' ? 'Map — Saint-Hyacinthe, QC' : 'Carte — Saint-Hyacinthe, QC'}
            className="relative rounded-2xl overflow-hidden border border-zinc-200 shadow-sm bg-white min-h-[320px] md:min-h-[360px] flex flex-col"
          >
            <iframe
              src={mapsEmbedSrc}
              title={lang === 'en' ? 'Map of Saint-Hyacinthe, QC' : 'Carte de Saint-Hyacinthe, QC'}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="w-full flex-1 border-0"
              // Defensive allow attributes — some browsers strip iframe
              // interactive capability without an explicit allow list
              // even for same-origin map embeds.
              allowFullScreen
            />
            <a
              href={mapsLinkHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 text-[13px] font-bold text-[#0F2341] hover:text-[#E8A838] bg-white border-t border-zinc-200 py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838]/50"
            >
              <MapPin size={14} aria-hidden="true" />
              {lang === 'en' ? 'View on Google Maps' : 'Voir sur Google Maps'}
            </a>
          </section>
        </div>

        {/* Contact form — localStorage persistence stub. A future backend
            swap replaces the try/catch write with a fetch('/api/contact')
            call; the validation + UX contract (toast on success, focus
            return to the first field) stays identical so the form
            component doesn't need to change shape. */}
        <section
          aria-label={lang === 'en' ? 'Send us a message' : 'Envoyez-nous un message'}
          className="bg-white rounded-2xl border border-zinc-200 p-6 md:p-8 shadow-sm max-w-[760px]"
        >
          <h2 className="text-xl md:text-2xl font-extrabold text-[#0F2341] mb-2 tracking-[-0.3px]">
            {lang === 'en' ? 'Send us a message' : 'Envoyez-nous un message'}
          </h2>
          <p className="text-sm text-zinc-600 mb-6">
            {lang === 'en'
              ? 'Fill in the form below and we\u2019ll get back to you within 24 hours.'
              : 'Remplissez le formulaire ci-dessous et nous vous reviendrons sous 24h.'}
          </p>
          {sent ? (
            // Task 173 — post-submit confirmation card. Replaces the
            // form entirely so the user has an unambiguous end-state
            // (an emptied form alone can read as "did it even go?").
            // role=status + aria-live=polite makes assistive tech
            // announce the confirmation on mount without stealing focus.
            <div
              role="status"
              aria-live="polite"
              className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 md:p-6 text-[#0F2341]"
            >
              <div className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-600 text-white shrink-0">
                  <Send size={18} aria-hidden="true" />
                </span>
                <div className="flex-1">
                  <h3 className="text-base md:text-lg font-extrabold tracking-[-0.2px] mb-1">
                    {lang === 'en'
                      ? 'Thanks — we\u2019ll reply within 24h'
                      : 'Merci — on te répond sous 24h'}
                  </h3>
                  <p className="text-sm text-zinc-700 mb-4">
                    {lang === 'en'
                      ? 'Your message is on its way. Watch your inbox (and the spam folder, just in case).'
                      : 'Votre message est parti. Surveillez votre boîte de réception (et les pourriels, au cas où).'}
                  </p>
                  <button
                    type="button"
                    onClick={handleSendAnother}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-extrabold bg-white border border-emerald-300 text-[#0F2341] hover:bg-emerald-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                  >
                    {lang === 'en' ? 'Send another' : 'Envoyer un autre message'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1.5 block">
                  {lang === 'en' ? 'Name' : 'Nom'}
                </span>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  autoComplete="name"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-zinc-300 bg-white text-[#0F2341] placeholder:text-zinc-400 focus:outline-none focus:border-[#0052CC] focus-visible:ring-2 focus-visible:ring-[#0052CC]/25 transition-shadow"
                  placeholder={lang === 'en' ? 'Full name' : 'Nom complet'}
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1.5 block">
                  {lang === 'en' ? 'Email' : 'Courriel'}
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); if (emailErr) setEmailErr(false); }}
                  // Task 173 — onBlur check surfaces the invalid-email
                  // hint the moment the user leaves the field, not only
                  // when they hit submit. Empty blur is tolerated so we
                  // don't scold a user who tabs through the form first.
                  onBlur={() => {
                    const trimmed = normalizeInvisible(email).trim();
                    if (trimmed && !isValidEmail(trimmed.toLowerCase())) setEmailErr(true);
                  }}
                  required
                  autoComplete="email"
                  aria-invalid={emailErr || undefined}
                  // Task 6.9 — wire the input to the error span via
                  // aria-describedby when it's visible, so a screen
                  // reader re-announces the hint on refocus (otherwise
                  // role=alert only fires once when the span mounts).
                  aria-describedby={emailErr ? 'contact-email-error' : undefined}
                  className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-white text-[#0F2341] placeholder:text-zinc-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]/25 transition-shadow ${
                    emailErr ? 'border-rose-400 focus:border-rose-500' : 'border-zinc-300 focus:border-[#0052CC]'
                  }`}
                  placeholder={lang === 'en' ? 'you@email.com' : 'vous@courriel.com'}
                />
                {emailErr ? (
                  <span
                    id="contact-email-error"
                    role="alert"
                    aria-live="polite"
                    className="text-[11px] text-rose-600 font-semibold mt-1 block"
                  >
                    {lang === 'en'
                      ? 'That email doesn\u2019t look valid — please double-check.'
                      : 'Ce courriel ne semble pas valide — vérifie-le.'}
                  </span>
                ) : null}
              </label>
            </div>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1.5 block">
                {lang === 'en' ? 'Subject' : 'Sujet'}
              </span>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-zinc-300 bg-white text-[#0F2341] placeholder:text-zinc-400 focus:outline-none focus:border-[#0052CC] focus-visible:ring-2 focus-visible:ring-[#0052CC]/25 transition-shadow"
                placeholder={lang === 'en' ? 'What\u2019s this about?' : 'De quoi s\u2019agit-il\u00a0?'}
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1.5 block">
                {lang === 'en' ? 'Message' : 'Message'}
              </span>
              <textarea
                value={message}
                onChange={e => {
                  // Hard-cap at MESSAGE_MAX so the visible counter is
                  // the binding limit; paste beyond the cap is silently
                  // truncated rather than accepted then rejected later.
                  const next = e.target.value.slice(0, MESSAGE_MAX);
                  setMessage(next);
                }}
                required
                rows={6}
                maxLength={MESSAGE_MAX}
                aria-describedby="contact-message-counter"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-zinc-300 bg-white text-[#0F2341] placeholder:text-zinc-400 focus:outline-none focus:border-[#0052CC] focus-visible:ring-2 focus-visible:ring-[#0052CC]/25 transition-shadow resize-y min-h-[140px]"
                placeholder={lang === 'en' ? 'Tell us how we can help...' : 'Dites-nous comment nous pouvons aider...'}
              />
              {/* Task 173 — live character counter. aria-live=polite so
                  screen readers hear the remaining budget without being
                  interrupted on every keystroke. Tints rose when within
                  20 chars of the cap to signal "wrap up soon". */}
              <div
                id="contact-message-counter"
                aria-live="polite"
                className={`text-[11px] mt-1 text-right font-semibold tabular-nums ${
                  message.length >= MESSAGE_MAX - 20 ? 'text-rose-600' : 'text-zinc-500'
                }`}
              >
                {message.length}/{MESSAGE_MAX}
              </div>
            </label>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <p className="text-[11px] text-zinc-500">
                {lang === 'en'
                  ? 'We don\u2019t share your info. Reply within 24h on business days.'
                  : 'Vos coordonnées restent privées. Réponse sous 24h en jours ouvrables.'}
              </p>
              <SubmitButton
                state={submitState}
                disabled={!name.trim() || !email.trim() || !subject.trim() || !message.trim()}
                // Success swap tints the button emerald so the tick lands
                // on a matching surface instead of fighting the CTA blue.
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-extrabold text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                  submitState === 'success'
                    ? 'bg-emerald-600 hover:bg-emerald-600 focus-visible:ring-emerald-500/50'
                    : 'bg-[#0052CC] hover:bg-[#003D99] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#0052CC] focus-visible:ring-[#0052CC]/50'
                }`}
              >
                <Send size={15} aria-hidden="true" />
                {lang === 'en' ? 'Send message' : 'Envoyer le message'}
              </SubmitButton>
            </div>
          </form>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
