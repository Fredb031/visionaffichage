import { Link } from 'react-router-dom';
import { ShoppingBag, ShoppingCart, UserPlus, AlertCircle, ChevronDown } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';
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

// How many items to show before the admin clicks "Voir plus".
// 20 balances "see a meaningful slice of the day" with "don't
// drown a quiet dashboard in a wall of customer signups".
const INITIAL_VISIBLE = 20;

// Group label for an activity timestamp. We bucket into four
// human-readable bins instead of showing 30 identical "14 avr."
// headers for a busy week. Older entries get an absolute date so
// admins can still anchor themselves in time.
function groupLabel(ts: number, now: number): string {
  const d = new Date(ts);
  const n = new Date(now);
  const startOfDay = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  // Subtract days via the Date constructor rather than fixed 86_400_000-ms
  // arithmetic. In America/Toronto (Quebec) DST transitions make some
  // calendar days 23h or 25h long, which would otherwise mis-bucket
  // "Hier" as "Cette semaine" (or vice-versa) twice a year.
  const today = startOfDay(n);
  const yesterday = new Date(n.getFullYear(), n.getMonth(), n.getDate() - 1).getTime();
  const weekAgo = new Date(n.getFullYear(), n.getMonth(), n.getDate() - 6).getTime();
  const entry = startOfDay(d);
  if (entry === today) return "Aujourd'hui";
  if (entry === yesterday) return 'Hier';
  if (entry > weekAgo) return 'Cette semaine';
  try {
    return d.toLocaleDateString('fr-CA', {
      day: 'numeric',
      month: 'long',
      year: d.getFullYear() === n.getFullYear() ? undefined : 'numeric',
    });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function relativeTime(ts: number): string {
  // Clamp so a Shopify ts a few seconds ahead of the browser clock
  // doesn't render "-1 min" / "-1h" in the activity feed.
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60000);
  // Sub-minute events read more naturally as "à l'instant" than
  // "0 min" — the bare zero suggests stale data ("0 min ago? did
  // anything happen?") instead of "just now".
  if (m < 1) return "à l'instant";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}j`;
}

// Full fr-CA timestamp for the hover tooltip so admins can see the
// exact moment behind the relative label ("5 min" → "20 avril 2026, 14:32").
function absoluteTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString('fr-CA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return new Date(ts).toISOString();
  }
}

function ActivityFeedInner() {
  // Tick every 60s so "à l'instant" / "5 min" / "2h" labels actually
  // update while an admin keeps the dashboard open. The component is
  // wrapped in memo() below, so without this forced re-render the
  // relative timestamps stayed frozen at the values from the first
  // paint — a dashboard left open for an hour still read "à l'instant".
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick(t => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const [expanded, setExpanded] = useState(false);

  const items = useMemo<ActivityItem[]>(() => {
    const all: ActivityItem[] = [];

    // Parse a Shopify ISO timestamp into a millisecond epoch, returning
    // null on anything we can't trust. Without this guard a malformed
    // `createdAt` (missing field, future API rename, manual fixture
    // typo) yields NaN, which then poisons groupLabel/relativeTime —
    // `new Date(NaN).toLocaleDateString` throws RangeError and crashes
    // the entire dashboard tile, hiding the rest of the feed too.
    const parseTs = (raw: unknown): number | null => {
      if (typeof raw !== 'string' || raw.length === 0) return null;
      const t = new Date(raw).getTime();
      return Number.isFinite(t) ? t : null;
    };

    SHOPIFY_ORDERS_SNAPSHOT.forEach(o => {
      const ts = parseTs(o.createdAt);
      if (ts === null) return;
      all.push({
        id: `order-${o.id}`,
        ts,
        icon: ShoppingBag,
        iconColor: 'text-emerald-700',
        iconBg: 'bg-emerald-50',
        title: `Nouvelle commande ${o.name}`,
        detail: `${o.customerName.trim() || o.email} · ${o.total.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $`,
        href: '/admin/orders',
      });
    });

    SHOPIFY_ABANDONED_CHECKOUTS_SNAPSHOT.forEach(c => {
      const ts = parseTs(c.createdAt);
      if (ts === null) return;
      all.push({
        id: `abandoned-${c.id}`,
        ts,
        icon: ShoppingCart,
        iconColor: 'text-amber-700',
        iconBg: 'bg-amber-50',
        title: 'Panier abandonné',
        detail: `${c.customerName.trim() || c.email} · ${c.total.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $`,
        href: '/admin/abandoned-carts',
      });
    });

    SHOPIFY_CUSTOMERS_SNAPSHOT.forEach(c => {
      const ts = parseTs(c.createdAt);
      if (ts === null) return;
      all.push({
        id: `customer-${c.id}`,
        ts,
        icon: UserPlus,
        iconColor: 'text-blue-700',
        iconBg: 'bg-blue-50',
        title: 'Nouveau client',
        detail: `${[c.firstName, c.lastName].filter(Boolean).join(' ') || c.email}${c.city ? ` · ${c.city}` : ''}`,
        href: '/admin/customers',
      });
    });

    // Keep a larger working set than we display so the "Voir plus"
    // button has something to reveal. The feed is in-memory data,
    // so the cost is negligible.
    return all.sort((a, b) => b.ts - a.ts).slice(0, 60);
  }, []);

  const visibleItems = expanded ? items : items.slice(0, INITIAL_VISIBLE);

  // Group visible items by day bucket while preserving the sorted
  // (newest-first) order. Using a plain array of [label, items]
  // rather than a Map so React can key on index and the order of
  // insertion is stable.
  const groups = useMemo<Array<[string, ActivityItem[]]>>(() => {
    const now = Date.now();
    const out: Array<[string, ActivityItem[]]> = [];
    for (const item of visibleItems) {
      const label = groupLabel(item.ts, now);
      const last = out[out.length - 1];
      if (last && last[0] === label) {
        last[1].push(item);
      } else {
        out.push([label, [item]]);
      }
    }
    return out;
  }, [visibleItems]);

  const hiddenCount = Math.max(0, items.length - INITIAL_VISIBLE);

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
      <div className="max-h-[480px] overflow-y-auto -mx-2">
        {groups.map(([label, groupItems]) => (
          <div key={label} className="mb-2 last:mb-0">
            <div className="px-2 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              {label}
            </div>
            <div className="space-y-1">
              {groupItems.map(item => {
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
                    <time
                      dateTime={new Date(item.ts).toISOString()}
                      title={absoluteTime(item.ts)}
                      className="text-[10px] text-zinc-400 whitespace-nowrap font-medium pt-1"
                    >
                      {relativeTime(item.ts)}
                    </time>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
        {hiddenCount > 0 && !expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-semibold text-[#0052CC] hover:bg-zinc-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
            aria-label={`Voir ${hiddenCount} activités de plus`}
          >
            <ChevronDown size={14} aria-hidden="true" />
            Voir plus ({hiddenCount})
          </button>
        )}
      </div>
    </div>
  );
}

// React.memo so the feed isn't re-rendered when a sibling widget's
// state changes. Zero props so the shallow compare is always a hit.
export const ActivityFeed = memo(ActivityFeedInner);
