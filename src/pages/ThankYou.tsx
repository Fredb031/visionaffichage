// /merci — order confirmation page (Master Prompt Audi visual rebuild).
//
// Shopify's hosted thank-you page can't be replaced, but the Shopify
// "Order status URL" setting CAN redirect customers to a brand-owned
// destination after checkout. We surface that here at /merci.
//
// Order metadata is read from the URL (?order=1570&first_name=Marie&eta=...
// &days=5) or, as a fallback, from a localStorage `va:last-order` blob
// the Checkout flow can write before handing off to Shopify. Both
// shapes are tolerated so the page degrades gracefully when neither
// carries every field.
//
// The Master Prompt rebuild trims the page to a single Audi-style
// hero card on a full-bleed light background: big check, headline,
// expected delivery callout, three reassurance chips, two CTAs. The
// 4-step tracker that previously lived here moves out of the customer's
// way — they can dive into /suivi when they're ready, but the
// confirmation moment stays clean and celebratory.
//
// The `?days=` clamp at MAX_DELIVERY_DAYS=60 (introduced in 81e0f49)
// is preserved verbatim — without it, a hostile or fat-fingered link
// like /merci?days=9999999 would lock the render thread inside
// computeFallbackDeliveryDate's while loop. confetti.ts is already
// reduce-motion-aware (31d0315), so we fire it on mount unconditionally.

import { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useLang } from '@/lib/langContext';
import { readLS } from '@/lib/storage';
import { fireConfetti } from '@/lib/confetti';

interface LastOrderBlob {
  orderNumber?: string;
  firstName?: string;
  eta?: string;
  deliveryDays?: number;
}

// Hard ceiling on the `?days=` URL param. Without this, a hostile
// or fat-fingered link like /merci?days=9999999 would lock the
// render thread inside computeFallbackDeliveryDate's while loop
// — a trivial client-side DoS through a URL search param. 60
// business days (~3 months) is well past any legitimate Vision
// Affichage delivery window (Standard=5, Express=2, Custom rush
// caps around 10) so clamping here is purely defensive.
const DEFAULT_DELIVERY_DAYS = 5;
const MAX_DELIVERY_DAYS = 60;

/**
 * Compute a delivery date in business days (Mon-Fri) from today.
 * Used when the URL/localStorage payload lacks an explicit ETA.
 * Falls back to +5 business days, matching the Standard tier in
 * src/data/deliveryOptions.ts.
 */
function computeFallbackDeliveryDate(days = DEFAULT_DELIVERY_DAYS): Date {
  const d = new Date();
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay(); // 0 = Sun, 6 = Sat
    if (day !== 0 && day !== 6) added += 1;
  }
  return d;
}

function formatDate(date: Date, lang: 'fr' | 'en'): string {
  return date.toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export default function ThankYou() {
  const { lang } = useLang();

  useDocumentTitle(
    lang === 'fr' ? 'Merci! · Vision Affichage' : 'Thanks! · Vision Affichage',
    lang === 'fr'
      ? 'Commande confirmée. Suis ta production et ta livraison en temps réel. Logo imprimé et livré en 5 jours ouvrables au Québec.'
      : 'Order confirmed. Track production and delivery in real time. Logo printed and shipped in 5 business days across Quebec.',
  );

  const [params] = useSearchParams();

  // Merge URL params with the localStorage fallback. URL wins so a
  // shared link (e.g. operator-debugged "?order=1570&first_name=Marie")
  // overrides a stale blob from an older checkout.
  const data = useMemo(() => {
    const blob = readLS<LastOrderBlob>('va:last-order', {});
    const etaParam = params.get('eta') ?? blob.eta ?? '';
    const daysParam = params.get('days');
    const rawDays = daysParam ? Number.parseInt(daysParam, 10) : blob.deliveryDays;
    // Clamp to [1, MAX_DELIVERY_DAYS]. Anything outside that band
    // (negative, NaN, absurdly large) falls back to the Standard
    // tier — protects against ?days=9999999 hanging the loop.
    const days =
      typeof rawDays === 'number' && Number.isFinite(rawDays) && rawDays > 0
        ? Math.min(Math.floor(rawDays), MAX_DELIVERY_DAYS)
        : DEFAULT_DELIVERY_DAYS;

    let etaDate: Date | null = null;
    if (etaParam) {
      const parsed = new Date(etaParam);
      if (!Number.isNaN(parsed.getTime())) etaDate = parsed;
    }
    if (!etaDate) {
      etaDate = computeFallbackDeliveryDate(days);
    }

    return {
      etaLabel: formatDate(etaDate, lang),
    };
  }, [params, lang]);

  // Confetti fires once on mount. confetti.ts (31d0315) handles
  // prefers-reduced-motion internally — no guard needed here.
  useEffect(() => {
    fireConfetti();
  }, []);

  const copy = lang === 'fr'
    ? {
        title: 'Merci! Ta commande est confirmée.',
        sub: 'On est sur le coup. Tu reçois un courriel de confirmation dans quelques minutes — et un courriel de suivi quand on expédie.',
        deliveryLabel: 'Livraison prévue',
        chips: [
          '✓ Confirmation par courriel',
          "✓ Tu peux ajouter d'autres produits",
          '✓ Suivi automatique au début de l’expédition',
        ],
        primary: 'Voir mes commandes',
        secondary: 'Commander encore',
      }
    : {
        title: 'Thanks! Your order is confirmed.',
        sub: "We're on it. You'll get a confirmation email in a few minutes — and a tracking email when we ship.",
        deliveryLabel: 'Expected delivery',
        chips: [
          '✓ Email confirmation',
          '✓ You can still add items',
          '✓ Auto tracking at shipping',
        ],
        primary: 'View my orders',
        secondary: 'Order again',
      };

  return (
    <div className="bg-va-bg-1">
      <Navbar />

      <main
        id="main"
        className="min-h-screen bg-va-bg-1 flex items-center justify-center py-24 px-4"
      >
        <div className="bg-white max-w-2xl w-full rounded-3xl border border-va-line p-10 md:p-16 text-center shadow-[0_24px_80px_rgba(0,0,0,0.06)]">
          <div
            className="bg-va-ok/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8"
            aria-hidden="true"
          >
            <Check className="w-10 h-10 text-va-ok" strokeWidth={3} />
          </div>

          <h1 className="font-display font-black text-va-ink text-4xl md:text-5xl tracking-[-0.03em] mb-4">
            {copy.title}
          </h1>

          <p className="text-va-dim text-lg leading-relaxed mb-8">
            {copy.sub}
          </p>

          <div className="bg-va-blue-l border border-va-blue/25 rounded-2xl p-5 mb-8">
            <div className="text-va-blue text-xs uppercase font-semibold tracking-wider">
              {copy.deliveryLabel}
            </div>
            <div className="font-display font-black text-va-blue text-3xl md:text-4xl mt-1">
              {data.etaLabel}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {copy.chips.map((chip) => (
              <div
                key={chip}
                className="bg-va-bg-2 rounded-xl p-4 text-va-dim text-sm font-medium text-left"
              >
                {chip}
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/account"
              className="bg-va-blue text-white px-6 py-3 rounded-xl font-semibold hover:bg-va-blue-h transition-colors"
            >
              {copy.primary}
            </Link>
            <Link
              to="/boutique"
              className="border border-va-line text-va-ink px-6 py-3 rounded-xl font-semibold hover:border-va-line-h transition-colors"
            >
              {copy.secondary}
            </Link>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
