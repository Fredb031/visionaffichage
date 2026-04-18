import { ExternalLink, Mail, Send, RefreshCw, ShoppingBag } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  SHOPIFY_ABANDONED_CHECKOUTS_SNAPSHOT,
  SHOPIFY_STATS,
  type ShopifyAbandonedCheckoutSnapshot,
} from '@/data/shopifySnapshot';
import { StatCard } from '@/components/admin/StatCard';

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} jours`;
  if (days < 30) return `il y a ${Math.floor(days / 7)} sem.`;
  return `il y a ${Math.floor(days / 30)} mois`;
}

export default function AdminAbandonedCarts() {
  const [sort, setSort] = useState<'recent' | 'value'>('value');

  const sorted = useMemo(() => {
    const arr = [...SHOPIFY_ABANDONED_CHECKOUTS_SNAPSHOT];
    if (sort === 'value') arr.sort((a, b) => b.total - a.total);
    else arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return arr;
  }, [sort]);

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
        <button className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 border border-zinc-200 rounded-lg hover:bg-zinc-50 bg-white">
          <RefreshCw size={15} />
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
          <div className="inline-flex bg-zinc-100 rounded-lg p-0.5">
            {(['value', 'recent'] as const).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setSort(s)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                  sort === s ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                {s === 'value' ? 'Plus haute valeur' : 'Plus récent'}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {sorted.map(c => (
            <CheckoutRow key={c.id} checkout={c} />
          ))}
        </div>
      </div>

      <div className="bg-gradient-to-br from-[#0F2341] to-[#1B3A6B] text-white rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
            <Send size={18} />
          </div>
          <div>
            <div className="font-bold text-sm mb-1">Activer la séquence de récupération</div>
            <div className="text-xs text-white/70 mb-3 max-w-md">
              Configurez l'envoi automatique d'un courriel de relance après 1h, 24h et 72h pour récupérer en moyenne 15-25% des paniers abandonnés.
            </div>
            <button type="button" className="text-[11px] font-bold text-[#E8A838] hover:underline">
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
    <div className="flex items-center gap-4 p-3 hover:bg-zinc-50 rounded-xl transition-colors">
      <div className="w-10 h-10 rounded-full bg-zinc-100 text-zinc-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
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
      <a
        href={`mailto:${checkout.email}?subject=Tu as oubli%C3%A9 ton panier sur Vision Affichage&body=Bonjour ${encodeURIComponent(name)},%0D%0A%0D%0AOn a remarqu%C3%A9 que tu as un panier en attente sur notre site. Tu peux le compl%C3%A9ter ici :%0D%0A${encodeURIComponent(checkout.recoveryUrl)}%0D%0A%0D%0ASi tu as des questions, n%27h%C3%A9site pas !%0D%0A%0D%0A%C3%89quipe Vision Affichage`}
        title="Envoyer un courriel de relance"
        className="w-8 h-8 rounded-lg hover:bg-zinc-100 flex items-center justify-center text-zinc-500 hover:text-[#0052CC]"
      >
        <Mail size={14} />
      </a>
      <a
        href={checkout.recoveryUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="Lien de récupération"
        className="w-8 h-8 rounded-lg hover:bg-zinc-100 flex items-center justify-center text-zinc-500 hover:text-[#0052CC]"
      >
        <ExternalLink size={14} />
      </a>
    </div>
  );
}
