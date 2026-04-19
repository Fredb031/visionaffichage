import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Package, CheckCircle2, Truck, Mail, AlertCircle, Search } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { AIChat } from '@/components/AIChat';
import { DeliveryBadge } from '@/components/DeliveryBadge';
import { useLang } from '@/lib/langContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { SHOPIFY_ORDERS_SNAPSHOT } from '@/data/shopifySnapshot';
import { isValidEmail, normalizeInvisible } from '@/lib/utils';

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

export default function TrackOrder() {
  const { lang } = useLang();
  const { orderNumber: paramOrder } = useParams();
  const [searchInput, setSearchInput] = useState(paramOrder ?? '');
  const [emailInput, setEmailInput] = useState('');

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

  useDocumentTitle(lang === 'en' ? 'Track an order — Vision Affichage' : 'Suivre une commande — Vision Affichage');

  const currentStage: Stage | null = order ? deriveStage(order) : null;
  const currentIdx = currentStage ? STAGES.findIndex(s => s.id === currentStage) : -1;

  // ETA: pending = +5 days, production = +3 days, shipped = +1 day
  const eta = (() => {
    if (!order || currentStage === 'delivered') return null;
    const created = new Date(order.createdAt);
    const days = currentStage === 'pending' ? 5 : currentStage === 'production' ? 3 : 1;
    const target = new Date(created.getTime() + days * 86400000);
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

          {!searchInput.trim() || !emailInput.trim() ? (
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
            <div className="space-y-5 pt-2">
              {/* Order summary */}
              <div className="flex items-center justify-between p-4 bg-secondary/40 rounded-xl">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {lang === 'en' ? 'Order' : 'Commande'}
                  </div>
                  <div className="text-xl font-extrabold">{order.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {new Date(order.createdAt).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA')}
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

              {/* Stage tracker */}
              <div className="space-y-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground" id="track-progress-label">
                  {lang === 'en' ? 'Progress' : 'Progression'}
                </div>
                <ol aria-labelledby="track-progress-label" className="space-y-3">
                  {STAGES.map((s, i) => {
                    const isDone = i < currentIdx;
                    const isCurrent = i === currentIdx;
                    const Icon = s.icon;
                    const stateSr = isDone
                      ? (lang === 'en' ? 'completed' : 'complété')
                      : isCurrent
                        ? (lang === 'en' ? 'current' : 'en cours')
                        : (lang === 'en' ? 'upcoming' : 'à venir');
                    return (
                      <li
                        key={s.id}
                        className="flex items-start gap-3"
                        aria-current={isCurrent ? 'step' : undefined}
                        aria-label={`${lang === 'en' ? s.en : s.fr} — ${stateSr}`}
                      >
                        <div className={`relative w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                          isDone ? 'bg-emerald-500 text-white'
                          : isCurrent ? 'bg-[#0052CC] text-white scale-110 shadow-lg ring-4 ring-[#0052CC]/15'
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

              <div className="border-t border-border pt-4 flex items-center gap-3 flex-wrap">
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
