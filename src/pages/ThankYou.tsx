// /merci — order confirmation page (Mega Blueprint §9.5 + §17.11).
//
// Shopify's hosted thank-you page can't be replaced, but the Shopify
// "Order status URL" setting CAN redirect customers to a brand-owned
// destination after checkout. We surface that here at /merci.
//
// Order metadata is read from the URL (?order=1570&first_name=Marie&eta=...)
// or, as a fallback, from a localStorage `va:last-order` blob the
// Checkout flow can write before handing off to Shopify. Both shapes
// are tolerated so the page degrades gracefully when neither carries
// every field — we render the headline + tracker even with zero data,
// so a customer who lands here from a stale link still sees the
// confirmation UI rather than a 404.
//
// The 4-step tracker mirrors the brief's §16.1 order-tracking visual
// (Commande reçue ✓ / En production ⏳ / Expédié / Livré) so the
// experience feels continuous between /merci and /suivi/:order. We
// don't reuse TrackOrder's stepper component directly — that one is
// data-driven from a real lookup; here we hardcode "received=done,
// production=active" because the customer has just placed the order.
//
// The pulse animation on the active step uses Tailwind's
// `animate-pulse` utility, which the project's global motion rule
// (a CSS @media (prefers-reduced-motion: reduce) rule in index.css)
// neutralises for users who opt out of motion.

import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { readLS } from '@/lib/storage';

interface LastOrderBlob {
  orderNumber?: string;
  firstName?: string;
  eta?: string;
  deliveryDays?: number;
}

/**
 * Compute a delivery date string in fr-CA long form (e.g.
 * "vendredi 2 mai"). Used when the URL/localStorage payload lacks an
 * explicit ETA. Falls back to +5 business days from today, matching
 * the Standard tier in src/data/deliveryOptions.ts.
 *
 * Business days = Mon-Fri only; we skip Saturdays and Sundays so the
 * customer doesn't see "samedi 3 mai" when nothing actually ships
 * over the weekend.
 */
function computeFallbackDeliveryDate(days = 5): Date {
  const d = new Date();
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay(); // 0 = Sun, 6 = Sat
    if (day !== 0 && day !== 6) added += 1;
  }
  return d;
}

function formatFr(date: Date): string {
  return date.toLocaleDateString('fr-CA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export default function ThankYou() {
  useDocumentTitle(
    'Commande confirmée — Vision Affichage',
    'Merci pour ta commande. Suis ta production et ta livraison en temps réel sur Vision Affichage.',
  );

  const [params] = useSearchParams();

  // Merge URL params with the localStorage fallback. URL wins so a
  // shared link (e.g. operator-debugged "?order=1570&first_name=Marie")
  // overrides a stale blob from an older checkout.
  const data = useMemo(() => {
    const blob = readLS<LastOrderBlob>('va:last-order', {});
    const orderNumber =
      params.get('order') ?? params.get('order_number') ?? blob.orderNumber ?? '';
    const firstName =
      params.get('first_name') ?? params.get('firstName') ?? blob.firstName ?? '';
    const etaParam = params.get('eta') ?? blob.eta ?? '';
    const daysParam = params.get('days');
    const days = daysParam ? Number.parseInt(daysParam, 10) : blob.deliveryDays;

    let etaDate: Date | null = null;
    if (etaParam) {
      const parsed = new Date(etaParam);
      if (!Number.isNaN(parsed.getTime())) etaDate = parsed;
    }
    if (!etaDate) {
      etaDate = computeFallbackDeliveryDate(
        Number.isFinite(days) && (days as number) > 0 ? (days as number) : 5,
      );
    }

    return {
      orderNumber: orderNumber.trim().replace(/^#/, ''),
      firstName: firstName.trim(),
      etaLabel: formatFr(etaDate),
    };
  }, [params]);

  const trackerSteps: Array<{
    label: string;
    state: 'done' | 'active' | 'future';
  }> = [
    { label: 'Commande reçue', state: 'done' },
    { label: 'En production', state: 'active' },
    { label: 'Expédié', state: 'future' },
    { label: 'Livré', state: 'future' },
  ];

  // The brief calls for `bg-brand-blue` etc, but the project's Tailwind
  // config doesn't define a `brand-*` palette; existing pages reach
  // for the literal `[#0052CC]` arbitrary value (see TrackOrder.tsx).
  // We follow the same convention so the colour matches across the
  // tracker on /suivi and the headline accent on /merci without
  // touching the design tokens.
  const BRAND = '#0052CC';
  const BRAND_LIGHT = '#E6EEFB';
  const GREY_LIGHT = '#F1F2F4';
  const GREY = '#5E6C84';

  const greeting = data.firstName
    ? `Merci ${data.firstName}. Ta commande est en production.`
    : 'Merci pour ta commande. Elle est en production.';

  const trackHref = data.orderNumber ? `/suivi/${encodeURIComponent(data.orderNumber)}` : '/suivi';

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50">
      <Navbar />

      <main id="main" className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-14">
        <header className="text-center space-y-3 mb-8">
          {/* Visual checkmark badge — uses the project's literal brand
              blue so the colour matches the active stepper pip below. */}
          <div
            className="mx-auto rounded-full flex items-center justify-center"
            style={{ width: 56, height: 56, backgroundColor: BRAND, color: 'white' }}
            aria-hidden="true"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Commande confirmée !
          </h1>
          <p className="text-base sm:text-lg text-foreground">{greeting}</p>
          <p className="text-sm sm:text-base text-muted-foreground">
            Livraison prévue le <span className="font-bold text-foreground">{data.etaLabel}</span>
          </p>
          {data.orderNumber && (
            <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
              Commande #{data.orderNumber}
            </p>
          )}
        </header>

        {/* 4-step tracker — done / active (pulsing) / future. */}
        <ol
          aria-label="Progression de la commande"
          className="grid grid-cols-4 gap-2 sm:gap-4 mb-10"
        >
          {trackerSteps.map((step, i) => {
            const baseStyle: React.CSSProperties = {
              width: 40,
              height: 40,
              borderRadius: '9999px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 14,
            };
            let pipStyle: React.CSSProperties;
            if (step.state === 'done') {
              pipStyle = { ...baseStyle, backgroundColor: BRAND, color: 'white' };
            } else if (step.state === 'active') {
              pipStyle = {
                ...baseStyle,
                backgroundColor: BRAND_LIGHT,
                color: BRAND,
                border: `2px solid ${BRAND}`,
              };
            } else {
              pipStyle = { ...baseStyle, backgroundColor: GREY_LIGHT, color: GREY };
            }

            return (
              <li
                key={step.label}
                className="flex flex-col items-center text-center gap-2"
                aria-current={step.state === 'active' ? 'step' : undefined}
              >
                <div className="relative flex items-center justify-center">
                  <div
                    style={pipStyle}
                    className={step.state === 'active' ? 'animate-pulse' : undefined}
                    aria-hidden="true"
                  >
                    {step.state === 'done' ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                </div>
                <span
                  className="text-xs sm:text-sm font-bold"
                  style={{
                    color:
                      step.state === 'future' ? GREY : step.state === 'active' ? BRAND : '#0F172A',
                  }}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>

        {/* Primary CTA → /suivi/:orderNumber. */}
        <div className="flex justify-center mb-10">
          <Link
            to={trackHref}
            className="inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm sm:text-base font-bold text-white shadow-sm transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ backgroundColor: BRAND }}
          >
            Suivre ma commande
          </Link>
        </div>

        {/* Review prompt + referral CTA. The referral copy is a
            placeholder until the post-Section-10 program wires real
            codes; the brief asks us to ship the slot so we don't have
            to redesign the page when the program lands. */}
        <section className="space-y-4 bg-white rounded-2xl border border-border p-5 sm:p-6 shadow-sm">
          <div>
            <h2 className="text-base font-extrabold mb-1">Partage ton expérience</h2>
            <p className="text-sm text-muted-foreground mb-2">
              Ton avis aide d'autres entrepreneurs québécois à choisir le bon partenaire merch.
            </p>
            <a
              href="https://g.page/r/CcEXAMPLE/review"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-bold underline-offset-2 hover:underline"
              style={{ color: BRAND }}
            >
              Laisse un avis Google →
            </a>
          </div>

          <div className="border-t border-border pt-4">
            <h2 className="text-base font-extrabold mb-1">Code de parrainage</h2>
            <p className="text-sm text-muted-foreground">
              [Crée un compte pour générer ton code]
            </p>
            <Link
              to="/account"
              className="inline-flex items-center gap-2 text-sm font-bold mt-2 underline-offset-2 hover:underline"
              style={{ color: BRAND }}
            >
              Aller à mon compte →
            </Link>
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
