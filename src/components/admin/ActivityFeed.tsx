import { Link } from 'react-router-dom';
import { ShoppingBag, ShoppingCart, UserPlus, AlertCircle } from 'lucide-react';
import { memo, useMemo } from 'react';
import {
  SHOPIFY_ORDERS_SNAPSHOT,
  SHOPIFY_ABANDONED_CHECKOUTS_SNAPSHOT,
  SHOPIFY_CUSTOMERS_SNAPSHOT,
} from '@/data/shopifySnapshot';

interface ActivityItem {
  id: string;
  ts: number;
  icon: typeof ShoppingBag;
  iconColor: string;
  iconBg: string;
  title: string;
  detail: string;
  href: string;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}j`;
}

function ActivityFeedInner() {
  const items = useMemo<ActivityItem[]>(() => {
    const all: ActivityItem[] = [];

    SHOPIFY_ORDERS_SNAPSHOT.forEach(o => {
      all.push({
        id: `order-${o.id}`,
        ts: new Date(o.createdAt).getTime(),
        icon: ShoppingBag,
        iconColor: 'text-emerald-700',
        iconBg: 'bg-emerald-50',
        title: `Nouvelle commande ${o.name}`,
        detail: `${o.customerName.trim() || o.email} · ${o.total.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $`,
        href: '/admin/orders',
      });
    });

    SHOPIFY_ABANDONED_CHECKOUTS_SNAPSHOT.forEach(c => {
      all.push({
        id: `abandoned-${c.id}`,
        ts: new Date(c.createdAt).getTime(),
        icon: ShoppingCart,
        iconColor: 'text-amber-700',
        iconBg: 'bg-amber-50',
        title: 'Panier abandonné',
        detail: `${c.customerName.trim() || c.email} · ${c.total.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $`,
        href: '/admin/abandoned-carts',
      });
    });

    SHOPIFY_CUSTOMERS_SNAPSHOT.forEach(c => {
      all.push({
        id: `customer-${c.id}`,
        ts: new Date(c.createdAt).getTime(),
        icon: UserPlus,
        iconColor: 'text-blue-700',
        iconBg: 'bg-blue-50',
        title: 'Nouveau client',
        detail: `${[c.firstName, c.lastName].filter(Boolean).join(' ') || c.email}${c.city ? ` · ${c.city}` : ''}`,
        href: '/admin/customers',
      });
    });

    return all.sort((a, b) => b.ts - a.ts).slice(0, 12);
  }, []);

  if (items.length === 0) {
    return (
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 text-center" role="status">
        <AlertCircle size={20} className="text-zinc-400 mx-auto mb-2" aria-hidden="true" />
        <div className="text-sm text-zinc-500">Aucune activité récente</div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold">Activité récente</h2>
        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </span>
      </div>
      <div className="space-y-1 max-h-[480px] overflow-y-auto -mx-2">
        {items.map(item => {
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              to={item.href}
              className="flex items-start gap-3 px-2 py-2.5 rounded-lg hover:bg-zinc-50 transition-colors group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
            >
              <div className={`w-8 h-8 rounded-lg ${item.iconBg} ${item.iconColor} flex items-center justify-center flex-shrink-0`}>
                <Icon size={14} aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{item.title}</div>
                <div className="text-[11px] text-zinc-500 truncate">{item.detail}</div>
              </div>
              <div className="text-[10px] text-zinc-400 whitespace-nowrap font-medium pt-1">
                {relativeTime(item.ts)}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// React.memo so the feed isn't re-rendered when a sibling widget's
// state changes. Zero props so the shallow compare is always a hit.
export const ActivityFeed = memo(ActivityFeedInner);
