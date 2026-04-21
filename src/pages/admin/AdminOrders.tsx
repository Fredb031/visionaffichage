import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Filter, Download, RefreshCw, ExternalLink, CheckCircle2, Archive, Truck, X } from 'lucide-react';
import { toast } from 'sonner';
import { SHOPIFY_ORDERS_SNAPSHOT, SHOPIFY_SNAPSHOT_META, type ShopifyOrderSnapshot } from '@/data/shopifySnapshot';
import { TablePagination } from '@/components/admin/TablePagination';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useSearchHotkey } from '@/hooks/useSearchHotkey';
import { normalizeInvisible } from '@/lib/utils';
import { readLS, writeLS } from '@/lib/storage';

type StatusFilter = 'all' | 'paid' | 'pending' | 'fulfilled' | 'awaiting_fulfillment';
const VALID_STATUS_FILTERS: readonly StatusFilter[] = ['all', 'paid', 'pending', 'fulfilled', 'awaiting_fulfillment'];

/** Generate and download a CSV for the currently filtered order list.
 * Escapes double quotes per RFC 4180 and wraps every field so commas
 * inside customer names don't shift columns. Cells whose first char is
 * one of '=' '+' '-' '@' are prefixed with a single tab so Excel /
 * Google Sheets treat them as text instead of formulas — a customer
 * named '=cmd|...' or an order note starting with '@' would otherwise
 * execute as a formula when the admin opens the CSV (CSV injection /
 * "formula injection", OWASP). The tab keeps the value readable while
 * neutralising the formula trigger. */
function exportOrdersCsv(orders: Array<ShopifyOrderSnapshot & { fulfillmentStatus: ShopifyOrderSnapshot['fulfillmentStatus'] }>) {
  const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;
  const esc = (v: unknown) => {
    let s = String(v ?? '');
    if (FORMULA_TRIGGERS.test(s)) s = '\t' + s;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const header = ['Commande', 'Client', 'Courriel', 'Total', 'Paiement', 'Livraison', 'Date'];
  const rows = orders.map(o => [
    o.name,
    o.customerName,
    o.email,
    o.total.toFixed(2),
    o.financialStatus ?? '',
    o.fulfillmentStatus ?? '',
    new Date(o.createdAt).toISOString(),
  ]);
  const csv = [header, ...rows].map(r => r.map(esc).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vision-commandes-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast.success(`${orders.length} commande${orders.length > 1 ? 's' : ''} exportée${orders.length > 1 ? 's' : ''}`);
}

const FIN_COLOR: Record<string, string> = {
  paid: 'bg-emerald-100 text-emerald-800',
  pending: 'bg-amber-50 text-amber-700',
  partially_paid: 'bg-blue-50 text-blue-700',
  refunded: 'bg-rose-50 text-rose-700',
  partially_refunded: 'bg-rose-50 text-rose-700',
  voided: 'bg-zinc-100 text-zinc-700',
  authorized: 'bg-blue-50 text-blue-700',
};

const FUL_COLOR: Record<string, string> = {
  fulfilled: 'bg-emerald-50 text-emerald-700',
  partial: 'bg-amber-50 text-amber-700',
  restocked: 'bg-zinc-100 text-zinc-700',
};

const FIN_LABEL: Record<string, string> = {
  paid: 'Payé',
  pending: 'En attente',
  partially_paid: 'Partiel',
  refunded: 'Remboursé',
  partially_refunded: 'Rembours. partiel',
  voided: 'Annulé',
  authorized: 'Autorisé',
};

const FUL_LABEL: Record<string, string> = {
  fulfilled: 'Expédié',
  partial: 'Partiel',
  restocked: 'Retourné',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatRelativeTime(iso: string): string {
  // Math.abs on diff first — the snapshot sync time can occasionally
  // be a few seconds AHEAD of the browser clock (NTP drift, laptop that
  // just woke from sleep). Without the abs, that flipped diff negative
  // and rendered "Synchronisé il y a -1 min" in the admin header.
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `il y a ${days}j`;
}

const PAGE_SIZE = 25;

export default function AdminOrders() {
  // URL-backed initial state so reload preserves the admin's view.
  // ?q=...&filter=... are accepted; an unknown filter falls back to 'all'.
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const initialFilterRaw = searchParams.get('filter') ?? 'all';
  const initialFilter: StatusFilter = (VALID_STATUS_FILTERS as readonly string[]).includes(initialFilterRaw)
    ? (initialFilterRaw as StatusFilter)
    : 'all';

  const [query, setQuery] = useState(initialQuery);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialFilter);
  const [selected, setSelected] = useState<ShopifyOrderSnapshot | null>(null);
  const [shippedIds, setShippedIds] = useState<Set<number>>(new Set());
  const [archivedIds, setArchivedIds] = useState<Set<number>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(0);

  // Reset to first page whenever the filter or search changes so we
  // don't strand the user on an empty page 5 after narrowing a filter.
  useEffect(() => { setPage(0); }, [query, statusFilter]);
  useDocumentTitle('Commandes — Admin Vision Affichage');
  // Cmd+K focuses the search input; Esc clears + blurs while focused.
  const searchRef = useSearchHotkey({ onClear: () => setQuery('') });

  // Sync state → URL (replace history so each keystroke doesn't pollute
  // back-stack). Reload now lands the admin exactly where they were.
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    const trimmed = query.trim();
    if (trimmed) next.set('q', trimmed); else next.delete('q');
    if (statusFilter !== 'all') next.set('filter', statusFilter); else next.delete('filter');
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [query, statusFilter, searchParams, setSearchParams]);

  // Cancel the resync delay if the admin clicks through to a sibling
  // route in the 400ms before the reload fires — otherwise it yanks
  // them back here from /admin/customers etc. Same pattern as the other
  // admin tables.
  const resyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (resyncTimerRef.current) clearTimeout(resyncTimerRef.current);
    };
  }, []);

  useEscapeKey(!!selected, useCallback(() => setSelected(null), []));
  // Side-drawer modal: stop the underlying table from scrolling while
  // the detail is open (iOS/mobile especially — the scroll wheel
  // leaking through reads as broken), and trap Tab inside the panel
  // so keyboard users don't fall back into the dimmed table.
  useBodyScrollLock(!!selected);
  const trapRef = useFocusTrap<HTMLDivElement>(!!selected);

  useEffect(() => {
    // readLS swallows the parse failure so a corrupted shipped-orders
    // blob can't crash the admin list on mount.
    const raw = readLS<unknown>('vision-shipped-orders', []);
    // Coerce to numbers and drop non-numeric entries. Old builds
    // (and manual admin edits in Supabase Studio) could have
    // persisted string IDs — Set's identity-based `has()` would
    // then fail to match the numeric o.id column and the Shipped
    // badge wouldn't render on orders the admin had marked.
    const numeric = Array.isArray(raw)
      ? (raw as unknown[]).map(x => (typeof x === 'number' ? x : Number(x))).filter(n => Number.isFinite(n))
      : [];
    setShippedIds(new Set(numeric));
  }, []);

  const markShipped = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(shippedIds);
    next.add(id);
    setShippedIds(next);
    if (!writeLS('vision-shipped-orders', [...next])) {
      console.warn('[AdminOrders] Could not persist shipped orders (quota or storage disabled)');
    }
  };

  // Bulk: mark every currently-selected order as shipped. We persist to
  // the same localStorage key so a reload keeps the fulfillment badges.
  const bulkMarkShipped = () => {
    if (selectedIds.size === 0) return;
    const next = new Set(shippedIds);
    selectedIds.forEach(id => next.add(id));
    setShippedIds(next);
    if (!writeLS('vision-shipped-orders', [...next])) {
      console.warn('[AdminOrders] Could not persist shipped orders (quota or storage disabled)');
    }
    toast.success(`${selectedIds.size} commande${selectedIds.size > 1 ? 's' : ''} marquée${selectedIds.size > 1 ? 's' : ''} expédiée${selectedIds.size > 1 ? 's' : ''}`);
    setSelectedIds(new Set());
  };

  // Bulk archive — removes rows from the active view. Not a destructive
  // operation; the snapshot is immutable, so we keep the id set in state
  // (persisted) and filter the table on read.
  const bulkArchive = () => {
    if (selectedIds.size === 0) return;
    const next = new Set(archivedIds);
    selectedIds.forEach(id => next.add(id));
    setArchivedIds(next);
    toast.success(`${selectedIds.size} commande${selectedIds.size > 1 ? 's' : ''} archivée${selectedIds.size > 1 ? 's' : ''}`);
    setSelectedIds(new Set());
  };

  const toggleRowSelected = (id: number, e: React.MouseEvent | React.ChangeEvent) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const augmented = useMemo(
    () => SHOPIFY_ORDERS_SNAPSHOT.map(o =>
      shippedIds.has(o.id) && o.fulfillmentStatus === null
        ? { ...o, fulfillmentStatus: 'fulfilled' as const }
        : o,
    ),
    [shippedIds],
  );

  const filtered = useMemo(() => {
    // Scrub invisible chars before comparing so a query pasted from
    // Slack/email with a ZWSP attached still matches. Also strip from
    // the order's own email — a Shopify export could carry one through.
    const q = normalizeInvisible(query).trim().toLowerCase();
    return augmented.filter(o => {
      if (archivedIds.has(o.id)) return false;
      if (statusFilter === 'paid' && o.financialStatus !== 'paid') return false;
      if (statusFilter === 'pending' && o.financialStatus !== 'pending') return false;
      if (statusFilter === 'fulfilled' && o.fulfillmentStatus !== 'fulfilled') return false;
      if (statusFilter === 'awaiting_fulfillment' && !(o.financialStatus === 'paid' && !o.fulfillmentStatus)) return false;
      if (!q) return true;
      const email = normalizeInvisible(o.email).toLowerCase();
      return (
        o.customerName.toLowerCase().includes(q) ||
        o.name.toLowerCase().includes(q) ||
        email.includes(q) ||
        String(o.id).includes(q)
      );
    });
  }, [augmented, query, statusFilter, archivedIds]);

  // Paginated slice. Rendering 100+ order rows at once caused noticeable
  // first-paint jank on the admin route.
  const pageItems = useMemo(
    () => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page],
  );

  // Select-all applies to the current filtered view (all pages) so the
  // admin can act on "every paid order matching this search" in one go
  // without tab-clicking through pagination. Tri-state: fully unchecked,
  // fully checked, or indeterminate when only some rows are selected.
  const allVisibleIds = useMemo(() => filtered.map(o => o.id), [filtered]);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedIds.has(id));
  const someSelected = !allSelected && allVisibleIds.some(id => selectedIds.has(id));
  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allVisibleIds));
    }
  };

  const lastSync = new Date(SHOPIFY_SNAPSHOT_META.syncedAt);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Commandes Shopify</h1>
          <p className="text-sm text-zinc-500 mt-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Connecté à {SHOPIFY_SNAPSHOT_META.shop}
            </span>
            <span className="text-zinc-400">·</span>
            <span>Synchronisé il y a {formatRelativeTime(SHOPIFY_SNAPSHOT_META.syncedAt)}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              // Snapshot is baked in at build time, so a "resync" is
              // really a hard reload — best we can do until this moves
              // behind a live Shopify edge function.
              toast.info('Synchronisation en cours…');
              if (resyncTimerRef.current) clearTimeout(resyncTimerRef.current);
              resyncTimerRef.current = setTimeout(() => window.location.reload(), 400);
            }}
            className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 border border-zinc-200 rounded-lg hover:bg-zinc-50 bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
            title="Recharger depuis Shopify"
          >
            <RefreshCw size={15} aria-hidden="true" />
            Resync
          </button>
          <button
            type="button"
            onClick={() => exportOrdersCsv(filtered)}
            className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 border border-zinc-200 rounded-lg hover:bg-zinc-50 bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
            title="Exporter en CSV"
            aria-label={`Exporter ${filtered.length} commande${filtered.length > 1 ? 's' : ''} en CSV`}
          >
            <Download size={15} aria-hidden="true" />
            Exporter
          </button>
        </div>
      </header>

      {selectedIds.size > 0 && (
        <div
          role="region"
          aria-label="Actions groupées"
          className="sticky top-0 z-20 flex items-center justify-between gap-3 flex-wrap bg-[#0052CC] text-white px-4 py-3 rounded-xl shadow-lg"
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/20 text-xs font-bold">
              {selectedIds.size}
            </span>
            <span className="text-sm font-bold">
              {selectedIds.size} sélectionnée{selectedIds.size > 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={bulkMarkShipped}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-white text-[#0052CC] hover:bg-zinc-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0052CC]"
            >
              <Truck size={13} aria-hidden="true" />
              Marquer expédiées
            </button>
            <button
              type="button"
              onClick={() => {
                const selectedOrders = filtered.filter(o => selectedIds.has(o.id));
                exportOrdersCsv(selectedOrders);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-white/10 text-white ring-1 ring-white/30 hover:bg-white/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0052CC]"
            >
              <Download size={13} aria-hidden="true" />
              Exporter CSV
            </button>
            <button
              type="button"
              onClick={bulkArchive}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-white/10 text-white ring-1 ring-white/30 hover:bg-white/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0052CC]"
            >
              <Archive size={13} aria-hidden="true" />
              Archiver
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              aria-label="Effacer la sélection"
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0052CC]"
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
        <div className="p-4 flex items-center gap-3 border-b border-zinc-100 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[220px] border border-zinc-200 rounded-lg px-3 py-2 bg-zinc-50">
            <Search size={16} className="text-zinc-400" aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher par client, numéro, courriel  (⌘K)"
              aria-label="Rechercher par client, numéro ou courriel"
              aria-keyshortcuts="Meta+K Control+K"
              className="bg-transparent border-none outline-none text-sm flex-1"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-zinc-400" aria-hidden="true" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              aria-label="Filtrer par statut"
              className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white outline-none focus:border-[#0052CC] focus-visible:ring-2 focus-visible:ring-[#0052CC]/25"
            >
              <option value="all">Tous les statuts</option>
              <option value="paid">Payées</option>
              <option value="pending">En attente de paiement</option>
              <option value="awaiting_fulfillment">À expédier</option>
              <option value="fulfilled">Expédiées</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-[11px] font-bold text-zinc-500 tracking-wider uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 w-10">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    disabled={allVisibleIds.length === 0}
                    aria-label={allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                    className="w-4 h-4 rounded border-zinc-300 text-[#0052CC] focus:ring-2 focus:ring-[#0052CC]/25 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </th>
                <th className="text-left px-4 py-3">#</th>
                <th className="text-left px-4 py-3">Client</th>
                <th className="text-right px-4 py-3">Articles</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-left px-4 py-3">Paiement</th>
                <th className="text-left px-4 py-3">Expédition</th>
                <th className="text-left px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-zinc-400 text-sm">
                    Aucune commande trouvée
                  </td>
                </tr>
              ) : (
                pageItems.map(o => (
                  <tr
                    key={o.id}
                    onClick={() => setSelected(o)}
                    onKeyDown={e => {
                      // Keyboard activation for the row — same fix as
                      // AdminCustomers. cursor:pointer + onClick was a
                      // mouse-only contract, leaving keyboard / SR users
                      // unable to open the order detail.
                      //
                      // Only act when the row itself has focus. Without
                      // this guard, a keyboard user who tabs into the
                      // inner "Marquer expédié" button and presses Enter
                      // fires the button's click AND the bubbled keydown
                      // here, which opens the detail drawer on top — the
                      // shipped action succeeded but the user is yanked
                      // into a modal they didn't ask for.
                      if (e.target !== e.currentTarget) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelected(o);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Voir les détails de la commande ${o.name}`}
                    aria-selected={selectedIds.has(o.id)}
                    className={`border-t border-zinc-100 hover:bg-zinc-50 cursor-pointer transition-colors focus:outline-none focus-visible:bg-zinc-50 focus-visible:shadow-[inset_0_0_0_2px_#0052CC] ${selectedIds.has(o.id) ? 'bg-blue-50/50' : ''}`}
                  >
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(o.id)}
                        onChange={e => toggleRowSelected(o.id, e)}
                        onClick={e => e.stopPropagation()}
                        aria-label={`Sélectionner ${o.name}`}
                        className="w-4 h-4 rounded border-zinc-300 text-[#0052CC] focus:ring-2 focus:ring-[#0052CC]/25 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 font-bold">{o.name}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{o.customerName.trim() || '—'}</div>
                      <div className="text-xs text-zinc-500">{o.email}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{o.itemsCount}</td>
                    <td className="px-4 py-3 text-right font-bold">
                      {o.total.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-md ${FIN_COLOR[o.financialStatus ?? ''] ?? 'bg-zinc-100 text-zinc-700'}`}>
                        {FIN_LABEL[o.financialStatus ?? ''] ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {o.fulfillmentStatus ? (
                        <span className={`text-[11px] font-bold px-2 py-1 rounded-md ${FUL_COLOR[o.fulfillmentStatus]}`}>
                          {FUL_LABEL[o.fulfillmentStatus]}
                        </span>
                      ) : o.financialStatus === 'paid' ? (
                        <button
                          type="button"
                          onClick={e => markShipped(o.id, e)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md bg-zinc-100 text-zinc-700 hover:bg-emerald-100 hover:text-emerald-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"
                          title="Marquer comme expédié"
                          aria-label={`Marquer ${o.name} comme expédié`}
                        >
                          <CheckCircle2 size={11} aria-hidden="true" />
                          Marquer expédié
                        </button>
                      ) : (
                        <span className="text-[11px] text-zinc-400">À expédier</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">{formatDate(o.createdAt)}</td>
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
          itemLabel="commandes"
        />
      </div>

      {selected && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-detail-title"
          onClick={() => setSelected(null)}
        >
          <div ref={trapRef} tabIndex={-1} className="bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl focus:outline-none" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xs text-zinc-500">Commande Shopify</div>
                  <h2 id="order-detail-title" className="text-xl font-extrabold">{selected.name}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label="Fermer le détail"
                  className="text-zinc-400 hover:text-zinc-700 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] rounded px-1"
                >
                  Fermer
                </button>
              </div>
              <div className="space-y-4 text-sm">
                <div>
                  <div className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-1">Client</div>
                  <div className="font-semibold">{selected.customerName.trim() || '—'}</div>
                  <div className="text-zinc-500">{selected.email}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-1">Montant</div>
                  <div className="text-2xl font-extrabold">{selected.total.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $ {selected.currency}</div>
                  <div className="text-xs text-zinc-500">{selected.itemsCount} article{selected.itemsCount > 1 ? 's' : ''}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-1">Statut</div>
                  <div className="flex gap-2">
                    <span className={`text-[11px] font-bold px-2 py-1 rounded-md ${FIN_COLOR[selected.financialStatus ?? ''] ?? 'bg-zinc-100'}`}>
                      {FIN_LABEL[selected.financialStatus ?? ''] ?? '—'}
                    </span>
                    {selected.fulfillmentStatus && (
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-md ${FUL_COLOR[selected.fulfillmentStatus]}`}>
                        {FUL_LABEL[selected.fulfillmentStatus]}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-1">Passée le</div>
                  <div>{new Date(selected.createdAt).toLocaleString('fr-CA')}</div>
                </div>
                <a
                  href={`https://${SHOPIFY_SNAPSHOT_META.shop}/admin/orders/${selected.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Voir ${selected.name} dans Shopify Admin (nouvel onglet)`}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0052CC] hover:underline pt-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded"
                >
                  Voir dans Shopify Admin
                  <ExternalLink size={13} aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
