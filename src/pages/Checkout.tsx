import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, ShieldCheck, MapPin, Mail, Truck, CreditCard, CheckCircle2, Loader2, Package, MailCheck, Clock, X, Gift } from 'lucide-react';
import { toast } from 'sonner';
import { useCartStore } from '@/stores/localCartStore';
import { useCartStore as useShopifyCartStore } from '@/stores/cartStore';
import { useAuthStore } from '@/stores/authStore';
import { useLang } from '@/lib/langContext';
import { isValidEmail, isValidCanadianPostal } from '@/lib/utils';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { AIChat } from '@/components/AIChat';
import { DeliveryBadge } from '@/components/DeliveryBadge';
import { fmtMoney as fmtCAD } from '@/lib/format';
import { trackEvent } from '@/lib/analytics';
import { readLS, writeLS } from '@/lib/storage';
import { sanitizeText } from '@/lib/sanitize';

type Step = 'info' | 'shipping' | 'payment' | 'done';

interface ShippingForm {
  email: string;
  firstName: string;
  lastName: string;
  company: string;
  address: string;
  city: string;
  postalCode: string;
  province: string;
  phone: string;
  notes: string;
}

// Quebec effective combined rate is 14.975% (5% GST + 9.975% QST).
// We break out each component for the order summary so buyers can see
// where the tax number came from — federal GST and provincial QST
// are separate line items on any Quebec invoice.
const GST_RATE = 0.05;
const QST_RATE = 0.09975;
const TAX_RATE = GST_RATE + QST_RATE; // 0.14975 — QST + GST combined for Quebec

// Shipping options shown as radio tiles on the Shipping step. Each tile
// renders the method name, price, a computed ETA date (skipping weekends,
// except for pickup which has a fixed "ready tomorrow" promise), and a
// one-liner description. Defaults to Standard on first visit; selection
// persists to localStorage under `vision-shipping-method` so a refresh
// mid-checkout keeps the buyer's choice.
type ShippingMethod = 'standard' | 'express' | 'pickup';
const SHIPPING_OPTIONS: Record<ShippingMethod, {
  labelFr: string;
  labelEn: string;
  windowFr: string;
  windowEn: string;
  descFr: string;
  descEn: string;
  price: number;
  /** Business-day offset from today used to compute ETA. null = pickup (no delivery ETA). */
  etaBusinessDays: number | null;
}> = {
  standard: {
    labelFr: 'Standard',
    labelEn: 'Standard',
    windowFr: '5-7 jours ouvrables',
    windowEn: '5-7 business days',
    descFr: 'Livraison régulière',
    descEn: 'Standard delivery',
    price: 12,
    etaBusinessDays: 6,
  },
  express: {
    labelFr: 'Express',
    labelEn: 'Express',
    windowFr: '2-3 jours ouvrables',
    windowEn: '2-3 business days',
    descFr: 'Livraison rapide',
    descEn: 'Rush delivery',
    price: 22,
    etaBusinessDays: 3,
  },
  pickup: {
    labelFr: 'Cueillette',
    labelEn: 'Pickup',
    windowFr: 'Prêt demain',
    windowEn: 'Ready tomorrow',
    descFr: 'Cueillette à Saint-Hyacinthe',
    descEn: 'Pickup in Saint-Hyacinthe',
    price: 0,
    etaBusinessDays: null,
  },
};

const SHIPPING_STORAGE_KEY = 'vision-shipping-method';

// Key + TTL for the "pending checkout draft" feature. Any in-progress
// form state (name / email / phone / address / city / postal / notes /
// shipping method) is persisted under this key with a 500ms debounce
// so a buyer who closes the tab mid-flow can resume on the next visit
// via a banner at the top of the page. Card data (cardNumber, cvv,
// expiry) is NEVER persisted here — Shopify's hosted form owns that.
const DRAFT_STORAGE_KEY = 'vision-checkout-draft';
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DRAFT_DEBOUNCE_MS = 500;

interface CheckoutDraft {
  name: string;        // "First Last" joined for forward-compat with schemas that store one field
  firstName?: string;  // split variants kept so hydration can skip the re-split round-trip
  lastName?: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  notes: string;
  shippingMethod: ShippingMethod;
  /** Task 5.17 — gift-message metadata. `isGift` tracks whether the
   *  buyer opened the textarea so we can restore the toggle state on
   *  resume; `giftMessage` is the optional note itself (capped at 250
   *  chars in the UI). Both optional for back-compat with drafts
   *  written before 5.17 shipped. */
  isGift?: boolean;
  giftMessage?: string;
  updatedAt: number;
}

/** Task 5.17 — hard cap on gift-message length. 250 keeps the note
 *  short enough to fit on a handwritten-style delivery-receipt card
 *  without the fulfillment team having to truncate by hand. Enforced
 *  at the textarea (maxLength) and at persistence time (slice). */
const GIFT_MESSAGE_MAX = 250;

/** Humanize ms elapsed into "5min", "2h", "3j/d". Used by the resume banner. */
function formatElapsed(ms: number, lang: 'en' | 'fr'): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return lang === 'en' ? 'just now' : "à l'instant";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return lang === 'en' ? `${minutes}min` : `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return lang === 'en' ? `${hours}h` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return lang === 'en' ? `${days}d` : `${days}j`;
}

/**
 * Progressively format a phone string as fr-CA `(ddd) ddd-dddd`.
 * Strips every non-digit, caps at 10, and reformats partial input so
 * the user sees "(514", "(514) 5", "(514) 555-1", etc. as they type.
 * Idempotent: running it on an already-formatted value reproduces the
 * same output. `isValidPhone` downstream normalizes via /[^\d]/ so the
 * formatted string remains valid for the submit/validate pipeline.
 */
function formatCanadianPhone(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 10);
  if (digits.length === 0) return '';
  if (digits.length < 4) return `(${digits}`;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * Progressively format a Canadian postal code as `A1A 1A1`. Uppercases,
 * strips spaces and non-alphanumerics, caps at 6 characters, then
 * inserts a single space after the 3rd char once we have more than 3.
 * Idempotent — re-running on a formatted value preserves it exactly.
 */
function formatCanadianPostal(input: string): string {
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  if (cleaned.length <= 3) return cleaned;
  return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
}

/**
 * Add `businessDays` weekdays to `from`, skipping Saturday + Sunday.
 * Used to compute the real delivery ETA shown on each shipping tile
 * so the buyer sees a concrete date ("Livré autour du mardi 28 avril")
 * instead of a vague window.
 */
function addBusinessDays(from: Date, businessDays: number): Date {
  const out = new Date(from);
  let remaining = businessDays;
  while (remaining > 0) {
    out.setDate(out.getDate() + 1);
    const dow = out.getDay();
    if (dow !== 0 && dow !== 6) remaining--;
  }
  return out;
}

const empty: ShippingForm = {
  email: '', firstName: '', lastName: '', company: '',
  address: '', city: '', postalCode: '', province: 'QC', phone: '', notes: '',
};

/**
 * Multi-step checkout page (info → shipping → payment → done) with EN/FR
 * copy, draft auto-save, Canadian postal/phone formatting, and a Shopify
 * hand-off for payment. Renders the local confirmation screen when the
 * thank-you redirect returns with `?step=done&order=…`.
 */
export default function Checkout() {
  const { lang } = useLang();
  const navigate = useNavigate();
  const cart = useCartStore();
  const shopifyCart = useShopifyCartStore();
  const user = useAuthStore(s => s.user);

  // On mount, detect a return-from-Shopify handoff. Shopify's thank-you
  // page can redirect back here with `?step=done&order=VA-1234` (or the
  // equivalent `?order_number=…` alias) so we can render the local
  // confirmation screen without depending on Shopify's UI. If the URL
  // carries a pending-checkout payload from localStorage we fall back to
  // that buyer's name/email so the confirmation feels personal.
  const initialStep = useMemo<Step>(() => {
    if (typeof window === 'undefined') return 'info';
    const params = new URLSearchParams(window.location.search);
    const s = params.get('step');
    return s === 'done' ? 'done' : 'info';
  }, []);
  const initialOrderNumber = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    return params.get('order') ?? params.get('order_number') ?? '';
  }, []);

  const [step, setStep] = useState<Step>(initialStep);
  const [orderNumber, setOrderNumber] = useState<string>(initialOrderNumber);
  const [form, setForm] = useState<ShippingForm>(empty);

  // Resume-draft banner — surfaced on mount if `vision-checkout-draft`
  // was written within the last 7 days. Declared here (not lazily inside
  // a useMemo) so we can clear it from both the Reprendre and Effacer
  // handlers without re-reading localStorage. `null` = no offer.
  const [draftOffer, setDraftOffer] = useState<CheckoutDraft | null>(() => {
    if (typeof window === 'undefined') return null;
    if (initialStep === 'done') return null; // post-payment return — don't nag
    const draft = readLS<CheckoutDraft | null>(DRAFT_STORAGE_KEY, null);
    if (!draft || typeof draft !== 'object') return null;
    if (typeof draft.updatedAt !== 'number') return null;
    if (Date.now() - draft.updatedAt > DRAFT_TTL_MS) return null;
    // Nothing to restore? Don't show the banner.
    const hasContent = Boolean(
      draft.email || draft.firstName || draft.lastName || draft.address ||
      draft.city || draft.postalCode || draft.phone || draft.notes ||
      draft.isGift || draft.giftMessage,
    );
    return hasContent ? draft : null;
  });

  // Rehydrate buyer info from the pending-checkout payload we stashed
  // before redirecting to Shopify. Lets the 'Merci, {name}!' line still
  // greet them by first name on the return trip even if the user isn't
  // signed in.
  useEffect(() => {
    if (step !== 'done') return;
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('vision-pending-checkout');
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<ShippingForm> & { ts?: number };
      // Ignore anything older than 24h — a stale payload probably isn't
      // from the order we're confirming.
      if (parsed?.ts && Date.now() - parsed.ts > 24 * 60 * 60 * 1000) return;
      setForm(f => ({
        ...f,
        email: f.email || parsed.email || '',
        firstName: f.firstName || parsed.firstName || '',
        lastName: f.lastName || parsed.lastName || '',
      }));
    } catch (e) {
      console.warn('[Checkout] Could not rehydrate pending checkout payload:', e);
    }
  }, [step]);

  // Pre-fill email from the signed-in user's profile so they don't
  // have to retype what the app already knows. Only fills if the
  // field is still empty (don't overwrite a user edit if they opt to
  // use a different email). Split the name too when we have it.
  // Track the post-redirect safety-net timers so they don't fire
  // setProcessing on an unmounted page after Shopify navigation lands.
  // The window.location.href redirect is synchronous but the new page
  // hasn't mounted yet — React dev warning otherwise.
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  // GA4 begin_checkout — fires once on mount when the buyer lands on
  // /checkout with items in the cart. Skipped when the page is a
  // Shopify post-payment redirect (?step=done) because that flow
  // never went through the on-site info/shipping/payment funnel, and
  // the purchase effect below is the correct signal for those loads.
  const beginCheckoutFiredRef = useRef(false);
  useEffect(() => {
    if (beginCheckoutFiredRef.current) return;
    if (initialStep === 'done') return;
    if (cart.items.length === 0) return;
    beginCheckoutFiredRef.current = true;
    trackEvent('begin_checkout', {
      item_count: cart.getItemCount(),
      value: cart.getTotal(),
      currency: 'CAD',
    });
  }, [cart, initialStep]);

  // GA4 purchase — fires the moment the checkout UI flips to the
  // `done` state, either because the user completed the on-site flow
  // or because Shopify's thank-you page redirected back with
  // ?step=done&order=VA-…. Guarded with a ref so a re-render of the
  // done screen (lang toggle, title update) doesn't re-fire it.
  const purchaseFiredRef = useRef(false);
  useEffect(() => {
    if (step !== 'done') return;
    if (purchaseFiredRef.current) return;
    purchaseFiredRef.current = true;
    trackEvent('purchase', {
      transaction_id: orderNumber || undefined,
      currency: 'CAD',
    });
  }, [step, orderNumber]);

  const prefilledRef = useRef(false);
  useEffect(() => {
    if (prefilledRef.current) return;
    if (!user) return;
    prefilledRef.current = true;
    setForm(prev => {
      const updates: Partial<ShippingForm> = {};
      if (!prev.email && user.email) updates.email = user.email;
      if (!prev.firstName || !prev.lastName) {
        const parts = (user.name ?? '').trim().split(/\s+/);
        if (!prev.firstName && parts[0]) updates.firstName = parts[0];
        if (!prev.lastName && parts.length > 1) updates.lastName = parts.slice(1).join(' ');
      }
      return Object.keys(updates).length ? { ...prev, ...updates } : prev;
    });
  }, [user]);

  useEffect(() => {
    const prev = document.title;
    const labels: Record<Step, { en: string; fr: string }> = {
      info:     { en: 'Checkout · Info',     fr: 'Caisse · Informations' },
      shipping: { en: 'Checkout · Shipping', fr: 'Caisse · Livraison' },
      payment:  { en: 'Checkout · Payment',  fr: 'Caisse · Paiement' },
      done:     { en: 'Order confirmed',     fr: 'Commande confirmée' },
    };
    document.title = `${lang === 'en' ? labels[step].en : labels[step].fr} — Vision Affichage`;
    return () => { document.title = prev; };
  }, [lang, step]);
  // Rehydrate previous shipping-method choice from localStorage so a
  // refresh mid-checkout doesn't silently reset the buyer back to
  // Standard and re-surcharge them (or undo a pickup choice). Falls
  // back to 'standard' on first visit or if the stored value is stale.
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>(() => {
    if (typeof window === 'undefined') return 'standard';
    try {
      const saved = window.localStorage.getItem(SHIPPING_STORAGE_KEY);
      if (saved === 'standard' || saved === 'express' || saved === 'pickup') return saved;
    } catch { /* SSR / privacy-mode safari — ignore */ }
    return 'standard';
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { window.localStorage.setItem(SHIPPING_STORAGE_KEY, shippingMethod); } catch { /* quota / privacy mode — ignore */ }
  }, [shippingMethod]);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Task 5.17 — optional gift-message. Toggle stays collapsed by
  // default so the field doesn't clutter the payment step for the
  // 95% of buyers shipping merch to themselves. When checked, the
  // textarea below appears with a live char counter. Both pieces
  // persist into the checkout draft so a mid-flow refresh preserves
  // the toggle + any typed note, and both are forwarded into the
  // `vision-pending-checkout` payload so fulfillment sees them.
  const [isGift, setIsGift] = useState(false);
  const [giftMessage, setGiftMessage] = useState('');

  // Debounced (500ms) write of the non-sensitive portion of the form
  // into `vision-checkout-draft`. Any re-render that changes form or
  // shippingMethod schedules a fresh timer; the previous one is
  // cleared so we only persist after the user pauses typing. Card
  // fields are not part of `form` so they can't leak in by accident —
  // but we still hand-pick fields to put in the draft rather than
  // blindly spreading `form`, as belt-and-suspenders against a future
  // refactor that would add a sensitive field to ShippingForm.
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (step === 'done') return; // never persist after success
    // Skip persisting an all-empty form on first render — avoids
    // creating an empty draft that then immediately trips the banner
    // on the next visit with nothing useful to restore.
    const hasContent = Boolean(
      form.email || form.firstName || form.lastName || form.address ||
      form.city || form.postalCode || form.phone || form.notes ||
      isGift || giftMessage,
    );
    if (!hasContent) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      const name = [form.firstName, form.lastName].filter(Boolean).join(' ').trim();
      const draft: CheckoutDraft = {
        name,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        address: form.address,
        city: form.city,
        postalCode: form.postalCode,
        notes: form.notes,
        shippingMethod,
        // Task 5.17 — belt-and-suspenders cap at persistence time in
        // case a future refactor ever bypasses the textarea maxLength.
        isGift,
        giftMessage: giftMessage.slice(0, GIFT_MESSAGE_MAX),
        updatedAt: Date.now(),
      };
      writeLS(DRAFT_STORAGE_KEY, draft);
      draftTimerRef.current = null;
    }, DRAFT_DEBOUNCE_MS);
    return () => {
      if (draftTimerRef.current) {
        clearTimeout(draftTimerRef.current);
        draftTimerRef.current = null;
      }
    };
  }, [form, shippingMethod, step, isGift, giftMessage]);

  // Successful checkout wipes the draft so the banner doesn't re-
  // appear on the next visit. Fires on the step-flip to 'done' (both
  // direct flow and Shopify return-redirect ?step=done), mirroring
  // the purchase-event effect above.
  useEffect(() => {
    if (step !== 'done') return;
    if (typeof window === 'undefined') return;
    try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch { /* private mode — ignore */ }
    setDraftOffer(null);
  }, [step]);

  const hydrateFromDraft = (draft: CheckoutDraft) => {
    setForm(prev => ({
      ...prev,
      email: draft.email || prev.email,
      firstName: draft.firstName || (draft.name?.split(' ')[0] ?? '') || prev.firstName,
      lastName: draft.lastName || (draft.name?.split(' ').slice(1).join(' ') ?? '') || prev.lastName,
      phone: draft.phone || prev.phone,
      address: draft.address || prev.address,
      city: draft.city || prev.city,
      postalCode: draft.postalCode || prev.postalCode,
      notes: draft.notes || prev.notes,
    }));
    if (draft.shippingMethod === 'standard' || draft.shippingMethod === 'express' || draft.shippingMethod === 'pickup') {
      setShippingMethod(draft.shippingMethod);
    }
    // Task 5.17 — restore the gift toggle + note so a buyer who was
    // mid-way through writing "Bonne fête maman" can pick up exactly
    // where they left off.
    if (typeof draft.isGift === 'boolean') setIsGift(draft.isGift);
    if (typeof draft.giftMessage === 'string') {
      setGiftMessage(draft.giftMessage.slice(0, GIFT_MESSAGE_MAX));
    }
    setDraftOffer(null);
    toast.success(lang === 'en' ? 'Draft restored.' : 'Brouillon restauré.');
  };

  const clearDraft = () => {
    if (typeof window !== 'undefined') {
      try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch { /* ignore */ }
    }
    setDraftOffer(null);
  };

  const subtotal = cart.getTotal();
  const shippingCost = SHIPPING_OPTIONS[shippingMethod].price;
  const taxableBase = subtotal + shippingCost;
  const gst = taxableBase * GST_RATE;
  const qst = taxableBase * QST_RATE;
  const tax = gst + qst;
  const total = subtotal + shippingCost + tax;
  const itemCount = cart.getItemCount();

  // Match the locale-aware money formatting used on Cart /
  // FeaturedProducts / WishlistGrid / ProductDetailBulkCalc so French
  // users see "27,54 $" (comma decimal) instead of "27.54 $" on the
  // checkout page. Plain .toFixed() is locale-blind and made the
  // checkout summary the odd page out after the Cart fix.
  const fmtMoney = (n: number) =>
    (Number.isFinite(n) ? n : 0).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  if (step === 'done') {
    return (
      <div id="main-content" tabIndex={-1} className="min-h-screen bg-gradient-to-b from-secondary/30 to-background focus:outline-none">
        <Navbar />
        <div className="max-w-[720px] mx-auto px-4 md:px-8 pt-20 pb-32">
          <DoneState
            lang={lang}
            firstName={form.firstName}
            orderNumber={orderNumber}
          />
        </div>
        <AIChat />
        <BottomNav />
      </div>
    );
  }

  if (cart.items.length === 0 && step !== 'done') {
    return (
      <div className="min-h-screen bg-background flex flex-col pb-20">
        <Navbar />
        <div className="flex-1 flex items-center justify-center px-6 py-20">
          <div className="text-center max-w-sm">
            <h1 className="text-2xl font-extrabold mb-2">{lang === 'en' ? 'Cart is empty' : 'Panier vide'}</h1>
            <p className="text-sm text-muted-foreground mb-6">
              {lang === 'en' ? 'Add a product before checkout.' : "Ajoute un produit avant de passer la commande."}
            </p>
            <Link to="/products" className="inline-block text-sm font-extrabold text-primary-foreground gradient-navy px-6 py-3 rounded-full shadow-navy">
              {lang === 'en' ? 'See products' : 'Voir les produits'}
            </Link>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  const stepIndex = (['info', 'shipping', 'payment'] as const).indexOf(step as 'info' | 'shipping' | 'payment');

  const goNext = () => {
    if (step === 'info') setStep('shipping');
    else if (step === 'shipping') setStep('payment');
  };

  const goBack = () => {
    if (step === 'payment') setStep('shipping');
    else if (step === 'shipping') setStep('info');
    else navigate('/cart');
  };

  // Canadian postal code: H2X 1Y2 (letter-digit-letter space? digit-letter-digit).
  // Lenient on the space and case — accept "H2X 1Y2", "H2X1Y2", "h2x1y2".
  // Without this, the 'Continue' button enabled for 'foo' input and the
  // user only learned at Shopify's checkout that the address was invalid.
  const postalValid = isValidCanadianPostal(form.postalCode);
  // Phone is optional, but if the user typed something it must be a
  // plausible NANP 10-digit number once punctuation is stripped.
  // Without this, Shopify's checkout rejects the line at submission
  // and the user has to re-enter card details.
  const phoneTrimmed = form.phone.trim();
  const isValidPhone = phoneTrimmed.length === 0
    || /^\d{10}$/.test(phoneTrimmed.replace(/[^\d]/g, ''));
  const infoValid =
    isValidEmail(form.email) &&
    form.firstName.trim() && form.lastName.trim() && form.address.trim() &&
    form.city.trim() && postalValid && isValidPhone;

  const handlePay = async () => {
    if (!acceptedTerms) return;
    setProcessing(true);
    // Build Shopify cart with line items + buyer identity, then redirect to
    // Shopify's hosted payment form (the only step that can't run on our
    // domain without Shopify Plus checkout extensibility). Everything before
    // this — shipping/email/method — stays on-site.
    try {
      // Wait up to ~5s for Shopify cart to be ready. The old logic
      // stopped polling as soon as isLoading was false, which exited
      // prematurely when the cart hadn't even started syncing yet
      // (race: user hits Pay before addItem's first fetch kicks off).
      let checkoutUrl = shopifyCart.getCheckoutUrl();
      let retries = 0;
      const MAX_RETRIES = 20;       // 20 × 250ms = 5s max wait
      const IDLE_GIVE_UP_AFTER = 8; // 2s with no activity = give up
      while (!checkoutUrl && retries < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 250));
        // Read LIVE state from the store, not the stale `shopifyCart`
        // value captured at render time. Without this, a fetch that
        // kicks off mid-loop (shopifyCart.isLoading flips true AFTER
        // handlePay started) would still read the pre-loop snapshot
        // and trigger the early-bail branch below, aborting the wait.
        const live = useShopifyCartStore.getState();
        checkoutUrl = live.getCheckoutUrl();
        retries++;
        // If Shopify isn't currently syncing AND we've waited a bit,
        // bail out to the fallback path instead of stalling the full 5s.
        if (!live.isLoading && retries >= IDLE_GIVE_UP_AFTER && !checkoutUrl) break;
      }

      if (checkoutUrl) {
        try {
          // Task 5.17 — forward the gift-message into the pending-
          // checkout payload so the downstream fulfillment pipeline
          // (Shopify webhook → order-notes → pack slip) receives it.
          // Only emit the note when the toggle is on and the trimmed
          // text is non-empty, so an abandoned "opened toggle but
          // typed nothing" state doesn't attach a blank gift card.
          // Task 14.4 — sanitize before persisting to the pending-
          // checkout blob so a pasted tag / oversized whitespace payload
          // can't poison the fulfillment pipeline that reads it back.
          const giftNote = isGift ? sanitizeText(giftMessage, { maxLength: GIFT_MESSAGE_MAX }) : '';
          localStorage.setItem('vision-pending-checkout', JSON.stringify({
            ...form,
            total,
            isGift: isGift && giftNote.length > 0,
            giftMessage: giftNote,
            ts: Date.now(),
          }));
        } catch (e) {
          console.warn('[Checkout] Could not persist pending checkout to localStorage:', e);
        }
        window.location.href = checkoutUrl;
        // If the navigation doesn't actually happen (popup blocker,
        // browser extension, CSP that blocks the Shopify origin) the
        // user would be stuck on "Processing…" indefinitely. Give it
        // 4s then unstick the button so they can try again.
        if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = setTimeout(() => {
          setProcessing(false);
          toast.error(lang === 'en'
            ? 'Redirect didn\u2019t happen. Check popup blockers + try again.'
            : 'La redirection n\u2019a pas eu lieu. Vérifie les bloqueurs de popups et réessaie.');
          redirectTimerRef.current = null;
        }, 4000);
        return;
      }

      // Last resort: rebuild Shopify cart from local items if any
      // shopifyVariantIds were captured. Uses Shopify's cart permalink
      // syntax (/cart/{variantId}:{qty},{variantId}:{qty},...) so the
      // destination page arrives pre-populated. Without this the
      // previous fallback just redirected to an empty /cart page —
      // which is exactly the problem we were trying to recover from.
      //
      // Qty mapping:
      // - Multi-variant line: shopifyVariantIds[i] matches
      //   sizeQuantities[i] (ProductCustomizer pushes them together in
      //   the same loop), so zip by index.
      // - Single-color line: shopifyVariantIds has one id representing
      //   the whole line, so carry the line's totalQuantity.
      // Hardcoding qty:1 (the previous code) undercounted every line
      // — customer paid for 1 shirt instead of the 10 they ordered.
      const localLines = cart.items.flatMap(it => {
        const vids = it.shopifyVariantIds ?? [];
        if (vids.length === 0) return [];
        if (vids.length === 1) {
          return [{ vid: vids[0], qty: Math.max(1, it.totalQuantity || 1) }];
        }
        return vids.map((vid, i) => ({
          vid,
          qty: Math.max(1, it.sizeQuantities?.[i]?.quantity ?? 1),
        }));
      });
      if (localLines.length === 0) {
        toast.error(lang === 'en'
          ? 'Your cart could not be synced to Shopify. Please refresh and try again, or contact us at 367-380-4808.'
          : "Le panier n'a pas pu être synchronisé avec Shopify. Rafraîchis la page ou appelle-nous au 367-380-4808.");
        setProcessing(false);
        return;
      }
      // Strip the "gid://shopify/ProductVariant/" prefix — cart
      // permalinks need the bare numeric ID. Skip anything malformed
      // rather than including it and producing a 400 at Shopify.
      const permalinkParts = localLines
        .map(({ vid, qty }) => {
          const numericId = vid.split('/').pop();
          return numericId ? `${numericId}:${qty}` : null;
        })
        .filter((s): s is string => s !== null);
      if (permalinkParts.length === 0) {
        toast.error(lang === 'en'
          ? 'Your cart could not be synced to Shopify. Please refresh and try again.'
          : "Le panier n'a pas pu être synchronisé avec Shopify. Rafraîchis la page et réessaie.");
        setProcessing(false);
        return;
      }
      // Shopify cart permalinks accept up to ~8 KB. Each part runs
      // ~14 chars, so 500+ size variants in one cart could truncate
      // the URL server-side and drop items at checkout. Cap at 400
      // parts which keeps the URL well under browser + Shopify limits
      // and warn if we had to clip.
      const MAX_PERMALINK_PARTS = 400;
      const clipped = permalinkParts.length > MAX_PERMALINK_PARTS;
      const urlParts = clipped ? permalinkParts.slice(0, MAX_PERMALINK_PARTS) : permalinkParts;
      if (clipped) {
        toast.warning(lang === 'en'
          ? `Cart too large for direct checkout — only the first ${MAX_PERMALINK_PARTS} lines were sent. Contact us at 367-380-4808 to finish the order.`
          : `Panier trop volumineux pour le paiement direct — seules les ${MAX_PERMALINK_PARTS} premières lignes ont été envoyées. Appelle-nous au 367-380-4808 pour finaliser.`,
          { duration: 8000 });
      }
      window.location.href = `https://visionaffichage-com.myshopify.com/cart/${urlParts.join(',')}`;
      // Same no-navigation safety net as the direct checkoutUrl path.
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = setTimeout(() => {
        setProcessing(false);
        toast.error(lang === 'en'
          ? 'Redirect didn\u2019t happen. Check popup blockers + try again.'
          : 'La redirection n\u2019a pas eu lieu. Vérifie les bloqueurs de popups et réessaie.');
        redirectTimerRef.current = null;
      }, 4000);
    } catch (err) {
      console.error('Checkout error:', err);
      // Distinguish a transient network blip (offline, DNS hiccup, CORS
      // preflight dropped) from a real failure. fetch() throws a plain
      // TypeError in all those cases and never sets an HTTP status, so
      // the message check below is the only reliable signal we get in
      // the browser. When we detect one, attach a one-click Retry to
      // the toast so the user doesn't have to fish for the Pay button
      // again after their wifi re-associates — the form is already
      // filled, the cart is already built, re-running handlePay is
      // idempotent (the Shopify cart sync is a no-op once complete).
      const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
      const isNetBlip =
        (err instanceof TypeError) ||
        msg.includes('network') ||
        msg.includes('failed to fetch') ||
        msg.includes('load failed') ||
        (typeof navigator !== 'undefined' && navigator.onLine === false);
      if (isNetBlip) {
        toast.error(
          lang === 'en'
            ? 'Network hiccup. Check your connection and retry.'
            : 'Problème de réseau. Vérifie ta connexion et réessaie.',
          {
            action: {
              label: lang === 'en' ? 'Retry' : 'Réessayer',
              onClick: () => { void handlePay(); },
            },
            duration: 10_000,
          },
        );
      } else {
        toast.error(lang === 'en'
          ? 'Something went wrong. Please try again or call us.'
          : 'Une erreur est survenue. Réessaie ou appelle-nous.');
      }
      setProcessing(false);
    }
  };

  return (
    <div id="main-content" tabIndex={-1} className="min-h-screen bg-gradient-to-b from-secondary/30 to-background focus:outline-none">
      <Navbar />

      <div className="max-w-[1100px] mx-auto px-4 md:px-8 pt-20 pb-32">
        {draftOffer && (
          <div
            role="region"
            aria-label={lang === 'en' ? 'Resume in-progress checkout' : 'Reprendre la commande en cours'}
            className="mb-4 flex items-start gap-3 border-l-4 border-[#0052CC] bg-blue-50/60 rounded-r-lg px-4 py-3"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {lang === 'en'
                  ? 'Resume your in-progress checkout?'
                  : 'Reprendre votre commande en cours ?'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {lang === 'en'
                  ? `Last saved ${formatElapsed(Date.now() - draftOffer.updatedAt, 'en')} ago.`
                  : `Dernière modification il y a ${formatElapsed(Date.now() - draftOffer.updatedAt, 'fr')}.`}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => hydrateFromDraft(draftOffer)}
                  className="inline-flex items-center px-3 py-1.5 rounded-md bg-[#0052CC] text-white text-xs font-extrabold hover:bg-[#003d99] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2"
                >
                  {lang === 'en' ? 'Resume' : 'Reprendre'}
                </button>
                <button
                  type="button"
                  onClick={clearDraft}
                  className="inline-flex items-center px-3 py-1.5 rounded-md border border-border text-foreground text-xs font-bold hover:bg-secondary/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  {lang === 'en' ? 'Clear' : 'Effacer'}
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={clearDraft}
              aria-label={lang === 'en' ? 'Dismiss' : 'Fermer'}
              className="flex-shrink-0 text-muted-foreground hover:text-foreground rounded p-1 -m-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        )}

        <button
          onClick={goBack}
          disabled={processing}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {step === 'info'
            ? lang === 'en' ? 'Back to cart' : 'Retour au panier'
            : lang === 'en' ? 'Previous step' : 'Étape précédente'}
        </button>

        {/* Step indicator — role=progressbar so screen readers announce
            "Step X of 3" without relying on the visual dot count. */}
        <ol
          className="flex items-center justify-center mb-8"
          aria-label={lang === 'en' ? 'Checkout progress' : 'Progression de la commande'}
        >
          {(['info', 'shipping', 'payment'] as const).map((s, i) => {
            const isActive = step === s;
            const isDone = stepIndex > i;
            // Completed steps become clickable so the user can jump back
            // to edit (typo in email, change shipping method) without
            // hammering the Back button. The current step + future steps
            // stay non-interactive — payment can't be reached without
            // valid info, so jumping forward would just bounce.
            const isClickable = isDone && !processing;
            const labels: Record<typeof s, { fr: string; en: string }> = {
              info: { fr: 'Informations', en: 'Info' },
              shipping: { fr: 'Livraison', en: 'Shipping' },
              payment: { fr: 'Paiement', en: 'Payment' },
            };
            const stateLabel = isDone
              ? (lang === 'en' ? 'completed' : 'complété')
              : isActive
                ? (lang === 'en' ? 'current step' : 'étape courante')
                : (lang === 'en' ? 'upcoming' : 'à venir');
            const actionLabel = isClickable
              ? (lang === 'en' ? ` · click to edit` : ` · cliquer pour modifier`)
              : '';
            const indicator = (
              <>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold transition-all ${
                    isDone ? 'bg-emerald-500 text-white'
                      : isActive ? 'bg-[#0052CC] text-white scale-110'
                      : 'bg-zinc-200 text-zinc-500'
                  }`}
                  aria-hidden="true"
                >
                  {isDone ? <CheckCircle2 size={14} /> : i + 1}
                </div>
                <span className={`ml-2 text-xs font-bold uppercase tracking-wider ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {labels[s][lang]}
                </span>
              </>
            );
            return (
              <li
                key={s}
                className="flex items-center"
                aria-current={isActive ? 'step' : undefined}
              >
                {isClickable ? (
                  <button
                    type="button"
                    onClick={() => setStep(s)}
                    aria-label={`${labels[s][lang]} — ${stateLabel}${actionLabel}`}
                    className="flex items-center hover:opacity-80 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2 rounded-full"
                  >
                    {indicator}
                  </button>
                ) : (
                  <div className="flex items-center" aria-label={`${labels[s][lang]} — ${stateLabel}`}>
                    {indicator}
                  </div>
                )}
                {i < 2 && <div className={`w-12 md:w-20 h-0.5 mx-3 ${isDone ? 'bg-emerald-500' : 'bg-zinc-200'}`} aria-hidden="true" />}
              </li>
            );
          })}
        </ol>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          {/* Main step content */}
          <div className="bg-white border border-border rounded-2xl p-6 md:p-8">
            {step === 'info' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-extrabold flex items-center gap-2 mb-1">
                    <Mail size={18} className="text-[#0052CC]" aria-hidden="true" />
                    {lang === 'en' ? 'Contact' : 'Contact'}
                  </h2>
                  {(() => {
                    const emailInvalid = form.email.trim().length > 0 && !isValidEmail(form.email);
                    // Per Vercel web-interface-guidelines: error messages must
                    // include the fix/next step, not just the problem. Tie the
                    // message to the input via aria-describedby so screen readers
                    // announce it alongside the field instead of leaving users
                    // with an unexplained red border.
                    return (
                      <>
                        <input
                          type="email"
                          value={form.email}
                          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                          autoComplete="email"
                          spellCheck={false}
                          placeholder={lang === 'en' ? 'Email address' : 'Adresse courriel'}
                          aria-label={lang === 'en' ? 'Email address' : 'Adresse courriel'}
                          aria-required="true"
                          aria-invalid={emailInvalid || undefined}
                          aria-describedby={emailInvalid ? 'checkout-email-error' : undefined}
                          className={`w-full mt-2 border rounded-lg px-3 py-2.5 text-sm outline-none focus-visible:ring-2 transition-shadow ${
                            emailInvalid
                              ? 'border-rose-400 focus:border-rose-500 focus-visible:ring-rose-400/25'
                              : 'border-border focus:border-primary focus-visible:ring-primary/25'
                          }`}
                          required
                        />
                        {emailInvalid && (
                          <p id="checkout-email-error" role="alert" className="mt-1.5 text-xs text-rose-600">
                            {lang === 'en'
                              ? 'Enter a valid email like name@example.com so we can send your receipt.'
                              : 'Entre une adresse valide comme nom@exemple.com pour recevoir ta confirmation.'}
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>

                <div>
                  <h2 className="text-xl font-extrabold flex items-center gap-2 mb-3">
                    <MapPin size={18} className="text-[#0052CC]" aria-hidden="true" />
                    {lang === 'en' ? 'Shipping address' : 'Adresse de livraison'}
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    <Input value={form.firstName} onChange={v => setForm(f => ({ ...f, firstName: v }))} placeholder={lang === 'en' ? 'First name' : 'Prénom'} autoComplete="given-name" autoCapitalize="words" required />
                    <Input value={form.lastName}  onChange={v => setForm(f => ({ ...f, lastName: v }))}  placeholder={lang === 'en' ? 'Last name' : 'Nom'} autoComplete="family-name" autoCapitalize="words" required />
                    <Input value={form.company}   onChange={v => setForm(f => ({ ...f, company: v }))}   placeholder={lang === 'en' ? 'Company (optional)' : 'Entreprise (optionnel)'} autoComplete="organization" autoCapitalize="words" className="col-span-2" />
                    <Input value={form.address}   onChange={v => setForm(f => ({ ...f, address: v }))}   placeholder={lang === 'en' ? 'Street address' : 'Adresse'} autoComplete="street-address" autoCapitalize="words" className="col-span-2" required />
                    <Input value={form.city}      onChange={v => setForm(f => ({ ...f, city: v }))}      placeholder={lang === 'en' ? 'City' : 'Ville'} autoComplete="address-level2" autoCapitalize="words" required />
                    <Input
                      value={form.postalCode}
                      // Auto-format Canadian postal on every keystroke:
                      // uppercase, strip spaces/non-alphanumerics, cap at
                      // 6 chars, then insert the space after the 3rd.
                      // Idempotent so repeated keystrokes / paste events
                      // re-normalize rather than accumulate.
                      onChange={v => setForm(f => ({ ...f, postalCode: formatCanadianPostal(v) }))}
                      placeholder={lang === 'en' ? 'Postal code' : 'Code postal'}
                      autoComplete="postal-code"
                      autoCapitalize="characters"
                      inputMode="text"
                      maxLength={7}
                      required
                      // Show the red invalid state only AFTER the user has
                      // typed something — empty input shouldn't look like
                      // an error on first load.
                      ariaInvalid={form.postalCode.trim().length > 0 && !postalValid}
                    />
                    <Input
                      value={form.phone}
                      // Progressive fr-CA formatting: strip non-digits,
                      // cap at 10, render as "(ddd) ddd-dddd" partial-as-
                      // typed. The downstream validator already
                      // normalizes via /[^\d]/ so storing the formatted
                      // string doesn't break the 10-digit check.
                      onChange={v => setForm(f => ({ ...f, phone: formatCanadianPhone(v) }))}
                      placeholder={lang === 'en' ? 'Phone (optional)' : 'Téléphone (optionnel)'}
                      autoComplete="tel"
                      inputMode="tel"
                      className="col-span-2"
                      type="tel"
                      maxLength={14}
                      // Only flag invalid once the user has typed — empty
                      // input is allowed (phone is optional).
                      ariaInvalid={phoneTrimmed.length > 0 && !isValidPhone}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!infoValid}
                  onClick={goNext}
                  className="w-full py-3.5 gradient-navy-dark text-primary-foreground rounded-xl text-sm font-extrabold disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-xl transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2"
                >
                  {lang === 'en' ? 'Continue to shipping' : 'Continuer à la livraison'}
                </button>
              </div>
            )}

            {step === 'shipping' && (
              <div className="space-y-5">
                <h2 className="text-xl font-extrabold flex items-center gap-2 mb-1">
                  <Truck size={18} className="text-[#0052CC]" aria-hidden="true" />
                  {lang === 'en' ? 'Shipping method' : 'Mode de livraison'}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {lang === 'en'
                    ? 'Pick how you want your order delivered. ETA is calculated from today, weekends excluded.'
                    : "Choisis comment recevoir ta commande. Les délais sont calculés à partir d'aujourd'hui, week-ends exclus."}
                </p>

                <fieldset
                  className="space-y-2.5 border-0 p-0 m-0"
                  aria-label={lang === 'en' ? 'Shipping method' : 'Mode de livraison'}
                >
                  {(['standard', 'express', 'pickup'] as const).map(m => {
                    const opt = SHIPPING_OPTIONS[m];
                    const selected = shippingMethod === m;
                    const now = new Date();
                    // Pickup has no delivery ETA — it's a "ready tomorrow"
                    // local-cueillette promise, so we skip the Intl date
                    // format and show the static window copy instead.
                    const etaDate = opt.etaBusinessDays != null
                      ? addBusinessDays(now, opt.etaBusinessDays)
                      : null;
                    const etaLabel = etaDate
                      ? etaDate.toLocaleDateString(lang === 'en' ? 'en-CA' : 'fr-CA', {
                          weekday: 'long', month: 'long', day: 'numeric',
                        })
                      : null;
                    const priceLabel = opt.price === 0
                      ? <span className="text-emerald-600">{lang === 'en' ? 'Free' : 'Gratuit'}</span>
                      : fmtCAD(opt.price, lang);
                    return (
                      <label
                        key={m}
                        className={`relative flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                          selected
                            // Gold selection ring on the chosen tile — same
                            // accent the checkout CTAs use for focus so it
                            // reads as brand-consistent emphasis.
                            ? 'border-[#E8A838] bg-[#E8A838]/5 ring-2 ring-[#E8A838]/40 shadow-sm'
                            : 'border-border hover:border-primary/40 hover:bg-secondary/30'
                        }`}
                      >
                        <input
                          type="radio"
                          name="shipping-method"
                          value={m}
                          checked={selected}
                          onChange={() => setShippingMethod(m)}
                          className="mt-1 w-4 h-4 accent-[#E8A838]"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-3">
                            <div className="font-extrabold text-sm">
                              {lang === 'en' ? opt.labelEn : opt.labelFr}
                              <span className="ml-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                                {lang === 'en' ? opt.windowEn : opt.windowFr}
                              </span>
                            </div>
                            <div className="font-extrabold text-sm whitespace-nowrap">
                              {priceLabel}
                            </div>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {lang === 'en' ? opt.descEn : opt.descFr}
                          </div>
                          {etaLabel && (
                            <div className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                              <Clock size={12} aria-hidden="true" />
                              {lang === 'en' ? `Arrives by ${etaLabel}` : `Livré autour du ${etaLabel}`}
                            </div>
                          )}
                          {!etaLabel && (
                            <div className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                              <MapPin size={12} aria-hidden="true" />
                              {lang === 'en' ? 'Saint-Hyacinthe, QC' : 'Saint-Hyacinthe, QC'}
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </fieldset>

                <button
                  type="button"
                  onClick={goNext}
                  className="w-full py-3.5 gradient-navy-dark text-primary-foreground rounded-xl text-sm font-extrabold hover:shadow-xl transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2"
                >
                  {lang === 'en' ? 'Continue to payment' : 'Continuer au paiement'}
                </button>
              </div>
            )}

            {step === 'payment' && (
              <div className="space-y-5">
                <h2 className="text-xl font-extrabold flex items-center gap-2 mb-1">
                  <CreditCard size={18} className="text-[#0052CC]" aria-hidden="true" />
                  {lang === 'en' ? 'Payment' : 'Paiement'}
                </h2>

                <div className="bg-secondary/40 border border-border rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <ShieldCheck size={16} className="text-emerald-600" aria-hidden="true" />
                    <span className="font-bold">{lang === 'en' ? 'Secure payment' : 'Paiement sécurisé'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {lang === 'en'
                      ? 'Card processing happens on Shopify\'s PCI-compliant infrastructure. Your card never touches our servers.'
                      : "Le traitement des cartes s'effectue sur l'infrastructure PCI-compliant de Shopify. Ta carte ne touche jamais nos serveurs."}
                  </p>
                </div>

                <div className="border border-border rounded-xl p-4">
                  <div className="font-bold text-sm mb-2">
                    {lang === 'en' ? 'Order summary' : 'Résumé de commande'}
                  </div>
                  <div className="space-y-1 text-sm">
                    <Row label={lang === 'en' ? 'Subtotal' : 'Sous-total'} value={`${fmtMoney(subtotal)} $`} />
                    <Row label={lang === 'en' ? 'Shipping' : 'Livraison'} value={shippingCost === 0 ? lang === 'en' ? 'Free' : 'Gratuit' : `${fmtMoney(shippingCost)} $`} />
                    <Row label={lang === 'en' ? 'Tax (14.975%)' : 'Taxes (14.975%)'} value={`${fmtMoney(tax)} $`} />
                    {/* QC invoices must show GST + QST separately. Indented
                        to read as a breakdown of the combined tax line. */}
                    <div className="pl-3 border-l-2 border-border/60 ml-1 space-y-0.5 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>{lang === 'en' ? 'GST (5%)' : 'TPS (5%)'}</span>
                        <span className="font-semibold">{fmtMoney(gst)} $</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{lang === 'en' ? 'QST (9.975%)' : 'TVQ (9,975%)'}</span>
                        <span className="font-semibold">{fmtMoney(qst)} $</span>
                      </div>
                    </div>
                    <div className="border-t border-border pt-2 mt-2 flex justify-between items-baseline">
                      <span className="font-extrabold">Total</span>
                      <span className="text-2xl font-extrabold text-primary">{fmtMoney(total)} $ CAD</span>
                    </div>
                  </div>
                </div>

                {/* Task 5.17 — optional gift-message section. Collapsed
                    by default (just the toggle) so it doesn't clutter the
                    payment step for the majority of buyers shipping to
                    themselves. When the toggle flips on, the textarea,
                    live char counter, and helper text reveal together.
                    Emerald accent on the active toggle matches the same
                    "confirmed / positive" accent we use on the step-done
                    dots and the arrives-by banner above. */}
                <div className="border border-border rounded-xl overflow-hidden">
                  <label
                    className={`flex items-start gap-3 p-3 transition-colors ${
                      isGift ? 'bg-emerald-50' : 'bg-secondary/30 hover:bg-secondary/50'
                    } ${processing ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <input
                      type="checkbox"
                      checked={isGift}
                      disabled={processing}
                      onChange={e => setIsGift(e.target.checked)}
                      aria-controls="checkout-gift-textarea"
                      aria-expanded={isGift}
                      className={`mt-0.5 w-5 h-5 disabled:cursor-not-allowed ${
                        isGift ? 'accent-emerald-600' : 'accent-primary'
                      }`}
                    />
                    <span className="flex items-center gap-2 text-sm">
                      <Gift
                        size={16}
                        className={isGift ? 'text-emerald-600' : 'text-muted-foreground'}
                        aria-hidden="true"
                      />
                      <span className={isGift ? 'font-semibold text-emerald-900' : ''}>
                        {lang === 'en'
                          ? 'This is a gift — add a note'
                          : 'Ceci est un cadeau — ajouter un mot'}
                      </span>
                    </span>
                  </label>
                  {isGift && (
                    <div className="px-3 pb-3 pt-2 bg-emerald-50/40 border-t border-emerald-100">
                      <textarea
                        id="checkout-gift-textarea"
                        value={giftMessage}
                        // Keep state in sync with the raw input but cap
                        // at the limit; the maxLength attr already blocks
                        // further typing, the slice here is defense-in-
                        // depth for paste events on some older browsers.
                        onChange={e => setGiftMessage(e.target.value.slice(0, GIFT_MESSAGE_MAX))}
                        maxLength={GIFT_MESSAGE_MAX}
                        rows={3}
                        disabled={processing}
                        placeholder={lang === 'en'
                          ? 'Happy birthday! Hope you love it. — M.'
                          : "Bonne fête! J'espère que ça te plaira. — M."}
                        aria-label={lang === 'en' ? 'Gift message' : 'Message cadeau'}
                        aria-describedby="checkout-gift-helper checkout-gift-counter"
                        className="w-full resize-none border border-emerald-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 focus:border-emerald-400 transition-shadow disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                      <div className="mt-1 flex items-start justify-between gap-3">
                        <p id="checkout-gift-helper" className="text-[11px] text-muted-foreground flex-1">
                          {lang === 'en'
                            ? 'Will appear on the delivery receipt.'
                            : 'Apparaîtra sur le reçu de livraison.'}
                        </p>
                        <span
                          id="checkout-gift-counter"
                          aria-live="polite"
                          className={`text-[11px] tabular-nums font-semibold ${
                            giftMessage.length >= GIFT_MESSAGE_MAX
                              ? 'text-rose-600'
                              : giftMessage.length >= GIFT_MESSAGE_MAX - 25
                                ? 'text-amber-600'
                                : 'text-muted-foreground'
                          }`}
                        >
                          {giftMessage.length}/{GIFT_MESSAGE_MAX}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <label className={`flex items-start gap-3 p-3 bg-secondary/30 rounded-xl ${processing ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    disabled={processing}
                    onChange={e => setAcceptedTerms(e.target.checked)}
                    className="mt-0.5 w-5 h-5 accent-primary disabled:cursor-not-allowed"
                  />
                  <span className="text-sm">
                    {lang === 'en'
                      ? "I accept the terms of service and confirm my order details."
                      : "J'accepte les conditions de service et confirme les détails de ma commande."}
                  </span>
                </label>

                {/* Urgency: ship-by promise. Calculated client-side from
                    today's date. Past-3pm orders bump one business day,
                    express cuts the window to 2-3 business days. Pickup
                    swaps the whole line for a "ready tomorrow" cueillette
                    message — a delivered-by date would be misleading for
                    buyers coming in person. */}
                {(() => {
                  const now = new Date();
                  const cutoff = new Date(now);
                  cutoff.setHours(15, 0, 0, 0);
                  const after3pm = now > cutoff;
                  if (shippingMethod === 'pickup') {
                    const ready = addBusinessDays(now, 1);
                    return (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs flex items-start gap-2">
                        <span className="text-emerald-600 text-base leading-none">📍</span>
                        <span className="text-emerald-900">
                          {lang === 'en'
                            ? <>
                                <strong>Ready for pickup</strong> in Saint-Hyacinthe by{' '}
                                <strong>{ready.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })}</strong>
                              </>
                            : <>
                                <strong>Prêt pour la cueillette</strong> à Saint-Hyacinthe d'ici le{' '}
                                <strong>{ready.toLocaleDateString('fr-CA', { weekday: 'long', month: 'long', day: 'numeric' })}</strong>
                              </>}
                        </span>
                      </div>
                    );
                  }
                  // Base promise matches the shipping method copy: standard
                  // = 5 business days, express = 3. Before this, express
                  // buyers saw the 5-day ETA even after paying for express.
                  const baseDays = shippingMethod === 'express' ? 3 : 5;
                  const ship = addBusinessDays(now, baseDays + (after3pm ? 1 : 0));
                  return (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs flex items-start gap-2">
                      <span className="text-emerald-600 text-base leading-none">⚡</span>
                      <span className="text-emerald-900">
                        {lang === 'en'
                          ? <>
                              <strong>{after3pm ? 'Order today —' : 'Order before 3pm —'}</strong> delivered by{' '}
                              <strong>{ship.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })}</strong>
                            </>
                          : <>
                              <strong>{after3pm ? 'Commande aujourd\'hui —' : 'Commande avant 15h —'}</strong> livrée d'ici le{' '}
                              <strong>{ship.toLocaleDateString('fr-CA', { weekday: 'long', month: 'long', day: 'numeric' })}</strong>
                            </>}
                      </span>
                    </div>
                  );
                })()}

                <button
                  type="button"
                  disabled={!acceptedTerms || processing}
                  onClick={handlePay}
                  aria-busy={processing}
                  className="w-full py-4 gradient-navy-dark text-primary-foreground rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-xl transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2"
                >
                  {processing ? (
                    <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Lock size={16} aria-hidden="true" />
                  )}
                  {processing
                    ? lang === 'en' ? 'Processing…' : 'Traitement…'
                    : lang === 'en' ? `Pay ${fmtMoney(total)} $ securely` : `Payer ${fmtMoney(total)} $ en sécurité`}
                </button>

                <p className="text-[11px] text-muted-foreground text-center">
                  {lang === 'en'
                    ? '🔒 Encrypted · 💳 All cards accepted · 🇨🇦 Made in Québec'
                    : '🔒 Chiffré · 💳 Toutes cartes acceptées · 🇨🇦 Fabriqué au Québec'}
                </p>
              </div>
            )}
          </div>

          {/* Sticky cart summary */}
          <aside className="bg-white border border-border rounded-2xl p-5 h-fit lg:sticky lg:top-6">
            {/* Task 5.19: delivery-by promise banner. Anchored to the
                selected shipping method so the buyer sees a concrete
                "arrives by {date}" at the very top of the sidebar —
                reassuring while they read the order summary. Pickup
                swaps in a "ready for pickup tomorrow" message because
                a delivery date would be misleading for in-person
                pickup. */}
            {(() => {
              const now = new Date();
              if (shippingMethod === 'pickup') {
                const ready = addBusinessDays(now, 1);
                const dateStr = ready.toLocaleDateString(lang === 'en' ? 'en-CA' : 'fr-CA', { weekday: 'long', month: 'long', day: 'numeric' });
                return (
                  <div className="mb-4 flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-900">
                    <MapPin size={14} className="text-emerald-600 flex-shrink-0" aria-hidden="true" />
                    <span className="font-medium">
                      {lang === 'en'
                        ? <>Ready for pickup <span className="font-semibold">tomorrow</span> ({dateStr})</>
                        : <>Prêt à la cueillette <span className="font-semibold">demain</span> ({dateStr})</>}
                    </span>
                  </div>
                );
              }
              const baseDays = shippingMethod === 'express' ? 3 : 6;
              const arrives = addBusinessDays(now, baseDays);
              const dateStr = arrives.toLocaleDateString(lang === 'en' ? 'en-CA' : 'fr-CA', { weekday: 'long', month: 'long', day: 'numeric' });
              return (
                <div className="mb-4 flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-900">
                  <Truck size={14} className="text-emerald-600 flex-shrink-0" aria-hidden="true" />
                  <span className="font-medium">
                    {lang === 'en'
                      ? <>Arrives by <span className="font-semibold">{dateStr}</span></>
                      : <>Reçu vers le <span className="font-semibold">{dateStr}</span></>}
                  </span>
                </div>
              );
            })()}
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-extrabold">{lang === 'en' ? 'Your cart' : 'Ton panier'}</h2>
              <span className="text-xs text-muted-foreground">{itemCount} {lang === 'en' ? 'items' : 'articles'}</span>
            </div>
            <div className="space-y-3 max-h-[260px] overflow-y-auto">
              {cart.items.map(it => (
                <div key={it.cartId} className="flex gap-3 text-sm">
                  {it.previewSnapshot && (
                    <img src={it.previewSnapshot} alt="" width={48} height={48} className="w-12 h-12 rounded-lg object-cover bg-secondary border border-border flex-shrink-0" loading="lazy" decoding="async" onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xs truncate">{it.productName}</div>
                    <div className="text-[11px] text-muted-foreground">× {it.totalQuantity}</div>
                  </div>
                  <div className="font-bold text-xs whitespace-nowrap">{fmtMoney(it.totalPrice)} $</div>
                </div>
              ))}
            </div>
            <div className="border-t border-border mt-4 pt-3 space-y-1 text-sm">
              <Row label={lang === 'en' ? 'Subtotal' : 'Sous-total'} value={`${fmtMoney(subtotal)} $`} muted />
              <Row label={lang === 'en' ? 'Shipping' : 'Livraison'} value={shippingCost === 0 ? lang === 'en' ? 'Free' : 'Gratuit' : `${fmtMoney(shippingCost)} $`} muted />
              <Row label={lang === 'en' ? 'Tax' : 'Taxes'} value={`${fmtMoney(tax)} $`} muted />
              {/* Mirror the GST/QST split from the payment-step summary so
                  the sticky aside shows the same breakdown on every step. */}
              <div className="pl-3 border-l-2 border-border/60 ml-1 space-y-0.5 text-[11px] text-muted-foreground">
                <div className="flex justify-between">
                  <span>{lang === 'en' ? 'GST (5%)' : 'TPS (5%)'}</span>
                  <span className="font-semibold">{fmtMoney(gst)} $</span>
                </div>
                <div className="flex justify-between">
                  <span>{lang === 'en' ? 'QST (9.975%)' : 'TVQ (9,975%)'}</span>
                  <span className="font-semibold">{fmtMoney(qst)} $</span>
                </div>
              </div>
              <div className="flex justify-between pt-2 mt-1 border-t border-border">
                <span className="font-extrabold">Total</span>
                <span className="font-extrabold text-primary">{fmtMoney(total)} $</span>
              </div>
            </div>
            <div className="mt-4">
              <DeliveryBadge size="sm" />
            </div>
          </aside>
        </div>
      </div>

      <AIChat />
      <BottomNav />
    </div>
  );
}

function Input({
  value, onChange, placeholder, autoComplete, type = 'text', required, className = '', ariaLabel, autoCapitalize, inputMode, ariaInvalid, maxLength,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete?: string;
  type?: string;
  required?: boolean;
  className?: string;
  /** Defaults to the placeholder — override only if you need a more
   * specific a11y label than the visible hint. */
  ariaLabel?: string;
  /** Mobile keyboard hint — 'words' for names, 'characters' for postal codes. */
  autoCapitalize?: 'off' | 'sentences' | 'words' | 'characters';
  /** Mobile virtual keyboard layout — e.g. 'tel' for phone numbers. */
  inputMode?: 'text' | 'numeric' | 'tel' | 'email' | 'url' | 'search' | 'decimal';
  /** Screen reader + visual invalid state. */
  ariaInvalid?: boolean;
  /** Hard cap on character count — useful for fixed-width formatted
   * fields like postal codes ("A1A 1A1" = 7) or phone ("(514) 555-1234" = 14). */
  maxLength?: number;
}) {
  // Phone inputs default to the tel keyboard for faster mobile entry.
  const effectiveInputMode = inputMode ?? (type === 'tel' ? 'tel' : undefined);
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      // Placeholder is not a label per WCAG. Use it as an accessible
      // name when no explicit one is provided so screen readers
      // announce the field correctly when focused.
      aria-label={ariaLabel ?? placeholder}
      aria-required={required}
      aria-invalid={ariaInvalid || undefined}
      autoComplete={autoComplete}
      autoCapitalize={autoCapitalize}
      inputMode={effectiveInputMode}
      maxLength={maxLength}
      required={required}
      className={`border rounded-lg px-3 py-2.5 text-sm outline-none focus-visible:ring-2 transition-shadow ${ariaInvalid ? 'border-rose-400 focus:border-rose-500 focus-visible:ring-rose-400/25' : 'border-border focus:border-primary focus-visible:ring-primary/25'} ${className}`}
    />
  );
}

function Row({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={muted ? 'text-muted-foreground' : ''}>{label}</span>
      <span className={muted ? 'font-semibold' : 'font-bold'}>{value}</span>
    </div>
  );
}

/**
 * Post-payment confirmation screen. Shown either when Shopify's
 * thank-you page redirects back with `?step=done&order=…` or when the
 * local flow reaches the final step directly (future extensibility for
 * an on-site order submission path). CSS-only confetti keeps the bundle
 * size flat — no react-confetti / canvas-confetti dependency.
 */
function DoneState({
  lang,
  firstName,
  orderNumber,
}: {
  lang: 'en' | 'fr';
  firstName: string;
  orderNumber: string;
}) {
  const displayName = (firstName || '').trim() || (lang === 'en' ? 'there' : 'à toi');
  const displayOrder = orderNumber.trim() || (lang === 'en' ? 'in progress' : 'en cours');

  // Announce success to screen readers the moment the view mounts so
  // non-sighted buyers get the same "Commande confirmée" reassurance as
  // the big check icon provides sighted users.
  useEffect(() => {
    const prev = document.title;
    document.title = lang === 'en'
      ? `Order confirmed — Vision Affichage`
      : `Commande confirmée — Vision Affichage`;
    return () => { document.title = prev; };
  }, [lang]);

  // Pre-compute 24 confetti pieces with varied left position, delay,
  // duration, color, and rotation so the animation feels organic
  // without pulling in a heavy library. Math.random is fine here — we
  // render once per mount and the visual doesn't need to be reproducible.
  const confettiPieces = useMemo(() => {
    const colors = ['#0052CC', '#E8A838', '#10B981', '#EC4899', '#8B5CF6', '#F59E0B'];
    return Array.from({ length: 24 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.8,
      duration: 2.4 + Math.random() * 1.6,
      color: colors[i % colors.length],
      rotate: Math.random() * 360,
      scale: 0.8 + Math.random() * 0.6,
    }));
  }, []);

  return (
    <div className="relative bg-white border border-border rounded-2xl p-6 md:p-10 overflow-hidden">
      {/* Local keyframes — kept inline so the confetti is fully
          self-contained to this component and we don't have to touch
          index.css. The reduced-motion override at the global scope
          will still neutralize this via the universal selector. */}
      <style>{`
        @keyframes vaConfettiFall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 0; }
          10%  { opacity: 1; }
          100% { transform: translateY(520px) rotate(720deg); opacity: 0; }
        }
        @keyframes vaCheckPop {
          0%   { transform: scale(0.4); opacity: 0; }
          60%  { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes vaCheckRing {
          0%   { transform: scale(0.6); opacity: 0.6; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>

      {/* Confetti layer — absolutely positioned, pointer-events: none
          so it doesn't eat clicks on the links below. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        {confettiPieces.map(p => (
          <span
            key={p.id}
            style={{
              position: 'absolute',
              top: '-16px',
              left: `${p.left}%`,
              width: '8px',
              height: '14px',
              backgroundColor: p.color,
              transform: `rotate(${p.rotate}deg) scale(${p.scale})`,
              animation: `vaConfettiFall ${p.duration}s ${p.delay}s ease-in forwards`,
              borderRadius: '2px',
            }}
          />
        ))}
      </div>

      <div className="relative z-[1] flex flex-col items-center text-center">
        {/* Check icon with pulsing ring. aria-live=polite on the status
            row below is the SR signal — the icon itself is decorative. */}
        <div className="relative w-20 h-20 mb-5">
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-emerald-400/40"
            style={{ animation: 'vaCheckRing 1.6s ease-out infinite' }}
          />
          <div
            className="relative w-20 h-20 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg"
            style={{ animation: 'vaCheckPop 0.6s cubic-bezier(.34,1.56,.64,1) forwards' }}
          >
            <CheckCircle2 size={44} strokeWidth={2.4} aria-hidden="true" />
          </div>
        </div>

        <h1
          role="status"
          aria-live="polite"
          className="text-2xl md:text-3xl font-extrabold mb-2"
        >
          {lang === 'en'
            ? <>Thank you, {displayName}! Order {displayOrder} confirmed.</>
            : <>Merci, {displayName}! Commande {displayOrder} confirmée.</>}
        </h1>

        <p className="text-sm text-muted-foreground max-w-md mb-8">
          {lang === 'en'
            ? "We've received your payment. Here's what happens next."
            : "Paiement reçu. Voici la suite des choses."}
        </p>

        {/* Next-steps list — email confirmation, 5-day production window,
            tracking. Using an ordered list so AT announces "1 of 3" etc. */}
        <ol className="w-full max-w-md space-y-3 text-left mb-8">
          <li className="flex items-start gap-3 bg-secondary/40 border border-border rounded-xl p-4">
            <MailCheck size={20} className="text-[#0052CC] flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <div className="font-bold text-sm">
                {lang === 'en' ? 'Confirmation email on its way' : 'Courriel de confirmation en route'}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {lang === 'en'
                  ? "Check your inbox in the next few minutes — look in spam if it doesn't show up."
                  : "Vérifie ta boîte courriel dans les prochaines minutes — regarde dans les indésirables au besoin."}
              </div>
            </div>
          </li>
          <li className="flex items-start gap-3 bg-secondary/40 border border-border rounded-xl p-4">
            <Clock size={20} className="text-[#0052CC] flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <div className="font-bold text-sm">
                {lang === 'en' ? 'Production · 5 business days' : 'Production · 5 jours ouvrables'}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {lang === 'en'
                  ? 'We print, trim, and QC every order in our Québec shop before it ships.'
                  : "On imprime, coupe et contrôle chaque commande dans notre atelier au Québec avant l'envoi."}
              </div>
            </div>
          </li>
          <li className="flex items-start gap-3 bg-secondary/40 border border-border rounded-xl p-4">
            <Package size={20} className="text-[#0052CC] flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <div className="font-bold text-sm">
                {lang === 'en' ? 'Tracking link when it ships' : "Lien de suivi à l'expédition"}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {lang === 'en'
                  ? 'You\u2019ll get a second email with a carrier tracking number the moment it leaves our shop.'
                  : "Tu recevras un deuxième courriel avec le numéro de suivi dès que ta commande quitte l'atelier."}
              </div>
            </div>
          </li>
        </ol>

        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
          {orderNumber.trim() && (
            <Link
              to={`/track/${encodeURIComponent(orderNumber.trim())}`}
              className="flex-1 py-3 gradient-navy-dark text-primary-foreground rounded-xl text-sm font-extrabold text-center hover:shadow-xl transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2"
            >
              {lang === 'en' ? 'Track order' : 'Suivre ma commande'}
            </Link>
          )}
          <Link
            to="/products"
            className="flex-1 py-3 border-2 border-border text-foreground rounded-xl text-sm font-extrabold text-center hover:border-primary/40 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {lang === 'en' ? 'Continue shopping' : 'Continuer à magasiner'}
          </Link>
        </div>
      </div>
    </div>
  );
}
