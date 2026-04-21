import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  SHOPIFY_CUSTOMERS_SNAPSHOT,
  SHOPIFY_STATS,
  type ShopifyCustomerSnapshot,
} from '@/data/shopifySnapshot';
import { StatCard } from '@/components/admin/StatCard';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useSearchHotkey } from '@/hooks/useSearchHotkey';
import { TablePagination } from '@/components/admin/TablePagination';
import { normalizeInvisible } from '@/lib/utils';

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

const PAGE_SIZE = 25;

type CustomerFilter = 'all' | 'paying' | 'prospects';
const VALID_FILTERS: readonly CustomerFilter[] = ['all', 'paying', 'prospects'];

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

  const filtered = useMemo(() => {
    // Strip invisibles on both sides so a paste-from-Slack search term
    // still matches customer records that might also carry ZWSP from
    // a Shopify export.
    const q = normalizeInvisible(query).trim().toLowerCase();
    return SHOPIFY_CUSTOMERS_SNAPSHOT.filter(c => {
      if (filter === 'paying' && c.ordersCount === 0) return false;
      if (filter === 'prospects' && c.ordersCount > 0) return false;
      if (!q) return true;
      const email = normalizeInvisible(c.email).toLowerCase();
      const first = normalizeInvisible(c.firstName ?? '').toLowerCase();
      const last  = normalizeInvisible(c.lastName ?? '').toLowerCase();
      const city  = normalizeInvisible(c.city ?? '').toLowerCase();
      return email.includes(q) || first.includes(q) || last.includes(q) || city.includes(q);
    });
  }, [query, filter]);

  // Paginated slice — don't render 1000+ table rows at once.
  const pageItems = useMemo(
    () => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page],
  );

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
                <th className="text-right px-4 py-3">Dépensé</th>
                <th className="text-left px-4 py-3">Inscrit</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-zinc-400 text-sm">
                    Aucun client trouvé
                  </td>
                </tr>
              ) : (
                pageItems.map(c => (
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
                    <td className="px-4 py-3 text-right font-bold">{c.ordersCount}</td>
                    <td className="px-4 py-3 text-right font-bold">
                      {c.totalSpent > 0
                        ? c.totalSpent.toLocaleString('fr-CA', { minimumFractionDigits: 2 }) + ' $'
                        : <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">{formatDate(c.createdAt)}</td>
                  </tr>
                ))
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
