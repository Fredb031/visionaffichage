import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Package, CheckCircle2, Truck, Mail, AlertCircle, Search, Copy, Check, Share2, Printer } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { AIChat } from '@/components/AIChat';
import { DeliveryBadge } from '@/components/DeliveryBadge';
import { useLang } from '@/lib/langContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { SHOPIFY_ORDERS_SNAPSHOT } from '@/data/shopifySnapshot';
import { isValidEmail, normalizeInvisible } from '@/lib/utils';
import { getOrderStatus, getCarrierTrackingUrl, type OrderStage } from '@/lib/orderTracking';

type Stage = 'pending' | 'production' | 'shipped' | 'delivered';

interface StageInfo {
  id: Stage;
  fr: string;
  en: string;
  desc: { fr: string; en: string };
  icon: typeof Package;
}

const STAGES: StageInfo[] = [
  { id: 'pending',    fr: 'Paiement reçu',     en: 'Payment received',   desc: { fr: 'On a confirmé ta commande', en: 'Order confirmed' },                     icon: CheckCircle2 },
  { id: 'production', fr: 'En production',     en: 'In production',      desc: { fr: 'Imprimée au Québec',         en: 'Printed in Québec' },                  icon: Package },
  { id: 'shipped',    fr: 'Expédié',           en: 'Shipped',            desc: { fr: 'En route vers toi',          en: 'On its way' },                          icon: Truck },
  { id: 'delivered',  fr: 'Livré',             en: 'Delivered',          desc: { fr: 'Profite de tes nouveaux merch', en: 'Enjoy your new merch' },           icon: CheckCircle2 },
];

function deriveStage(o: typeof SHOPIFY_ORDERS_SNAPSHOT[0]): Stage {
  if (o.fulfillmentStatus === 'fulfilled') return 'delivered';
  if (o.fulfillmentStatus === 'partial') return 'shipped';
  if (o.financialStatus === 'paid') return 'production';
  return 'pending';
}

/**
 * Map the orderTracking lib's OrderStage to this page's local Stage
 * union. The lib uses "received" (matches the brief's "Commande reçue"
 * literal) while the snapshot path has historically called the same
 * thing "pending". Keeping both unions and bridging them here avoids
 * touching the snapshot-derived deriveStage logic.
 */
function mapMockStage(s: OrderStage): Stage {
  if (s === 'received') return 'pending';
  return s;
}

/** Public order-tracking page — gated lookup (order # + email) over the Shopify snapshot, with copy/share/print and timeline UI. */
export default function TrackOrder() {
  const { lang } = useLang();
  const { orderNumber: paramOrder } = useParams();
  const [searchInput, setSearchInput] = useState(paramOrder ?? '');
  const [emailInput, setEmailInput] = useState('');
  // Transient feedback flags for the copy-tracking and share-link
  // buttons on the success view. Kept local — both auto-clear after
  // 2s via setTimeout. No effect on order-lookup state.
  const [copiedTracking, setCopiedTracking] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);

  // Sync input to the route param when it changes (e.g. if another link
  // navigates /track/1570 → /track/1580). Without this the stale useState
  // initializer from the first mount would keep showing the old value.
  useEffect(() => {
    if (paramOrder && paramOrder !== searchInput) setSearchInput(paramOrder);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramOrder]);

  const order = useMemo(() => {
    // Scrub invisible chars before normalizing so a customer who
    // pastes an order number or email out of Slack/Notion (which
    // can drag ZWSP/BOM along) still matches. Without this they
    // saw "Commande introuvable" for a perfectly correct-looking
    // order number.
    const q = normalizeInvisible(searchInput).trim().toLowerCase().replace(/^#/, '');
    if (!q) return null;
    // Require both order number AND email. Without this, anyone could
    // type an order number and see the customer's name, total, and
    // items — a straight customer-data leak for a public page. Real
    // order lookup should gate on the email that paid.
    const emailQ = normalizeInvisible(emailInput).trim().toLowerCase();
    if (!emailQ) return null;
    return SHOPIFY_ORDERS_SNAPSHOT.find(o => {
      const matchNumber = o.name.toLowerCase().replace('#', '') === q;
      // Mirror the input-side normalization on the snapshot too — a
      // Shopify-exported order email that accidentally carries a ZWSP
      // would otherwise fail the strict compare against a clean input.
      // Account.tsx already does this; TrackOrder was inconsistent.
      const snapshotEmail = normalizeInvisible(o.email).trim().toLowerCase();
      const matchEmail = snapshotEmail === emailQ;
      return matchNumber && matchEmail;
    }) ?? null;
  }, [searchInput, emailInput]);

  // Mega Blueprint §16 mock fallback — when the URL carries an order
  // number AND the customer-data Shopify snapshot didn't match (most
  // common case: operator seeded a row into localStorage `va:orders`
  // for support/QA before the real Shopify webhook sync exists), fall
  // through to the orderTracking lib. The mock path doesn't gate on
  // email because the rows are operator-seeded test data; the real
  // sync will inherit the snapshot path's email gate instead.
  const mockOrder = useMemo(() => {
    if (order) return null;
    if (!paramOrder) return null;
    return getOrderStatus(paramOrder);
  }, [order, paramOrder]);

  useDocumentTitle(lang === 'en' ? 'Track an order — Vision Affichage' : 'Suivre une commande — Vision Affichage');

  const currentStage: Stage | null = order ? deriveStage(order) : null;
  const currentIdx = currentStage ? STAGES.findIndex(s => s.id === currentStage) : -1;

  // Stale-order guard: an order sitting in 'pending' (payment received but not
  // yet in production) for > 14 days is almost certainly a data hiccup on our
  // side — a partially-captured payment, a stuck webhook, or an order the team
  // forgot to flip to 'paid'. Without a hint here, customers stare at a
  // "Paiement reçu" step that never advances and assume we ghosted them. The
  // banner nudges them to reach out instead of silently waiting another week.
  const isStalePending = (() => {
    if (!order || currentStage !== 'pending') return false;
    const createdMs = new Date(order.createdAt).getTime();
    if (!Number.isFinite(createdMs)) return false;
    return Date.now() - createdMs > 14 * 86400000;
  })();

  // ETA: pending = +5 days, production = +3 days, shipped = +1 day.
  // Clamp the target to at least tomorrow so an order that's been
  // stuck in 'pending' for longer than the stage's nominal SLA
  // doesn't advertise an "Expected <past date>" — customers were
  // confused by a weekday already gone by when the order was
  // actually just running behind.
  //
  // Weekend nudge: Canada Post doesn't do standard delivery on
  // Sundays and the Québec shop doesn't print on Saturday/Sunday,
  // so an ETA landing on a weekend is effectively a lie — the
  // customer then sees "Expected dimanche 26 avril" and nothing
  // moves that day. Push any weekend landing to the next Monday
  // so the date on screen matches what actually happens.
  const eta = (() => {
    if (!order || currentStage === 'delivered') return null;
    const created = new Date(order.createdAt);
    const days = currentStage === 'pending' ? 5 : currentStage === 'production' ? 3 : 1;
    const createdMs = created.getTime();
    const floor = Date.now() + 86400000;
    // If createdAt is malformed (Shopify snapshot edge case, missing
    // timestamp, or an admin-edited row) createdMs is NaN and every
    // arithmetic derivation stays NaN — Math.max(NaN, floor) is NaN,
    // which renders as "Invalid Date". Fall back to the floor so the
    // user still sees a sensible "earliest tomorrow" ETA instead of
    // literal "Invalid Date" shouting from the badge.
    const nominal = Number.isFinite(createdMs) ? createdMs + days * 86400000 : floor;
    const target = new Date(Math.max(nominal, floor));
    // 0=Sunday, 6=Saturday — bump into Monday either way.
    const dow = target.getDay();
    if (dow === 6) target.setDate(target.getDate() + 2);
    else if (dow === 0) target.setDate(target.getDate() + 1);
    return target.toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', { weekday: 'long', day: 'numeric', month: 'long' });
  })();

  return (
    <div id="main-content" tabIndex={-1} className="min-h-screen bg-gradient-to-b from-secondary/40 to-background pb-20 focus:outline-none">
      <Navbar />

      <main className="max-w-[760px] mx-auto px-4 md:px-8 pt-20 pb-16">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {lang === 'en' ? 'Back home' : "Retour à l'accueil"}
        </Link>

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[2px] uppercase text-[#0052CC] mb-2">
            <Package size={14} aria-hidden="true" />
            {lang === 'en' ? 'Order tracking' : 'Suivi de commande'}
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground mb-2">
            {lang === 'en' ? "Where's my order?" : 'Où en est ma commande ?'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {lang === 'en'
              ? 'Enter your order number and email to see status.'
              : 'Entre ton numéro de commande et ton courriel pour voir le statut.'}
          </p>
        </div>

        <div className="bg-white border border-border rounded-2xl p-5 md:p-6 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr] gap-3">
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {lang === 'en' ? 'Order #' : 'Commande #'}
              </span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="1570"
                aria-label={lang === 'en' ? 'Order number' : 'Numéro de commande'}
                className="mt-1 w-full border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 transition-shadow"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {lang === 'en' ? 'Email used at checkout' : 'Courriel utilisé à la commande'}
              </span>
              {(() => {
                const emailInvalid = emailInput.trim().length > 0 && !isValidEmail(emailInput);
                return (
                  <input
                    type="email"
                    autoComplete="email"
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    placeholder={lang === 'en' ? 'you@company.com' : 'toi@entreprise.ca'}
                    aria-label={lang === 'en' ? 'Email used at checkout' : 'Courriel utilisé à la commande'}
                    aria-invalid={emailInvalid || undefined}
                    className={`mt-1 w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus-visible:ring-2 transition-shadow ${
                      emailInvalid
                        ? 'border-rose-400 focus:border-rose-500 focus-visible:ring-rose-400/25'
                        : 'border-border focus:border-primary focus-visible:ring-primary/25'
                    }`}
                  />
                );
              })()}
            </label>
          </div>

          {mockOrder ? (
            <div className="track-order-print space-y-5 pt-2">
              {/* Mock-data render path — Mega Blueprint §16 stub.
                  Operator-seeded rows in localStorage `va:orders` show
                  the same 4-stage stepper UI as a Shopify-snapshot
                  match, just with simpler data (no totals, no
                  itemsCount). The TODO in lib/orderTracking explains
                  the real Shopify-webhook follow-up. */}
              <div className="flex items-center justify-between p-4 bg-secondary/40 rounded-xl gap-3 flex-wrap">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {lang === 'en' ? 'Order' : 'Commande'}
                  </div>
                  <div className="text-xl font-extrabold">#{mockOrder.orderNumber}</div>
                </div>
                {mockOrder.eta && (
                  <div className="text-right">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {lang === 'en' ? 'Expected delivery' : 'Livraison prévue'}
                    </div>
                    <div className="text-xl font-extrabold text-primary">
                      {(() => {
                        const d = new Date(mockOrder.eta);
                        if (Number.isNaN(d.getTime())) return mockOrder.eta;
                        return d.toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', { weekday: 'long', day: 'numeric', month: 'long' });
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {mockOrder.trackingNumber && (() => {
                const carrier = getCarrierTrackingUrl(mockOrder.trackingNumber);
                return (
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="font-bold text-muted-foreground">
                      {lang === 'en' ? 'Tracking #' : 'N° de suivi'}
                    </span>
                    {carrier ? (
                      <a
                        href={carrier.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono bg-secondary/60 rounded px-2 py-1 text-[#0052CC] underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
                        aria-label={lang === 'en' ? `Track on ${carrier.carrier}` : `Suivre sur ${carrier.carrier}`}
                      >
                        {mockOrder.trackingNumber}
                      </a>
                    ) : (
                      <code className="font-mono bg-secondary/60 rounded px-2 py-1">{mockOrder.trackingNumber}</code>
                    )}
                    {carrier && (
                      <span className="text-[11px] font-bold text-muted-foreground">
                        {lang === 'en' ? `via ${carrier.carrier}` : `via ${carrier.carrier}`}
                      </span>
                    )}
                  </div>
                );
              })()}

              {mockOrder.items.length > 0 && (
                <div className="bg-secondary/30 rounded-xl p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    {lang === 'en' ? 'Items' : 'Articles'}
                  </div>
                  <ul className="space-y-1.5 text-sm">
                    {mockOrder.items.map((it, i) => (
                      <li key={i} className="flex items-baseline justify-between gap-2">
                        <span className="font-bold text-foreground">{it.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {it.qty}× {it.sizes ? `(${it.sizes})` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground" id="track-mock-progress-label">
                  {lang === 'en' ? 'Progress' : 'Progression'}
                </div>
                <ol aria-labelledby="track-mock-progress-label" className="space-y-3">
                  {STAGES.map((s, i) => {
                    const mockStage = mapMockStage(mockOrder.stage);
                    const mockIdx = STAGES.findIndex(x => x.id === mockStage);
                    const isDone = i < mockIdx;
                    const isCurrent = i === mockIdx;
                    const isLast = i === STAGES.length - 1;
                    const Icon = s.icon;
                    const stateSr = isDone
                      ? (lang === 'en' ? 'completed' : 'complété')
                      : isCurrent
                        ? (lang === 'en' ? 'current' : 'en cours')
                        : (lang === 'en' ? 'upcoming' : 'à venir');
                    return (
                      <li
                        key={s.id}
                        className="flex items-start gap-3 relative"
                        aria-current={isCurrent ? 'step' : undefined}
                        aria-label={`${lang === 'en' ? s.en : s.fr} — ${stateSr}`}
                      >
                        {!isLast && (
                          <span
                            aria-hidden="true"
                            className={`absolute left-[17px] top-9 w-0.5 h-[calc(100%+0.25rem)] ${
                              isDone ? 'bg-emerald-400' : isCurrent ? 'bg-gradient-to-b from-[#0052CC] to-zinc-200' : 'bg-zinc-200'
                            }`}
                          />
                        )}
                        <div className={`relative w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all z-10 ${
                          isDone ? 'bg-emerald-500 text-white'
                          : isCurrent ? 'bg-[#0052CC] text-white scale-110 shadow-lg ring-4 ring-[#0052CC]/15 animate-pulse'
                          : 'bg-zinc-100 text-zinc-400'
                        }`}
                        aria-hidden="true"
                        >
                          <Icon size={16} />
                        </div>
                        <div className="flex-1 pt-1">
                          <div className={`text-sm font-extrabold ${isCurrent ? 'text-foreground' : isDone ? 'text-emerald-700' : 'text-muted-foreground'}`}>
                            {lang === 'en' ? s.en : s.fr}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {lang === 'en' ? s.desc.en : s.desc.fr}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>

              <div className="print-hide border-t border-border pt-4 flex items-center gap-3 flex-wrap">
                <a
                  href={`mailto:info@visionaffichage.com?subject=${encodeURIComponent(`Question commande #${mockOrder.orderNumber}`)}`}
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 bg-[#0052CC] text-white rounded-xl hover:bg-[#003D99] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
                >
                  <Mail size={12} aria-hidden="true" />
                  {lang === 'en' ? 'Contact support' : 'Contacter le support'}
                </a>
                <DeliveryBadge size="sm" />
              </div>
            </div>
          ) : !searchInput.trim() || !emailInput.trim() ? (
            <div className="text-center py-12">
              <Search size={32} className="text-muted-foreground/40 mx-auto mb-3" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                {lang === 'en'
                  ? 'Enter your order number AND the email used at checkout'
                  : 'Entre ton numéro de commande ET le courriel utilisé à la commande'}
              </p>
            </div>
          ) : !order ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center" role="status">
              <AlertCircle size={28} className="text-amber-500 mx-auto mb-2" aria-hidden="true" />
              <p className="font-bold text-amber-900 mb-1">
                {lang === 'en' ? 'Order not found' : 'Commande introuvable'}
              </p>
              <p className="text-xs text-amber-700">
                {lang === 'en'
                  ? 'Check the number/email or call us at 367-380-4808'
                  : 'Vérifie le numéro/courriel ou appelle-nous au 367-380-4808'}
              </p>
            </div>
          ) : (
            <div className="track-order-print space-y-5 pt-2">
              {/* Scoped print stylesheet — when the customer hits the Print
                  button below we want a paper-friendly view that hides
                  the Navbar, BottomNav, AIChat and lookup form, leaving
                  only the success card. The body-star visibility trick is
                  safer than adding .no-print to every chrome component
                  because it localizes the change to this page alone. */}
              <style>{`@media print { body * { visibility: hidden; } .track-order-print, .track-order-print * { visibility: visible; } .track-order-print { position: absolute; left: 0; top: 0; width: 100%; } .track-order-print .print-hide { display: none !important; } }`}</style>
              {/* Order summary */}
              <div className="flex items-center justify-between p-4 bg-secondary/40 rounded-xl gap-3 flex-wrap">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {lang === 'en' ? 'Order' : 'Commande'}
                  </div>
                  <div className="text-xl font-extrabold">{order.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {(() => {
                      // Same NaN guard as the ETA derivation above — a
                      // malformed createdAt would otherwise render the
                      // literal string "Invalid Date" right under the
                      // order number on the success card.
                      const d = new Date(order.createdAt);
                      return Number.isFinite(d.getTime())
                        ? d.toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA')
                        : '—';
                    })()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-extrabold text-primary">
                    {order.total.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA', { style: 'currency', currency: 'CAD' })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {order.itemsCount} {lang === 'en' ? 'items' : 'articles'}
                  </div>
                </div>
              </div>

              {/* Quick actions — share the current status URL and print
                  a paper-friendly summary. Both are self-contained and
                  only render when an order has been successfully looked
                  up. The inline "Lien copié" hint replaces a full toast
                  system to keep this additive. `print-hide` keeps these
                  chrome buttons out of the printed output. */}
              <div className="print-hide flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={async () => {
                    const url = typeof window !== 'undefined' ? window.location.href : '';
                    const shareTitle = lang === 'en' ? `Order ${order.name} — Vision Affichage` : `Commande ${order.name} — Vision Affichage`;
                    const shareText = lang === 'en' ? `Track order ${order.name}` : `Suivi de la commande ${order.name}`;
                    try {
                      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
                        await navigator.share({ title: shareTitle, text: shareText, url });
                        return;
                      }
                    } catch {
                      // User dismissed the share sheet or the OS rejected it — fall
                      // through to the clipboard path so the action still does
                      // something useful.
                    }
                    try {
                      if (typeof navigator !== 'undefined' && navigator.clipboard) {
                        await navigator.clipboard.writeText(url);
                        setCopiedShareLink(true);
                        setTimeout(() => setCopiedShareLink(false), 2000);
                      }
                    } catch {
                      // Clipboard blocked (insecure context, perms). Silently no-op;
                      // the share button failing loud would be worse than quietly
                      // doing nothing here.
                    }
                  }}
                  aria-label={lang === 'en' ? 'Share order status' : 'Partager le statut de commande'}
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 bg-[#0052CC] text-white rounded-xl hover:bg-[#003D99] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
                >
                  <Share2 size={12} aria-hidden="true" />
                  {lang === 'en' ? 'Share' : 'Partager'}
                </button>
                <button
                  type="button"
                  onClick={() => { if (typeof window !== 'undefined') window.print(); }}
                  aria-label={lang === 'en' ? 'Print order summary' : 'Imprimer le résumé de commande'}
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 border border-border rounded-lg hover:bg-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
                >
                  <Printer size={12} aria-hidden="true" />
                  {lang === 'en' ? 'Print' : 'Imprimer'}
                </button>
                {copiedShareLink && (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1" role="status">
                    {lang === 'en' ? 'Link copied' : 'Lien copié'}
                  </span>
                )}
              </div>

              {/* Tracking number row — Shopify snapshots don't expose
                  tracking yet (the ShopifyOrderSnapshot type has no
                  such field as of 2026-04), so this block only shows
                  up once a shipment record carries one. Reading it
                  through an optional cast keeps TypeScript happy
                  without widening the data-layer type from here. */}
              {(() => {
                const trackingNumber = (order as unknown as { trackingNumber?: string | null }).trackingNumber;
                if (!trackingNumber) return null;
                const carrier = getCarrierTrackingUrl(trackingNumber);
                return (
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="font-bold text-muted-foreground">
                      {lang === 'en' ? 'Tracking #' : 'N° de suivi'}
                    </span>
                    {carrier ? (
                      <a
                        href={carrier.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono bg-secondary/60 rounded px-2 py-1 text-[#0052CC] underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
                        aria-label={lang === 'en' ? `Track on ${carrier.carrier}` : `Suivre sur ${carrier.carrier}`}
                      >
                        {trackingNumber}
                      </a>
                    ) : (
                      <code className="font-mono bg-secondary/60 rounded px-2 py-1">{trackingNumber}</code>
                    )}
                    {carrier && (
                      <span className="text-[11px] font-bold text-muted-foreground">via {carrier.carrier}</span>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          if (typeof navigator !== 'undefined' && navigator.clipboard) {
                            await navigator.clipboard.writeText(trackingNumber);
                            setCopiedTracking(true);
                            setTimeout(() => setCopiedTracking(false), 2000);
                          }
                        } catch {
                          // Clipboard unavailable — silently no-op so the
                          // button doesn't spit an error at a customer who
                          // can still select + copy the tracking text.
                        }
                      }}
                      aria-label={lang === 'en' ? 'Copy tracking number' : 'Copier le numéro de suivi'}
                      className="print-hide inline-flex items-center gap-1 font-bold px-2 py-1 border border-border rounded-md hover:bg-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
                    >
                      {copiedTracking ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
                      {copiedTracking
                        ? (lang === 'en' ? 'Copied' : 'Copié')
                        : (lang === 'en' ? 'Copy' : 'Copier')}
                    </button>
                  </div>
                );
              })()}

              {isStalePending && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3" role="status">
                  <AlertCircle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
                  <div className="text-xs text-amber-900">
                    <div className="font-bold mb-0.5">
                      {lang === 'en' ? 'This order is taking longer than usual' : 'Cette commande prend plus de temps que prévu'}
                    </div>
                    <div className="text-amber-800">
                      {lang === 'en'
                        ? 'It has been pending for more than 14 days. Please call us at 367-380-4808 so we can look into it.'
                        : 'Elle est en attente depuis plus de 14 jours. Appelle-nous au 367-380-4808 pour qu\u2019on la regarde.'}
                    </div>
                  </div>
                </div>
              )}

              {/* Stage tracker */}
              <div className="space-y-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground" id="track-progress-label">
                  {lang === 'en' ? 'Progress' : 'Progression'}
                </div>
                <ol aria-labelledby="track-progress-label" className="space-y-3">
                  {STAGES.map((s, i) => {
                    const isDone = i < currentIdx;
                    const isCurrent = i === currentIdx;
                    const isLast = i === STAGES.length - 1;
                    const Icon = s.icon;
                    const stateSr = isDone
                      ? (lang === 'en' ? 'completed' : 'complété')
                      : isCurrent
                        ? (lang === 'en' ? 'current' : 'en cours')
                        : (lang === 'en' ? 'upcoming' : 'à venir');
                    return (
                      <li
                        key={s.id}
                        className="flex items-start gap-3 relative"
                        aria-current={isCurrent ? 'step' : undefined}
                        aria-label={`${lang === 'en' ? s.en : s.fr} — ${stateSr}`}
                      >
                        {/* Vertical connector to the next step. Coloured
                            green when the CURRENT step is past (flow has
                            already passed this gap), blue-ish for the
                            gap sitting just below the current step, and
                            grey for upcoming gaps. Makes the timeline
                            read as a continuous line, not 4 detached
                            circles. aria-hidden because the <ol> order
                            already conveys the sequence to AT users. */}
                        {!isLast && (
                          <span
                            aria-hidden="true"
                            className={`absolute left-[17px] top-9 w-0.5 h-[calc(100%+0.25rem)] ${
                              isDone ? 'bg-emerald-400' : isCurrent ? 'bg-gradient-to-b from-[#0052CC] to-zinc-200' : 'bg-zinc-200'
                            }`}
                          />
                        )}
                        <div className={`relative w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all z-10 ${
                          isDone ? 'bg-emerald-500 text-white'
                          : isCurrent ? 'bg-[#0052CC] text-white scale-110 shadow-lg ring-4 ring-[#0052CC]/15 animate-pulse'
                          : 'bg-zinc-100 text-zinc-400'
                        }`}
                        aria-hidden="true"
                        >
                          <Icon size={16} />
                        </div>
                        <div className="flex-1 pt-1">
                          <div className={`text-sm font-extrabold ${isCurrent ? 'text-foreground' : isDone ? 'text-emerald-700' : 'text-muted-foreground'}`}>
                            {lang === 'en' ? s.en : s.fr}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {lang === 'en' ? s.desc.en : s.desc.fr}
                          </div>
                          {isCurrent && eta && (
                            <div className="inline-flex items-center gap-1 mt-2 text-[11px] font-bold px-2 py-1 rounded-md bg-blue-50 text-blue-700">
                              ⚡ {lang === 'en' ? `Expected ${eta}` : `Prévu ${eta}`}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>

              <div className="print-hide border-t border-border pt-4 flex items-center gap-3 flex-wrap">
                <a
                  href={`mailto:info@visionaffichage.com?subject=${encodeURIComponent(`Question commande ${order.name}`)}`}
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 border border-border rounded-lg hover:bg-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                >
                  <Mail size={12} aria-hidden="true" />
                  {lang === 'en' ? 'Question about this order' : 'Question sur cette commande'}
                </a>
                <DeliveryBadge size="sm" />
              </div>
            </div>
          )}
        </div>
      </main>

      <AIChat />
      <BottomNav />
    </div>
  );
}
