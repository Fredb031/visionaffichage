import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Eye, Plus } from 'lucide-react';
import { TablePagination } from '@/components/admin/TablePagination';

const PAGE_SIZE = 20;

type Status = 'draft' | 'sent' | 'viewed' | 'accepted' | 'paid' | 'expired';

const MOCK = [
  { id: 'q1', number: 'Q-2026-0042', vendor: 'Sophie Tremblay',      client: 'Sous Pression', items: 3, total: 1840, discount: 10, status: 'viewed'  as Status, age: 'il y a 2h' },
  { id: 'q2', number: 'Q-2026-0041', vendor: 'Marc-André Pelletier', client: 'Perfocazes',    items: 2, total: 620,  discount: 0,  status: 'paid'    as Status, age: 'il y a 5h' },
  { id: 'q3', number: 'Q-2026-0040', vendor: 'Sophie Tremblay',      client: 'Lacasse',       items: 5, total: 3450, discount: 15, status: 'sent'    as Status, age: 'il y a 1j' },
  { id: 'q4', number: 'Q-2026-0039', vendor: 'Julie Gagnon',         client: 'CFP Québec',    items: 4, total: 2100, discount: 8,  status: 'viewed'  as Status, age: 'il y a 2j' },
  { id: 'q5', number: 'Q-2026-0038', vendor: 'Marc-André Pelletier', client: 'Extreme Fab',   items: 6, total: 4250, discount: 12, status: 'paid'    as Status, age: 'il y a 3j' },
];

const STATUS_LABEL: Record<Status, string> = {
  draft: 'Brouillon', sent: 'Envoyé', viewed: 'Vu',
  accepted: 'Accepté', paid: 'Payé', expired: 'Expiré',
};

const STATUS_COLOR: Record<Status, string> = {
  draft: 'bg-zinc-100 text-zinc-700',
  sent: 'bg-blue-50 text-blue-700',
  viewed: 'bg-amber-50 text-amber-700',
  accepted: 'bg-emerald-50 text-emerald-700',
  paid: 'bg-emerald-100 text-emerald-800',
  expired: 'bg-rose-50 text-rose-700',
};

export default function AdminQuotes() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Status | 'all'>('all');
  const [savedQuotes, setSavedQuotes] = useState<typeof MOCK>([]);
  const [page, setPage] = useState(0);

  useEffect(() => { setPage(0); }, [query, filter]);

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
        items?: unknown[];
        discountValue?: number;
      };
      // Same defensive pattern as QuoteList: one malformed row used to
      // wipe every saved quote (split on undefined email). Per-row
      // try/catch keeps the rest of the list visible.
      const mapped: typeof MOCK = [];
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
          mapped.push({
            id: String(q.id ?? `q-${mapped.length}`),
            number: typeof q.number === 'string' ? q.number : '—',
            vendor: 'Admin',
            client: q.clientName || clientFromEmail || '—',
            items: Array.isArray(q.items) ? q.items.length : 0,
            total: typeof q.total === 'number' ? q.total : 0,
            discount: typeof q.discountValue === 'number' ? q.discountValue : 0,
            status: (q.status as Status) ?? 'draft',
            age,
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

  const filtered = useMemo(() => {
    return all.filter(q => {
      if (filter !== 'all' && q.status !== filter) return false;
      if (!query.trim()) return true;
      const Q = query.toLowerCase();
      return q.client.toLowerCase().includes(Q) || q.vendor.toLowerCase().includes(Q) || q.number.toLowerCase().includes(Q);
    });
  }, [all, query, filter]);

  const paged = useMemo(
    () => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page],
  );

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Soumissions</h1>
          <p className="text-sm text-zinc-500 mt-1">Toutes les soumissions créées par l'équipe</p>
        </div>
        <Link
          to="/admin/quotes/new"
          className="inline-flex items-center gap-2 text-sm font-bold px-5 py-2.5 bg-[#0052CC] text-white rounded-lg hover:opacity-90 shadow-md"
        >
          <Plus size={16} />
          Nouvelle soumission
        </Link>
      </header>

      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
        <div className="p-4 flex items-center gap-3 border-b border-zinc-100 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[220px] border border-zinc-200 rounded-lg px-3 py-2 bg-zinc-50">
            <Search size={16} className="text-zinc-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher par client, vendeur, numéro"
              className="bg-transparent border-none outline-none text-sm flex-1"
            />
          </div>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as Status | 'all')}
            className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white outline-none focus:border-[#0052CC]"
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
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-right px-4 py-3">Rabais</th>
                <th className="text-left px-4 py-3">Statut</th>
                <th className="text-left px-4 py-3">Âge</th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {paged.map(q => (
                <tr key={q.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                  <td className="px-4 py-3 font-mono text-xs font-bold">{q.number}</td>
                  <td className="px-4 py-3 font-semibold">{q.vendor}</td>
                  <td className="px-4 py-3 font-semibold">{q.client}</td>
                  <td className="px-4 py-3 text-right font-bold">{q.total.toLocaleString('fr-CA')} $</td>
                  <td className="px-4 py-3 text-right text-emerald-700 font-semibold">
                    {q.discount > 0 ? `${q.discount}%` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-bold px-2 py-1 rounded-md ${STATUS_COLOR[q.status]}`}>
                      {STATUS_LABEL[q.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{q.age}</td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/quote/${q.id}`} className="text-zinc-500 hover:text-zinc-900">
                      <Eye size={14} className="inline" />
                    </Link>
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
    </div>
  );
}
