import { memo, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ShoppingCart, Clock, Package, ArrowRight } from 'lucide-react';
import {
  SHOPIFY_ORDERS_SNAPSHOT,
  SHOPIFY_ABANDONED_CHECKOUTS_SNAPSHOT,
  SHOPIFY_STATS,
} from '@/data/shopifySnapshot';

interface ActionItem {
  id: string;
  label: string;
  detail: string;
  href: string;
  icon: typeof AlertCircle;
  priority: 'urgent' | 'normal' | 'low';
}

function TodayWidgetInner() {
  // Data is imported from a static snapshot, so the computation below
  // has zero runtime inputs — compute once per mount via useMemo and
  // skip the work on every subsequent render (sidebar toggle, nav,
  // etc.).
  const items = useMemo<ActionItem[]>(() => {
    const acc: ActionItem[] = [];

  // Pending payments — urgent
  const pendingOrders = SHOPIFY_ORDERS_SNAPSHOT.filter(o => o.financialStatus === 'pending');
  if (pendingOrders.length > 0) {
    const total = pendingOrders.reduce((s, o) => s + o.total, 0);
    acc.push({
      id: 'pending-payments',
      label: `${pendingOrders.length} paiement${pendingOrders.length > 1 ? 's' : ''} en attente`,
      detail: `${total.toFixed(2)} $ à confirmer`,
      href: '/admin/orders?filter=pending',
      icon: AlertCircle,
      priority: 'urgent',
    });
  }

  // Awaiting fulfillment
  if (SHOPIFY_STATS.awaitingFulfillment > 0) {
    acc.push({
      id: 'fulfill',
      label: `${SHOPIFY_STATS.awaitingFulfillment} commande${SHOPIFY_STATS.awaitingFulfillment > 1 ? 's' : ''} à expédier`,
      detail: 'Production prête, à étiqueter',
      href: '/admin/orders?filter=awaiting',
      icon: Package,
      priority: 'normal',
    });
  }

  // High-value abandoned carts (≥ 200 $)
  const highValueAbandoned = SHOPIFY_ABANDONED_CHECKOUTS_SNAPSHOT.filter(c => c.total >= 200);
  if (highValueAbandoned.length > 0) {
    const total = highValueAbandoned.reduce((s, c) => s + c.total, 0);
    acc.push({
      id: 'recover-abandoned',
      label: `${highValueAbandoned.length} panier${highValueAbandoned.length > 1 ? 's' : ''} à récupérer`,
      detail: `${total.toFixed(0)} $ en valeur (≥ 200 $/panier)`,
      href: '/admin/abandoned-carts',
      icon: ShoppingCart,
      priority: 'normal',
    });
  }

  // Inactive prospects (no order in last 7d)
  const inactiveProspects = SHOPIFY_STATS.totalCustomers - SHOPIFY_STATS.payingCustomers;
  if (inactiveProspects > 5) {
    acc.push({
      id: 'nurture',
      label: `${inactiveProspects} prospects sans commande`,
      detail: 'Considérer une séquence de nurturing',
      href: '/admin/customers?filter=prospects',
      icon: Clock,
      priority: 'low',
    });
  }
    return acc;
  }, []);

  if (items.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
        <div className="text-4xl mb-2">✨</div>
        <div className="font-bold text-emerald-900">Tout est à jour</div>
        <div className="text-xs text-emerald-700 mt-1">Aucune action requise pour le moment.</div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-zinc-100 bg-gradient-to-r from-[#0F2341] to-[#1B3A6B]">
        <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">À faire aujourd'hui</div>
        <div className="text-sm font-extrabold text-white mt-0.5">{items.length} action{items.length > 1 ? 's' : ''} prioritaire{items.length > 1 ? 's' : ''}</div>
      </div>
      <div className="divide-y divide-zinc-100">
        {items.map(item => {
          const Icon = item.icon;
          const tone = {
            urgent: 'bg-rose-50 text-rose-700',
            normal: 'bg-amber-50 text-amber-700',
            low: 'bg-blue-50 text-blue-700',
          }[item.priority];
          return (
            <Link
              key={item.id}
              to={item.href}
              className="flex items-center gap-3 p-4 hover:bg-zinc-50 transition-colors group"
            >
              <div className={`w-9 h-9 rounded-xl ${tone} flex items-center justify-center flex-shrink-0`}>
                <Icon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{item.label}</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">{item.detail}</div>
              </div>
              <ArrowRight size={14} className="text-zinc-300 group-hover:text-[#0052CC] transition-colors" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// React.memo keeps the dashboard parent from re-rendering the whole
// action list when an unrelated piece of state flips (sidebar open,
// nav link click, etc.).
export const TodayWidget = memo(TodayWidgetInner);
