import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, ShieldCheck, MapPin, Mail, Truck, CreditCard, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCartStore } from '@/stores/localCartStore';
import { useCartStore as useShopifyCartStore } from '@/stores/cartStore';
import { useAuthStore } from '@/stores/authStore';
import { useLang } from '@/lib/langContext';
import { isValidEmail } from '@/lib/utils';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { AIChat } from '@/components/AIChat';
import { DeliveryBadge } from '@/components/DeliveryBadge';

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
}

const TAX_RATE = 0.14975; // QST + GST combined for Quebec
const SHIPPING_RATES = {
  standard: { fr: 'Livraison standard · 5 jours ouvrables', en: 'Standard · 5 business days', price: 0 },
  express:  { fr: 'Livraison express · 2-3 jours ouvrables', en: 'Express · 2-3 business days', price: 25.00 },
};

const empty: ShippingForm = {
  email: '', firstName: '', lastName: '', company: '',
  address: '', city: '', postalCode: '', province: 'QC', phone: '',
};

export default function Checkout() {
  const { lang } = useLang();
  const navigate = useNavigate();
  const cart = useCartStore();
  const shopifyCart = useShopifyCartStore();
  const user = useAuthStore(s => s.user);

  const [step, setStep] = useState<Step>('info');
  const [form, setForm] = useState<ShippingForm>(empty);

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
  const [shippingMethod, setShippingMethod] = useState<'standard' | 'express'>('standard');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [processing, setProcessing] = useState(false);

  const subtotal = cart.getTotal();
  const shippingCost = SHIPPING_RATES[shippingMethod].price;
  const tax = (subtotal + shippingCost) * TAX_RATE;
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
  // Lenient on the space — accept with or without. Without this, the
  // 'Continue' button enabled for 'foo' input and the user only learned
  // at Shopify's checkout that the address was invalid.
  const isValidCanadianPostal = /^[A-CEGHJ-NPR-TVXY]\d[A-CEGHJ-NPR-TV-Z]\s?\d[A-CEGHJ-NPR-TV-Z]\d$/i
    .test(form.postalCode.trim());
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
    form.city.trim() && isValidCanadianPostal && isValidPhone;

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
          localStorage.setItem('vision-pending-checkout', JSON.stringify({ ...form, total, ts: Date.now() }));
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
                    return (
                      <input
                        type="email"
                        value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        autoComplete="email"
                        placeholder={lang === 'en' ? 'Email address' : 'Adresse courriel'}
                        aria-label={lang === 'en' ? 'Email address' : 'Adresse courriel'}
                        aria-required="true"
                        aria-invalid={emailInvalid || undefined}
                        className={`w-full mt-2 border rounded-lg px-3 py-2.5 text-sm outline-none focus-visible:ring-2 transition-shadow ${
                          emailInvalid
                            ? 'border-rose-400 focus:border-rose-500 focus-visible:ring-rose-400/25'
                            : 'border-border focus:border-primary focus-visible:ring-primary/25'
                        }`}
                        required
                      />
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
                      onChange={v => setForm(f => ({ ...f, postalCode: v.toUpperCase() }))}
                      placeholder={lang === 'en' ? 'Postal code' : 'Code postal'}
                      autoComplete="postal-code"
                      autoCapitalize="characters"
                      required
                      // Show the red invalid state only AFTER the user has
                      // typed something — empty input shouldn't look like
                      // an error on first load.
                      ariaInvalid={form.postalCode.trim().length > 0 && !isValidCanadianPostal}
                    />
                    <Input
                      value={form.phone}
                      onChange={v => setForm(f => ({ ...f, phone: v }))}
                      placeholder={lang === 'en' ? 'Phone (optional)' : 'Téléphone (optionnel)'}
                      autoComplete="tel"
                      className="col-span-2"
                      type="tel"
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
                  {lang === 'en' ? 'Shipping method' : 'Méthode de livraison'}
                </h2>

                <div className="space-y-2">
                  {(['standard', 'express'] as const).map(m => {
                    const opt = SHIPPING_RATES[m];
                    return (
                      <label
                        key={m}
                        className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                          shippingMethod === m ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                        }`}
                      >
                        <input
                          type="radio"
                          name="shipping-method"
                          value={m}
                          checked={shippingMethod === m}
                          onChange={() => setShippingMethod(m)}
                          className="w-4 h-4 accent-primary"
                        />
                        <div className="flex-1">
                          <div className="font-bold text-sm">{lang === 'en' ? opt.en : opt.fr}</div>
                        </div>
                        <div className="font-extrabold text-sm">
                          {opt.price === 0 ? <span className="text-emerald-600">{lang === 'en' ? 'Free' : 'Gratuit'}</span> : `${fmtMoney(opt.price)} $`}
                        </div>
                      </label>
                    );
                  })}
                </div>

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
                    <div className="border-t border-border pt-2 mt-2 flex justify-between items-baseline">
                      <span className="font-extrabold">Total</span>
                      <span className="text-2xl font-extrabold text-primary">{fmtMoney(total)} $ CAD</span>
                    </div>
                  </div>
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
                    express cuts the window to 2-3 business days. */}
                {(() => {
                  const now = new Date();
                  const cutoff = new Date(now);
                  cutoff.setHours(15, 0, 0, 0);
                  const after3pm = now > cutoff;
                  // Base promise matches the shipping method copy: standard
                  // = 5 business days, express = 3. Before this, express
                  // buyers saw the 5-day ETA even after paying for express.
                  const baseDays = shippingMethod === 'express' ? 3 : 5;
                  const ship = new Date(now);
                  let remaining = baseDays + (after3pm ? 1 : 0);
                  while (remaining > 0) {
                    ship.setDate(ship.getDate() + 1);
                    const dow = ship.getDay();
                    if (dow !== 0 && dow !== 6) remaining--;
                  }
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
  value, onChange, placeholder, autoComplete, type = 'text', required, className = '', ariaLabel, autoCapitalize, inputMode, ariaInvalid,
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
