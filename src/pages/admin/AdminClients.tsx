import { useMemo, useState } from 'react';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, UsersRound, AlertCircle } from 'lucide-react';
import {
  SHOPIFY_CUSTOMERS_SNAPSHOT,
  SHOPIFY_ORDERS_SNAPSHOT,
  type ShopifyCustomerSnapshot,
} from '@/data/shopifySnapshot';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { fmtMoney } from '@/lib/format';

// Volume II §22 — Admin Clients (B2B-aware customer roster).
//
// The brief calls for a Supabase `profiles`-backed view: company,
// total spend, order count, last order date, LTV, loyalty tier.
// Supabase is operator follow-up — there is no `profiles` table in
// the codebase yet (only the typed Supabase client + auth wiring).
// Until that lands we surface the same shape from
// SHOPIFY_CUSTOMERS_SNAPSHOT folded over SHOPIFY_ORDERS_SNAPSHOT so
// the admin has a real sortable surface to look at, with a clearly-
// labelled banner that flags the data source as transitional.
//
// Loyalty tier is currently a single-account localStorage shim
// (src/lib/loyalty.ts) and not yet keyed per-customer — we display
// "—" in that column with a tooltip rather than fabricate a tier
// per row. When loyalty_accounts lands in Supabase the join is a
// drop-in; the column is already in the table so no layout churn.

type SortKey = 'company' | 'spend' | 'orders' | 'lastOrder' | 'ltv';
type SortDir = 'asc' | 'desc';

interface ClientRow extends ShopifyCustomerSnapshot {
  company: string;
  orderCount: number;
  lastOrderAt: string | null;
  lifetimeValue: number;
  loyaltyTier: 'bronze' | 'silver' | 'gold' | null;
}

function fullName(c: ShopifyCustomerSnapshot): string {
  const parts = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
  return parts || c.email.split('@')[0];
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Best-effort company derivation from the snapshot until the
// Supabase `profiles.company` column is available. Tags can carry
// "company:Acme" hints; otherwise we fall back to the email domain
// (minus common consumer providers) so corporate prospects still
// group sensibly.
const CONSUMER_DOMAINS = new Set(['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com', 'live.com', 'me.com']);

// Strip diacritics + lowercase so French queries match French data.
// Mirrors the NFD-strip contract used by src/lib/searchIndex.ts (2a831fb)
// and src/lib/colorMap.ts (1e7268d): the haystack here is full of
// Quebec names/cities ("Lévis", "Québec", "Marc-André", "Frédérick",
// "Saint-Jean-sur-Richelieu") so a query like "levis"/"andre"/"frederick"
// would silently miss every accented row without normalisation. Both
// sides of the comparison must live in the same character space.
function normaliseSearch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function deriveCompany(c: ShopifyCustomerSnapshot): string {
  const tagHint = c.tags
    .split(',')
    .map(t => t.trim())
    .find(t => t.toLowerCase().startsWith('company:') || t.toLowerCase().startsWith('entreprise:'));
  if (tagHint) {
    const v = tagHint.split(':')[1]?.trim();
    if (v) return v;
  }
  const domain = c.email.split('@')[1]?.toLowerCase();
  if (domain && !CONSUMER_DOMAINS.has(domain)) {
    return domain.replace(/\.(com|ca|net|org|io|co)$/i, '');
  }
  return '—';
}

export default function AdminClients() {
  useDocumentTitle('Clients — Admin');
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('ltv');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const rows: ClientRow[] = useMemo(() => {
    return SHOPIFY_CUSTOMERS_SNAPSHOT.map(c => {
      const orders = SHOPIFY_ORDERS_SNAPSHOT.filter(o => o.email === c.email);
      const orderCount = orders.length;
      const lifetimeValue = orders.reduce((sum, o) => sum + o.total, 0);
      const lastOrderAt = orders.length
        ? orders.reduce<string>((latest, o) => (o.createdAt > latest ? o.createdAt : latest), orders[0].createdAt)
        : null;
      return {
        ...c,
        company: deriveCompany(c),
        orderCount,
        lastOrderAt,
        lifetimeValue,
        // No per-customer loyalty wiring yet (operator follow-up). Null
        // so the column renders an em-dash; bronze/silver/gold tier
        // computation already exists in src/lib/loyalty.ts and will
        // join here once loyalty_accounts is keyed by customer.
        loyaltyTier: null,
      };
    });
  }, []);

  const filtered = useMemo(() => {
    const q = normaliseSearch(query.trim());
    if (!q) return rows;
    return rows.filter(r =>
      normaliseSearch(r.company).includes(q) ||
      normaliseSearch(fullName(r)).includes(q) ||
      normaliseSearch(r.email).includes(q),
    );
  }, [rows, query]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    copy.sort((a, b) => {
      switch (sortKey) {
        case 'company': return a.company.localeCompare(b.company, 'fr') * dir;
        case 'spend': return (a.totalSpent - b.totalSpent) * dir;
        case 'orders': return (a.orderCount - b.orderCount) * dir;
        case 'lastOrder': {
          const ax = a.lastOrderAt ? Date.parse(a.lastOrderAt) : 0;
          const bx = b.lastOrderAt ? Date.parse(b.lastOrderAt) : 0;
          return (ax - bx) * dir;
        }
        case 'ltv': return (a.lifetimeValue - b.lifetimeValue) * dir;
      }
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'company' ? 'asc' : 'desc');
    }
  };

  const sortIcon = (key: SortKey) => {
    if (key !== sortKey) return <ArrowUpDown size={12} aria-hidden="true" className="opacity-40" />;
    return sortDir === 'asc'
      ? <ArrowUp size={12} aria-hidden="true" />
      : <ArrowDown size={12} aria-hidden="true" />;
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <UsersRound size={22} aria-hidden="true" className="text-[#0052CC]" />
          Clients
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Vue B2B des comptes — entreprise, dépense totale, nombre de commandes, dernière commande, valeur à vie et niveau de fidélité.
        </p>
      </div>

      {/* Transitional-data banner — flags that the underlying source is
          still the Shopify snapshot, not the eventual Supabase
          profiles + loyalty_accounts join. */}
      <div
        role="note"
        className="mb-5 flex items-start gap-3 rounded-xl border border-[#E8A838]/40 bg-[#E8A838]/10 px-4 py-3 text-sm text-[#7a5208] dark:text-[#E8A838]"
      >
        <AlertCircle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
        <div>
          <strong className="font-bold">Bientôt disponible :</strong>{' '}
          intégration Supabase <code className="rounded bg-white/70 dark:bg-zinc-900/40 px-1 py-0.5 text-[12px]">profiles</code> +{' '}
          <code className="rounded bg-white/70 dark:bg-zinc-900/40 px-1 py-0.5 text-[12px]">loyalty_accounts</code>.
          {' '}Les valeurs ci-dessous proviennent du snapshot Shopify courant. TODO opérateur :
          créer la table <code className="rounded bg-white/70 dark:bg-zinc-900/40 px-1 py-0.5 text-[12px]">profiles</code> (company, ltv_cached, loyalty_tier),
          activer un trigger orders → ltv, puis remplacer la dérivation locale par un select Supabase.
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher entreprise, nom, courriel…"
            aria-label="Rechercher un client"
            className="w-full rounded-lg border border-zinc-300 bg-white pl-9 pr-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
          />
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400" aria-live="polite">
          {sorted.length} client{sorted.length > 1 ? 's' : ''}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900/60">
              <tr>
                {(
                  [
                    { key: 'company' as SortKey, label: 'Entreprise' },
                    { key: 'spend' as SortKey, label: 'Dépense totale', align: 'right' as const },
                    { key: 'orders' as SortKey, label: 'Commandes', align: 'right' as const },
                    { key: 'lastOrder' as SortKey, label: 'Dernière commande', align: 'right' as const },
                    { key: 'ltv' as SortKey, label: 'LTV', align: 'right' as const },
                  ] as Array<{ key: SortKey; label: string; align?: 'right' }>
                ).map(col => (
                  <th
                    key={col.key}
                    scope="col"
                    className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className={`inline-flex items-center gap-1.5 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] rounded ${col.align === 'right' ? 'flex-row-reverse' : ''}`}
                    >
                      {col.label}
                      {sortIcon(col.key)}
                    </button>
                  </th>
                ))}
                <th scope="col" className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                  Niveau fidélité
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-500">
                    Aucun client ne correspond à la recherche.
                  </td>
                </tr>
              ) : sorted.map(c => (
                <tr key={c.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">{c.company}</div>
                    <div className="text-[12px] text-zinc-500 dark:text-zinc-400">
                      {fullName(c)} · <span className="font-mono">{c.email}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                    {fmtMoney(c.totalSpent)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                    {c.orderCount}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                    {formatDate(c.lastOrderAt)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#0052CC]">
                    {fmtMoney(c.lifetimeValue)}
                  </td>
                  <td className="px-4 py-3 text-zinc-400" title="Loyalty tier — Supabase loyalty_accounts join à venir">
                    —
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
