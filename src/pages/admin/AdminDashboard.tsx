import { Link } from 'react-router-dom';
import { ShoppingBag, DollarSign, FileText, Package, TrendingUp, AlertCircle } from 'lucide-react';
import { StatCard } from '@/components/admin/StatCard';
import { TodayWidget } from '@/components/admin/TodayWidget';
import { ActivityFeed } from '@/components/admin/ActivityFeed';
import { SHOPIFY_ORDERS_SNAPSHOT, SHOPIFY_STATS, SHOPIFY_SNAPSHOT_META } from '@/data/shopifySnapshot';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

const STATUS_COLORS: Record<string, string> = {
  paid: 'bg-emerald-100 text-emerald-800',
  pending: 'bg-amber-50 text-amber-700',
  fulfilled: 'bg-emerald-50 text-emerald-700',
  awaiting: 'bg-blue-50 text-blue-700',
  refunded: 'bg-rose-50 text-rose-700',
  voided: 'bg-zinc-100 text-zinc-700',
};

export default function AdminDashboard() {
  useDocumentTitle('Tableau de bord — Admin Vision Affichage');
  const recentOrders = SHOPIFY_ORDERS_SNAPSHOT.slice(0, 6);
  const revenueFmt = SHOPIFY_STATS.revenueLast7Days.toLocaleString('fr-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Tableau de bord</h1>
        <p className="text-sm text-zinc-500 mt-1 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Shopify via Zapier
          </span>
          <span className="text-zinc-400">·</span>
          <span>{SHOPIFY_SNAPSHOT_META.shop}</span>
        </p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Commandes (7j)" value={String(SHOPIFY_STATS.ordersLast7Days)} delta={12} deltaLabel="vs. sem. dernière" icon={ShoppingBag} accent="blue" />
        <StatCard label="Revenus (7j)" value={`${revenueFmt} $`} delta={8} deltaLabel="vs. sem. dernière" icon={DollarSign} accent="green" />
        <StatCard label="À expédier" value={String(SHOPIFY_STATS.awaitingFulfillment)} icon={FileText} accent="gold" />
        <StatCard
          label="Paniers à récupérer"
          value={`${SHOPIFY_STATS.abandonedCheckoutsValue.toFixed(0)} $`}
          deltaLabel={`${SHOPIFY_STATS.abandonedCheckoutsCount} paniers`}
          icon={Package}
          accent="gold"
        />
      </div>

      <TodayWidget />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-zinc-900">Commandes récentes <span className="text-xs text-zinc-400 font-normal">(Shopify live)</span></h2>
            <Link
              to="/admin/orders"
              aria-label="Voir toutes les commandes"
              className="text-xs font-semibold text-[#0052CC] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded"
            >
              Voir tout →
            </Link>
          </div>
          <div className="divide-y divide-zinc-100">
            {recentOrders.map(order => {
              const date = new Date(order.createdAt);
              const relTime = (() => {
                // Clamp to 0 — order.createdAt can be a few seconds
                // ahead of the browser clock (NTP drift) and would
                // render "il y a -1h" otherwise.
                const diff = Math.max(0, Date.now() - date.getTime());
                const mins = Math.floor(diff / 60000);
                if (mins < 60) return mins < 1 ? "à l'instant" : `il y a ${mins} min`;
                const h = Math.floor(mins / 60);
                if (h < 24) return `il y a ${h}h`;
                return `il y a ${Math.floor(h / 24)}j`;
              })();
              // Refunded / voided orders used to fall through to the
              // 'paid' branch and render a green "Payé" badge on the
              // dashboard — misleading for the admin trying to spot
              // which orders actually have money in the bank.
              const statusKey = order.fulfillmentStatus === 'fulfilled'
                ? 'fulfilled'
                : order.financialStatus === 'refunded' || order.financialStatus === 'partially_refunded'
                  ? 'refunded'
                  : order.financialStatus === 'voided'
                    ? 'voided'
                    : order.financialStatus === 'pending'
                      ? 'pending'
                      : order.financialStatus === 'paid' && !order.fulfillmentStatus
                        ? 'awaiting'
                        : 'paid';
              const statusLabel = statusKey === 'fulfilled' ? 'Expédié'
                : statusKey === 'pending' ? 'En attente'
                : statusKey === 'awaiting' ? 'À expédier'
                : statusKey === 'refunded' ? 'Remboursé'
                : statusKey === 'voided' ? 'Annulé'
                : 'Payé';
              return (
                <div key={order.id} className="py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{order.name}</div>
                    <div className="text-xs text-zinc-500 truncate">{order.customerName.trim() || order.email}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm">{order.total.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $</div>
                    <div className="text-[10px] text-zinc-500">{relTime}</div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-md whitespace-nowrap ${STATUS_COLORS[statusKey]}`}>
                    {statusLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-white border border-zinc-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-zinc-900 text-sm">Zapier ⇄ Shopify</h2>
              <TrendingUp size={16} className="text-emerald-600" aria-hidden="true" />
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Boutique</span>
                <span className="font-bold font-mono text-[11px]">visionaffichage-com</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Commandes synchronisées</span>
                <span className="font-bold">{SHOPIFY_ORDERS_SNAPSHOT.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Paiements en attente</span>
                <span className="font-bold text-amber-700">{SHOPIFY_STATS.pendingPayments}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Dernière sync</span>
                <span className="font-bold">{new Date(SHOPIFY_SNAPSHOT_META.syncedAt).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#0F2341] to-[#1B3A6B] text-white rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                <AlertCircle size={18} aria-hidden="true" />
              </div>
              <div>
                <div className="font-bold text-sm mb-1">Stock faible</div>
                <div className="text-xs text-white/70 mb-3">3 produits ont un inventaire sous 10 unités.</div>
                <Link
                  to="/admin/products?filter=low-stock"
                  className="text-[11px] font-bold text-[#E8A838] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2341] rounded"
                >
                  Voir les produits →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ActivityFeed />
    </div>
  );
}
