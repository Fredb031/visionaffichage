import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, DollarSign, Package, Users, ShoppingBag, Download } from 'lucide-react';
import { toast } from 'sonner';
import {
  SHOPIFY_ORDERS_SNAPSHOT,
  SHOPIFY_CUSTOMERS_SNAPSHOT,
  SHOPIFY_PRODUCTS_SNAPSHOT,
  SHOPIFY_ABANDONED_CHECKOUTS_SNAPSHOT,
  SHOPIFY_STATS,
} from '@/data/shopifySnapshot';
import { StatCard } from '@/components/admin/StatCard';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { downloadCsv as downloadCsvBlob, csvFilename } from '@/lib/csv';
import { useAuthStore } from '@/stores/authStore';
import { hasPermission } from '@/lib/permissions';

// ---------------------------------------------------------------------------
// Date-range segmented picker
//
// The page is driven by a static Shopify snapshot that still carries real
// per-order `createdAt` timestamps, so we can slice the dataset
// client-side without a round-trip. Four presets cover every question an
// admin asks without a free-form date picker (which would need a calendar
// widget + URL sync — out of scope for a self-contained tweak).
//
// "annuel" = calendar YTD. January 1st local → now. `90j` / `30j` / `7j`
// are rolling windows ending "now". Selection is persisted under
// localStorage['va:analytics-range'] so the last choice survives a hard
// refresh; the key is namespaced (`va:`) so it plays nicely with the
// other analytics/settings keys on the admin surface.
// ---------------------------------------------------------------------------
type RangeKey = '7j' | '30j' | '90j' | 'annuel';

const RANGE_OPTIONS: ReadonlyArray<{ key: RangeKey; label: string; days: number | 'ytd' }> = [
  { key: '7j',     label: '7j',      days: 7   },
  { key: '30j',    label: '30j',     days: 30  },
  { key: '90j',    label: '90j',     days: 90  },
  { key: 'annuel', label: 'Annuel',  days: 'ytd' },
];

const RANGE_STORAGE_KEY = 'va:analytics-range';

// Resolve the [start, end) window for a given range anchored at `now`
// (local time). End is "right now" and is exclusive of future orders
// (snapshot shouldn't contain any, but it's a cheap guard).
function rangeWindow(key: RangeKey, now: Date = new Date()): { start: Date; end: Date } {
  const end = now;
  if (key === 'annuel') {
    return { start: new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0), end };
  }
  const days = key === '7j' ? 7 : key === '30j' ? 30 : 90;
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

// Read the persisted range; guarded against SSR + invalid legacy values
// so a manually-edited localStorage doesn't crash the whole page.
function readPersistedRange(): RangeKey {
  if (typeof window === 'undefined') return '30j';
  try {
    const raw = window.localStorage.getItem(RANGE_STORAGE_KEY);
    if (raw && RANGE_OPTIONS.some(o => o.key === raw)) return raw as RangeKey;
  } catch {
    // private-browsing + quota errors — fall back silently to default
  }
  return '30j';
}

// Thin wrapper around the shared CSV helper that also pops a success
// toast. The lib/csv.ts builder is UI-agnostic (it'll be reused by
// headless exporters in commissions.ts + future admin reports), so
// the toast stays here where the page already owns sonner.
function exportCsv(rows: ReadonlyArray<ReadonlyArray<unknown>>, slug: string, toastLabel: string): void {
  downloadCsvBlob(rows, csvFilename(slug));
  toast.success(toastLabel);
}

// Verbatim copy of the AdminOrders CSV-injection guard — the page-level
// "Exporter CSV" action uses its own builder (not lib/csv) because the
// spec wants the filename `analytics-YYYY-MM-DD.csv` without the shared
// `vision-` prefix and wants the per-section exporters left untouched.
const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;
const csvEscape = (v: unknown) => {
  let s = String(v ?? '');
  if (FORMULA_TRIGGERS.test(s)) s = '\t' + s;
  // Wrap when the value contains a delimiter/quote/newline OR when we
  // prefixed a tab above (defensive — a bare leading tab in a field
  // confuses Numbers.app's CSV auto-detect). Double inner quotes.
  return /[",\n\r\t]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Format a Date as fr-CA (YYYY-MM-DD). The CSV spec calls for fr-CA
// dates; Intl with fr-CA returns dashed ISO which is what finance
// expects, but `toLocaleDateString` in Safari-old can format weirdly —
// build the string by hand to be safe.
function frCaDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Bucket orders by LOCAL day, not UTC. toISOString() drifts orders
// placed in the evening (America/Toronto is -04/-05) into the next day
// and the `new Date('YYYY-MM-DD')` label then renders as the prior day
// locally — a double off-by-one that mis-labels the bar chart.
function dayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Parse a local YYYY-MM-DD back into a Date in local time (not UTC).
// `new Date('2026-04-16')` is parsed as UTC midnight which shifts the
// weekday label in negative timezones.
function parseDayKeyLocal(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export default function AdminAnalytics() {
  useDocumentTitle('Analytique — Admin Vision Affichage');
  // Gate the export buttons on the same permission used by the other
  // admin CSV exports (AdminVendors, VendorDashboard). A salesman who
  // lost orders:read via an override shouldn't walk away with a CSV of
  // the 14-day revenue chart. Button stays mounted so screen readers
  // can still announce the page structure, but the click is a no-op.
  const user = useAuthStore(s => s.user);
  const canExport = Boolean(user && hasPermission(user.role, 'orders:read'));

  // Range state — lazy-init from localStorage so the first paint already
  // reflects the user's last pick (no flicker from default → restored).
  const [range, setRange] = useState<RangeKey>(() => readPersistedRange());
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { window.localStorage.setItem(RANGE_STORAGE_KEY, range); } catch { /* quota */ }
  }, [range]);

  // Compare-to-previous toggle — opt-in so casual viewers aren't
  // bombarded with deltas. Not persisted: it's a transient analysis
  // mode, and pre-checking it would slow the page for everyone.
  const [compare, setCompare] = useState(false);

  const { start: rangeStart, end: rangeEnd } = useMemo(() => rangeWindow(range), [range]);
  // Previous-period window has the same length, ending where the
  // current window starts. For "annuel" we mirror the number of days
  // elapsed YTD against the same run last calendar year (start of prev
  // year → prev year anniversary of today).
  const { prevStart, prevEnd } = useMemo(() => {
    if (range === 'annuel') {
      const prevStart = new Date(rangeStart.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
      const prevEnd = new Date(rangeEnd);
      prevEnd.setFullYear(prevEnd.getFullYear() - 1);
      return { prevStart, prevEnd };
    }
    const lengthMs = rangeEnd.getTime() - rangeStart.getTime();
    return { prevEnd: rangeStart, prevStart: new Date(rangeStart.getTime() - lengthMs) };
  }, [range, rangeStart, rangeEnd]);

  // Orders whose createdAt falls inside the active window. Kept as a
  // derived memo (rather than inlined) so the stat cards, bar chart,
  // and conversion rate all agree on the filtered set.
  const ordersInRange = useMemo(() => {
    return SHOPIFY_ORDERS_SNAPSHOT.filter(o => {
      const t = new Date(o.createdAt).getTime();
      return t >= rangeStart.getTime() && t <= rangeEnd.getTime();
    });
  }, [rangeStart, rangeEnd]);

  const ordersInPrev = useMemo(() => {
    return SHOPIFY_ORDERS_SNAPSHOT.filter(o => {
      const t = new Date(o.createdAt).getTime();
      return t >= prevStart.getTime() && t < prevEnd.getTime();
    });
  }, [prevStart, prevEnd]);

  const revenueInRange = useMemo(
    () => ordersInRange.reduce((sum, o) => sum + o.total, 0),
    [ordersInRange],
  );
  const revenueInPrev = useMemo(
    () => ordersInPrev.reduce((sum, o) => sum + o.total, 0),
    [ordersInPrev],
  );

  const dailyRevenue = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of ordersInRange) {
      const k = dayKey(o.createdAt);
      map.set(k, (map.get(k) ?? 0) + o.total);
    }
    // Cap very long ranges at 90 bars so the chart stays legible at
    // `annuel` — we show the most recent days in-range.
    const sorted = Array.from(map.entries()).sort(([a], [b]) => (a < b ? -1 : 1));
    return sorted.slice(-90);
  }, [ordersInRange]);

  const maxRevenue = Math.max(...dailyRevenue.map(([, v]) => v), 1);

  // Active range metadata (label + days-used) pulled once per render so
  // the header/export use the same string the picker displays.
  const activeRange = RANGE_OPTIONS.find(r => r.key === range) ?? RANGE_OPTIONS[1];
  // Pct delta helper. Guard against prev=0 (can't divide) by returning
  // null — call sites render an em-dash instead of Infinity.
  const pctDelta = (cur: number, prev: number): number | null => {
    if (prev === 0) return null;
    return ((cur - prev) / prev) * 100;
  };

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

  // Count abandoned carts whose createdAt falls inside the active window
  // so the conversion rate matches the filtered order count (otherwise
  // the rate would drift up spuriously for short ranges).
  const abandonedInRange = useMemo(() => {
    return SHOPIFY_ABANDONED_CHECKOUTS_SNAPSHOT.filter(c => {
      const t = new Date(c.createdAt).getTime();
      return t >= rangeStart.getTime() && t <= rangeEnd.getTime();
    });
  }, [rangeStart, rangeEnd]);

  const abandonedInPrev = useMemo(() => {
    return SHOPIFY_ABANDONED_CHECKOUTS_SNAPSHOT.filter(c => {
      const t = new Date(c.createdAt).getTime();
      return t >= prevStart.getTime() && t < prevEnd.getTime();
    });
  }, [prevStart, prevEnd]);

  const conversionRate = useMemo(() => {
    const ordered = ordersInRange.length;
    const abandoned = abandonedInRange.length;
    if (ordered + abandoned === 0) return 0;
    return Math.round((ordered / (ordered + abandoned)) * 100);
  }, [ordersInRange, abandonedInRange]);

  const conversionRatePrev = useMemo(() => {
    const ordered = ordersInPrev.length;
    const abandoned = abandonedInPrev.length;
    if (ordered + abandoned === 0) return 0;
    return Math.round((ordered / (ordered + abandoned)) * 100);
  }, [ordersInPrev, abandonedInPrev]);

  // Page-level "Exporter CSV" — bundles the filtered daily-revenue
  // series (same shape as the per-chart export) so finance can grab
  // the current view in one click. Filename matches the spec
  // (`analytics-YYYY-MM-DD.csv`, no `vision-` prefix); uses the local
  // csvEscape/FORMULA_TRIGGERS copied from AdminOrders so a pasted
  // order note starting with `=` or `@` can't execute on open.
  const handleHeaderExport = () => {
    if (!canExport) {
      toast.error('Permission orders:read requise pour exporter');
      return;
    }
    if (dailyRevenue.length === 0) {
      toast.info('Aucune donnée à exporter pour cette période');
      return;
    }
    const header = ['Date', 'Commandes', 'Revenus'];
    const byDayCount = new Map<string, number>();
    for (const o of ordersInRange) {
      const k = dayKey(o.createdAt);
      byDayCount.set(k, (byDayCount.get(k) ?? 0) + 1);
    }
    const rows = dailyRevenue.map(([day, revenue]) => [
      // fr-CA date (YYYY-MM-DD) — matches AdminOrders locale contract.
      frCaDate(parseDayKeyLocal(day)),
      String(byDayCount.get(day) ?? 0),
      revenue.toFixed(2),
    ]);
    const csv = [header, ...rows].map(r => r.map(csvEscape).join(',')).join('\n');
    // UTF-8 BOM so Excel-on-Windows renders Québécois accents.
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${frCaDate(new Date())}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`${rows.length} jour${rows.length > 1 ? 's' : ''} exporté${rows.length > 1 ? 's' : ''}`);
  };

  const revenueDelta = pctDelta(revenueInRange, revenueInPrev);
  const conversionDelta = pctDelta(conversionRate, conversionRatePrev);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Analytique</h1>
          <p className="text-sm text-zinc-500 mt-1">Vue d'ensemble basée sur tes vraies données Shopify</p>
        </div>
        <button
          type="button"
          onClick={handleHeaderExport}
          disabled={!canExport || dailyRevenue.length === 0}
          className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 border border-zinc-200 rounded-lg hover:bg-zinc-50 bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
          title={canExport ? `Exporter l'analytique (${activeRange.label}) en CSV` : 'Permission requise'}
          aria-label="Exporter l'analytique en CSV"
        >
          <Download size={14} aria-hidden="true" />
          Exporter CSV
        </button>
      </header>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex border border-zinc-200 rounded-lg overflow-hidden bg-white" role="radiogroup" aria-label="Période d'analyse">
          {RANGE_OPTIONS.map(opt => {
            const active = range === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setRange(opt.key)}
                className={`px-3 py-1.5 text-xs font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-inset ${active ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50'}`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <label className="inline-flex items-center gap-2 text-xs font-bold text-zinc-600 select-none cursor-pointer">
          <input
            type="checkbox"
            checked={compare}
            onChange={e => setCompare(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-[#0052CC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
          />
          Comparer à la période précédente
        </label>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={`Revenus ${activeRange.label}`}
          value={`${revenueInRange.toLocaleString('fr-CA', { maximumFractionDigits: 0 })} $`}
          delta={compare && revenueDelta !== null ? revenueDelta : undefined}
          deltaLabel={compare ? 'vs période précédente' : undefined}
          icon={DollarSign}
          accent="green"
        />
        <StatCard
          label="Taux conversion"
          value={`${conversionRate}%`}
          delta={compare && conversionDelta !== null ? conversionDelta : undefined}
          deltaLabel={compare ? 'vs période précédente' : 'commandes vs paniers'}
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
          <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
            <h2 id="daily-revenue-heading" className="font-bold">Revenus quotidiens</h2>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">{activeRange.label}</span>
              <button
                type="button"
                onClick={() => {
                  if (!canExport) {
                    toast.error('Permission orders:read requise pour exporter');
                    return;
                  }
                  if (dailyRevenue.length === 0) {
                    toast.info('Aucune donnée à exporter');
                    return;
                  }
                  exportCsv(
                    [['Date', 'Revenus'], ...dailyRevenue.map(([day, revenue]) => [day, revenue.toFixed(2)])],
                    'revenus-quotidiens',
                    `${dailyRevenue.length} jour${dailyRevenue.length > 1 ? 's' : ''} exporté${dailyRevenue.length > 1 ? 's' : ''}`,
                  );
                }}
                disabled={!canExport || dailyRevenue.length === 0}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 border border-zinc-200 rounded-md hover:bg-zinc-50 bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
                title={canExport ? 'Exporter les revenus quotidiens en CSV' : 'Permission requise'}
                aria-label="Télécharger CSV des revenus quotidiens"
              >
                <Download size={12} aria-hidden="true" />
                Télécharger CSV
              </button>
            </div>
          </div>
          {dailyRevenue.length === 0 ? (
            // Snapshot empty (no orders yet) — render a labelled empty state
            // instead of a bare h-48 box. Otherwise the role='list' is
            // empty (invalid per WAI-ARIA, must contain ≥1 listitem) and
            // the chart looks broken instead of just unfilled.
            <div className="flex items-center justify-center h-48 text-sm text-zinc-400" role="status">
              Aucune commande sur cette période
            </div>
          ) : (
            <div className="flex items-end gap-1.5 h-48" role="list">
              {dailyRevenue.map(([day, revenue]) => {
                const heightPct = (revenue / maxRevenue) * 100;
                const date = parseDayKeyLocal(day);
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
          )}
        </section>

        <section className="bg-white border border-zinc-200 rounded-2xl p-5" aria-labelledby="top-customers-heading">
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <h2 id="top-customers-heading" className="font-bold">Top clients</h2>
            <button
              type="button"
              onClick={() => {
                if (!canExport) {
                  toast.error('Permission orders:read requise pour exporter');
                  return;
                }
                if (topCustomers.length === 0) {
                  toast.info('Aucune donnée à exporter');
                  return;
                }
                exportCsv(
                  [
                    ['Rang', 'Prénom', 'Nom', 'Courriel', 'Total dépensé'],
                    ...topCustomers.map((c, i) => [
                      String(i + 1),
                      c.firstName ?? '',
                      c.lastName ?? '',
                      c.email,
                      c.totalSpent.toFixed(2),
                    ]),
                  ],
                  'top-clients',
                  `${topCustomers.length} client${topCustomers.length > 1 ? 's' : ''} exporté${topCustomers.length > 1 ? 's' : ''}`,
                );
              }}
              disabled={!canExport || topCustomers.length === 0}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 border border-zinc-200 rounded-md hover:bg-zinc-50 bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
              title={canExport ? 'Exporter le top clients en CSV' : 'Permission requise'}
              aria-label="Télécharger CSV du top clients"
            >
              <Download size={12} aria-hidden="true" />
              Télécharger CSV
            </button>
          </div>
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
        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <h2 id="catalog-breakdown-heading" className="font-bold">Catalogue par type de produit</h2>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">{SHOPIFY_PRODUCTS_SNAPSHOT.length} produit{SHOPIFY_PRODUCTS_SNAPSHOT.length > 1 ? 's' : ''} actif{SHOPIFY_PRODUCTS_SNAPSHOT.length > 1 ? 's' : ''}</span>
            <button
              type="button"
              onClick={() => {
                if (!canExport) {
                  toast.error('Permission orders:read requise pour exporter');
                  return;
                }
                if (productTypeRevenue.length === 0) {
                  toast.info('Aucune donnée à exporter');
                  return;
                }
                exportCsv(
                  [
                    ['Type de produit', 'Nombre de produits', 'Revenus min. cumulés', 'Prix moyen min.'],
                    ...productTypeRevenue.map(t => [
                      t.type,
                      String(t.count),
                      t.revenue.toFixed(2),
                      (t.revenue / Math.max(t.count, 1)).toFixed(2),
                    ]),
                  ],
                  'catalogue-par-type',
                  `${productTypeRevenue.length} type${productTypeRevenue.length > 1 ? 's' : ''} exporté${productTypeRevenue.length > 1 ? 's' : ''}`,
                );
              }}
              disabled={!canExport || productTypeRevenue.length === 0}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 border border-zinc-200 rounded-md hover:bg-zinc-50 bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
              title={canExport ? 'Exporter le catalogue par type en CSV' : 'Permission requise'}
              aria-label="Télécharger CSV du catalogue par type"
            >
              <Download size={12} aria-hidden="true" />
              Télécharger CSV
            </button>
          </div>
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
