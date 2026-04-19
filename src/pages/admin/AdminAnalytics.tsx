import { useMemo } from 'react';
import { TrendingUp, DollarSign, Package, Users, ShoppingBag } from 'lucide-react';
import {
  SHOPIFY_ORDERS_SNAPSHOT,
  SHOPIFY_CUSTOMERS_SNAPSHOT,
  SHOPIFY_PRODUCTS_SNAPSHOT,
  SHOPIFY_ABANDONED_CHECKOUTS_SNAPSHOT,
  SHOPIFY_STATS,
} from '@/data/shopifySnapshot';
import { StatCard } from '@/components/admin/StatCard';

function dayKey(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().slice(0, 10);
}

export default function AdminAnalytics() {
  const dailyRevenue = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of SHOPIFY_ORDERS_SNAPSHOT) {
      const k = dayKey(o.createdAt);
      map.set(k, (map.get(k) ?? 0) + o.total);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .slice(-14);
  }, []);

  const maxRevenue = Math.max(...dailyRevenue.map(([, v]) => v), 1);

  const productTypeRevenue = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    for (const p of SHOPIFY_PRODUCTS_SNAPSHOT) {
      const type = p.productType || 'Autre';
      const cur = map.get(type) ?? { count: 0, revenue: 0 };
      cur.count += 1;
      cur.revenue += p.minPrice;
      map.set(type, cur);
    }
    return Array.from(map.entries())
      .map(([type, data]) => ({ type, ...data }))
      .sort((a, b) => b.count - a.count);
  }, []);

  const topCustomers = useMemo(() => {
    return [...SHOPIFY_CUSTOMERS_SNAPSHOT]
      .filter(c => c.totalSpent > 0)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 5);
  }, []);

  const conversionRate = useMemo(() => {
    const ordered = SHOPIFY_ORDERS_SNAPSHOT.length;
    const abandoned = SHOPIFY_ABANDONED_CHECKOUTS_SNAPSHOT.length;
    if (ordered + abandoned === 0) return 0;
    return Math.round((ordered / (ordered + abandoned)) * 100);
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Analytique</h1>
        <p className="text-sm text-zinc-500 mt-1">Vue d'ensemble basée sur tes vraies données Shopify</p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Revenus 7 jours"
          value={`${SHOPIFY_STATS.revenueLast7Days.toLocaleString('fr-CA', { maximumFractionDigits: 0 })} $`}
          icon={DollarSign}
          accent="green"
        />
        <StatCard
          label="Taux conversion"
          value={`${conversionRate}%`}
          deltaLabel="commandes vs paniers"
          icon={TrendingUp}
          accent="blue"
        />
        <StatCard
          label="Panier moyen"
          value={`${(SHOPIFY_STATS.totalLifetimeRevenue / Math.max(SHOPIFY_STATS.payingCustomers, 1)).toFixed(0)} $`}
          icon={ShoppingBag}
          accent="gold"
        />
        <StatCard
          label="Clients actifs"
          value={String(SHOPIFY_STATS.payingCustomers)}
          deltaLabel={`sur ${SHOPIFY_STATS.totalCustomers} inscrit${SHOPIFY_STATS.totalCustomers > 1 ? 's' : ''}`}
          icon={Users}
          accent="blue"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <section className="lg:col-span-2 bg-white border border-zinc-200 rounded-2xl p-5" aria-labelledby="daily-revenue-heading">
          <div className="flex items-center justify-between mb-5">
            <h2 id="daily-revenue-heading" className="font-bold">Revenus quotidiens</h2>
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">14 jours</span>
          </div>
          <div className="flex items-end gap-1.5 h-48" role="list">
            {dailyRevenue.map(([day, revenue]) => {
              const heightPct = (revenue / maxRevenue) * 100;
              const date = new Date(day);
              const label = date.toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric' });
              return (
                <div
                  key={day}
                  className="flex-1 flex flex-col items-center gap-1.5 group"
                  role="listitem"
                  aria-label={`${label} : ${revenue.toFixed(0)} $`}
                >
                  <div className="text-[10px] font-bold text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true">
                    {revenue.toFixed(0)} $
                  </div>
                  <div
                    className="w-full bg-gradient-to-t from-[#0052CC] to-[#1B3A6B] rounded-md min-h-[4px] hover:from-[#E8A838] hover:to-[#B37D10] transition-all"
                    style={{ height: `${Math.max(heightPct, 2)}%` }}
                    aria-hidden="true"
                  />
                  <div className="text-[9px] text-zinc-400 whitespace-nowrap" aria-hidden="true">{label}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="bg-white border border-zinc-200 rounded-2xl p-5" aria-labelledby="top-customers-heading">
          <h2 id="top-customers-heading" className="font-bold mb-4">Top clients</h2>
          <ol className="space-y-3 list-none">
            {topCustomers.map((c, i) => (
              <li key={c.id} className="flex items-center gap-3">
                <span className="w-5 text-center text-xs font-bold text-zinc-400" aria-hidden="true">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate">
                    {[c.firstName, c.lastName].filter(Boolean).join(' ') || c.email.split('@')[0]}
                  </div>
                  <div className="text-[11px] text-zinc-500 truncate">{c.email}</div>
                </div>
                <div className="text-sm font-extrabold text-emerald-700 whitespace-nowrap">
                  {c.totalSpent.toFixed(0)} $
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="bg-white border border-zinc-200 rounded-2xl p-5" aria-labelledby="catalog-breakdown-heading">
        <div className="flex items-center justify-between mb-5">
          <h2 id="catalog-breakdown-heading" className="font-bold">Catalogue par type de produit</h2>
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">{SHOPIFY_PRODUCTS_SNAPSHOT.length} produit{SHOPIFY_PRODUCTS_SNAPSHOT.length > 1 ? 's' : ''} actif{SHOPIFY_PRODUCTS_SNAPSHOT.length > 1 ? 's' : ''}</span>
        </div>
        <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 list-none">
          {productTypeRevenue.map(t => (
            <li
              key={t.type}
              className="bg-zinc-50 rounded-xl p-3"
              aria-label={`${t.type} : ${t.count} produit${t.count > 1 ? 's' : ''}, à partir de ${(t.revenue / t.count).toFixed(2)} $`}
            >
              <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider truncate">{t.type}</div>
              <div className="text-2xl font-extrabold mt-1">{t.count}</div>
              <div className="text-[11px] text-zinc-500 mt-1">
                à partir de {(t.revenue / t.count).toFixed(2)} $
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-gradient-to-br from-[#1B3A6B] to-[#0F2341] text-white rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
            <Package size={18} aria-hidden="true" />
          </div>
          <div>
            <div className="font-bold text-sm mb-1">Opportunité de revenue</div>
            <div className="text-sm text-white/80 mb-2">
              {SHOPIFY_STATS.abandonedCheckoutsValue.toLocaleString('fr-CA')} $ en paniers abandonnés ·{' '}
              {SHOPIFY_STATS.totalCustomers - SHOPIFY_STATS.payingCustomers} prospects sans commande
            </div>
            <div className="text-xs text-white/60">
              Activer la séquence de relance courriel + nurturing prospects pourrait récupérer 15-25% de cette valeur.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
