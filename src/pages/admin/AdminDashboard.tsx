import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingBag,
  DollarSign,
  FileText,
  Package,
  TrendingUp,
  AlertCircle,
  ShoppingCart,
  ChevronRight,
  Shield,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';
import { StatCard } from '@/components/admin/StatCard';
import { TodayWidget } from '@/components/admin/TodayWidget';
import {
  SHOPIFY_ORDERS_SNAPSHOT,
  SHOPIFY_PRODUCTS_SNAPSHOT,
  SHOPIFY_STATS,
  SHOPIFY_SNAPSHOT_META,
  SHOPIFY_ABANDONED_CHECKOUTS_SNAPSHOT,
} from '@/data/shopifySnapshot';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getAuditLog, type AuditEntry } from '@/lib/auditLog';
import { useAppSettings, getUser2faMap } from '@/lib/appSettings';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';

const STATUS_COLORS: Record<string, string> = {
  paid: 'bg-emerald-100 text-emerald-800',
  pending: 'bg-amber-50 text-amber-700',
  fulfilled: 'bg-emerald-50 text-emerald-700',
  awaiting: 'bg-blue-50 text-blue-700',
  refunded: 'bg-rose-50 text-rose-700',
  voided: 'bg-zinc-100 text-zinc-700',
};

// Cadence at which relative-time labels ("il y a 5 min") refresh while
// the dashboard stays open. One minute matches the smallest visible
// unit — anything tighter just burns renders without changing pixels.
const RELATIVE_TIME_TICK_MS = 60_000;

// ───────────── Task 9.9 — Activity feed deep-links ─────────────
// Synthesizes recent orders / quotes / abandoned carts into a single
// freshest-first stream and deep-links each row back to its source
// record (with a ?highlight=<id> param so the target page can flash
// the specific row). Capped at 10 so the card stays a glance surface.

type ActivityIcon = typeof ShoppingBag;

interface ActivityItem {
  id: string;
  ts: number;
  icon: ActivityIcon;
  iconColor: string;
  iconBg: string;
  title: string;
  detail: string;
  href: string;
}

function relativeTimeFr(ts: number): string {
  // Clamp so a source ts a few seconds ahead of the browser clock
  // doesn't render "il y a -1 min" (NTP drift / Shopify server clock).
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

// Quotes live in localStorage under `vision-quotes` (same source
// AdminQuotes reads). Defensive per-row try/catch so one corrupted
// entry doesn't hide every quote from the activity feed.
interface StoredQuoteShape {
  id?: string | number;
  number?: string;
  clientName?: string;
  clientEmail?: string;
  total?: number;
  createdAt?: string;
}

function readQuoteActivities(): ActivityItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem('vision-quotes') ?? '[]');
    if (!Array.isArray(raw)) return [];
    const out: ActivityItem[] = [];
    for (const q of raw as StoredQuoteShape[]) {
      try {
        if (!q || typeof q !== 'object') continue;
        const ts = q.createdAt ? new Date(q.createdAt).getTime() : NaN;
        // Skip rows with an unparseable createdAt instead of pinning
        // them to "now" — a fleet of "à l'instant" quotes would
        // dominate the 10-row cap and hide real recent orders.
        if (!Number.isFinite(ts)) continue;
        const email = typeof q.clientEmail === 'string' ? q.clientEmail : '';
        const clientFromEmail = email.includes('@') ? email.split('@')[0] : email;
        const client =
          (typeof q.clientName === 'string' && q.clientName.trim()) || clientFromEmail || '—';
        const total = Number.isFinite(q.total) ? (q.total as number) : 0;
        const number = typeof q.number === 'string' && q.number ? q.number : '—';
        const qid = q.id ?? number;
        out.push({
          id: `quote-${qid}`,
          ts,
          icon: FileText,
          iconColor: 'text-[#0052CC]',
          iconBg: 'bg-blue-50',
          title: `Nouvelle soumission ${number}`,
          detail: `${client} · ${total.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $`,
          href: `/admin/quotes?highlight=${encodeURIComponent(String(qid))}`,
        });
      } catch {
        // Skip this row; keep the rest of the list visible.
      }
    }
    return out;
  } catch {
    return [];
  }
}

function useActivityItems(): ActivityItem[] {
  // Tick every 60s so "à l'instant" / "il y a 5 min" labels actually
  // advance while an admin keeps the dashboard open. Without this
  // the relative timestamps were frozen at the values from first
  // paint — a dashboard left open for an hour still read
  // "à l'instant".
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick(t => t + 1), RELATIVE_TIME_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  return useMemo<ActivityItem[]>(() => {
    const all: ActivityItem[] = [];

    SHOPIFY_ORDERS_SNAPSHOT.forEach(o => {
      // Shopify order.name is "#1570"; highlight param is the bare
      // number so AdminOrders can flash the matching row. Fall back
      // to the raw id for custom-named orders that don't match the
      // "#NNNN" shape.
      const num = o.name.startsWith('#') ? o.name.slice(1) : String(o.id);
      all.push({
        id: `order-${o.id}`,
        ts: new Date(o.createdAt).getTime(),
        icon: ShoppingBag,
        iconColor: 'text-emerald-700',
        iconBg: 'bg-emerald-50',
        title: `Nouvelle commande ${o.name}`,
        detail: `${o.customerName.trim() || o.email} · ${o.total.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $`,
        href: `/admin/orders?highlight=${encodeURIComponent(num)}`,
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
        href: `/admin/abandoned-carts?highlight=${encodeURIComponent(String(c.id))}`,
      });
    });

    for (const q of readQuoteActivities()) all.push(q);

    // Freshest first, capped at 10. Anything older is reachable via
    // the per-section "Voir tout" links — this card is a glance
    // surface, not a full history.
    return all.sort((a, b) => b.ts - a.ts).slice(0, 10);
  }, []);
}

function ActivityFeedCard() {
  const items = useActivityItems();

  if (items.length === 0) {
    return (
      <div
        className="bg-white border border-zinc-200 rounded-2xl p-6 text-center"
        role="status"
      >
        <AlertCircle size={20} className="text-zinc-400 mx-auto mb-2" aria-hidden="true" />
        <div className="text-sm text-zinc-500">Aucune activité récente</div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-zinc-900">Activité récente</h2>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
          <Link
            to="/admin/orders"
            aria-label="Voir toute l'activité"
            className="text-xs font-semibold text-[#0052CC] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded"
          >
            Voir tout →
          </Link>
        </div>
      </div>
      <ul className="divide-y divide-zinc-100 -mx-2">
        {items.map(item => {
          const Icon = item.icon;
          return (
            <li key={item.id}>
              <Link
                to={item.href}
                className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-zinc-50 transition-colors group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
              >
                <div
                  className={`w-8 h-8 rounded-lg ${item.iconBg} ${item.iconColor} flex items-center justify-center flex-shrink-0`}
                >
                  <Icon size={14} aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{item.title}</div>
                  <div className="text-[11px] text-zinc-500 truncate">{item.detail}</div>
                </div>
                <div className="text-[10px] text-zinc-400 whitespace-nowrap font-medium">
                  {relativeTimeFr(item.ts)}
                </div>
                <ChevronRight
                  size={16}
                  className="text-zinc-300 group-hover:text-zinc-500 transition-colors flex-shrink-0"
                  aria-hidden="true"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ───────────── Task 9.19 — Audit log "Historique récent" ─────────────
// Surfaces the last 10 admin actions (mark-shipped, convert-quote,
// settings saves, role changes, …) so an admin can retrace what
// changed without digging through each surface's own history. Hidden
// entirely when the log is empty — a "0 actions" placeholder adds
// noise to a fresh dashboard.

// Human labels per audit action. Falls back to the raw verb for any
// new action a future surface logs without updating this map — so the
// card degrades gracefully instead of showing "undefined".
const AUDIT_ACTION_LABEL: Record<string, string> = {
  'order.mark_shipped': 'Commande expédiée',
  'quote.convert': 'Soumission convertie en commande',
  'settings.save': 'Paramètres enregistrés',
  'user.role_changed': 'Rôle utilisateur modifié',
  'audit.cleared': 'Journal d\'audit vidé',
};

function auditDetailText(entry: AuditEntry): string {
  const d = entry.details ?? {};
  switch (entry.action) {
    case 'order.mark_shipped':
      return typeof d.orderId === 'number' || typeof d.orderId === 'string'
        ? `Commande #${d.orderId}`
        : '';
    case 'quote.convert':
      return typeof d.orderNumber === 'string' ? `→ ${d.orderNumber}` : '';
    case 'settings.save':
      return typeof d.section === 'string' ? `Section : ${d.section}` : '';
    case 'user.role_changed': {
      const from = typeof d.from === 'string' ? d.from : '?';
      const to = typeof d.to === 'string' ? d.to : '?';
      return `${from} → ${to}`;
    }
    default:
      return '';
  }
}

function formatAuditTimestamp(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '—';
  const diff = Math.max(0, Date.now() - t);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `il y a ${days}j`;
  // Past a week the relative label ("il y a 23j") gets harder to scan
  // than a short absolute date — switch to a locale-formatted stamp.
  return new Date(iso).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' });
}

function RecentAuditCard() {
  // Tick every minute so the relative timestamps refresh while the
  // dashboard stays open, same rhythm as ActivityFeedCard.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick(t => t + 1), RELATIVE_TIME_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const entries = useMemo(() => getAuditLog().slice(0, 10), []);
  if (entries.length === 0) return null;

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-bold text-zinc-900">Historique récent</h2>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Dernières actions administratives sur cet appareil.
          </p>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
          Audit
        </span>
      </div>
      <ul className="divide-y divide-zinc-100 -mx-2">
        {entries.map(entry => {
          const label = AUDIT_ACTION_LABEL[entry.action] ?? entry.action;
          const detail = auditDetailText(entry);
          return (
            <li key={entry.id} className="flex items-start gap-3 px-2 py-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#0052CC]/5 text-[#0052CC] flex items-center justify-center flex-shrink-0">
                <Shield size={14} aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{label}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {entry.by}
                  {detail ? <span className="text-zinc-400"> · </span> : null}
                  {detail}
                </div>
              </div>
              <div
                className="text-[10px] text-zinc-400 whitespace-nowrap font-medium"
                title={new Date(entry.at).toLocaleString('fr-CA')}
              >
                {formatAuditTimestamp(entry.at)}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ───────────── Task 9.20 — 2FA enforcement warning banner ─────────────
//
// Surfaces only when the policy toggle `require2fa` is on AND at least
// one admin-tier account hasn't flipped their own 2FA state on yet.
// The per-user state lives in `vision-user-2fa-enabled`; the admin
// roster is the set of Supabase `profiles` rows with role admin or
// president (presidents count — they have the keys to the admin
// surface too, so an unenrolled president is the same risk).
//
// Read directly inside this component rather than relying on the
// AdminUsers cache — the dashboard and the users page live on
// different routes so there's no shared in-memory list to hit.

function TwoFaEnforcementBanner() {
  const settings = useAppSettings();
  const [unenrolledCount, setUnenrolledCount] = useState<number | null>(null);

  useEffect(() => {
    // Skip the query entirely when the policy is off — no point
    // spending a round-trip to decide not to render the banner.
    if (!settings.require2fa) {
      setUnenrolledCount(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, role, active')
          .in('role', ['admin', 'president']);
        if (cancelled) return;
        if (error) {
          // Don't show a stale count — the banner disappears silently
          // on error rather than risking a wrong number nagging admins
          // into chasing down fake holdouts.
          setUnenrolledCount(null);
          return;
        }
        const map = getUser2faMap();
        const missing = (data ?? []).filter(
          (u: { id: string; role: string; active: boolean }) =>
            u.active && map[u.id] !== true,
        ).length;
        setUnenrolledCount(missing);
      } catch {
        if (!cancelled) setUnenrolledCount(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [settings.require2fa]);

  if (!settings.require2fa) return null;
  if (unenrolledCount === null || unenrolledCount <= 0) return null;

  return (
    <div
      role="alert"
      className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3"
    >
      <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
        <ShieldAlert size={18} aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm text-amber-900">
          {unenrolledCount} admin{unenrolledCount > 1 ? 's' : ''} n'
          {unenrolledCount > 1 ? 'ont' : 'a'} pas activé la 2FA — appliquez la politique ?
        </div>
        <p className="text-xs text-amber-800/80 mt-0.5">
          La politique <strong>Exiger la 2FA</strong> est activée mais certains comptes n'ont pas encore
          enrolé leur authentificateur.
        </p>
      </div>
      <Link
        to="/admin/users?filter=admin"
        className="text-xs font-extrabold text-amber-900 underline hover:no-underline whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-1 rounded"
      >
        Voir les admins →
      </Link>
    </div>
  );
}

/** Admin home page — headline metrics, today's priorities, recent orders
 * + activity feed, Shopify sync status, low-stock nudge, and audit log. */
export default function AdminDashboard() {
  useDocumentTitle('Tableau de bord — Admin Vision Affichage');
  const currentUser = useAuthStore(s => s.user);
  // The dashboard pulls from static snapshots + localStorage-memoized
  // widgets, so "refresh" remounts the data-bearing section by bumping
  // a key. Cheaper than threading a refetch signal through every child
  // and matches what an operator expects from a tiny refresh affordance.
  const [refreshKey, setRefreshKey] = useState(0);
  const handleRefresh = useCallback(() => setRefreshKey(k => k + 1), []);
  // Greeting name: prefer the profile's first name, fall back to the
  // email local-part so a freshly-signed-in account without a full_name
  // still gets a human-feeling salutation instead of an empty comma.
  const greetingName = (() => {
    const raw = currentUser?.name?.trim() ?? '';
    if (raw) return raw.split(' ')[0];
    const email = currentUser?.email ?? '';
    return email.includes('@') ? email.split('@')[0] : '';
  })();
  // fr-CA formatter intentionally spells out the weekday + month so the
  // header reads like "lundi 21 avril 2026" — dense enough to anchor
  // the admin's sense of time but still a single line at standard
  // dashboard widths.
  const todayLabel = new Date().toLocaleDateString('fr-CA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const recentOrders = SHOPIFY_ORDERS_SNAPSHOT.slice(0, 6);
  const revenueFmt = SHOPIFY_STATS.revenueLast7Days.toLocaleString('fr-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  // Count from the live snapshot instead of a hardcoded "3". Threshold
  // of 10 matches AdminProducts' lowStock/outOfStock split so both
  // surfaces agree on what "stock faible" means. Includes rupture
  // (inventory <= 0) since those also need admin attention — the card
  // is a "products that need a reorder" pointer, not a strict
  // 1–10-units filter. Hides the card entirely when everything is
  // healthy so admins don't see a stale "0 produits" alert.
  const lowStockCount = SHOPIFY_PRODUCTS_SNAPSHOT.filter(p => p.totalInventory <= 10).length;

  return (
    <div className="space-y-8">
      <header>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight">
              {greetingName ? `Bonjour, ${greetingName}` : 'Tableau de bord'}
            </h1>
            <p className="text-sm text-zinc-500 mt-1 flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Shopify via Zapier
              </span>
              <span className="text-zinc-400">·</span>
              <span>{SHOPIFY_SNAPSHOT_META.shop}</span>
              <span className="text-zinc-400">·</span>
              <span className="capitalize">{todayLabel}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            aria-label="Rafraîchir les données du tableau de bord"
            title="Rafraîchir"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-lg px-3 py-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 flex-shrink-0"
          >
            <RefreshCw size={14} aria-hidden="true" />
            Rafraîchir
          </button>
        </div>
      </header>

      <TwoFaEnforcementBanner />

      <div key={refreshKey} className="contents">

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
              // Reuse the shared helper — inline duplication had drifted
              // from the activity feed copy (same NTP-drift clamp + same
              // bucket boundaries) and any future fix would have to land
              // in two places to stay consistent.
              const relTime = relativeTimeFr(new Date(order.createdAt).getTime());
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

          {lowStockCount > 0 && (
            <div className="bg-gradient-to-br from-[#0F2341] to-[#1B3A6B] text-white rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                  <AlertCircle size={18} aria-hidden="true" />
                </div>
                <div>
                  <div className="font-bold text-sm mb-1">Stock faible</div>
                  <div className="text-xs text-white/70 mb-3">
                    {lowStockCount} produit{lowStockCount > 1 ? 's ont' : ' a'} un inventaire sous 10 unités.
                  </div>
                  <Link
                    to="/admin/products"
                    className="text-[11px] font-bold text-[#E8A838] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2341] rounded"
                  >
                    Voir les produits →
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ActivityFeedCard />

      <RecentAuditCard />

      </div>
    </div>
  );
}
