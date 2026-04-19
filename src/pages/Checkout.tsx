import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, ShieldCheck, MapPin, Mail, Truck, CreditCard, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCartStore } from '@/stores/localCartStore';
import { useCartStore as useShopifyCartStore } from '@/stores/cartStore';
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

  const [step, setStep] = useState<Step>('info');
  const [form, setForm] = useState<ShippingForm>(empty);

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

  const infoValid =
    isValidEmail(form.email) &&
    form.firstName.trim() && form.lastName.trim() && form.address.trim() &&
    form.city.trim() && form.postalCode.trim();

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
        return;
      }

      // Last resort: rebuild Shopify cart from local items if any
      // shopifyVariantIds were captured. Uses Shopify's cart permalink
      // syntax (/cart/{variantId}:{qty},{variantId}:{qty},...) so the
      // destination page arrives pre-populated. Without this the
      // previous fallback just redirected to an empty /cart page —
      // which is exactly the problem we were trying to recover from.
      const localLines = cart.items.flatMap(it =>
        (it.shopifyVariantIds ?? []).map(vid => ({ vid, qty: 1 })),
      );
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
      window.location.href = `https://visionaffichage-com.myshopify.com/cart/${permalinkParts.join(',')}`;
    } catch (err) {
      console.error('Checkout error:', err);
      toast.error(lang === 'en'
        ? 'Something went wrong. Please try again or call us.'
        : 'Une erreur est survenue. Réessaie ou appelle-nous.');
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
            return (
              <li
                key={s}
                className="flex items-center"
                aria-current={isActive ? 'step' : undefined}
                aria-label={`${labels[s][lang]} — ${stateLabel}`}
              >
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
                    <Mail size={18} className="text-[#0052CC]" />
                    {lang === 'en' ? 'Contact' : 'Contact'}
                  </h2>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    autoComplete="email"
                    placeholder={lang === 'en' ? 'Email address' : 'Adresse courriel'}
                    aria-label={lang === 'en' ? 'Email address' : 'Adresse courriel'}
                    aria-required="true"
                    className="w-full mt-2 border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 transition-shadow"
                    required
                  />
                </div>

                <div>
                  <h2 className="text-xl font-extrabold flex items-center gap-2 mb-3">
                    <MapPin size={18} className="text-[#0052CC]" />
                    {lang === 'en' ? 'Shipping address' : 'Adresse de livraison'}
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    <Input value={form.firstName} onChange={v => setForm(f => ({ ...f, firstName: v }))} placeholder={lang === 'en' ? 'First name' : 'Prénom'} autoComplete="given-name" autoCapitalize="words" required />
                    <Input value={form.lastName}  onChange={v => setForm(f => ({ ...f, lastName: v }))}  placeholder={lang === 'en' ? 'Last name' : 'Nom'} autoComplete="family-name" autoCapitalize="words" required />
                    <Input value={form.company}   onChange={v => setForm(f => ({ ...f, company: v }))}   placeholder={lang === 'en' ? 'Company (optional)' : 'Entreprise (optionnel)'} autoComplete="organization" autoCapitalize="words" className="col-span-2" />
                    <Input value={form.address}   onChange={v => setForm(f => ({ ...f, address: v }))}   placeholder={lang === 'en' ? 'Street address' : 'Adresse'} autoComplete="street-address" autoCapitalize="words" className="col-span-2" required />
                    <Input value={form.city}      onChange={v => setForm(f => ({ ...f, city: v }))}      placeholder={lang === 'en' ? 'City' : 'Ville'} autoComplete="address-level2" autoCapitalize="words" required />
                    <Input value={form.postalCode}onChange={v => setForm(f => ({ ...f, postalCode: v.toUpperCase() }))}placeholder={lang === 'en' ? 'Postal code' : 'Code postal'} autoComplete="postal-code" autoCapitalize="characters" required />
                    <Input value={form.phone}     onChange={v => setForm(f => ({ ...f, phone: v }))}     placeholder={lang === 'en' ? 'Phone' : 'Téléphone'} autoComplete="tel" className="col-span-2" type="tel" />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!infoValid}
                  onClick={goNext}
                  className="w-full py-3.5 gradient-navy-dark text-primary-foreground rounded-xl text-sm font-extrabold disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-xl transition-all"
                >
                  {lang === 'en' ? 'Continue to shipping' : 'Continuer à la livraison'}
                </button>
              </div>
            )}

            {step === 'shipping' && (
              <div className="space-y-5">
                <h2 className="text-xl font-extrabold flex items-center gap-2 mb-1">
                  <Truck size={18} className="text-[#0052CC]" />
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
                          {opt.price === 0 ? <span className="text-emerald-600">{lang === 'en' ? 'Free' : 'Gratuit'}</span> : `${opt.price.toFixed(2)} $`}
                        </div>
                      </label>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={goNext}
                  className="w-full py-3.5 gradient-navy-dark text-primary-foreground rounded-xl text-sm font-extrabold hover:shadow-xl transition-all"
                >
                  {lang === 'en' ? 'Continue to payment' : 'Continuer au paiement'}
                </button>
              </div>
            )}

            {step === 'payment' && (
              <div className="space-y-5">
                <h2 className="text-xl font-extrabold flex items-center gap-2 mb-1">
                  <CreditCard size={18} className="text-[#0052CC]" />
                  {lang === 'en' ? 'Payment' : 'Paiement'}
                </h2>

                <div className="bg-secondary/40 border border-border rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <ShieldCheck size={16} className="text-emerald-600" />
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
                    <Row label={lang === 'en' ? 'Subtotal' : 'Sous-total'} value={`${subtotal.toFixed(2)} $`} />
                    <Row label={lang === 'en' ? 'Shipping' : 'Livraison'} value={shippingCost === 0 ? lang === 'en' ? 'Free' : 'Gratuit' : `${shippingCost.toFixed(2)} $`} />
                    <Row label={lang === 'en' ? 'Tax (14.975%)' : 'Taxes (14.975%)'} value={`${tax.toFixed(2)} $`} />
                    <div className="border-t border-border pt-2 mt-2 flex justify-between items-baseline">
                      <span className="font-extrabold">Total</span>
                      <span className="text-2xl font-extrabold text-primary">{total.toFixed(2)} $ CAD</span>
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
                    today's date. Past-3pm orders bump one business day. */}
                {(() => {
                  const now = new Date();
                  const cutoff = new Date(now);
                  cutoff.setHours(15, 0, 0, 0);
                  const after3pm = now > cutoff;
                  const ship = new Date(now.getTime() + (after3pm ? 6 : 5) * 86400000);
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
                  className="w-full py-4 gradient-navy-dark text-primary-foreground rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-xl transition-all"
                >
                  {processing ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Lock size={16} />
                  )}
                  {processing
                    ? lang === 'en' ? 'Processing…' : 'Traitement…'
                    : lang === 'en' ? `Pay ${total.toFixed(2)} $ securely` : `Payer ${total.toFixed(2)} $ en sécurité`}
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
                    <img src={it.previewSnapshot} alt="" width={48} height={48} className="w-12 h-12 rounded-lg object-cover bg-secondary border border-border flex-shrink-0" loading="lazy" decoding="async" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xs truncate">{it.productName}</div>
                    <div className="text-[11px] text-muted-foreground">× {it.totalQuantity}</div>
                  </div>
                  <div className="font-bold text-xs whitespace-nowrap">{it.totalPrice.toFixed(2)} $</div>
                </div>
              ))}
            </div>
            <div className="border-t border-border mt-4 pt-3 space-y-1 text-sm">
              <Row label={lang === 'en' ? 'Subtotal' : 'Sous-total'} value={`${subtotal.toFixed(2)} $`} muted />
              <Row label={lang === 'en' ? 'Shipping' : 'Livraison'} value={shippingCost === 0 ? lang === 'en' ? 'Free' : 'Gratuit' : `${shippingCost.toFixed(2)} $`} muted />
              <Row label={lang === 'en' ? 'Tax' : 'Taxes'} value={`${tax.toFixed(2)} $`} muted />
              <div className="flex justify-between pt-2 mt-1 border-t border-border">
                <span className="font-extrabold">Total</span>
                <span className="font-extrabold text-primary">{total.toFixed(2)} $</span>
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
  value, onChange, placeholder, autoComplete, type = 'text', required, className = '', ariaLabel, autoCapitalize, inputMode,
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
      autoComplete={autoComplete}
      autoCapitalize={autoCapitalize}
      inputMode={effectiveInputMode}
      required={required}
      className={`border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 transition-shadow ${className}`}
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
