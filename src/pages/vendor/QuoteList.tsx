import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Plus, Copy, Send, Eye } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { normalizeInvisible } from '@/lib/utils';

type Status = 'draft' | 'sent' | 'viewed' | 'accepted' | 'paid' | 'expired';
type DiscountKind = 'percent' | 'flat';

interface MockQuote {
  id: string;
  number: string;
  client: string;
  email: string;
  items: number;
  total: number;
  discount: number;
  discountKind: DiscountKind;
  status: Status;
  age: string;
}

const MOCK: MockQuote[] = [
  { id: 'q1', number: 'Q-2026-0042', client: 'Sous Pression', email: 'anthony@sp.ca', items: 3, total: 1840, discount: 10, discountKind: 'percent', status: 'viewed', age: 'il y a 2h' },
  { id: 'q2', number: 'Q-2026-0041', client: 'Perfocazes',    email: 'hubert@p.com', items: 2, total: 620,  discount: 0,  discountKind: 'percent', status: 'paid',   age: 'il y a 5h' },
  { id: 'q3', number: 'Q-2026-0040', client: 'Lacasse',       email: 'marie@l.com',  items: 5, total: 3450, discount: 15, discountKind: 'percent', status: 'sent',   age: 'il y a 1j' },
  { id: 'q4', number: 'Q-2026-0039', client: 'CFP Québec',    email: 'info@cfp.qc', items: 4, total: 2100, discount: 8,  discountKind: 'percent', status: 'viewed', age: 'il y a 2j' },
  { id: 'q5', number: 'Q-2026-0038', client: 'Extreme Fab',   email: 'info@ef.ca',   items: 6, total: 4250, discount: 12, discountKind: 'percent', status: 'paid',   age: 'il y a 3j' },
  { id: 'q6', number: 'Q-2026-0037', client: 'Draft test',    email: '',             items: 1, total: 240,  discount: 0,  discountKind: 'percent', status: 'draft',  age: 'il y a 5j' },
  { id: 'q7', number: 'Q-2026-0036', client: 'Uni',           email: 'uni@u.ca',     items: 3, total: 1260, discount: 5,  discountKind: 'percent', status: 'expired', age: 'il y a 20j' },
];

const STATUS_LABEL: Record<Status, string> = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  viewed: 'Vu',
  accepted: 'Accepté',
  paid: 'Payé',
  expired: 'Expiré',
};

const STATUS_COLOR: Record<Status, string> = {
  draft: 'bg-zinc-100 text-zinc-700',
  sent: 'bg-blue-50 text-blue-700',
  viewed: 'bg-amber-50 text-amber-700',
  accepted: 'bg-emerald-50 text-emerald-700',
  paid: 'bg-emerald-100 text-emerald-800',
  expired: 'bg-rose-50 text-rose-700',
};

const VALID_STATUSES: readonly Status[] = ['draft', 'sent', 'viewed', 'accepted', 'paid', 'expired'];
function coerceStatus(raw: unknown): Status {
  // Persisted quotes could carry a status from an older Status union
  // ('pending', 'cancelled', etc), or a manual devtools edit. Without
  // coercion the table indexed STATUS_COLOR/STATUS_LABEL by an unknown
  // key and rendered `className={undefined}` + blank status cells.
  return typeof raw === 'string' && (VALID_STATUSES as readonly string[]).includes(raw)
    ? (raw as Status)
    : 'draft';
}

// Accepts either `?status=` (what VendorDashboard's quick-links emit)
// or `?filter=` (mirror of the admin URL scheme) as the initial filter
// so deep links like "/vendor/quotes?status=draft" actually land on
// the drafts view instead of resetting to "all".
function readStatusParam(raw: string | null): Status | 'all' {
  if (!raw) return 'all';
  if (raw === 'all') return 'all';
  return (VALID_STATUSES as readonly string[]).includes(raw) ? (raw as Status) : 'all';
}

export default function QuoteList() {
  useDocumentTitle('Mes soumissions — Vendeur Vision Affichage');
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Status | 'all'>(
    () => readStatusParam(searchParams.get('status') ?? searchParams.get('filter')),
  );
  const [savedQuotes, setSavedQuotes] = useState<MockQuote[]>([]);

  // Keep the URL in sync with the status filter so the view is
  // shareable/bookmarkable and back/forward preserves the filter.
  // Scrub both legacy `?filter=` and canonical `?status=` params so
  // switching from a dashboard deep link doesn't leave stale ones.
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (filter === 'all') {
      next.delete('status');
      next.delete('filter');
    } else {
      next.set('status', filter);
      next.delete('filter');
    }
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [filter, searchParams, setSearchParams]);

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('vision-quotes') ?? '[]');
      type StoredQuote = {
        id?: string | number;
        number?: string;
        clientName?: string;
        clientEmail?: string;
        total?: number;
        status?: MockQuote['status'];
        createdAt?: string;
        items?: unknown[];
        discountValue?: number;
        discountKind?: string;
      };
      // One malformed quote used to blow up .map (clientEmail.split on
      // undefined), which the outer try swallowed and emptied the whole
      // saved list. Use per-row try/catch and field guards so a single
      // bad row is skipped instead of losing every quote.
      const mapped: MockQuote[] = [];
      const list = Array.isArray(raw) ? (raw as StoredQuote[]) : [];
      for (const q of list) {
        try {
          if (!q || typeof q !== 'object') continue;
          const created = q.createdAt ? new Date(q.createdAt) : new Date();
          const ageMs = Date.now() - created.getTime();
          const days = Math.floor(ageMs / 86400000);
          const hours = Math.floor(ageMs / 3600000);
          const age = days > 0 ? `il y a ${days}j` : hours > 0 ? `il y a ${hours}h` : 'à l\'instant';
          const email = typeof q.clientEmail === 'string' ? q.clientEmail : '';
          const clientFromEmail = email.includes('@') ? email.split('@')[0] : email;
          // Preserve discountKind so the rebate column formats correctly:
          // a $50 flat discount must not render as '50%' (same fix as
          // AdminQuotes). QuoteBuilder persists 'percent' | 'flat';
          // anything else falls back to 'percent' for backwards-compat
          // with older rows that didn't carry the field.
          const kind: DiscountKind = q.discountKind === 'flat' ? 'flat' : 'percent';
          mapped.push({
            id: String(q.id ?? `q-${mapped.length}`),
            number: typeof q.number === 'string' ? q.number : '—',
            client: q.clientName || clientFromEmail || '—',
            email,
            items: Array.isArray(q.items) ? q.items.length : 0,
            // Guard against NaN/Infinity sneaking through typeof checks —
            // a corrupted localStorage row (e.g. `total: NaN` after a
            // failed numeric parse upstream) used to render literal 'NaN $'
            // in the vendor table. Number.isFinite catches NaN and ±Infinity.
            // Mirror of the AdminQuotes fix so both views stay in lockstep.
            total: Number.isFinite(q.total) ? (q.total as number) : 0,
            discount: Number.isFinite(q.discountValue) ? (q.discountValue as number) : 0,
            discountKind: kind,
            status: coerceStatus(q.status),
            age,
          });
        } catch (e) {
          console.warn('[QuoteList] Skipping malformed quote row:', e);
        }
      }
      setSavedQuotes(mapped);
    } catch {
      setSavedQuotes([]);
    }
  }, []);

  const all = useMemo(() => [...savedQuotes, ...MOCK], [savedQuotes]);

  const filtered = useMemo(() => {
    // ZWSP-safe search — same pattern as AdminQuotes / AdminOrders.
    const Q = normalizeInvisible(query).trim().toLowerCase();
    return all.filter(q => {
      if (filter !== 'all' && q.status !== filter) return false;
      if (!Q) return true;
      const client = normalizeInvisible(q.client).toLowerCase();
      const num = normalizeInvisible(q.number).toLowerCase();
      return client.includes(Q) || num.includes(Q);
    });
  }, [all, query, filter]);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Mes soumissions</h1>
          <p className="text-sm text-zinc-500 mt-1">{all.length} soumission{all.length > 1 ? 's' : ''} au total</p>
        </div>
        <Link
          to="/vendor/quotes/new"
          className="inline-flex items-center gap-2 text-sm font-bold px-5 py-2.5 bg-[#0052CC] text-white rounded-lg hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2"
        >
          <Plus size={16} aria-hidden="true" />
          Nouvelle soumission
        </Link>
      </header>

      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
        <div className="p-4 flex items-center gap-3 border-b border-zinc-100 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[220px] border border-zinc-200 rounded-lg px-3 py-2 bg-zinc-50">
            <Search size={16} className="text-zinc-400" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher par client ou numéro"
              aria-label="Rechercher par client ou numéro"
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
                <th className="text-left px-4 py-3">Client</th>
                <th className="text-right px-4 py-3">Articles</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-right px-4 py-3">Rabais</th>
                <th className="text-left px-4 py-3">Statut</th>
                <th className="text-left px-4 py-3">Âge</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-zinc-400 text-sm">
                    Aucune soumission trouvée
                  </td>
                </tr>
              ) : (
                filtered.map(q => (
                  <tr key={q.id} className="border-t border-zinc-100 hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-bold">{q.number}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{q.client}</div>
                      <div className="text-xs text-zinc-500">{q.email || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{q.items}</td>
                    <td className="px-4 py-3 text-right font-bold">{q.total.toLocaleString('fr-CA')} $</td>
                    <td className="px-4 py-3 text-right text-emerald-700 font-semibold">
                      {q.discount > 0
                        ? q.discountKind === 'flat'
                          ? `${q.discount.toLocaleString('fr-CA')} $`
                          : `${q.discount}%`
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-md ${STATUS_COLOR[q.status]}`}>
                        {STATUS_LABEL[q.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">{q.age}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <Link
                          to={`/quote/${q.id}`}
                          title="Voir"
                          aria-label={`Voir la soumission ${q.number}`}
                          className="w-8 h-8 rounded-lg hover:bg-zinc-100 flex items-center justify-center text-zinc-500 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
                        >
                          <Eye size={14} aria-hidden="true" />
                        </Link>
                        <Link
                          to={`/vendor/quotes/new?clone=${encodeURIComponent(q.id)}`}
                          title="Cloner"
                          aria-label={`Cloner la soumission ${q.number}`}
                          className="w-8 h-8 rounded-lg hover:bg-zinc-100 flex items-center justify-center text-zinc-500 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
                        >
                          <Copy size={14} aria-hidden="true" />
                        </Link>
                        <button
                          type="button"
                          title="Renvoyer"
                          aria-label={`Renvoyer la soumission ${q.number}`}
                          className="w-8 h-8 rounded-lg hover:bg-zinc-100 flex items-center justify-center text-zinc-500 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
                        >
                          <Send size={14} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
