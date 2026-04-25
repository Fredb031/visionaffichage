import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Eye, Plus, ArrowRightCircle, X, Download, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';
import { TablePagination } from '@/components/admin/TablePagination';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useSearchHotkey } from '@/hooks/useSearchHotkey';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { normalizeInvisible } from '@/lib/utils';
import { logAdminAction } from '@/lib/auditLog';
import { downloadCsv } from '@/lib/csv';

const PAGE_SIZE = 20;

// 'converted' is set locally by the convert-to-order action (Task 9.14)
// so the button doesn't fire twice against the same source quote. It
// lives alongside the canonical quote statuses because AdminQuotes is
// the only surface that reads it today — downstream readers that only
// know the legacy set fall back to 'draft' via coerceStatus().
type Status = 'draft' | 'sent' | 'viewed' | 'accepted' | 'paid' | 'expired' | 'converted';

type DiscountKind = 'percent' | 'flat';

// Shape of one stored quote's persisted line item, per QuoteBuilder.
// Kept loose (unknown[]) at read time but narrowed here for the
// convert-to-order payload so the manual-order ledger carries the
// same LineItem[] the vendor originally built.
type QuoteLineItem = {
  id?: string;
  productSku?: string;
  productName?: string;
  shopifyHandle?: string;
  image?: string;
  color?: string;
  size?: string;
  quantity?: number;
  unitPrice?: number;
  placementNote?: string;
  colors?: string[];
  sizeQuantities?: Record<string, Record<string, number>>;
  placement?: string;
};

type ManualOrder = {
  id: string;
  orderNumber: string;
  customer: { name: string; email: string };
  lineItems: QuoteLineItem[];
  total: number;
  createdAt: string;
  origin: 'from-quote';
  quoteId: string;
};

type QuoteRow = {
  id: string;
  number: string;
  vendor: string;
  client: string;
  clientEmail?: string;
  items: number;
  total: number;
  discount: number;
  discountKind: DiscountKind;
  status: Status;
  age: string;
  // ISO string when present — kept separate from the relative `age`
  // label so CSV export can format a stable fr-CA date and the expiry
  // badge can compare against `now`. Optional because MOCK rows don't
  // carry it and older localStorage rows predate the field.
  createdAt?: string;
  expiresAt?: string;
  // Rich payload carried forward from localStorage so the convert-to-
  // order dialog can show the real line items + rebuild the manual
  // order record without re-reading storage. Undefined for MOCK rows.
  lineItems?: QuoteLineItem[];
};

const MOCK: QuoteRow[] = [
  { id: 'q1', number: 'Q-2026-0042', vendor: 'Sophie Tremblay',      client: 'Sous Pression', items: 3, total: 1840, discount: 10, discountKind: 'percent', status: 'viewed',  age: 'il y a 2h' },
  { id: 'q2', number: 'Q-2026-0041', vendor: 'Marc-André Pelletier', client: 'Perfocazes',    items: 2, total: 620,  discount: 0,  discountKind: 'percent', status: 'paid',    age: 'il y a 5h' },
  { id: 'q3', number: 'Q-2026-0040', vendor: 'Sophie Tremblay',      client: 'Lacasse',       items: 5, total: 3450, discount: 15, discountKind: 'percent', status: 'sent',    age: 'il y a 1j' },
  { id: 'q4', number: 'Q-2026-0039', vendor: 'Julie Gagnon',         client: 'CFP Québec',    items: 4, total: 2100, discount: 8,  discountKind: 'percent', status: 'viewed',  age: 'il y a 2j' },
  { id: 'q5', number: 'Q-2026-0038', vendor: 'Marc-André Pelletier', client: 'Extreme Fab',   items: 6, total: 4250, discount: 12, discountKind: 'percent', status: 'paid',    age: 'il y a 3j' },
];

const STATUS_LABEL: Record<Status, string> = {
  draft: 'Brouillon', sent: 'Envoyé', viewed: 'Vu',
  accepted: 'Accepté', paid: 'Payé', expired: 'Expiré',
  converted: 'Convertie',
};

const STATUS_COLOR: Record<Status, string> = {
  draft: 'bg-zinc-100 text-zinc-700',
  sent: 'bg-blue-50 text-blue-700',
  viewed: 'bg-amber-50 text-amber-700',
  accepted: 'bg-emerald-50 text-emerald-700',
  paid: 'bg-emerald-100 text-emerald-800',
  expired: 'bg-rose-50 text-rose-700',
  converted: 'bg-brand-black/10 text-brand-black',
};

/** Format an ISO date for the CSV column / badge. fr-CA matches the
 * rest of the admin page so a reload-to-Excel round-trip preserves
 * month order; returns '—' for empty/invalid dates rather than 'Invalid
 * Date' so the CSV stays clean. */
function formatQuoteDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Classify how close a quote is to expiring. 'expired' for past dates,
 * 'tomorrow' for the window (now, 48h], null otherwise (including when
 * expiresAt is missing / unparseable). Using a 48h window instead of a
 * strict 24h lets a quote that expires "end of day tomorrow" still
 * trigger the badge through today's admin shift. */
function expiryState(iso: string | undefined): 'expired' | 'tomorrow' | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  const diff = ms - Date.now();
  if (diff <= 0) return 'expired';
  if (diff <= 48 * 60 * 60 * 1000) return 'tomorrow';
  return null;
}

/** Generate and download a CSV for the currently filtered quote list.
 * Columns (in this order): Numéro, Vendeur, Client, Courriel, Statut,
 * Total, Créée, Expire. Delegates quoting / BOM / injection-guard to
 * {@link downloadCsv} so this file stays focused on column shape. Total
 * is plain numeric (2 decimals, no '$') so the column stays parseable
 * as a number. Filename keeps the page-specific `quotes-YYYY-MM-DD.csv`
 * pattern (not the `vision-*` helper) so existing download folders /
 * Finance macros keep working. */
function exportQuotesCsv(rows: QuoteRow[]) {
  const header = ['Numéro', 'Vendeur', 'Client', 'Courriel', 'Statut', 'Total', 'Créée', 'Expire'];
  const body = rows.map(q => [
    q.number,
    q.vendor,
    q.client,
    q.clientEmail ?? '',
    STATUS_LABEL[q.status] ?? q.status,
    // No currency symbol — keeps the column numeric-parseable in Excel.
    (Number.isFinite(q.total) ? q.total : 0).toFixed(2),
    formatQuoteDate(q.createdAt),
    formatQuoteDate(q.expiresAt),
  ]);
  downloadCsv([header, ...body], `quotes-${new Date().toISOString().slice(0, 10)}.csv`);
  toast.success(`${rows.length} soumission${rows.length > 1 ? 's' : ''} exportée${rows.length > 1 ? 's' : ''}`);
}

const VALID_STATUSES: readonly Status[] = ['draft', 'sent', 'viewed', 'accepted', 'paid', 'expired', 'converted'];
function coerceStatus(raw: unknown): Status {
  return typeof raw === 'string' && (VALID_STATUSES as readonly string[]).includes(raw)
    ? (raw as Status)
    : 'draft';
}

// Monotonic 4-digit suffix, scoped per calendar day. Resets when the
// date rolls over so the admin doesn't have to stare at MAN-20260101-9817
// after a year — next-day orders restart at 0001. Uses the same
// counter-in-localStorage pattern as vision-quotes-seq in QuoteBuilder.
function nextManualOrderNumber(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const datePart = `${y}${m}${d}`;
  let seq = 0;
  try {
    const raw = localStorage.getItem('vision-manual-orders-seq');
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && parsed.date === datePart && Number.isFinite(parsed.n)) {
      seq = Math.max(0, Math.floor(parsed.n));
    }
    seq += 1;
    localStorage.setItem('vision-manual-orders-seq', JSON.stringify({ date: datePart, n: seq }));
  } catch {
    // If the counter is unreadable/unwritable, fall back to a random
    // 4-digit suffix so we still produce a plausible unique number
    // instead of colliding on MAN-YYYYMMDD-0001 every time.
    seq = Math.floor(1000 + Math.random() * 9000);
  }
  return `MAN-${datePart}-${String(seq).padStart(4, '0')}`;
}

// Recompute a quote's line-item total from the persisted matrix so the
// manual order carries an authoritative number even if the quote's
// stored `total` was stale (e.g. rounded pre-tax vs. post-tax). Falls
// back to the legacy `unitPrice * quantity` path if the new matrix
// shape isn't present on an older quote row.
function computeLineItemsTotal(items: QuoteLineItem[]): number {
  let sum = 0;
  for (const it of items) {
    const unit = Number.isFinite(it.unitPrice) ? (it.unitPrice as number) : 0;
    if (it.sizeQuantities && typeof it.sizeQuantities === 'object') {
      let qty = 0;
      for (const row of Object.values(it.sizeQuantities)) {
        if (!row) continue;
        for (const v of Object.values(row)) {
          const n = Number(v);
          if (Number.isFinite(n) && n > 0) qty += n;
        }
      }
      sum += unit * qty;
    } else {
      const qty = Number.isFinite(it.quantity) ? (it.quantity as number) : 0;
      sum += unit * qty;
    }
  }
  return sum;
}

export default function AdminQuotes() {
  // URL-backed initial state — same pattern as AdminCustomers / AdminOrders
  // so a reload preserves the admin's view + the URL is shareable.
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const initialFilterRaw = searchParams.get('filter') ?? 'all';
  const initialFilter: Status | 'all' = initialFilterRaw === 'all'
    ? 'all'
    : (VALID_STATUSES as readonly string[]).includes(initialFilterRaw)
      ? (initialFilterRaw as Status)
      : 'all';

  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<Status | 'all'>(initialFilter);
  const [savedQuotes, setSavedQuotes] = useState<QuoteRow[]>([]);
  const [page, setPage] = useState(0);
  // null = no active sort (keep source order — mixed savedQuotes + MOCK).
  // 'asc'/'desc' = click-to-sort on the Total header. Single column is
  // enough here; the admin already filters by status and searches by
  // client, so a full multi-column sort would be over-engineered.
  const [totalSort, setTotalSort] = useState<'asc' | 'desc' | null>(null);
  // Task 9.14 — convert-to-order confirmation dialog. Holds the quote
  // being converted so we can render a summary + line items before the
  // admin confirms. null = dialog closed.
  const [convertTarget, setConvertTarget] = useState<QuoteRow | null>(null);

  useEffect(() => { setPage(0); }, [query, filter]);
  useDocumentTitle('Soumissions — Admin Vision Affichage');
  const searchRef = useSearchHotkey({ onClear: () => setQuery('') });

  // State → URL sync; replace history so each keystroke doesn't pollute back-stack.
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    const trimmed = query.trim();
    if (trimmed) next.set('q', trimmed); else next.delete('q');
    if (filter !== 'all') next.set('filter', filter); else next.delete('filter');
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [query, filter, searchParams, setSearchParams]);

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('vision-quotes') ?? '[]');
      type StoredQuote = {
        id?: string | number;
        number?: string;
        clientName?: string;
        clientEmail?: string;
        total?: number;
        status?: string;
        createdAt?: string;
        expiresAt?: string;
        items?: unknown[];
        discountValue?: number;
        discountKind?: string;
      };
      // Same defensive pattern as QuoteList: one malformed row used to
      // wipe every saved quote (split on undefined email). Per-row
      // try/catch keeps the rest of the list visible.
      const mapped: QuoteRow[] = [];
      const list = Array.isArray(raw) ? (raw as StoredQuote[]) : [];
      for (const q of list) {
        try {
          if (!q || typeof q !== 'object') continue;
          const created = q.createdAt ? new Date(q.createdAt) : new Date();
          const ageMs = Date.now() - created.getTime();
          const days = Math.floor(ageMs / 86400000);
          const hours = Math.floor(ageMs / 3600000);
          const age = days > 0 ? `il y a ${days}j` : hours > 0 ? `il y a ${hours}h` : "à l'instant";
          const email = typeof q.clientEmail === 'string' ? q.clientEmail : '';
          const clientFromEmail = email.includes('@') ? email.split('@')[0] : email;
          // Preserve discountKind so the rebate column formats correctly:
          // a $50 flat discount must not render as '50%'. Saved quotes from
          // QuoteBuilder carry either 'percent' or 'flat'; anything else
          // (older rows, manually edited storage) falls back to 'percent'
          // for backwards-compat with the previous unconditional '%' render.
          const kind: DiscountKind = q.discountKind === 'flat' ? 'flat' : 'percent';
          mapped.push({
            id: String(q.id ?? `q-${mapped.length}`),
            number: typeof q.number === 'string' ? q.number : '—',
            vendor: 'Admin',
            client: q.clientName || clientFromEmail || '—',
            clientEmail: email,
            items: Array.isArray(q.items) ? q.items.length : 0,
            // Guard against NaN/Infinity sneaking through typeof checks —
            // a corrupted localStorage row (e.g. `total: NaN` after a
            // failed numeric parse upstream) used to render literal 'NaN'
            // in the admin table. Number.isFinite catches NaN and ±Infinity.
            total: Number.isFinite(q.total) ? (q.total as number) : 0,
            discount: Number.isFinite(q.discountValue) ? (q.discountValue as number) : 0,
            discountKind: kind,
            status: coerceStatus(q.status),
            age,
            createdAt: typeof q.createdAt === 'string' ? q.createdAt : undefined,
            expiresAt: typeof q.expiresAt === 'string' ? q.expiresAt : undefined,
            lineItems: Array.isArray(q.items) ? (q.items as QuoteLineItem[]) : [],
          });
        } catch (e) {
          console.warn('[AdminQuotes] Skipping malformed quote row:', e);
        }
      }
      setSavedQuotes(mapped);
    } catch {
      setSavedQuotes([]);
    }
  }, []);

  const all = useMemo(() => [...savedQuotes, ...MOCK], [savedQuotes]);

  // Task 9.14 — flip the source quote's status to 'converted' in both
  // the in-memory list (so the table re-renders without the button)
  // and in localStorage (so a reload doesn't resurrect it).
  const markQuoteConverted = useCallback((quoteId: string) => {
    setSavedQuotes(prev =>
      prev.map(row => (row.id === quoteId ? { ...row, status: 'converted' as Status } : row)),
    );
    try {
      const raw = JSON.parse(localStorage.getItem('vision-quotes') ?? '[]');
      if (Array.isArray(raw)) {
        const next = raw.map(q => {
          if (q && typeof q === 'object' && String((q as { id?: unknown }).id) === quoteId) {
            return { ...q, status: 'converted' };
          }
          return q;
        });
        localStorage.setItem('vision-quotes', JSON.stringify(next));
      }
    } catch (e) {
      console.warn('[AdminQuotes] Could not persist converted status:', e);
    }
  }, []);

  // Task 9.14 — persist a manual-order record to the vision-manual-orders
  // ledger. Mirrors the defensive read pattern used for vision-quotes so
  // a corrupted key doesn't blow up the convert action.
  const persistManualOrder = useCallback((order: ManualOrder) => {
    const list: unknown[] = (() => {
      try {
        const raw = JSON.parse(localStorage.getItem('vision-manual-orders') ?? '[]');
        return Array.isArray(raw) ? raw : [];
      } catch { return []; }
    })();
    list.unshift(order);
    try {
      // Cap at 500 entries so the ledger can't grow unbounded and push
      // us past the ~5MB localStorage quota on long-lived admin sessions.
      localStorage.setItem('vision-manual-orders', JSON.stringify(list.slice(0, 500)));
    } catch (e) {
      console.warn('[AdminQuotes] Manual order could not be saved locally:', e);
    }
  }, []);

  const confirmConvertToOrder = useCallback(() => {
    const quote = convertTarget;
    if (!quote) return;
    const now = new Date();
    const lineItems: QuoteLineItem[] = Array.isArray(quote.lineItems) ? quote.lineItems : [];
    // Prefer the quote's authoritative total when available — it already
    // includes the live Shopify variant price + print fee — and fall
    // back to the recomputed matrix total for legacy rows without a
    // persisted `total` (older shape, or the MOCK fixtures).
    const totalFromMatrix = computeLineItemsTotal(lineItems);
    const total = Number.isFinite(quote.total) && quote.total > 0 ? quote.total : totalFromMatrix;
    const orderNumber = nextManualOrderNumber(now);
    const order: ManualOrder = {
      id: `mo-${now.getTime()}`,
      orderNumber,
      customer: { name: quote.client, email: quote.clientEmail ?? '' },
      lineItems,
      total,
      createdAt: now.toISOString(),
      origin: 'from-quote',
      quoteId: quote.id,
    };
    persistManualOrder(order);
    markQuoteConverted(quote.id);
    // Task 9.19 — audit trail for the convert action so the dashboard
    // "Historique récent" card can surface it.
    logAdminAction('quote.convert', { quoteId: quote.id, orderNumber });
    setConvertTarget(null);
    toast.success(`Commande créée · ${orderNumber}`, {
      description: `À partir de la soumission ${quote.number}.`,
    });
  }, [convertTarget, persistManualOrder, markQuoteConverted]);

  const filtered = useMemo(() => {
    // Strip invisibles so a paste-from-Slack search still matches quote
    // records that may carry ZWSP from an earlier admin save.
    const Q = normalizeInvisible(query).trim().toLowerCase();
    return all.filter(q => {
      if (filter !== 'all' && q.status !== filter) return false;
      if (!Q) return true;
      const client = normalizeInvisible(q.client).toLowerCase();
      const vendor = normalizeInvisible(q.vendor).toLowerCase();
      const num = normalizeInvisible(q.number).toLowerCase();
      return client.includes(Q) || vendor.includes(Q) || num.includes(Q);
    });
  }, [all, query, filter]);

  // Apply the Total click-sort before paginating so the sort spans the
  // full filtered set, not just the current page. Copy first — do NOT
  // mutate `filtered` in place, the parent memo is shared with the CSV
  // export + the empty-state check below.
  const sorted = useMemo(() => {
    if (!totalSort) return filtered;
    const copy = filtered.slice();
    copy.sort((a, b) => {
      const av = Number.isFinite(a.total) ? a.total : 0;
      const bv = Number.isFinite(b.total) ? b.total : 0;
      return totalSort === 'asc' ? av - bv : bv - av;
    });
    return copy;
  }, [filtered, totalSort]);

  // Reset to the first page whenever the sort direction changes so the
  // admin doesn't land on an empty page 3 after toggling desc→asc.
  useEffect(() => { setPage(0); }, [totalSort]);

  const paged = useMemo(
    () => sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [sorted, page],
  );

  // Click handler for the Total header. Cycles: none → desc → asc →
  // none. Starts at desc because "biggest quotes first" is the common
  // triage order.
  const toggleTotalSort = useCallback(() => {
    setTotalSort(prev => (prev === null ? 'desc' : prev === 'desc' ? 'asc' : null));
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Soumissions</h1>
          <p className="text-sm text-zinc-500 mt-1">Toutes les soumissions créées par l'équipe</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => exportQuotesCsv(filtered)}
            disabled={filtered.length === 0}
            // Disabled state when the filter yields nothing — avoids
            // downloading a header-only CSV and signals to the admin
            // that the filter is the thing to change. Tooltip + aria
            // explain why the button is dead.
            className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 border border-zinc-200 rounded-lg hover:bg-zinc-50 bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
            title={filtered.length === 0 ? 'Aucune soumission à exporter' : 'Exporter en CSV'}
            aria-label={
              filtered.length === 0
                ? 'Aucune soumission à exporter'
                : `Exporter ${filtered.length} soumission${filtered.length > 1 ? 's' : ''} en CSV`
            }
          >
            <Download size={15} aria-hidden="true" />
            Exporter CSV
          </button>
          <Link
            to="/admin/quotes/new"
            className="inline-flex items-center gap-2 text-sm font-bold px-5 py-2.5 bg-[#0052CC] text-white rounded-lg hover:opacity-90 shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2"
          >
            <Plus size={16} aria-hidden="true" />
            Nouvelle soumission
          </Link>
        </div>
      </header>

      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
        <div className="p-4 flex items-center gap-3 border-b border-zinc-100 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[220px] border border-zinc-200 rounded-lg px-3 py-2 bg-zinc-50">
            <Search size={16} className="text-zinc-400" aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher par client, vendeur, numéro  (⌘K)"
              aria-label="Rechercher par client, vendeur ou numéro"
              aria-keyshortcuts="Meta+K Control+K"
              className="bg-transparent border-none outline-none text-sm flex-1"
            />
          </div>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as Status | 'all')}
            aria-label="Filtrer par statut"
            className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white outline-none focus:border-[#0052CC] focus-visible:ring-2 focus-visible:ring-[#0052CC]/25"
          >
            <option value="all">Tous les statuts</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-[11px] font-bold text-zinc-500 tracking-wider uppercase">
              <tr>
                <th className="text-left px-4 py-3">Numéro</th>
                <th className="text-left px-4 py-3">Vendeur</th>
                <th className="text-left px-4 py-3">Client</th>
                <th className="text-right px-4 py-3">
                  <button
                    type="button"
                    onClick={toggleTotalSort}
                    aria-label={
                      totalSort === 'asc'
                        ? 'Trier par total décroissant'
                        : totalSort === 'desc'
                          ? 'Retirer le tri par total'
                          : 'Trier par total décroissant'
                    }
                    aria-sort={
                      totalSort === 'asc' ? 'ascending' : totalSort === 'desc' ? 'descending' : 'none'
                    }
                    className="inline-flex items-center gap-1 ml-auto uppercase tracking-wider text-[11px] font-bold text-zinc-500 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded"
                  >
                    Total
                    {totalSort === 'asc'
                      ? <ArrowUp size={12} aria-hidden="true" />
                      : totalSort === 'desc'
                        ? <ArrowDown size={12} aria-hidden="true" />
                        : null}
                  </button>
                </th>
                <th className="text-right px-4 py-3">Rabais</th>
                <th className="text-left px-4 py-3">Statut</th>
                <th className="text-left px-4 py-3">Âge</th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {/* Empty-state row — parity with AdminOrders / AdminCustomers.
                  Without this, a no-match search (e.g. typo on a client
                  name) leaves the table body blank while the toolbar +
                  pagination still render, reading as a broken page. */}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-zinc-400 text-sm">
                    Aucune soumission trouvée
                  </td>
                </tr>
              ) : paged.map(q => (
                <tr key={q.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                  <td className="px-4 py-3 font-mono text-xs font-bold">{q.number}</td>
                  <td className="px-4 py-3 font-semibold">{q.vendor}</td>
                  <td className="px-4 py-3 font-semibold">{q.client}</td>
                  <td className="px-4 py-3 text-right font-bold">{q.total.toLocaleString('fr-CA')} $</td>
                  <td className="px-4 py-3 text-right text-emerald-700 font-semibold">
                    {q.discount > 0
                      ? q.discountKind === 'flat'
                        ? `${q.discount.toLocaleString('fr-CA')} $`
                        : `${q.discount}%`
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="inline-flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-md ${STATUS_COLOR[q.status]}`}>
                        {STATUS_LABEL[q.status]}
                      </span>
                      {(() => {
                        // Only surface the badge when the canonical
                        // status isn't already 'expired' — the status
                        // pill above already communicates that, a second
                        // "Expirée" chip would be redundant noise.
                        if (q.status === 'expired') return null;
                        const st = expiryState(q.expiresAt);
                        if (st === 'expired') {
                          return (
                            <span className="text-[11px] font-bold px-2 py-1 rounded-md bg-rose-50 text-rose-700">
                              Expirée
                            </span>
                          );
                        }
                        if (st === 'tomorrow') {
                          return (
                            <span className="text-[11px] font-bold px-2 py-1 rounded-md bg-amber-50 text-amber-700">
                              Expire demain
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{q.age}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1 justify-end">
                      {q.status === 'accepted' && (
                        <button
                          type="button"
                          onClick={() => setConvertTarget(q)}
                          aria-label={`Convertir la soumission ${q.number} en commande`}
                          title="Convertir en commande"
                          className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 bg-[#0052CC] text-white rounded-md hover:opacity-90 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
                        >
                          <ArrowRightCircle size={13} aria-hidden="true" />
                          <span>Convertir</span>
                        </button>
                      )}
                      <Link
                        to={`/quote/${q.id}`}
                        aria-label={`Voir la soumission ${q.number} pour ${q.client}`}
                        className="inline-flex items-center justify-center w-8 h-8 rounded text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
                      >
                        <Eye size={14} aria-hidden="true" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={page}
          pageSize={PAGE_SIZE}
          total={filtered.length}
          onPageChange={setPage}
          itemLabel="soumissions"
        />
      </div>

      <ConvertToOrderDialog
        target={convertTarget}
        onClose={() => setConvertTarget(null)}
        onConfirm={confirmConvertToOrder}
      />
    </div>
  );
}

// Convert-to-order confirmation (Task 9.14). Shown only when a quote is
// armed by the admin clicking "Convertir" on an accepted row. Dimmed
// backdrop + trapped focus + Esc-to-close, matching the rest of the
// admin dialogs.
function ConvertToOrderDialog({
  target,
  onClose,
  onConfirm,
}: {
  target: QuoteRow | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const open = target !== null;
  useEscapeKey(open, onClose);
  useBodyScrollLock(open);
  const trapRef = useFocusTrap<HTMLDivElement>(open);
  // Task 18.4 — double-click guard. onConfirm writes localStorage
  // (manual-orders + converted-quotes), appends to the audit log, and
  // closes the dialog. A rapid tap on a laggy admin machine could
  // deliver two clicks before React re-rendered, producing two manual
  // orders from the same quote. Lock the button the moment the first
  // click fires; the state resets implicitly when the dialog unmounts
  // after onConfirm's setConvertTarget(null).
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    if (!open) setSubmitting(false);
  }, [open]);

  if (!open || !target) return null;

  const handleConfirm = () => {
    if (submitting) return;
    setSubmitting(true);
    onConfirm();
  };

  const lineItems: QuoteLineItem[] = Array.isArray(target.lineItems) ? target.lineItems : [];
  const totalFromMatrix = computeLineItemsTotal(lineItems);
  const total = Number.isFinite(target.total) && target.total > 0 ? target.total : totalFromMatrix;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="convert-order-title"
        className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden"
      >
        <div className="flex items-start justify-between p-5 border-b border-zinc-100">
          <div>
            <h2 id="convert-order-title" className="font-extrabold text-lg text-brand-black">
              Créer une commande à partir de cette soumission ?
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              Soumission <span className="font-mono font-bold">{target.number}</span> · {target.client}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la boîte de dialogue"
            className="w-8 h-8 rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 max-h-[60vh] overflow-y-auto">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
            Articles ({lineItems.length})
          </h3>
          {lineItems.length === 0 ? (
            <div className="text-xs text-zinc-400 italic py-3">
              Aucun article détaillé disponible pour cette soumission.
            </div>
          ) : (
            <ul className="space-y-2 text-sm">
              {lineItems.map((it, idx) => {
                const name = it.productName || it.productSku || 'Article';
                const colors = Array.isArray(it.colors) && it.colors.length > 0
                  ? it.colors.join(', ')
                  : (it.color || '—');
                const qty = (() => {
                  if (it.sizeQuantities && typeof it.sizeQuantities === 'object') {
                    let q = 0;
                    for (const row of Object.values(it.sizeQuantities)) {
                      if (!row) continue;
                      for (const v of Object.values(row)) {
                        const n = Number(v);
                        if (Number.isFinite(n) && n > 0) q += n;
                      }
                    }
                    return q;
                  }
                  return Number.isFinite(it.quantity) ? (it.quantity as number) : 0;
                })();
                return (
                  <li
                    key={String(it.id ?? idx)}
                    className="flex items-center gap-3 border border-zinc-100 rounded-lg px-3 py-2 bg-zinc-50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{name}</div>
                      <div className="text-[11px] text-zinc-500 truncate">
                        {colors}
                      </div>
                    </div>
                    <div className="text-xs font-bold text-brand-black whitespace-nowrap">
                      × {qty}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex items-baseline justify-between mt-5 pt-3 border-t border-zinc-200">
            <span className="text-sm text-zinc-500 font-semibold">Total de la commande</span>
            <span className="text-xl font-extrabold text-[#0052CC]">
              {total.toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 bg-zinc-50 border-t border-zinc-100">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-bold px-4 py-2 border border-zinc-200 rounded-lg bg-white hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            aria-busy={submitting || undefined}
            className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 bg-[#0052CC] text-white rounded-lg hover:opacity-90 shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <ArrowRightCircle size={14} aria-hidden="true" />
            Créer la commande
          </button>
        </div>
      </div>
    </div>
  );
}
