import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Filter, Download, RefreshCw, ExternalLink, CheckCircle2, Archive, Truck, X, FileDown, Loader2, LayoutList, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { SHOPIFY_ORDERS_SNAPSHOT, SHOPIFY_SNAPSHOT_META, type ShopifyOrderSnapshot } from '@/data/shopifySnapshot';
import { getOrderLogos, LOGO_STATE_COLOR, LOGO_STATE_LABEL, type OrderLogoAttachment } from '@/data/orderLogos';
import { TablePagination } from '@/components/admin/TablePagination';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useSearchHotkey } from '@/hooks/useSearchHotkey';
import { normalizeInvisible } from '@/lib/utils';
import { readLS, writeLS } from '@/lib/storage';
import { buildLogoFilename, triggerBlobDownload } from '@/lib/logoVectorize';
import { logAdminAction } from '@/lib/auditLog';
import { downloadCsv } from '@/lib/csv';

type StatusFilter = 'all' | 'paid' | 'pending' | 'fulfilled' | 'awaiting_fulfillment';
const VALID_STATUS_FILTERS: readonly StatusFilter[] = ['all', 'paid', 'pending', 'fulfilled', 'awaiting_fulfillment'];

type OrdersView = 'table' | 'timeline';
const VALID_VIEWS: readonly OrdersView[] = ['table', 'timeline'];
const VIEW_STORAGE_KEY = 'vision-admin-orders-view';

/** Group orders by their createdAt calendar day (local tz). Returns
 * an array of [dayKey, orders] tuples sorted most-recent-first. dayKey
 * is an ISO yyyy-mm-dd string so it's stable across renders and Intl
 * formatting is deferred to the render site. */
function groupByDay(orders: ReadonlyArray<ShopifyOrderSnapshot>): Array<[string, ShopifyOrderSnapshot[]]> {
  const bucket = new Map<string, ShopifyOrderSnapshot[]>();
  for (const o of orders) {
    const d = new Date(o.createdAt);
    // yyyy-mm-dd in local tz — using toISOString() would shift late-night
    // Montreal orders into the next UTC day and break the grouping the
    // admin expects ("orders from Tuesday" stays on Tuesday).
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const arr = bucket.get(key);
    if (arr) arr.push(o); else bucket.set(key, [o]);
  }
  const out = Array.from(bucket.entries());
  out.sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0));
  // Within a day, newest first by timestamp.
  for (const [, list] of out) {
    list.sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime());
  }
  return out;
}

const DAY_HEADER_FMT = new Intl.DateTimeFormat('fr-CA', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const TIME_FMT = new Intl.DateTimeFormat('fr-CA', { hour: '2-digit', minute: '2-digit' });

/** Generate and download a CSV for the currently filtered order list.
 * Columns (in this order): #, Date, Client, Courriel, Statut, Articles,
 * Total. Delegates to the shared `downloadCsv` helper from `@/lib/csv`
 * so the escape policy (RFC 4180 always-quote, formula-injection guard,
 * UTF-8 BOM, CRLF) is identical to every other admin export. Filename
 * keeps the `orders-YYYY-MM-DD.csv` pattern the admin team relies on. */
function exportOrdersCsv(orders: Array<ShopifyOrderSnapshot & { fulfillmentStatus: ShopifyOrderSnapshot['fulfillmentStatus'] }>) {
  // Status label: prefer fulfillment (ready-to-ship is the interesting
  // axis when an admin scans a CSV) then financial. Falls back to '—'.
  const statusLabel = (o: ShopifyOrderSnapshot) => {
    if (o.fulfillmentStatus && FUL_LABEL[o.fulfillmentStatus]) return FUL_LABEL[o.fulfillmentStatus];
    if (o.financialStatus && FIN_LABEL[o.financialStatus]) return FIN_LABEL[o.financialStatus];
    return '—';
  };
  const header = ['#', 'Date', 'Client', 'Courriel', 'Statut', 'Articles', 'Total'];
  const rows = orders.map(o => [
    o.name,
    // Match UI format but include year so the CSV is portable across
    // years without losing context. fr-CA locale (the only one the
    // page uses today).
    formatDate(o.createdAt),
    o.customerName,
    o.email,
    statusLabel(o),
    String(o.itemsCount),
    // No currency symbol — keeps the column numeric-parseable in Excel.
    o.total.toFixed(2),
  ]);
  const filename = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
  downloadCsv([header, ...rows], filename);
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

/** Per-logo card inside the order drawer.
 *
 * Three display states, driven by LogoConversionState:
 *   - ready       → solid green "Télécharger SVG" button, instant blob download
 *   - queued      → amber spinner badge, button offers raster fallback
 *   - raster-only → zinc "Brouillon raster" badge, button triggers a
 *                   confirm-toast before downloading the original (we
 *                   refuse to serve a `.svg`-renamed raster — production
 *                   would treat it as a real vector and the plotter /
 *                   DTF workflow breaks on the first tool-path step).
 *
 * Download path uses fetch + blob so the file lands in /Downloads with
 * our friendly `vision-logo-<order>.<ext>` filename regardless of the
 * original upload name. */
function LogoAttachmentCard({
  logo,
  orderName,
}: {
  logo: OrderLogoAttachment;
  orderName: string;
}) {
  const [downloading, setDownloading] = useState(false);

  const downloadUrl = async (url: string, filename: string) => {
    setDownloading(true);
    try {
      // fetch → blob so Safari/Firefox respect the `download` attr
      // across origins. A bare <a download> on a cross-origin URL is
      // silently ignored and navigates instead, booting the admin
      // out of the drawer. Going via blob sidesteps that.
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      triggerBlobDownload(blob, filename);
    } catch (e) {
      console.warn('[AdminOrders] Logo download failed:', e);
      toast.error('Téléchargement impossible. Réessaie dans un instant.');
    } finally {
      setDownloading(false);
    }
  };

  const handleSvgDownload = () => {
    if (logo.state === 'ready' && logo.svgUrl) {
      void downloadUrl(logo.svgUrl, buildLogoFilename(orderName, 'svg'));
      return;
    }

    // Non-ready path — we refuse to rename a raster to `.svg` (the
    // production workflow reads the MIME and crashes on mismatched
    // content). Confirm the fallback to the original raster instead.
    //
    // Sonner doesn't have a native confirm primitive — use an action
    // toast so the admin stays in-flow without a blocking modal.
    const isQueued = logo.state === 'queued';
    toast(
      isQueued
        ? 'Conversion SVG en cours — télécharger le raster original ?'
        : 'Conversion SVG en attente — télécharger le raster original ?',
      {
        action: {
          label: 'Télécharger',
          onClick: () => {
            void downloadUrl(
              logo.sourceUrl,
              buildLogoFilename(orderName, logo.sourceExt),
            );
          },
        },
        duration: 8000,
      },
    );
  };

  const badgeLabel = LOGO_STATE_LABEL[logo.state];
  const badgeColor = LOGO_STATE_COLOR[logo.state];
  const canDownloadSvg = logo.state === 'ready';

  return (
    <div className="flex gap-3 items-start border border-zinc-200 rounded-xl p-3 bg-white">
      <div className="w-16 h-16 rounded-lg bg-zinc-50 border border-zinc-200 flex items-center justify-center overflow-hidden flex-shrink-0">
        <img
          src={logo.previewUrl}
          alt={logo.label}
          width={64}
          height={64}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-contain"
          onError={e => {
            // Broken CDN link shouldn't leave a "missing image" icon
            // in the drawer — fall back to the .ext text so the admin
            // still sees the shape of the asset.
            const el = e.currentTarget;
            el.style.display = 'none';
          }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="text-xs font-bold truncate">{logo.label}</div>
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${badgeColor}`}
            aria-label={`État conversion : ${badgeLabel}`}
          >
            {logo.state === 'queued' && (
              <Loader2 size={10} className="animate-spin" aria-hidden="true" />
            )}
            {badgeLabel}
          </span>
        </div>
        <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2">
          {logo.sourceExt}
        </div>
        <button
          type="button"
          onClick={handleSvgDownload}
          disabled={downloading}
          aria-label={
            canDownloadSvg
              ? `Télécharger le SVG de ${logo.label}`
              : `Conversion SVG pas prête — offrir le raster original pour ${logo.label}`
          }
          className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed ${
            canDownloadSvg
              ? 'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500'
              : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 focus-visible:ring-zinc-400'
          }`}
        >
          {downloading ? (
            <Loader2 size={12} className="animate-spin" aria-hidden="true" />
          ) : (
            <FileDown size={12} aria-hidden="true" />
          )}
          Télécharger SVG
        </button>
      </div>
    </div>
  );
}

export default function AdminOrders() {
  // URL-backed initial state so reload preserves the admin's view.
  // ?q=...&filter=... are accepted; an unknown filter falls back to 'all'.
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const initialFilterRaw = searchParams.get('filter') ?? 'all';
  const initialFilter: StatusFilter = (VALID_STATUS_FILTERS as readonly string[]).includes(initialFilterRaw)
    ? (initialFilterRaw as StatusFilter)
    : 'all';

  // View toggle state: URL > localStorage > default('table'). Kept in
  // sync with both stores so a reload OR a deep-link both restore the
  // admin's chosen layout.
  const initialViewRaw = searchParams.get('view');
  const initialView: OrdersView = (() => {
    if (initialViewRaw && (VALID_VIEWS as readonly string[]).includes(initialViewRaw)) {
      return initialViewRaw as OrdersView;
    }
    const stored = readLS<unknown>(VIEW_STORAGE_KEY, 'table');
    if (typeof stored === 'string' && (VALID_VIEWS as readonly string[]).includes(stored)) {
      return stored as OrdersView;
    }
    return 'table';
  })();

  const [query, setQuery] = useState(initialQuery);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialFilter);
  const [view, setView] = useState<OrdersView>(initialView);
  const [selected, setSelected] = useState<ShopifyOrderSnapshot | null>(null);
  const [shippedIds, setShippedIds] = useState<Set<number>>(new Set());
  const [archivedIds, setArchivedIds] = useState<Set<number>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(0);
  // Ref on the table wrapper so a click outside the table (but not
  // inside the floating bulk-action bar) clears the selection. Same
  // reason we can't use a plain document listener: clicks on the bar
  // itself should NOT clear — they're the whole point.
  const tableWrapRef = useRef<HTMLDivElement>(null);
  const bulkBarRef = useRef<HTMLDivElement>(null);

  // Reset to first page whenever the filter, search, or archived toggle
  // changes so we don't strand the user on an empty page 5 after
  // narrowing a filter — or after flipping to "Voir archivées" when only
  // a handful of orders are stashed there.
  useEffect(() => { setPage(0); }, [query, statusFilter, showArchived]);
  // Also drop any cross-view stale selection — the admin expects the
  // bulk bar counter to reflect the rows they can actually see.
  useEffect(() => { setSelectedIds(new Set()); }, [query, statusFilter]);
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
    if (view !== 'table') next.set('view', view); else next.delete('view');
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [query, statusFilter, view, searchParams, setSearchParams]);

  // Persist view choice to localStorage so a hard reload (no URL param)
  // still restores the admin's last layout.
  useEffect(() => {
    writeLS(VIEW_STORAGE_KEY, view);
  }, [view]);

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
    // Same coercion path for archived order IDs so the archive-hide
    // behaviour survives a reload. Serialized as an array of numbers;
    // JSON has no Set primitive.
    const rawArch = readLS<unknown>('vision-archived-orders', []);
    const numericArch = Array.isArray(rawArch)
      ? (rawArch as unknown[]).map(x => (typeof x === 'number' ? x : Number(x))).filter(n => Number.isFinite(n))
      : [];
    setArchivedIds(new Set(numericArch));
  }, []);

  // Escape clears the selection when any row is selected (and no drawer
  // is open — the drawer's own Escape handler takes priority). The
  // useEscapeKey hook already early-returns when `active` is false.
  useEscapeKey(
    selectedIds.size > 0 && !selected,
    useCallback(() => setSelectedIds(new Set()), []),
  );

  // Click outside the table + bulk-action bar clears the selection.
  // Bound at the document level (capture: false) so it doesn't steal
  // the click from inner controls — we only act when the target is
  // outside both refs.
  useEffect(() => {
    if (selectedIds.size === 0) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (tableWrapRef.current?.contains(target)) return;
      if (bulkBarRef.current?.contains(target)) return;
      setSelectedIds(new Set());
    };
    // `mousedown` instead of `click` so the selection clears before
    // any interactive element outside the table (e.g. a sibling
    // button) fires — feels snappier and avoids a double-render when
    // the click handler also navigates.
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [selectedIds.size]);

  const markShipped = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(shippedIds);
    next.add(id);
    setShippedIds(next);
    if (!writeLS('vision-shipped-orders', [...next])) {
      console.warn('[AdminOrders] Could not persist shipped orders (quota or storage disabled)');
    }
    // Task 9.19 — audit trail. Only log when the id wasn't already in
    // the set, so repeated clicks on a row that's already shipped
    // don't spam the log.
    if (!shippedIds.has(id)) {
      logAdminAction('order.mark_shipped', { orderId: id });
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
  // (persisted to localStorage as a number[] — JSON has no Set) and
  // filter the table on read. "Voir archivées" surfaces them back.
  const bulkArchive = () => {
    if (selectedIds.size === 0) return;
    const next = new Set(archivedIds);
    selectedIds.forEach(id => next.add(id));
    setArchivedIds(next);
    if (!writeLS('vision-archived-orders', [...next])) {
      console.warn('[AdminOrders] Could not persist archived orders (quota or storage disabled)');
    }
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
      // "Voir archivées" inverts the filter: when on, we only show
      // archived rows so the admin can audit / unarchive; when off,
      // archived rows are hidden. No "both" mode — it muddies the
      // N-selected counter and the admin always wants one or the other.
      if (showArchived) {
        if (!archivedIds.has(o.id)) return false;
      } else {
        if (archivedIds.has(o.id)) return false;
      }
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
  }, [augmented, query, statusFilter, archivedIds, showArchived]);

  // Paginated slice. Rendering 100+ order rows at once caused noticeable
  // first-paint jank on the admin route.
  const pageItems = useMemo(
    () => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page],
  );

  // Timeline groups the full filtered set (no pagination) — day cards are
  // already a visual break, and scanning by date breaks if page 2 starts
  // mid-day. Same filter + sort state the table uses, just re-bucketed.
  const grouped = useMemo(
    () => (view === 'timeline' ? groupByDay(filtered) : []),
    [filtered, view],
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
            disabled={filtered.length === 0}
            // Disabled state when the filter yields nothing — avoids
            // downloading a header-only CSV and signals to the admin
            // that the filter is the thing to change. Tooltip + aria
            // explain why the button is dead.
            className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 border border-zinc-200 rounded-lg hover:bg-zinc-50 bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
            title={filtered.length === 0 ? 'Aucune commande à exporter' : 'Exporter en CSV'}
            aria-label={
              filtered.length === 0
                ? 'Aucune commande à exporter'
                : `Exporter ${filtered.length} commande${filtered.length > 1 ? 's' : ''} en CSV`
            }
          >
            <Download size={15} aria-hidden="true" />
            Exporter CSV
          </button>
        </div>
      </header>

      {selectedIds.size > 0 && (
        <div
          ref={bulkBarRef}
          role="region"
          aria-label="Actions groupées"
          // Floating bottom bar: fixed to the viewport so it rides along
          // as the admin scrolls through a long order list. Max-width +
          // auto margins keep it centered on wide screens; bottom-4
          // leaves breathing room above sonner's bottom-right toasts.
          // Brand navy bg with a gold accent on the primary action
          // ("Marquer expédié") to anchor the eye on the high-value
          // bulk operation. The secondary actions use a frosted
          // white/10 so they read as deliberate-but-not-primary.
          className="fixed bottom-4 inset-x-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 z-30 flex items-center justify-between gap-3 flex-wrap bg-[#0052CC] text-white px-4 py-3 rounded-xl shadow-2xl ring-1 ring-white/10 max-w-3xl md:w-auto"
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/20 text-xs font-bold">
              {selectedIds.size}
            </span>
            <span className="text-sm font-bold">
              {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={bulkMarkShipped}
              // Gold accent = primary action. Hardcoded hsl values
              // match --gold / --gold2 tokens from index.css so the
              // bar reads on-brand without pulling in a styled-system.
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-[hsl(40,82%,55%)] text-[#0a1930] hover:bg-[hsl(35,91%,60%)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(40,82%,55%)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0052CC]"
            >
              <Truck size={13} aria-hidden="true" />
              Marquer expédié
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
              onClick={() => {
                const selectedOrders = filtered.filter(o => selectedIds.has(o.id));
                exportOrdersCsv(selectedOrders);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-white/10 text-white ring-1 ring-white/30 hover:bg-white/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0052CC]"
            >
              <Download size={13} aria-hidden="true" />
              Export CSV
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

      <div ref={tableWrapRef} className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
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
          {/* Archived-view toggle. Keeps the active table uncluttered
              by default; the count surfaces how many rows are stashed
              so the admin knows whether flipping the toggle is worth
              it. Clears the current selection — mixing archived and
              non-archived selections across views would be confusing. */}
          <label className={`inline-flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-lg cursor-pointer border transition-colors ${showArchived ? 'bg-[#0052CC] text-white border-[#0052CC]' : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'}`}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={e => {
                setShowArchived(e.target.checked);
                setSelectedIds(new Set());
              }}
              className="sr-only"
              aria-label="Afficher les commandes archivées"
            />
            <Archive size={13} aria-hidden="true" />
            {showArchived ? 'Masquer archivées' : 'Voir archivées'}
            {archivedIds.size > 0 && (
              <span className={`inline-flex items-center justify-center text-[10px] font-bold px-1.5 py-0.5 rounded ${showArchived ? 'bg-white/20' : 'bg-zinc-100 text-zinc-600'}`}>
                {archivedIds.size}
              </span>
            )}
          </label>
          {/* 2-button segmented control: Table vs Timeline. Visually a
              single pill with an active-fill on the chosen side so the
              control reads as "one setting, two modes" rather than two
              independent buttons. role=tablist/tab gives AT the same
              semantics. */}
          <div role="tablist" aria-label="Vue des commandes" className="inline-flex items-center gap-0 p-0.5 rounded-lg border border-zinc-200 bg-zinc-50">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'table'}
              onClick={() => setView('table')}
              className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] ${view === 'table' ? 'bg-white text-[#0052CC] shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}
            >
              <LayoutList size={13} aria-hidden="true" />
              Tableau
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'timeline'}
              onClick={() => setView('timeline')}
              className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] ${view === 'timeline' ? 'bg-white text-[#0052CC] shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}
            >
              <Clock size={13} aria-hidden="true" />
              Timeline
            </button>
          </div>
        </div>

        {view === 'table' ? (
        <>
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
        </>
        ) : (
          <div className="p-4 md:p-6">
            {grouped.length === 0 ? (
              <div className="text-center py-12 text-zinc-400 text-sm">
                Aucune commande trouvée
              </div>
            ) : (
              <ol className="space-y-6" aria-label="Commandes groupées par jour">
                {grouped.map(([dayKey, dayOrders]) => (
                  <li key={dayKey}>
                    {/* Sticky day header: rides with the scroll so the
                        admin always knows which day they're scanning.
                        top-0 of the nearest scroll container; the admin
                        shell handles the page scroll, so sticky here
                        pins to the viewport top under the page chrome. */}
                    <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-zinc-200 -mx-4 md:-mx-6 px-4 md:px-6 py-2 mb-3 flex items-center justify-between">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-700">
                        {DAY_HEADER_FMT.format(new Date(dayOrders[0].createdAt))}
                      </h3>
                      <span className="text-[11px] font-bold text-zinc-400">
                        {dayOrders.length} commande{dayOrders.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {dayOrders.map(o => (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => setSelected(o)}
                          aria-label={`Voir les détails de la commande ${o.name}`}
                          className="text-left bg-white border border-zinc-200 rounded-xl p-3 hover:border-[#0052CC] hover:shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="min-w-0">
                              <div className="text-[11px] font-bold text-zinc-500 tabular-nums">
                                {TIME_FMT.format(new Date(o.createdAt))}
                              </div>
                              <div className="font-bold text-sm truncate">{o.customerName.trim() || '—'}</div>
                              <div className="text-xs text-zinc-500 font-semibold">{o.name}</div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="font-extrabold text-sm">
                                {o.total.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $
                              </div>
                              <div className="text-[10px] text-zinc-400 uppercase tracking-wider">
                                {o.itemsCount} art.
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1.5 flex-wrap">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${FIN_COLOR[o.financialStatus ?? ''] ?? 'bg-zinc-100 text-zinc-700'}`}>
                              {FIN_LABEL[o.financialStatus ?? ''] ?? '—'}
                            </span>
                            {o.fulfillmentStatus ? (
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${FUL_COLOR[o.fulfillmentStatus]}`}>
                                {FUL_LABEL[o.fulfillmentStatus]}
                              </span>
                            ) : o.financialStatus === 'paid' ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600">
                                À expédier
                              </span>
                            ) : null}
                          </div>
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
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
                {(() => {
                  // Compute inside an IIFE so the render function stays
                  // close to the data it consumes — makes the empty
                  // state easy to spot when the Supabase hook replaces
                  // getOrderLogos in a follow-up commit. Phase B4 + B6
                  // of QUOTE-ORDER-WORKFLOW: show the client's upload
                  // + SVG status + download button.
                  const logos = getOrderLogos(selected.id);
                  if (logos.length === 0) {
                    return (
                      <div>
                        <div className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-1">Logos client</div>
                        <div className="text-xs text-zinc-400 italic">
                          Aucun logo reçu pour cette commande.
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div>
                      <div className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-2">
                        Logos client ({logos.length})
                      </div>
                      <div className="space-y-2">
                        {logos.map(logo => (
                          <LogoAttachmentCard
                            key={logo.id}
                            logo={logo}
                            orderName={selected.name}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })()}
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
