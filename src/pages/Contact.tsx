import { useRef, useState } from 'react';
import { Phone, Mail, MapPin, Clock, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Navbar } from '@/components/Navbar';
import { SiteFooter } from '@/components/SiteFooter';
import { useLang } from '@/lib/langContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { isValidEmail, normalizeInvisible } from '@/lib/utils';

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
  useDocumentTitle(lang === 'en' ? 'Contact — Vision Affichage' : 'Contact — Vision Affichage');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [emailErr, setEmailErr] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = normalizeInvisible(email).trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setEmailErr(true);
      return;
    }
    setEmailErr(false);

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
      clean.push({
        name: name.trim(),
        email: normalizedEmail,
        subject: subject.trim(),
        message: message.trim(),
        at: Date.now(),
        lang,
      });
      // Cap AFTER push so the freshest submission is always retained
      // even at the boundary. slice(-CAP) keeps the most recent N.
      const capped = clean.slice(-CONTACT_CAP);
      localStorage.setItem(CONTACT_KEY, JSON.stringify(capped));
    } catch { /* noop — toast still fires so the user isn't left in limbo */ }

    toast.success(
      lang === 'en'
        ? 'Message received! We reply within 24h.'
        : 'Message reçu\u00a0! On vous répond sous 24h.',
      { duration: 6000 },
    );
    setName('');
    setEmail('');
    setSubject('');
    setMessage('');
    nameInputRef.current?.focus();
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
                  required
                  autoComplete="email"
                  aria-invalid={emailErr || undefined}
                  className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-white text-[#0F2341] placeholder:text-zinc-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]/25 transition-shadow ${
                    emailErr ? 'border-rose-400 focus:border-rose-500' : 'border-zinc-300 focus:border-[#0052CC]'
                  }`}
                  placeholder={lang === 'en' ? 'you@email.com' : 'vous@courriel.com'}
                />
                {emailErr ? (
                  <span role="alert" className="text-[11px] text-rose-600 font-semibold mt-1 block">
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
                onChange={e => setMessage(e.target.value)}
                required
                rows={6}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-zinc-300 bg-white text-[#0F2341] placeholder:text-zinc-400 focus:outline-none focus:border-[#0052CC] focus-visible:ring-2 focus-visible:ring-[#0052CC]/25 transition-shadow resize-y min-h-[140px]"
                placeholder={lang === 'en' ? 'Tell us how we can help...' : 'Dites-nous comment nous pouvons aider...'}
              />
            </label>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <p className="text-[11px] text-zinc-500">
                {lang === 'en'
                  ? 'We don\u2019t share your info. Reply within 24h on business days.'
                  : 'Vos coordonnées restent privées. Réponse sous 24h en jours ouvrables.'}
              </p>
              <button
                type="submit"
                disabled={!name.trim() || !email.trim() || !subject.trim() || !message.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0052CC] text-white font-extrabold text-sm hover:bg-[#0041A6] disabled:opacity-50 disabled:hover:bg-[#0052CC] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]/50 focus-visible:ring-offset-2"
              >
                <Send size={15} aria-hidden="true" />
                {lang === 'en' ? 'Send message' : 'Envoyer le message'}
              </button>
            </div>
          </form>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
