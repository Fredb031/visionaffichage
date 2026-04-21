import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, Download, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import {
  SHOPIFY_CUSTOMERS_SNAPSHOT,
  SHOPIFY_ORDERS_SNAPSHOT,
  SHOPIFY_STATS,
  type ShopifyCustomerSnapshot,
} from '@/data/shopifySnapshot';
import { StatCard } from '@/components/admin/StatCard';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useSearchHotkey } from '@/hooks/useSearchHotkey';
import { TablePagination } from '@/components/admin/TablePagination';
import { normalizeInvisible } from '@/lib/utils';
import { fmtMoney } from '@/lib/format';
import { plural } from '@/lib/plural';
import { downloadCsv } from '@/lib/csv';

function initials(c: ShopifyCustomerSnapshot): string {
  const first = (c.firstName?.[0] ?? '').toUpperCase();
  const last = (c.lastName?.[0] ?? '').toUpperCase();
  const fallback = c.email[0].toUpperCase();
  return (first + last) || fallback;
}

function fullName(c: ShopifyCustomerSnapshot): string {
  const parts = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
  return parts || c.email.split('@')[0];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Format days-since-last-order into a short FR label. Returns an em-dash when
// no order exists so the column stays visually quiet for prospects.
function formatRecency(days: number | null): string {
  if (days == null) return '—';
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  if (days > 365) return '> 1 an';
  // Routed through plural() so future-locale / "jour"/"jours" swap is a
  // single-line change. Current copy keeps the abbreviated "j" unit, which
  // is invariant — the placeholder only exists to absorb `{count}`.
  return plural(days, { one: 'il y a {count} j', other: 'il y a {count} j' }, 'fr');
}

const PAGE_SIZE = 25;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type CustomerFilter = 'all' | 'paying' | 'prospects';
const VALID_FILTERS: readonly CustomerFilter[] = ['all', 'paying', 'prospects'];

type SortKey = 'default' | 'ltv-desc' | 'ltv-asc';

// Enriched row computed by folding SHOPIFY_ORDERS_SNAPSHOT over each customer
// by email. LTV supersedes the per-customer totalSpent field because orders
// is the authoritative source (totalSpent in the snapshot can lag).
interface EnrichedCustomer extends ShopifyCustomerSnapshot {
  lifetimeValue: number;
  orderCount: number;
  lastOrderAt: string | null;
  daysSinceLastOrder: number | null;
}

/** Generate and download a CSV for the currently filtered customer list.
 * Delegates the RFC-4180 quoting, CSV-injection guard (cells starting
 * with '=' '+' '-' '@' / TAB / CR get a tab prefix), UTF-8 BOM, and
 * CRLF line endings to the shared @/lib/csv helper so every admin
 * export stays in lockstep. Filename + columns are preserved. No
 * currency symbol on totalSpent — keeps the column numeric-parseable. */
function exportCustomersCsv(customers: EnrichedCustomer[]) {
  const header = ['Nom', 'Courriel', 'Téléphone', 'Étiquettes', 'Commandes', 'Total dépensé', 'Inscrit le'];
  const rows = customers.map(c => [
    fullName(c),
    c.email,
    c.phone ?? '',
    // Tags are stored as a comma-separated string in the snapshot; split
    // and re-join with "; " per spec so the column stays readable when
    // the CSV itself uses "," as the delimiter.
    c.tags
      ? c.tags.split(',').map(t => t.trim()).filter(Boolean).join('; ')
      : '',
    String(c.orderCount),
    // No currency symbol — keeps the column numeric-parseable in Excel.
    c.lifetimeValue.toFixed(2),
    formatDate(c.createdAt),
  ]);
  downloadCsv([header, ...rows], `customers-${new Date().toISOString().slice(0, 10)}.csv`);
  toast.success(`${customers.length} client${customers.length > 1 ? 's' : ''} exporté${customers.length > 1 ? 's' : ''}`);
}

export default function AdminCustomers() {
  // Read initial state from URL params so reload/share preserves the
  // admin's view. ?q=... ?filter=... — defaults to '' and 'all'. Coerce
  // the filter against the union to defend against hand-edited URLs.
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const initialFilterRaw = searchParams.get('filter') ?? 'all';
  const initialFilter: CustomerFilter = (VALID_FILTERS as readonly string[]).includes(initialFilterRaw)
    ? (initialFilterRaw as CustomerFilter)
    : 'all';

  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<CustomerFilter>(initialFilter);
  const [page, setPage] = useState(0);
  // Clicking the LTV header cycles default → desc → asc → default so an
  // admin can compare top spenders or find the long-tail cheapskates.
  const [sort, setSort] = useState<SortKey>('default');
  const navigate = useNavigate();
  // Cmd+K focuses the search input; Esc clears + blurs while focused.
  const searchRef = useSearchHotkey({ onClear: () => setQuery('') });
  // Distinct admin tab title — admins routinely have multiple admin
  // tabs open and the bare 'Vision Affichage' from index.html made
  // them indistinguishable in the strip.
  useDocumentTitle('Clients — Admin Vision Affichage');

  // Reset pagination when the filter or search changes — otherwise
  // filtering to 3 prospects while on page 5 shows an empty table.
  useEffect(() => { setPage(0); }, [query, filter]);

  // Sync state → URL with `replace: true` so each keystroke / filter
  // click doesn't pollute the back-stack. Reload now lands the admin
  // exactly where they were instead of resetting search and filter.
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    const trimmed = query.trim();
    if (trimmed) next.set('q', trimmed); else next.delete('q');
    if (filter !== 'all') next.set('filter', filter); else next.delete('filter');
    // Avoid a no-op setSearchParams that still appends a history entry.
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [query, filter, searchParams, setSearchParams]);

  // Track the resync delay so unmounting (route change between click and
  // the 400ms reload) cancels the pending location.reload — without this
  // the user would navigate to e.g. /admin/orders, then 400ms later get
  // yanked back to /admin/customers when the reload fires.
  const resyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (resyncTimerRef.current) clearTimeout(resyncTimerRef.current);
    };
  }, []);

  // Fold orders into a by-email index once — rebuilding this per row would
  // be O(n·m). Gives us LTV, order count, and most-recent order timestamp.
  const ordersByEmail = useMemo(() => {
    const map = new Map<string, { total: number; count: number; lastAt: number }>();
    for (const o of SHOPIFY_ORDERS_SNAPSHOT) {
      const key = o.email.trim().toLowerCase();
      if (!key) continue;
      const ts = new Date(o.createdAt).getTime();
      const prev = map.get(key);
      if (prev) {
        prev.total += o.total;
        prev.count += 1;
        if (ts > prev.lastAt) prev.lastAt = ts;
      } else {
        map.set(key, { total: o.total, count: 1, lastAt: ts });
      }
    }
    return map;
  }, []);

  // "Now" is pinned to the snapshot date so the recency label stays stable
  // in the UI even as real wall-clock time drifts away from the seed data.
  const nowMs = useMemo(() => Date.now(), []);

  const enriched = useMemo<EnrichedCustomer[]>(() => {
    return SHOPIFY_CUSTOMERS_SNAPSHOT.map(c => {
      const agg = ordersByEmail.get(c.email.trim().toLowerCase());
      // Fall back to the customer's reported totalSpent / ordersCount when
      // orders snapshot doesn't include this email (snapshot only has the
      // 20 most-recent orders).
      const lifetimeValue = agg?.total ?? c.totalSpent;
      const orderCount = agg?.count ?? c.ordersCount;
      const lastOrderAt = agg ? new Date(agg.lastAt).toISOString() : null;
      const daysSinceLastOrder = agg
        ? Math.max(0, Math.floor((nowMs - agg.lastAt) / MS_PER_DAY))
        : null;
      return { ...c, lifetimeValue, orderCount, lastOrderAt, daysSinceLastOrder };
    });
  }, [ordersByEmail, nowMs]);

  // Top-10% LTV threshold used to gold-accent big spenders. Computed once
  // over the non-zero-spender subset so prospects don't depress the cutoff.
  const topLtvThreshold = useMemo(() => {
    const spenders = enriched.filter(c => c.lifetimeValue > 0).map(c => c.lifetimeValue);
    if (spenders.length < 5) return Infinity;
    spenders.sort((a, b) => a - b);
    return spenders[Math.floor(spenders.length * 0.9)] ?? Infinity;
  }, [enriched]);

  // Cohort strip: "Active in last 30 days" = has ordered within 30d;
  // "New this quarter" = createdAt falls in the current calendar quarter.
  const cohortStats = useMemo(() => {
    const now = new Date(nowMs);
    const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).getTime();
    let active30 = 0;
    let newThisQuarter = 0;
    for (const c of enriched) {
      if (c.daysSinceLastOrder != null && c.daysSinceLastOrder <= 30) active30 += 1;
      if (new Date(c.createdAt).getTime() >= quarterStart) newThisQuarter += 1;
    }
    return { active30, newThisQuarter };
  }, [enriched, nowMs]);

  const filtered = useMemo(() => {
    // Strip invisibles on both sides so a paste-from-Slack search term
    // still matches customer records that might also carry ZWSP from
    // a Shopify export.
    const q = normalizeInvisible(query).trim().toLowerCase();
    const rows = enriched.filter(c => {
      if (filter === 'paying' && c.orderCount === 0) return false;
      if (filter === 'prospects' && c.orderCount > 0) return false;
      if (!q) return true;
      const email = normalizeInvisible(c.email).toLowerCase();
      const first = normalizeInvisible(c.firstName ?? '').toLowerCase();
      const last  = normalizeInvisible(c.lastName ?? '').toLowerCase();
      const city  = normalizeInvisible(c.city ?? '').toLowerCase();
      return email.includes(q) || first.includes(q) || last.includes(q) || city.includes(q);
    });
    if (sort === 'ltv-desc') return [...rows].sort((a, b) => b.lifetimeValue - a.lifetimeValue);
    if (sort === 'ltv-asc')  return [...rows].sort((a, b) => a.lifetimeValue - b.lifetimeValue);
    return rows;
  }, [enriched, query, filter, sort]);

  // Paginated slice — don't render 1000+ table rows at once.
  const pageItems = useMemo(
    () => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page],
  );

  const cycleLtvSort = () => {
    setSort(s => (s === 'default' ? 'ltv-desc' : s === 'ltv-desc' ? 'ltv-asc' : 'default'));
    setPage(0);
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Clients</h1>
          <p className="text-sm text-zinc-500 mt-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Shopify via Zapier
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              toast.info('Synchronisation en cours…');
              if (resyncTimerRef.current) clearTimeout(resyncTimerRef.current);
              resyncTimerRef.current = setTimeout(() => window.location.reload(), 400);
            }}
            className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 border border-zinc-200 rounded-lg hover:bg-zinc-50 bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
          >
            <RefreshCw size={15} aria-hidden="true" />
            Resync
          </button>
          <button
            type="button"
            onClick={() => exportCustomersCsv(filtered)}
            disabled={filtered.length === 0}
            // Disabled state when the filter yields nothing — avoids
            // downloading a header-only CSV and signals to the admin
            // that the filter is the thing to change. Tooltip + aria
            // explain why the button is dead.
            className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 border border-zinc-200 rounded-lg hover:bg-zinc-50 bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
            title={filtered.length === 0 ? 'Aucun client à exporter' : 'Exporter en CSV'}
            aria-label={
              filtered.length === 0
                ? 'Aucun client à exporter'
                : `Exporter ${filtered.length} client${filtered.length > 1 ? 's' : ''} en CSV`
            }
          >
            <Download size={15} aria-hidden="true" />
            Exporter CSV
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total clients" value={String(SHOPIFY_STATS.totalCustomers)} accent="blue" />
        <StatCard label="Clients payants" value={String(SHOPIFY_STATS.payingCustomers)} accent="green" />
        <StatCard label="Prospects" value={String(SHOPIFY_STATS.totalCustomers - SHOPIFY_STATS.payingCustomers)} accent="gold" />
        <StatCard
          label="Revenue total"
          value={SHOPIFY_STATS.totalLifetimeRevenue.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 })}
          accent="green"
        />
      </div>

      {/* Cohort summary strip — pulse of who's active and who just showed up.
          Kept inline + compact so it reads at a glance without stealing
          chart real estate from the proper dashboards. */}
      <div className="flex flex-wrap gap-2 text-xs" aria-label="Cohortes clients">
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50/60">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          <span className="text-zinc-500">Actifs (30 derniers jours)</span>
          <span className="font-extrabold text-emerald-700">{cohortStats.active30}</span>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50/60">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden="true" />
          <span className="text-zinc-500">Nouveaux ce trimestre</span>
          <span className="font-extrabold text-amber-700">{cohortStats.newThisQuarter}</span>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
        <div className="p-4 flex items-center gap-3 border-b border-zinc-100 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[220px] border border-zinc-200 rounded-lg px-3 py-2 bg-zinc-50">
            <Search size={16} className="text-zinc-400" aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher par nom, courriel, ville  (⌘K)"
              aria-label="Rechercher par nom, courriel ou ville"
              aria-keyshortcuts="Meta+K Control+K"
              className="bg-transparent border-none outline-none text-sm flex-1"
            />
          </div>
          <div className="inline-flex bg-zinc-100 rounded-lg p-0.5" role="radiogroup" aria-label="Filtrer par type de client">
            {(['all', 'paying', 'prospects'] as const).map(f => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={filter === f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 ${
                  filter === f ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                {f === 'all' ? 'Tous' : f === 'paying' ? 'Payants' : 'Prospects'}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-[11px] font-bold text-zinc-500 tracking-wider uppercase">
              <tr>
                <th className="text-left px-4 py-3">Client</th>
                <th className="text-left px-4 py-3">Contact</th>
                <th className="text-left px-4 py-3">Emplacement</th>
                <th className="text-right px-4 py-3">Commandes</th>
                <th className="text-right px-4 py-3">
                  <button
                    type="button"
                    onClick={cycleLtvSort}
                    aria-sort={sort === 'ltv-desc' ? 'descending' : sort === 'ltv-asc' ? 'ascending' : 'none'}
                    className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded"
                  >
                    LTV
                    {sort === 'ltv-desc' ? (
                      <ArrowDown size={11} aria-hidden="true" />
                    ) : sort === 'ltv-asc' ? (
                      <ArrowUp size={11} aria-hidden="true" />
                    ) : (
                      <ArrowUpDown size={11} aria-hidden="true" className="opacity-40" />
                    )}
                  </button>
                </th>
                <th className="text-left px-4 py-3">Dernière cmd</th>
                <th className="text-left px-4 py-3">Inscrit</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                // Warmer empty-state row — replaces the cold "Aucun client
                // trouvé" line with an icon, a diagnostic hint (search term
                // / active filter), and a one-click reset so admins don't
                // have to hunt for the bar they just typed into.
                <tr>
                  <td colSpan={7} className="px-4 py-14">
                    <div className="mx-auto max-w-sm flex flex-col items-center text-center">
                      <div className="w-14 h-14 rounded-full bg-zinc-100 flex items-center justify-center mb-4" aria-hidden="true">
                        <UsersRound className="w-6 h-6 text-zinc-400" />
                      </div>
                      <div className="text-sm font-extrabold text-zinc-800 mb-1">
                        Aucun client ne correspond
                      </div>
                      <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
                        {query.trim() || filter !== 'all'
                          ? 'Ajuste la recherche ou change le filtre pour voir plus de clients.'
                          : "Les nouveaux clients apparaîtront ici après leur première commande Shopify."}
                      </p>
                      {(query.trim() || filter !== 'all') && (
                        <button
                          type="button"
                          onClick={() => { setQuery(''); setFilter('all'); }}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#0052CC] hover:bg-[#003f9e] px-4 py-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2 transition-colors"
                        >
                          Réinitialiser les filtres
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                pageItems.map(c => {
                  const isTop = c.lifetimeValue > 0 && c.lifetimeValue >= topLtvThreshold;
                  return (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/admin/customers/${c.id}`)}
                    onKeyDown={e => {
                      // Make the row keyboard-activatable. The visual cursor:pointer
                      // and onClick suggested it was a "link" but keyboard / screen-
                      // reader users had no way to open the customer detail without
                      // a mouse — Tab landed on nothing, Enter did nothing.
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/admin/customers/${c.id}`);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Voir les détails de ${fullName(c)}`}
                    className="border-t border-zinc-100 hover:bg-zinc-50 cursor-pointer focus:outline-none focus-visible:bg-zinc-50 focus-visible:shadow-[inset_0_0_0_2px_#0052CC]"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0052CC] to-[#1B3A6B] text-white flex items-center justify-center text-[11px] font-extrabold flex-shrink-0"
                          aria-hidden="true"
                        >
                          {initials(c)}
                        </div>
                        <div className="font-semibold">{fullName(c)}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-zinc-600">{c.email}</div>
                      {c.phone && <div className="text-[11px] text-zinc-400">{c.phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {c.city ? `${c.city}${c.province ? ', ' + c.province : ''}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">{c.orderCount}</td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        isTop ? 'text-amber-600 font-bold' : ''
                      }`}
                      title={isTop ? 'Top 10 % des dépenseurs' : undefined}
                    >
                      {c.lifetimeValue > 0
                        ? fmtMoney(c.lifetimeValue)
                        : <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">
                      {formatRecency(c.daysSinceLastOrder)}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">{formatDate(c.createdAt)}</td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={page}
          pageSize={PAGE_SIZE}
          total={filtered.length}
          onPageChange={setPage}
          itemLabel="clients"
        />
      </div>

    </div>
  );
}
