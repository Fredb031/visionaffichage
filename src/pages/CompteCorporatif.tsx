import { useRef, useState } from 'react';
import { Building2, Lock, ShieldCheck, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Navbar } from '@/components/Navbar';
import { SiteFooter } from '@/components/SiteFooter';
import { SubmitButton, type SubmitButtonState } from '@/components/SubmitButton';
import { useLang } from '@/lib/langContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { isValidEmail, normalizeInvisible } from '@/lib/utils';
import { sanitizeText } from '@/lib/sanitize';

// Volume II §05.2 — public Net 30 / corporate-account application form.
// Mirrors the Contact-page localStorage stub: a real backend swap will
// POST this same payload to a Supabase corporate_applications row + fire
// a Resend notification to info@visionaffichage.com, then a manual
// approval flow flips company_portals.payment_terms to 'net30'.
type CorpAppRow = {
  company: string;
  neq: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  annualVolume: AnnualVolume;
  industry: Industry;
  paymentReference: string;
  at: number;
  lang: 'fr' | 'en';
};
const CORP_KEY = 'va:corp-applications';
// Cap the local ring buffer at 10 — corporate apps are low-volume and
// the operator drains them manually into Supabase, so a tighter cap
// than Contact (200) keeps the ledger reviewable at a glance and well
// below the 5MB localStorage budget shared with cart/newsletter state.
const CORP_CAP = 10;

type AnnualVolume = '<50' | '50-200' | '200-500' | '500-2000' | '2000+';
type Industry = 'construction' | 'paysagement' | 'municipal' | 'corporate' | 'autre';

const VOLUME_OPTIONS: AnnualVolume[] = ['<50', '50-200', '200-500', '500-2000', '2000+'];
const INDUSTRY_OPTIONS: Industry[] = ['construction', 'paysagement', 'municipal', 'corporate', 'autre'];

// Permissive but bounded phone validator — accepts 10-digit Canadian
// numbers in any common visual format (e.g. "514-555-1212",
// "(514) 555-1212", "5145551212") OR an E.164 string (+15145551212,
// +33123456789). Strips formatting before counting digits so the user
// isn't punished for typing dashes / parens / spaces.
function isValidPhone(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  // E.164: leading + then 8-15 digits.
  if (/^\+\d{8,15}$/.test(trimmed)) return true;
  // Strip every non-digit and check for a 10-digit CA number.
  const digits = trimmed.replace(/\D+/g, '');
  return digits.length === 10;
}

function volumeLabel(v: AnnualVolume, lang: 'fr' | 'en'): string {
  switch (v) {
    case '<50': return lang === 'en' ? 'Less than 50 pieces / year' : 'Moins de 50 pièces / an';
    case '50-200': return lang === 'en' ? '50-200 pieces / year' : '50-200 pièces / an';
    case '200-500': return lang === 'en' ? '200-500 pieces / year' : '200-500 pièces / an';
    case '500-2000': return lang === 'en' ? '500-2000 pieces / year' : '500-2000 pièces / an';
    case '2000+': return lang === 'en' ? '2000+ pieces / year' : '2000+ pièces / an';
  }
}

function industryLabel(i: Industry, lang: 'fr' | 'en'): string {
  switch (i) {
    case 'construction': return 'Construction';
    case 'paysagement': return lang === 'en' ? 'Landscaping' : 'Paysagement';
    case 'municipal': return lang === 'en' ? 'Municipal' : 'Municipal';
    case 'corporate': return lang === 'en' ? 'Corporate' : 'Corporate';
    case 'autre': return lang === 'en' ? 'Other' : 'Autre';
  }
}

export default function CompteCorporatif() {
  const { lang } = useLang();
  useDocumentTitle(
    lang === 'en'
      ? 'Corporate account — Net 30 invoice billing | Vision Affichage'
      : 'Compte corporatif — Paiement par facture (Net 30) | Vision Affichage',
    lang === 'en'
      ? 'Apply for a Vision Affichage corporate Net 30 account. For Quebec businesses, municipalities, and organisations. Reply within 48 hours.'
      : 'Demande de compte corporatif Vision Affichage avec paiement par facture (Net 30). Pour entreprises, villes et organismes du Québec. Réponse en 48 heures.',
    {},
  );

  const [company, setCompany] = useState('');
  const [neq, setNeq] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [annualVolume, setAnnualVolume] = useState<AnnualVolume | ''>('');
  const [industry, setIndustry] = useState<Industry | ''>('');
  const [paymentReference, setPaymentReference] = useState('');

  // Per-field error flags. Setting/clearing on submit (or on field
  // change) lets us tint the offending input red AND surface a screen-
  // reader hint via aria-invalid + aria-describedby, instead of just
  // toasting "fix the form" and leaving the user to hunt.
  const [companyErr, setCompanyErr] = useState(false);
  const [contactNameErr, setContactNameErr] = useState(false);
  const [emailErr, setEmailErr] = useState(false);
  const [phoneErr, setPhoneErr] = useState(false);
  const [volumeErr, setVolumeErr] = useState(false);
  const [industryErr, setIndustryErr] = useState(false);

  const [submitState, setSubmitState] = useState<SubmitButtonState>('idle');
  const [sent, setSent] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const companyInputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const cleanCompany = company.trim();
    const cleanContactName = contactName.trim();
    const normalizedEmail = normalizeInvisible(contactEmail).trim().toLowerCase();
    const cleanPhone = contactPhone.trim();

    const cErr = !cleanCompany;
    const nErr = !cleanContactName;
    const eErr = !isValidEmail(normalizedEmail);
    const pErr = !isValidPhone(cleanPhone);
    const vErr = !annualVolume;
    const iErr = !industry;

    setCompanyErr(cErr);
    setContactNameErr(nErr);
    setEmailErr(eErr);
    setPhoneErr(pErr);
    setVolumeErr(vErr);
    setIndustryErr(iErr);

    if (cErr || nErr || eErr || pErr || vErr || iErr) {
      toast.error(
        lang === 'en'
          ? 'Please complete the highlighted fields.'
          : 'Veuillez compléter les champs surlignés.',
      );
      return;
    }

    setSubmitState('loading');

    // Build the row up-front so console.error has a payload to surface
    // even if the localStorage write below fails (private mode, quota).
    // Until corporate apps get wired to a Zapier webhook → Outlook
    // delivery, devtools is the only direct visibility an operator has
    // on what was just submitted — and a Net 30 application is the
    // single highest-impact form on the site to lose silently.
    const payload: CorpAppRow = {
      company: sanitizeText(cleanCompany, { maxLength: 160 }),
      neq: sanitizeText(neq.trim(), { maxLength: 32 }),
      contactName: sanitizeText(cleanContactName, { maxLength: 120 }),
      contactEmail: normalizedEmail,
      contactPhone: sanitizeText(cleanPhone, { maxLength: 32 }),
      annualVolume: annualVolume as AnnualVolume,
      industry: industry as Industry,
      paymentReference: sanitizeText(paymentReference.trim(), { maxLength: 200 }),
      at: Date.now(),
      lang,
    };
    // Dev-only happy-path log — gated on import.meta.env.DEV so a
    // successful Net 30 application doesn't fire console.error in
    // production. The catch block below logs localStorage failures
    // unconditionally because those are real errors worth surfacing.
    if (import.meta.env.DEV) {
      console.error('[CompteCorporatif] form submission (no backend wired):', payload);
    }

    try {
      const raw = JSON.parse(localStorage.getItem(CORP_KEY) ?? '[]');
      const arr: unknown[] = Array.isArray(raw) ? raw : [];
      // Defensive filter — drop any row that doesn't match the expected
      // shape so a corrupted entry from devtools / older schema can't
      // poison the append path. Same pattern as Contact + newsletter.
      const clean: CorpAppRow[] = arr.filter(
        (v): v is CorpAppRow =>
          !!v && typeof v === 'object'
          && typeof (v as { company?: unknown }).company === 'string'
          && typeof (v as { contactEmail?: unknown }).contactEmail === 'string'
          && typeof (v as { at?: unknown }).at === 'number',
      );
      clean.push(payload);
      // FIFO cap of 10 — the freshest application is always retained.
      const capped = clean.slice(-CORP_CAP);
      localStorage.setItem(CORP_KEY, JSON.stringify(capped));
    } catch (err) {
      // Local persistence failed; toast still fires below so the user
      // isn't left in limbo, and the payload already hit console.error.
      console.error('[CompteCorporatif] localStorage write failed:', err);
    }

    // Brief loading dwell so the spinner registers before the tick —
    // matches the Contact form so the two surfaces feel coherent.
    window.setTimeout(() => {
      setSubmittedEmail(normalizedEmail);
      // Bilingual receipt toast with a phone fallback. Until the corp
      // application form is wired to a Zapier webhook → Outlook
      // delivery, the 367-380-4808 number gives a Net 30 applicant a
      // guaranteed channel to escalate if our 24h reply doesn't land.
      // Keep the 48h promise out of the toast and unify on the 24h-or-
      // call line — the longer SLA is still advertised on the page
      // body, but the toast is the operator-grade fallback.
      toast.success(
        lang === 'en'
          ? 'Message sent. We\u2019ll reply within 24h. Otherwise call us at 367-380-4808.'
          : 'Message envoyé. On te répond dans les 24h. Sinon appelle-nous au 367-380-4808.',
        { duration: 8000 },
      );
      setSubmitState('success');
      // Clear inputs even though we'll mount the success card next —
      // if the user hits "Submit another" they get a clean slate.
      setCompany('');
      setNeq('');
      setContactName('');
      setContactEmail('');
      setContactPhone('');
      setAnnualVolume('');
      setIndustry('');
      setPaymentReference('');
      window.setTimeout(() => setSubmitState('idle'), 2000);
      setSent(true);
    }, 350);
  };

  // Rewind to a fresh form. Used by "Submit another" inside the success
  // card so an operator filing for multiple subsidiaries doesn't need a
  // page reload.
  const handleSubmitAnother = () => {
    setSent(false);
    setSubmitState('idle');
    setCompanyErr(false);
    setContactNameErr(false);
    setEmailErr(false);
    setPhoneErr(false);
    setVolumeErr(false);
    setIndustryErr(false);
    window.setTimeout(() => companyInputRef.current?.focus(), 0);
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <Navbar />
      <main id="main-content" className="flex-1 max-w-[960px] w-full mx-auto px-6 md:px-10 py-12 md:py-16">
        {/* Hero — h1 + supporting paragraph + Loi 25 trust line. The
            Building2 glyph anchors the offer visually and matches the
            B2B framing in the brief. */}
        <div className="flex items-start gap-3 mb-3">
          <span className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-[#0052CC]/10 text-[#0052CC] shrink-0">
            <Building2 size={22} aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-[#0F2341] tracking-[-0.5px]">
              {lang === 'en'
                ? 'Corporate account — Net 30 invoice billing'
                : 'Compte corporatif — Paiement par facture (Net 30)'}
            </h1>
          </div>
        </div>
        <p className="text-sm md:text-base text-zinc-700 max-w-[680px] mb-3">
          {lang === 'en'
            ? 'For businesses, cities, and organisations. Our team replies within 48 hours.'
            : 'Pour les entreprises, villes et organismes. Notre équipe répond en 48 heures.'}
        </p>
        <p className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 mb-10">
          <Lock size={12} aria-hidden="true" />
          {lang === 'en'
            ? 'Your information is protected under Quebec\u2019s Law 25.'
            : 'Tes informations sont protégées par la Loi\u00a025 du Québec.'}
        </p>

        {/* Three-up trust strip — concise reasons B2B buyers should bother
            applying. Mirrors the language of the brief: 48h response,
            invoice billing, Quebec compliance. Kept token-light (icons +
            short labels) so it reads at a glance and doesn't compete
            with the form for attention. */}
        <div className="grid sm:grid-cols-3 gap-3 mb-10">
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#E8A838] mb-1">
              {lang === 'en' ? '48h response' : 'Réponse 48h'}
            </div>
            <p className="text-[13px] text-zinc-700 leading-snug">
              {lang === 'en'
                ? 'A real human reviews every application within two business days.'
                : 'Une vraie personne révise chaque demande en 2 jours ouvrables.'}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#E8A838] mb-1">
              {lang === 'en' ? 'Invoice billing' : 'Facturation Net\u00a030'}
            </div>
            <p className="text-[13px] text-zinc-700 leading-snug">
              {lang === 'en'
                ? 'Pay by invoice with 30-day terms — no credit card needed.'
                : 'Paiement par facture, 30 jours — aucune carte de crédit requise.'}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#E8A838] mb-1">
              {lang === 'en' ? 'Quebec-based' : 'Au Québec'}
            </div>
            <p className="text-[13px] text-zinc-700 leading-snug">
              {lang === 'en'
                ? 'Local team, French-first service, NEQ-aware billing.'
                : 'Équipe locale, service en français, facturation avec NEQ.'}
            </p>
          </div>
        </div>

        <section
          aria-label={
            lang === 'en'
              ? 'Corporate account application'
              : 'Demande de compte corporatif'
          }
          className="bg-white rounded-2xl border border-zinc-200 p-6 md:p-8 shadow-sm"
        >
          <h2 className="text-xl md:text-2xl font-extrabold text-[#0F2341] mb-2 tracking-[-0.3px]">
            {lang === 'en' ? 'Apply for an account' : 'Demande de compte'}
          </h2>
          <p className="text-sm text-zinc-600 mb-6">
            {lang === 'en'
              ? 'Tell us about your organisation and we\u2019ll get back to you within 48 hours.'
              : 'Parlez-nous de votre organisation et nous vous reviendrons sous 48\u00a0heures.'}
          </p>

          {sent ? (
            // Post-submit confirmation card — same pattern as Contact.
            // Replaces the form so the user has an unambiguous end-state
            // and the Loi 25 reassurance carries over.
            <div
              role="status"
              aria-live="polite"
              className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 md:p-6 text-[#0F2341]"
            >
              <div className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-600 text-white shrink-0">
                  <ShieldCheck size={18} aria-hidden="true" />
                </span>
                <div className="flex-1">
                  <h3 className="text-base md:text-lg font-extrabold tracking-[-0.2px] mb-1">
                    {lang === 'en'
                      ? 'Application received!'
                      : 'Demande reçue\u00a0!'}
                  </h3>
                  <p className="text-sm text-zinc-700 mb-4">
                    {lang === 'en'
                      ? `A team member will contact you within 48 hours at ${submittedEmail}.`
                      : `Un membre de l\u2019équipe te contactera dans 48\u00a0heures à ${submittedEmail}.`}
                  </p>
                  <button
                    type="button"
                    onClick={handleSubmitAnother}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-extrabold bg-white border border-emerald-300 text-[#0F2341] hover:bg-emerald-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                  >
                    {lang === 'en' ? 'Submit another' : 'Soumettre une autre demande'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
              {/* Company name — required */}
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1.5 block">
                  {lang === 'en' ? 'Company name' : 'Nom de l\u2019entreprise'}
                  <span className="text-rose-600 ml-0.5" aria-hidden="true">*</span>
                </span>
                <input
                  ref={companyInputRef}
                  type="text"
                  value={company}
                  onChange={e => { setCompany(e.target.value); if (companyErr) setCompanyErr(false); }}
                  required
                  autoComplete="organization"
                  aria-invalid={companyErr || undefined}
                  aria-describedby={companyErr ? 'corp-company-error' : undefined}
                  className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-white text-[#0F2341] placeholder:text-zinc-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]/25 transition-shadow ${
                    companyErr ? 'border-rose-400 focus:border-rose-500' : 'border-zinc-300 focus:border-[#0052CC]'
                  }`}
                  placeholder={lang === 'en' ? 'Your company name' : 'Nom de votre entreprise'}
                />
                {companyErr ? (
                  <span id="corp-company-error" role="alert" aria-live="polite" className="text-[11px] text-rose-600 font-semibold mt-1 block">
                    {lang === 'en' ? 'Company name is required.' : 'Le nom de l\u2019entreprise est requis.'}
                  </span>
                ) : null}
              </label>

              {/* NEQ — optional, two-up with payment reference on wider
                  screens. NEQ identifies a Quebec entreprise; helpful but
                  not blocking since a fresh org may not have one yet. */}
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1.5 block">
                    {lang === 'en' ? 'NEQ (optional)' : 'NEQ (optionnel)'}
                  </span>
                  <input
                    type="text"
                    value={neq}
                    onChange={e => setNeq(e.target.value)}
                    autoComplete="off"
                    inputMode="numeric"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-zinc-300 bg-white text-[#0F2341] placeholder:text-zinc-400 focus:outline-none focus:border-[#0052CC] focus-visible:ring-2 focus-visible:ring-[#0052CC]/25 transition-shadow"
                    placeholder="1234567890"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1.5 block">
                    {lang === 'en' ? 'Payment reference (optional)' : 'Référence de paiement (optionnel)'}
                  </span>
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={e => setPaymentReference(e.target.value)}
                    autoComplete="off"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-zinc-300 bg-white text-[#0F2341] placeholder:text-zinc-400 focus:outline-none focus:border-[#0052CC] focus-visible:ring-2 focus-visible:ring-[#0052CC]/25 transition-shadow"
                    placeholder={lang === 'en' ? 'PO #, AP contact, etc.' : 'No de bon de commande, contact comptes payables, etc.'}
                  />
                </label>
              </div>

              {/* Contact name + email — two-up. Both required. */}
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1.5 block">
                    {lang === 'en' ? 'Contact name' : 'Nom du contact'}
                    <span className="text-rose-600 ml-0.5" aria-hidden="true">*</span>
                  </span>
                  <input
                    type="text"
                    value={contactName}
                    onChange={e => { setContactName(e.target.value); if (contactNameErr) setContactNameErr(false); }}
                    required
                    autoComplete="name"
                    aria-invalid={contactNameErr || undefined}
                    aria-describedby={contactNameErr ? 'corp-contactname-error' : undefined}
                    className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-white text-[#0F2341] placeholder:text-zinc-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]/25 transition-shadow ${
                      contactNameErr ? 'border-rose-400 focus:border-rose-500' : 'border-zinc-300 focus:border-[#0052CC]'
                    }`}
                    placeholder={lang === 'en' ? 'Full name' : 'Nom complet'}
                  />
                  {contactNameErr ? (
                    <span id="corp-contactname-error" role="alert" aria-live="polite" className="text-[11px] text-rose-600 font-semibold mt-1 block">
                      {lang === 'en' ? 'Contact name is required.' : 'Le nom du contact est requis.'}
                    </span>
                  ) : null}
                </label>
                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1.5 block">
                    {lang === 'en' ? 'Contact email' : 'Courriel du contact'}
                    <span className="text-rose-600 ml-0.5" aria-hidden="true">*</span>
                  </span>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={e => { setContactEmail(e.target.value); if (emailErr) setEmailErr(false); }}
                    onBlur={() => {
                      const trimmed = normalizeInvisible(contactEmail).trim();
                      if (trimmed && !isValidEmail(trimmed.toLowerCase())) setEmailErr(true);
                    }}
                    required
                    autoComplete="email"
                    aria-invalid={emailErr || undefined}
                    aria-describedby={emailErr ? 'corp-email-error' : undefined}
                    className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-white text-[#0F2341] placeholder:text-zinc-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]/25 transition-shadow ${
                      emailErr ? 'border-rose-400 focus:border-rose-500' : 'border-zinc-300 focus:border-[#0052CC]'
                    }`}
                    placeholder={lang === 'en' ? 'you@company.com' : 'vous@entreprise.com'}
                  />
                  {emailErr ? (
                    <span id="corp-email-error" role="alert" aria-live="polite" className="text-[11px] text-rose-600 font-semibold mt-1 block">
                      {lang === 'en'
                        ? 'That email doesn\u2019t look valid — please double-check.'
                        : 'Ce courriel ne semble pas valide — vérifie-le.'}
                    </span>
                  ) : null}
                </label>
              </div>

              {/* Phone — required, accepts CA 10-digit or E.164. */}
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1.5 block">
                  {lang === 'en' ? 'Contact phone' : 'Téléphone du contact'}
                  <span className="text-rose-600 ml-0.5" aria-hidden="true">*</span>
                </span>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={e => { setContactPhone(e.target.value); if (phoneErr) setPhoneErr(false); }}
                  onBlur={() => {
                    if (contactPhone.trim() && !isValidPhone(contactPhone)) setPhoneErr(true);
                  }}
                  required
                  autoComplete="tel"
                  inputMode="tel"
                  aria-invalid={phoneErr || undefined}
                  aria-describedby={phoneErr ? 'corp-phone-error' : 'corp-phone-help'}
                  className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-white text-[#0F2341] placeholder:text-zinc-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]/25 transition-shadow ${
                    phoneErr ? 'border-rose-400 focus:border-rose-500' : 'border-zinc-300 focus:border-[#0052CC]'
                  }`}
                  placeholder="514-555-1212"
                />
                {phoneErr ? (
                  <span id="corp-phone-error" role="alert" aria-live="polite" className="text-[11px] text-rose-600 font-semibold mt-1 block">
                    {lang === 'en'
                      ? 'Enter a 10-digit Canadian number or an international number starting with +.'
                      : 'Entrez un numéro canadien à 10 chiffres ou un numéro international commençant par +.'}
                  </span>
                ) : (
                  <span id="corp-phone-help" className="text-[11px] text-zinc-500 mt-1 block">
                    {lang === 'en'
                      ? '10-digit Canadian or international (+1...).'
                      : '10 chiffres au Canada ou format international (+1...).'}
                  </span>
                )}
              </label>

              {/* Annual volume + industry — two-up selects, both required. */}
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1.5 block">
                    {lang === 'en' ? 'Annual volume' : 'Volume annuel'}
                    <span className="text-rose-600 ml-0.5" aria-hidden="true">*</span>
                  </span>
                  <select
                    value={annualVolume}
                    onChange={e => {
                      setAnnualVolume(e.target.value as AnnualVolume | '');
                      if (volumeErr) setVolumeErr(false);
                    }}
                    required
                    aria-invalid={volumeErr || undefined}
                    aria-describedby={volumeErr ? 'corp-volume-error' : undefined}
                    className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-white text-[#0F2341] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]/25 transition-shadow ${
                      volumeErr ? 'border-rose-400 focus:border-rose-500' : 'border-zinc-300 focus:border-[#0052CC]'
                    }`}
                  >
                    <option value="" disabled>
                      {lang === 'en' ? 'Select volume...' : 'Choisir un volume...'}
                    </option>
                    {VOLUME_OPTIONS.map(v => (
                      <option key={v} value={v}>{volumeLabel(v, lang)}</option>
                    ))}
                  </select>
                  {volumeErr ? (
                    <span id="corp-volume-error" role="alert" aria-live="polite" className="text-[11px] text-rose-600 font-semibold mt-1 block">
                      {lang === 'en' ? 'Please pick an annual volume.' : 'Veuillez choisir un volume annuel.'}
                    </span>
                  ) : null}
                </label>
                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1.5 block">
                    {lang === 'en' ? 'Industry' : 'Industrie'}
                    <span className="text-rose-600 ml-0.5" aria-hidden="true">*</span>
                  </span>
                  <select
                    value={industry}
                    onChange={e => {
                      setIndustry(e.target.value as Industry | '');
                      if (industryErr) setIndustryErr(false);
                    }}
                    required
                    aria-invalid={industryErr || undefined}
                    aria-describedby={industryErr ? 'corp-industry-error' : undefined}
                    className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-white text-[#0F2341] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]/25 transition-shadow ${
                      industryErr ? 'border-rose-400 focus:border-rose-500' : 'border-zinc-300 focus:border-[#0052CC]'
                    }`}
                  >
                    <option value="" disabled>
                      {lang === 'en' ? 'Select industry...' : 'Choisir une industrie...'}
                    </option>
                    {INDUSTRY_OPTIONS.map(i => (
                      <option key={i} value={i}>{industryLabel(i, lang)}</option>
                    ))}
                  </select>
                  {industryErr ? (
                    <span id="corp-industry-error" role="alert" aria-live="polite" className="text-[11px] text-rose-600 font-semibold mt-1 block">
                      {lang === 'en' ? 'Please pick an industry.' : 'Veuillez choisir une industrie.'}
                    </span>
                  ) : null}
                </label>
              </div>

              <div className="flex items-center justify-between gap-4 flex-wrap pt-2">
                <p className="text-[11px] text-zinc-500 max-w-[420px]">
                  {lang === 'en'
                    ? 'Approval is manual. Once approved, your account is flipped to Net 30 invoice billing.'
                    : 'L\u2019approbation est manuelle. Une fois approuvé, votre compte passe en facturation Net\u00a030.'}
                </p>
                <SubmitButton
                  state={submitState}
                  disabled={
                    !company.trim()
                    || !contactName.trim()
                    || !contactEmail.trim()
                    || !contactPhone.trim()
                    || !annualVolume
                    || !industry
                  }
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-extrabold text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                    submitState === 'success'
                      ? 'bg-emerald-600 hover:bg-emerald-600 focus-visible:ring-emerald-500/50'
                      : 'bg-[#0052CC] hover:bg-[#003D99] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#0052CC] focus-visible:ring-[#0052CC]/50'
                  }`}
                >
                  <Send size={15} aria-hidden="true" />
                  {lang === 'en' ? 'Submit application' : 'Envoyer la demande'}
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
