import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, ExternalLink, Mail, Phone, MapPin, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  SHOPIFY_CUSTOMERS_SNAPSHOT,
  SHOPIFY_STATS,
  SHOPIFY_SNAPSHOT_META,
  type ShopifyCustomerSnapshot,
} from '@/data/shopifySnapshot';
import { StatCard } from '@/components/admin/StatCard';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { TablePagination } from '@/components/admin/TablePagination';

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

export default function AdminCustomers() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'paying' | 'prospects'>('all');
  const [selected, setSelected] = useState<ShopifyCustomerSnapshot | null>(null);
  const [page, setPage] = useState(0);

  // Reset pagination when the filter or search changes — otherwise
  // filtering to 3 prospects while on page 5 shows an empty table.
  useEffect(() => { setPage(0); }, [query, filter]);

  useEscapeKey(!!selected, useCallback(() => setSelected(null), []));
  // Lock body scroll + trap focus while the customer detail drawer is
  // open — same pattern as AdminOrders. Without these the scroll wheel
  // over the backdrop moves the underlying table (reads as broken on
  // mobile), and Tab escapes into the dimmed list.
  useBodyScrollLock(!!selected);
  const trapRef = useFocusTrap<HTMLDivElement>(!!selected);

  const filtered = useMemo(() => {
    return SHOPIFY_CUSTOMERS_SNAPSHOT.filter(c => {
      if (filter === 'paying' && c.ordersCount === 0) return false;
      if (filter === 'prospects' && c.ordersCount > 0) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        c.email.toLowerCase().includes(q) ||
        (c.firstName ?? '').toLowerCase().includes(q) ||
        (c.lastName ?? '').toLowerCase().includes(q) ||
        (c.city ?? '').toLowerCase().includes(q)
      );
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
            setTimeout(() => window.location.reload(), 400);
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
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher par nom, courriel, ville"
              aria-label="Rechercher par nom, courriel ou ville"
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
                    onClick={() => setSelected(c)}
                    className="border-t border-zinc-100 hover:bg-zinc-50 cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0052CC] to-[#1B3A6B] text-white flex items-center justify-center text-[11px] font-extrabold flex-shrink-0">
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

      {selected && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-labelledby="customer-detail-title"
          onClick={() => setSelected(null)}
        >
          <div ref={trapRef} tabIndex={-1} className="bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl focus:outline-none" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Fermer"
                className="float-right text-zinc-400 hover:text-zinc-700 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] rounded px-1"
              >
                Fermer
              </button>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#0052CC] to-[#1B3A6B] text-white flex items-center justify-center text-lg font-extrabold">
                  {initials(selected)}
                </div>
                <div>
                  <h2 id="customer-detail-title" className="text-xl font-extrabold">{fullName(selected)}</h2>
                  <div className="text-xs text-zinc-500">Client depuis le {formatDate(selected.createdAt)}</div>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <InfoRow icon={Mail} label="Courriel">
                  <a href={`mailto:${selected.email}`} className="text-[#0052CC] hover:underline">
                    {selected.email}
                  </a>
                </InfoRow>
                {selected.phone && (
                  <InfoRow icon={Phone} label="Téléphone">
                    <a href={`tel:${selected.phone}`} className="text-[#0052CC] hover:underline">
                      {selected.phone}
                    </a>
                  </InfoRow>
                )}
                {selected.city && (
                  <InfoRow icon={MapPin} label="Adresse">
                    {selected.city}{selected.province ? `, ${selected.province}` : ''}
                  </InfoRow>
                )}

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-zinc-200">
                  <div className="bg-zinc-50 rounded-xl p-3">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Commandes</div>
                    <div className="text-2xl font-extrabold mt-1">{selected.ordersCount}</div>
                  </div>
                  <div className="bg-zinc-50 rounded-xl p-3">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Dépensé</div>
                    <div className="text-2xl font-extrabold mt-1">
                      {selected.totalSpent.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $
                    </div>
                  </div>
                </div>

                {selected.tags && (
                  <div>
                    <div className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-1">Tags</div>
                    <div className="flex flex-wrap gap-1">
                      {selected.tags.split(',').map((t, i) => (
                        <span key={i} className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700">
                          {t.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <a
                  href={`https://${SHOPIFY_SNAPSHOT_META.shop}/admin/customers/${selected.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0052CC] hover:underline pt-2"
                >
                  Voir dans Shopify Admin
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={15} className="text-zinc-400 mt-0.5 flex-shrink-0" />
      <div>
        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{label}</div>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  );
}
