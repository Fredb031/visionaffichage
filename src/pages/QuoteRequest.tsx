import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Navbar } from '@/components/Navbar';
import { SiteFooter } from '@/components/SiteFooter';
import { SubmitButton, type SubmitButtonState } from '@/components/SubmitButton';
import { useLang } from '@/lib/langContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { isValidEmail, normalizeInvisible } from '@/lib/utils';
import { sanitizeText } from '@/lib/sanitize';
import { PRODUCTS } from '@/data/products';
import { getPricePerUnit, PRICING } from '@/data/pricing';

// Mega Blueprint Section 02 — /devis quote-request page.
//
// Three-step user-facing form: (1) project basics — quantity, product,
// deadline, colors; (2) contact — company, name, email, phone, optional
// logo upload, notes; (3) confirmation card with live price estimate.
//
// Submission is a frontend-only stub: payload is queued to localStorage
// 'va:quote-queue' (FIFO, max 20) and a "Soumission envoyée — réponse
// dans 2 heures" toast fires. Operator follow-up — wire to Supabase
// quote_requests + Zapier notify, plus the jspdf+Resend edge function
// for the PDF response per the Mega Blueprint Section 2.2.
//
// Visual layer follows the Master Prompt Audi tokens (va.* in
// tailwind.config.ts c8c4171). All form fields, validation, aria
// wiring, parseQty clamp (f66ffa8) and submit handler are unchanged.

const QUEUE_KEY = 'va:quote-queue';
const QUEUE_CAP = 20;
// Hard cap on logo data-URL size so a 50MB drag-drop can't blow past
// the 5MB localStorage budget and brick the queue. 800kB at base64
// (~600kB raw) is enough for a typical PNG/JPG client logo.
const LOGO_MAX_BYTES = 800 * 1024;
// Hard upper bound on quantity — well beyond any realistic merch order
// (Vision's largest single-shot has been ~5K units), prevents a runaway
// 1e10 from flowing into the price preview or the queued payload.
const QTY_MAX = 50_000;

// Integer-only quantity parser. Mirrors AdminCapacity 0636a9f's
// parseSlotCount — Number.isInteger >= 0 with NaN/Infinity/decimal/
// negative all collapsing to 0. Pricing.ts is frozen at ba33680, so
// guaranteeing the upstream qty is a non-negative integer is the
// cheapest way to keep getPricePerUnit's tier-ladder math stable.
function parseQty(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  // Reject anything that isn't a run of ASCII digits — kills "1.5",
  // "1e3", "-5", "0x10", "  5  abc" before Number() sees them.
  if (!/^\d+$/.test(trimmed)) return 0;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0) return 0;
  if (n > QTY_MAX) return QTY_MAX;
  return n;
}

type QuoteQueueRow = {
  // Step 1
  quantity: number;
  productSku: string;
  productName: string;
  deadline: string;
  colors: string;
  // Step 2
  company: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  logoDataUrl: string | null;
  logoName: string | null;
  // Bookkeeping
  estimatedTotal: number;
  estimatedUnit: number;
  at: number;
  lang: 'fr' | 'en';
};

// Phone validation. Accept either an E.164-ish form (+ followed by 8-15
// digits) or a 10-digit Canadian number with optional separators —
// matches what most clients will paste from their email signature. We
// strip spaces, dashes, dots and parens before counting digits so
// "(514) 555-1234" and "514.555.1234" both pass.
function isValidPhone(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (/^\+\d{8,15}$/.test(trimmed.replace(/[\s.\-()]/g, ''))) return true;
  const digits = trimmed.replace(/[^\d]/g, '');
  return digits.length === 10;
}

// Compute a human-readable tier label for the qty preview pill.
// Walks the SKU's frozen tier ladder, finds the active tier, and
// formats "Tier 50-99 — 7.50$/pièce" (FR) or "Tier 50-99 — $7.50/unit"
// (EN). Falls back to ATC1000 for unknown SKUs to mirror getPricePerUnit.
function tierLabel(productSku: string, qty: number, lang: 'fr' | 'en'): string {
  const tiers = PRICING[productSku] ?? PRICING.ATC1000;
  if (!tiers || tiers.length === 0 || qty < 1) return '';
  // Walk from highest to lowest — first tier whose minQty <= qty wins.
  let activeIdx = 0;
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (qty >= tiers[i].minQty) { activeIdx = i; break; }
  }
  const t = tiers[activeIdx];
  const next = tiers[activeIdx + 1];
  const range = next ? `${t.minQty}-${next.minQty - 1}` : `${t.minQty}+`;
  const price = t.pricePerUnit;
  return lang === 'en'
    ? `Tier ${range} — $${price.toFixed(2)}/unit`
    : `Palier ${range} — ${price.toFixed(2)} $/pièce`;
}

export default function QuoteRequest() {
  const { lang } = useLang();
  useDocumentTitle(
    lang === 'en' ? 'Express quote · Vision Affichage' : 'Devis express · Vision Affichage',
    lang === 'en'
      ? 'Get a bulk quote in 3 quick steps. Response within 2 hours on business days. Production in 5 business days. Starting at 1 piece for samples.'
      : 'Obtiens un devis en 3 étapes rapides. Réponse sous 2h en jours ouvrables. Production en 5 jours ouvrables. À partir d\u2019une pièce pour échantillons.',
    {},
  );

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitState, setSubmitState] = useState<SubmitButtonState>('idle');
  const [submitted, setSubmitted] = useState(false);

  // Step 1
  const [quantity, setQuantity] = useState<number>(50);
  // Default to the first hoodie SKU so the live price estimate reads
  // meaningful rather than $0. PRODUCTS is non-empty per the catalogue.
  const [productSku, setProductSku] = useState<string>(PRODUCTS[0]?.sku ?? 'ATC1000');
  const [deadline, setDeadline] = useState<string>('');
  const [colors, setColors] = useState<string>('');

  // Step 2
  const [company, setCompany] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoName, setLogoName] = useState<string | null>(null);

  const [emailErr, setEmailErr] = useState(false);
  const [phoneErr, setPhoneErr] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Live price estimate. getPricePerUnit walks the SKU's tier ladder
  // and falls back to ATC1000 for unknown SKUs, so this is safe even
  // before the user changes the default product.
  const { unitPrice, totalPrice, productName, tierPill } = useMemo(() => {
    const product = PRODUCTS.find(p => p.sku === productSku) ?? PRODUCTS[0];
    // Belt-and-braces: parseQty already clamps the source state, but
    // re-validate on the read-side so a stray useState write or a
    // future regression can't poison the price preview.
    const safeQty = Number.isInteger(quantity) && quantity >= 1
      ? Math.min(quantity, QTY_MAX)
      : 1;
    const unit = getPricePerUnit(productSku, safeQty);
    return {
      unitPrice: unit,
      totalPrice: unit * safeQty,
      productName: product?.shortName ?? product?.name ?? productSku,
      tierPill: tierLabel(productSku, safeQty, lang),
    };
  }, [productSku, quantity, lang]);

  const step1Valid =
    Number.isInteger(quantity) && quantity >= 1 && quantity <= QTY_MAX && !!productSku;
  const step2Valid = !!company.trim() && isValidEmail(normalizeInvisible(email)) && isValidPhone(phone);

  const goNext = () => {
    if (step === 1 && step1Valid) setStep(2);
    else if (step === 2) {
      const emailOk = isValidEmail(normalizeInvisible(email));
      const phoneOk = isValidPhone(phone);
      setEmailErr(!emailOk);
      setPhoneErr(!phoneOk);
      if (!company.trim() || !emailOk || !phoneOk) return;
      setStep(3);
    }
  };

  const goBack = () => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  const handleFile = (file: File | null) => {
    if (!file) {
      setLogoDataUrl(null);
      setLogoName(null);
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      toast.error(
        lang === 'en'
          ? 'Logo too large — max 800 KB. Send the original by email after submitting.'
          : 'Logo trop volumineux — max 800 Ko. Envoyez l’original par courriel après la soumission.',
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      setLogoDataUrl(result);
      setLogoName(file.name);
    };
    reader.onerror = () => {
      toast.error(
        lang === 'en' ? 'Could not read that file.' : 'Impossible de lire ce fichier.',
      );
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!step1Valid || !step2Valid) return;
    setSubmitState('loading');

    const row: QuoteQueueRow = {
      quantity: Number.isInteger(quantity) && quantity >= 1
        ? Math.min(quantity, QTY_MAX)
        : 1,
      productSku,
      productName: sanitizeText(productName, { maxLength: 200 }),
      deadline: sanitizeText(deadline, { maxLength: 40 }),
      colors: sanitizeText(colors, { maxLength: 200 }),
      company: sanitizeText(company, { maxLength: 200 }),
      name: sanitizeText(name, { maxLength: 120 }),
      email: normalizeInvisible(email).trim().toLowerCase(),
      phone: sanitizeText(phone, { maxLength: 40 }),
      notes: sanitizeText(notes, { maxLength: 2000 }),
      logoDataUrl,
      logoName: logoName ? sanitizeText(logoName, { maxLength: 200 }) : null,
      estimatedTotal: Math.round(totalPrice * 100) / 100,
      estimatedUnit: unitPrice,
      at: Date.now(),
      lang,
    };

    // Dev-only happy-path log — operator-grade observability while the
    // form has no backend wired. Gated on import.meta.env.DEV so a
    // successful submit doesn't fire console.error in production. The
    // logo data URL is trimmed in the preview so devtools rows stay
    // readable; the full base64 still lives on the queued row when
    // localStorage succeeds. The catch block below logs failures
    // unconditionally because those are real errors.
    if (import.meta.env.DEV) {
      console.error('[QuoteRequest] form submission (no backend wired):', {
        ...row,
        logoDataUrl: row.logoDataUrl ? `[base64 ${row.logoDataUrl.length} chars]` : null,
      });
    }

    try {
      const raw = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
      const arr: unknown[] = Array.isArray(raw) ? raw : [];
      const clean: QuoteQueueRow[] = arr.filter(
        (v): v is QuoteQueueRow =>
          !!v && typeof v === 'object'
          && typeof (v as { email?: unknown }).email === 'string'
          && typeof (v as { company?: unknown }).company === 'string'
          && typeof (v as { at?: unknown }).at === 'number',
      );
      clean.push(row);
      // FIFO cap — drop oldest entries beyond QUEUE_CAP so localStorage
      // doesn't grow unbounded and a stale 800KB logo from three weeks
      // ago can't squat on the budget. slice(-CAP) keeps the most recent.
      const capped = clean.slice(-QUEUE_CAP);
      localStorage.setItem(QUEUE_KEY, JSON.stringify(capped));
    } catch (err) {
      // Local persistence failed; toast still fires so the user isn't
      // left in limbo, and the payload already hit console.error.
      console.error('[QuoteRequest] localStorage write failed:', err);
    }

    // Brief loading dwell so the spinner registers before the tick.
    window.setTimeout(() => {
      // Bilingual receipt toast with a phone fallback. Until quote
      // submissions are wired to a Zapier webhook → Outlook delivery,
      // the 367-380-4808 number gives the user a guaranteed channel
      // if our 24h reply doesn't land. The page body still advertises
      // the more aggressive 2h-business SLA — the toast is the
      // operator-grade safety net.
      toast.success(
        lang === 'en'
          ? 'Message sent. We’ll reply within 24h. Otherwise call us at 367-380-4808.'
          : 'Message envoyé. On te répond dans les 24h. Sinon appelle-nous au 367-380-4808.',
        { duration: 8000 },
      );
      setSubmitState('success');
      setSubmitted(true);
      window.setTimeout(() => setSubmitState('idle'), 2000);
    }, 350);
  };

  // Display strings for the step indicator + nav labels.
  const stepLabels = lang === 'en'
    ? ['Project', 'Contact', 'Review']
    : ['Projet', 'Contact', 'Confirmation'];

  // Master Prompt Audi field-group classes — single source of truth so
  // every input/select/textarea on the form stays visually aligned.
  const fieldBase =
    'w-full bg-white border border-va-line rounded-xl px-4 py-3 text-va-ink focus:border-va-blue focus:ring-2 focus:ring-va-blue/20 focus:outline-none transition-all';
  const fieldErr =
    'w-full bg-white border border-va-err rounded-xl px-4 py-3 text-va-ink focus:border-va-err focus:ring-2 focus:ring-va-err/20 focus:outline-none transition-all';
  const labelBase = 'font-medium text-va-dim text-sm mb-2 block';
  const errText = 'text-va-err text-xs mt-1';

  return (
    <div className="min-h-screen bg-va-bg-2 flex flex-col">
      <Navbar />
      <main id="main-content" className="flex-1">
        {/* Hero header — Master Prompt Audi */}
        <header className="bg-va-bg-1 py-16 border-b border-va-line">
          <div className="max-w-3xl mx-auto px-6">
            <div className="text-va-muted text-xs uppercase tracking-[0.15em] mb-3">
              {lang === 'en' ? 'Quick quote' : 'Devis express'}
            </div>
            <h1 className="font-display font-black text-va-ink text-4xl md:text-5xl tracking-[-0.03em] mb-4">
              {lang === 'en' ? 'Reply within 24 hours.' : 'On te répond avant 24 heures.'}
            </h1>
            <p className="text-va-muted text-lg">
              {lang === 'en'
                ? 'The more specific, the faster we ship. No commitment.'
                : 'Plus c’est précis, plus vite on te livre. Aucun engagement.'}
            </p>
          </div>
        </header>

        <div className="px-6">
          <section className="bg-white max-w-3xl mx-auto p-8 md:p-12 rounded-2xl border border-va-line shadow-[0_24px_60px_rgba(0,0,0,0.04)] my-12">
          {/* Step indicator */}
          {!submitted && (
            <ol
              className="flex items-center gap-3 mb-10"
              aria-label={lang === 'en' ? 'Form steps' : 'Étapes du formulaire'}
            >
              {stepLabels.map((label, i) => {
                const idx = (i + 1) as 1 | 2 | 3;
                const active = step === idx;
                const done = step > idx;
                const circleCls = done
                  ? 'bg-va-blue text-white'
                  : active
                    ? 'bg-va-ink text-white ring-2 ring-va-blue ring-offset-2'
                    : 'bg-va-line text-va-muted';
                return (
                  <li key={label} className="flex items-center gap-3 flex-1 min-w-0">
                    <span
                      aria-current={active ? 'step' : undefined}
                      className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all flex-shrink-0 ${circleCls}`}
                    >
                      {done ? <Check size={14} aria-hidden="true" /> : idx}
                    </span>
                    <span
                      className={`text-xs font-semibold uppercase tracking-wider truncate ${
                        active ? 'text-va-ink' : done ? 'text-va-blue' : 'text-va-muted'
                      }`}
                    >
                      {label}
                    </span>
                    {i < stepLabels.length - 1 && (
                      <span
                        aria-hidden="true"
                        className={`flex-1 h-px ${done ? 'bg-va-blue' : 'bg-va-line'}`}
                      />
                    )}
                  </li>
                );
              })}
            </ol>
          )}

          {submitted ? (
            // Success state — replaces the form. Same pattern as Contact.tsx
            // so the user sees a concrete end-state after submission.
            <div className="text-center py-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-va-blue-l text-va-blue mb-4">
                <Check size={28} aria-hidden="true" />
              </div>
              <h2 className="font-display font-black text-va-ink text-3xl tracking-[-0.02em] mb-2">
                {lang === 'en' ? 'Submission received' : 'Soumission envoyée'}
              </h2>
              <p className="text-va-muted text-base mb-6 max-w-[480px] mx-auto">
                {lang === 'en'
                  ? `Thanks ${name || 'for reaching out'} — we’ll reply with a tailored quote within 2 business hours. Check your inbox at ${email}.`
                  : `Merci ${name || 'd’avoir écrit'} — on revient avec une soumission personnalisée sous 2 heures ouvrables. Surveillez votre boîte : ${email}.`}
              </p>
              <Link
                to="/"
                className="inline-block bg-va-blue hover:bg-va-blue-h text-white font-semibold px-6 py-3 rounded-xl transition-colors"
              >
                {lang === 'en' ? 'Back to home' : 'Retour à l’accueil'}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              {step === 1 && (
                <div className="grid gap-5">
                  <h2 className="font-display font-black text-va-ink text-2xl tracking-[-0.02em]">
                    {lang === 'en' ? 'Project basics' : 'Détails du projet'}
                  </h2>

                  <div>
                    <label htmlFor="qty" className={labelBase}>
                      {lang === 'en' ? 'Quantity' : 'Quantité'}
                      <span className="text-va-err ml-1" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="qty"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={QTY_MAX}
                      step={1}
                      value={quantity}
                      onChange={e => setQuantity(parseQty(e.target.value))}
                      required
                      aria-required="true"
                      aria-invalid={quantity < 1 || !Number.isInteger(quantity)}
                      aria-describedby="qty-hint"
                      className={fieldBase}
                    />
                    {/* Inline qty preview pill — surfaces the active
                        tier so the buyer sees the per-unit price drop
                        the moment they cross a threshold. */}
                    {quantity >= 1 && tierPill && (
                      <div className="bg-va-blue-l text-va-blue rounded-full px-3 py-1 text-xs font-semibold mt-2 inline-block">
                        {tierPill}
                      </div>
                    )}
                    <p id="qty-hint" className="text-xs text-va-muted mt-2">
                      {lang === 'en'
                        ? 'Whole number, 1 to 50,000.'
                        : 'Nombre entier, de 1 à 50 000.'}
                    </p>
                  </div>

                  <div>
                    <label htmlFor="product" className={labelBase}>
                      {lang === 'en' ? 'Product' : 'Produit'}
                      <span className="text-va-err ml-1" aria-hidden="true">*</span>
                    </label>
                    <select
                      id="product"
                      value={productSku}
                      onChange={e => setProductSku(e.target.value)}
                      required
                      aria-required="true"
                      className={fieldBase}
                    >
                      {PRODUCTS.map(p => (
                        <option key={p.sku} value={p.sku}>
                          {p.shortName} — {p.sku}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="deadline" className={labelBase}>
                        {lang === 'en' ? 'Deadline' : 'Échéance'}
                      </label>
                      <input
                        id="deadline"
                        type="date"
                        value={deadline}
                        onChange={e => setDeadline(e.target.value)}
                        className={fieldBase}
                      />
                    </div>
                    <div>
                      <label htmlFor="colors" className={labelBase}>
                        {lang === 'en' ? 'Colors / Pantone' : 'Couleurs / Pantone'}
                      </label>
                      <input
                        id="colors"
                        type="text"
                        value={colors}
                        onChange={e => setColors(e.target.value)}
                        placeholder={lang === 'en' ? 'e.g. PMS 2945 + white' : 'ex. PMS 2945 + blanc'}
                        className={fieldBase}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={goNext}
                      disabled={!step1Valid}
                      className="inline-flex items-center gap-2 bg-va-blue hover:bg-va-blue-h text-white font-semibold px-6 py-3 rounded-xl transition-colors disabled:bg-va-line disabled:text-va-muted disabled:cursor-not-allowed"
                    >
                      {lang === 'en' ? 'Continue' : 'Continuer'}
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="grid gap-5">
                  <h2 className="font-display font-black text-va-ink text-2xl tracking-[-0.02em]">
                    {lang === 'en' ? 'Your contact info' : 'Vos coordonnées'}
                  </h2>

                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="company" className={labelBase}>
                        {lang === 'en' ? 'Company' : 'Entreprise'}
                        <span className="text-va-err ml-1" aria-hidden="true">*</span>
                      </label>
                      <input
                        id="company"
                        type="text"
                        value={company}
                        onChange={e => setCompany(e.target.value)}
                        required
                        aria-required="true"
                        className={fieldBase}
                      />
                    </div>
                    <div>
                      <label htmlFor="name" className={labelBase}>
                        {lang === 'en' ? 'Your name' : 'Votre nom'}
                      </label>
                      <input
                        id="name"
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className={fieldBase}
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="email" className={labelBase}>
                        {lang === 'en' ? 'Email' : 'Courriel'}
                        <span className="text-va-err ml-1" aria-hidden="true">*</span>
                      </label>
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={e => { setEmail(e.target.value); setEmailErr(false); }}
                        aria-invalid={emailErr}
                        aria-required="true"
                        required
                        className={emailErr ? fieldErr : fieldBase}
                      />
                      {emailErr && (
                        <p className={errText}>
                          {lang === 'en' ? 'Please enter a valid email.' : 'Entrez un courriel valide.'}
                        </p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="phone" className={labelBase}>
                        {lang === 'en' ? 'Phone' : 'Téléphone'}
                        <span className="text-va-err ml-1" aria-hidden="true">*</span>
                      </label>
                      <input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={e => { setPhone(e.target.value); setPhoneErr(false); }}
                        aria-invalid={phoneErr}
                        aria-required="true"
                        required
                        placeholder="514-555-1234"
                        className={phoneErr ? fieldErr : fieldBase}
                      />
                      {phoneErr && (
                        <p className={errText}>
                          {lang === 'en'
                            ? 'Use a 10-digit Canadian number or +country format.'
                            : 'Utilisez un numéro à 10 chiffres ou le format +indicatif.'}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className={labelBase}>
                      {lang === 'en' ? 'Logo (optional)' : 'Logo (optionnel)'}
                    </label>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-va-line-h rounded-xl text-sm text-va-dim bg-va-bg-2 hover:bg-va-bg-3 hover:border-va-blue transition-all"
                    >
                      <Upload size={15} aria-hidden="true" />
                      {logoName
                        ? logoName
                        : lang === 'en' ? 'Upload your logo (PNG, JPG, SVG, PDF)' : 'Téléverser votre logo (PNG, JPG, SVG, PDF)'}
                    </button>
                    <input
                      ref={fileInputRef}
                      id="logo"
                      type="file"
                      accept="image/*,.pdf,.svg"
                      onChange={e => handleFile(e.target.files?.[0] ?? null)}
                      className="sr-only"
                    />
                    <p className="text-xs text-va-muted mt-2">
                      {lang === 'en'
                        ? 'Max 800 KB. For larger files, send by email after submitting.'
                        : 'Max 800 Ko. Pour des fichiers plus gros, envoyez par courriel après la soumission.'}
                    </p>
                  </div>

                  <div>
                    <label htmlFor="notes" className={labelBase}>
                      {lang === 'en' ? 'Notes' : 'Notes'}
                    </label>
                    <textarea
                      id="notes"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={4}
                      className={fieldBase}
                    />
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <button
                      type="button"
                      onClick={goBack}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-va-muted hover:text-va-ink px-4 py-2 rounded-xl transition-colors"
                    >
                      <ArrowLeft size={15} aria-hidden="true" />
                      {lang === 'en' ? 'Back' : 'Retour'}
                    </button>
                    <button
                      type="button"
                      onClick={goNext}
                      className="inline-flex items-center gap-2 bg-va-blue hover:bg-va-blue-h text-white font-semibold px-6 py-3 rounded-xl transition-colors"
                    >
                      {lang === 'en' ? 'Review' : 'Réviser'}
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="grid gap-5">
                  <h2 className="font-display font-black text-va-ink text-2xl tracking-[-0.02em]">
                    {lang === 'en' ? 'Review and submit' : 'Réviser et soumettre'}
                  </h2>

                  <div className="rounded-xl bg-va-bg-2 border border-va-line p-6">
                    <div className="text-xs font-medium uppercase tracking-[0.15em] text-va-muted mb-2">
                      {lang === 'en' ? 'Estimated price' : 'Prix estimé'}
                    </div>
                    <div className="font-display font-black text-va-ink text-4xl tracking-[-0.02em]">
                      {totalPrice.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', {
                        style: 'currency',
                        currency: 'CAD',
                        maximumFractionDigits: 2,
                      })}
                    </div>
                    <div className="text-sm text-va-dim mt-2">
                      {quantity} × {productName} · {unitPrice.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', {
                        style: 'currency',
                        currency: 'CAD',
                      })}
                      {' '}
                      / {lang === 'en' ? 'unit' : 'unité'}
                    </div>
                    <p className="text-xs text-va-muted mt-3">
                      {lang === 'en'
                        ? 'Indicative only. Final pricing depends on art, locations and finishes — confirmed in our reply.'
                        : 'À titre indicatif. Le prix final dépend du visuel, des emplacements et des finitions — confirmé dans notre réponse.'}
                    </p>
                  </div>

                  <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-[0.15em] text-va-muted mb-1">{lang === 'en' ? 'Company' : 'Entreprise'}</dt>
                      <dd className="text-va-ink">{company || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-[0.15em] text-va-muted mb-1">{lang === 'en' ? 'Contact' : 'Contact'}</dt>
                      <dd className="text-va-ink">{name || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-[0.15em] text-va-muted mb-1">{lang === 'en' ? 'Email' : 'Courriel'}</dt>
                      <dd className="text-va-ink break-all">{email}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-[0.15em] text-va-muted mb-1">{lang === 'en' ? 'Phone' : 'Téléphone'}</dt>
                      <dd className="text-va-ink">{phone}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-[0.15em] text-va-muted mb-1">{lang === 'en' ? 'Deadline' : 'Échéance'}</dt>
                      <dd className="text-va-ink">{deadline || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-[0.15em] text-va-muted mb-1">{lang === 'en' ? 'Colors' : 'Couleurs'}</dt>
                      <dd className="text-va-ink">{colors || '—'}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs font-medium uppercase tracking-[0.15em] text-va-muted mb-1">{lang === 'en' ? 'Logo' : 'Logo'}</dt>
                      <dd className="text-va-ink">{logoName ?? (lang === 'en' ? 'None attached' : 'Aucun')}</dd>
                    </div>
                    {notes && (
                      <div className="sm:col-span-2">
                        <dt className="text-xs font-medium uppercase tracking-[0.15em] text-va-muted mb-1">{lang === 'en' ? 'Notes' : 'Notes'}</dt>
                        <dd className="text-va-ink whitespace-pre-wrap">{notes}</dd>
                      </div>
                    )}
                  </dl>

                  <div className="pt-2 space-y-4">
                    <div className="flex justify-between items-center">
                      <button
                        type="button"
                        onClick={goBack}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-va-muted hover:text-va-ink px-4 py-2 rounded-xl transition-colors"
                      >
                        <ArrowLeft size={15} aria-hidden="true" />
                        {lang === 'en' ? 'Back' : 'Retour'}
                      </button>
                    </div>
                    <SubmitButton
                      state={submitState}
                      className="bg-va-blue hover:bg-va-blue-h text-white font-semibold w-full px-6 py-4 rounded-xl shadow-[0_0_30px_rgba(0,82,204,0.25)] disabled:bg-va-line disabled:text-va-muted disabled:shadow-none transition-all"
                    >
                      {lang === 'en' ? 'Send request' : 'Envoyer ma demande'}
                    </SubmitButton>
                    <p className="text-va-muted text-xs text-center">
                      {lang === 'en'
                        ? '🔒 Your info stays private · No commitment · Reply within 24h'
                        : '🔒 Tes infos restent privées · Aucun engagement · Réponse en 24h'}
                    </p>
                  </div>
                </div>
              )}
            </form>
          )}
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
