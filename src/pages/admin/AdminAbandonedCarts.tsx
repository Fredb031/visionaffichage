import { ExternalLink, Mail, Send, RefreshCw, ShoppingBag } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  SHOPIFY_ABANDONED_CHECKOUTS_SNAPSHOT,
  SHOPIFY_STATS,
  type ShopifyAbandonedCheckoutSnapshot,
} from '@/data/shopifySnapshot';
import { StatCard } from '@/components/admin/StatCard';
import { TablePagination } from '@/components/admin/TablePagination';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

const PAGE_SIZE = 25;

function formatRelative(iso: string): string {
  // Compare CALENDAR-DAY deltas instead of a 24-hour-window floor —
  // a cart created at 11:55pm yesterday was previously labelled
  // "aujourd'hui" when viewed at 11:55am today (12h diff → floor(12/24)=0)
  // even though it was clearly the previous calendar day. Use day-start
  // anchors so the same calendar day reads "aujourd'hui" and the prior
  // calendar day always reads "hier" regardless of the hour.
  const created = new Date(iso);
  if (Number.isNaN(created.getTime())) return '';
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const todayMid = startOfDay(new Date()).getTime();
  const createdMid = startOfDay(created).getTime();
  const days = Math.max(0, Math.round((todayMid - createdMid) / 86400000));
  if (days === 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} jours`;
  if (days < 30) return `il y a ${Math.floor(days / 7)} sem.`;
  return `il y a ${Math.floor(days / 30)} mois`;
}

export default function AdminAbandonedCarts() {
  const [sort, setSort] = useState<'recent' | 'value'>('value');
  const [page, setPage] = useState(0);
  useDocumentTitle('Paniers abandonnés — Admin Vision Affichage');

  const sorted = useMemo(() => {
    const arr = [...SHOPIFY_ABANDONED_CHECKOUTS_SNAPSHOT];
    if (sort === 'value') arr.sort((a, b) => b.total - a.total);
    else arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return arr;
  }, [sort]);

  // Reset page on sort change so user isn't stranded.
  useEffect(() => { setPage(0); }, [sort]);

  const pageItems = useMemo(
    () => sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [sorted, page],
  );

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Paniers abandonnés</h1>
          <p className="text-sm text-zinc-500 mt-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Shopify via Zapier
            </span>
            <span className="text-zinc-400">·</span>
            <span>{SHOPIFY_STATS.abandonedCheckoutsCount} checkouts à recuperer</span>
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 border border-zinc-200 rounded-lg hover:bg-zinc-50 bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
        >
          <RefreshCw size={15} aria-hidden="true" />
          Resync
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Valeur totale"
          value={SHOPIFY_STATS.abandonedCheckoutsValue.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 })}
          icon={ShoppingBag}
          accent="gold"
        />
        <StatCard
          label="Checkouts en attente"
          value={String(SHOPIFY_STATS.abandonedCheckoutsCount)}
          icon={Mail}
          accent="blue"
        />
        <StatCard
          label="Valeur moyenne"
          value={(SHOPIFY_STATS.abandonedCheckoutsValue / Math.max(SHOPIFY_STATS.abandonedCheckoutsCount, 1)).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 })}
          accent="green"
        />
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-sm">Liste des paniers</h2>
          <div className="inline-flex bg-zinc-100 rounded-lg p-0.5" role="radiogroup" aria-label="Trier les paniers">
            {(['value', 'recent'] as const).map(s => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={sort === s}
                onClick={() => setSort(s)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 ${
                  sort === s ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                {s === 'value' ? 'Plus haute valeur' : 'Plus récent'}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {pageItems.map(c => (
            <CheckoutRow key={c.id} checkout={c} />
          ))}
        </div>

        <TablePagination
          page={page}
          pageSize={PAGE_SIZE}
          total={sorted.length}
          onPageChange={setPage}
          itemLabel="paniers"
        />
      </div>

      <div className="bg-gradient-to-br from-[#0F2341] to-[#1B3A6B] text-white rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
            <Send size={18} aria-hidden="true" />
          </div>
          <div>
            <div className="font-bold text-sm mb-1">Activer la séquence de récupération</div>
            <div className="text-xs text-white/70 mb-3 max-w-md">
              Configurez l'envoi automatique d'un courriel de relance après 1h, 24h et 72h pour récupérer en moyenne 15-25% des paniers abandonnés.
            </div>
            <button
              type="button"
              className="text-[11px] font-bold text-[#E8A838] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2341] rounded"
            >
              Configurer la séquence →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckoutRow({ checkout }: { checkout: ShopifyAbandonedCheckoutSnapshot }) {
  const name = checkout.customerName.trim() || checkout.email.split('@')[0];
  const valueColor = checkout.total >= 200 ? 'text-emerald-700' : checkout.total >= 75 ? 'text-amber-700' : 'text-zinc-500';

  return (
    // focus-within mirrors the hover state when a keyboard user tabs
    // into one of the row's action links (Mail / ExternalLink). Without
    // it, sighted-mouse users got the hover affordance but keyboard
    // users had no row-level visual context to anchor focus.
    <div className="flex items-center gap-4 p-3 hover:bg-zinc-50 focus-within:bg-zinc-50 rounded-xl transition-colors">
      <div
        className="w-10 h-10 rounded-full bg-zinc-100 text-zinc-600 flex items-center justify-center text-xs font-bold flex-shrink-0"
        aria-hidden="true"
      >
        {name[0]?.toUpperCase() || '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate">{name}</div>
        <div className="text-xs text-zinc-500 truncate">{checkout.email}</div>
      </div>
      <div className="text-xs text-zinc-400 hidden sm:block min-w-[80px] text-right">
        {checkout.itemsCount} {checkout.itemsCount > 1 ? 'articles' : 'article'}
      </div>
      <div className="text-xs text-zinc-400 hidden md:block min-w-[110px] text-right">
        {formatRelative(checkout.createdAt)}
      </div>
      <div className={`text-sm font-extrabold min-w-[80px] text-right ${valueColor}`}>
        {checkout.total.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $
      </div>
      {(() => {
        // Build the mailto URL via encodeURIComponent on each field so
        // spaces, accents, and apostrophes are handled uniformly.
        // The old inline template mixed hand-crafted %C3%A9 escapes with
        // raw spaces and unencoded recipient addresses — any email with
        // a `+alias` or a space would break the link.
        const subject = encodeURIComponent('Tu as oublié ton panier sur Vision Affichage');
        const body = encodeURIComponent(
          `Bonjour ${name},\n\n` +
          `On a remarqué que tu as un panier en attente sur notre site. Tu peux le compléter ici :\n` +
          `${checkout.recoveryUrl}\n\n` +
          `Si tu as des questions, n'hésite pas !\n\n` +
          `— Équipe Vision Affichage`,
        );
        const mailtoHref = `mailto:${encodeURIComponent(checkout.email)}?subject=${subject}&body=${body}`;
        return (
          <a
            href={mailtoHref}
            title="Envoyer un courriel de relance"
            aria-label={`Envoyer un courriel de relance à ${name}`}
            className="w-8 h-8 rounded-lg hover:bg-zinc-100 flex items-center justify-center text-zinc-500 hover:text-[#0052CC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
          >
            <Mail size={14} aria-hidden="true" />
          </a>
        );
      })()}
      <a
        href={checkout.recoveryUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="Lien de récupération"
        aria-label={`Ouvrir le lien de récupération pour ${name} (nouvel onglet)`}
        className="w-8 h-8 rounded-lg hover:bg-zinc-100 flex items-center justify-center text-zinc-500 hover:text-[#0052CC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
      >
        <ExternalLink size={14} aria-hidden="true" />
      </a>
    </div>
  );
}
