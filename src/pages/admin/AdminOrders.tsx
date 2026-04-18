import { useEffect, useMemo, useState } from 'react';
import { Search, Filter, Download, RefreshCw, ExternalLink, CheckCircle2 } from 'lucide-react';
import { SHOPIFY_ORDERS_SNAPSHOT, SHOPIFY_SNAPSHOT_META, type ShopifyOrderSnapshot } from '@/data/shopifySnapshot';

type StatusFilter = 'all' | 'paid' | 'pending' | 'fulfilled' | 'awaiting_fulfillment';

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
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `il y a ${days}j`;
}

export default function AdminOrders() {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selected, setSelected] = useState<ShopifyOrderSnapshot | null>(null);
  const [shippedIds, setShippedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('vision-shipped-orders') ?? '[]');
      setShippedIds(new Set(Array.isArray(raw) ? raw : []));
    } catch (e) {
      console.warn('[AdminOrders] Failed to parse shipped orders from localStorage:', e);
    }
  }, []);

  const markShipped = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(shippedIds);
    next.add(id);
    setShippedIds(next);
    try {
      localStorage.setItem('vision-shipped-orders', JSON.stringify([...next]));
    } catch (err) {
      console.warn('[AdminOrders] Could not persist shipped orders:', err);
    }
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
    return augmented.filter(o => {
      if (statusFilter === 'paid' && o.financialStatus !== 'paid') return false;
      if (statusFilter === 'pending' && o.financialStatus !== 'pending') return false;
      if (statusFilter === 'fulfilled' && o.fulfillmentStatus !== 'fulfilled') return false;
      if (statusFilter === 'awaiting_fulfillment' && !(o.financialStatus === 'paid' && !o.fulfillmentStatus)) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        o.customerName.toLowerCase().includes(q) ||
        o.name.toLowerCase().includes(q) ||
        o.email.toLowerCase().includes(q) ||
        String(o.id).includes(q)
      );
    });
  }, [augmented, query, statusFilter]);

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
            className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 border border-zinc-200 rounded-lg hover:bg-zinc-50 bg-white"
            title="Resynchroniser via Zapier"
          >
            <RefreshCw size={15} />
            Resync
          </button>
          <button className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 border border-zinc-200 rounded-lg hover:bg-zinc-50 bg-white">
            <Download size={15} />
            Exporter
          </button>
        </div>
      </header>

      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
        <div className="p-4 flex items-center gap-3 border-b border-zinc-100 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[220px] border border-zinc-200 rounded-lg px-3 py-2 bg-zinc-50">
            <Search size={16} className="text-zinc-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher par client, numéro, courriel"
              className="bg-transparent border-none outline-none text-sm flex-1"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-zinc-400" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white outline-none focus:border-[#0052CC]"
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
                  <td colSpan={7} className="text-center py-12 text-zinc-400 text-sm">
                    Aucune commande trouvée
                  </td>
                </tr>
              ) : (
                filtered.map(o => (
                  <tr
                    key={o.id}
                    onClick={() => setSelected(o)}
                    className="border-t border-zinc-100 hover:bg-zinc-50 cursor-pointer transition-colors"
                  >
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
                          className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md bg-zinc-100 text-zinc-700 hover:bg-emerald-100 hover:text-emerald-700 transition-colors"
                          title="Marquer comme expédié"
                        >
                          <CheckCircle2 size={11} />
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
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex justify-end" onClick={() => setSelected(null)}>
          <div className="bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xs text-zinc-500">Commande Shopify</div>
                  <h2 className="text-xl font-extrabold">{selected.name}</h2>
                </div>
                <button onClick={() => setSelected(null)} className="text-zinc-400 hover:text-zinc-700 text-sm">Fermer</button>
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
                  <div className="text-xs text-zinc-500">{selected.itemsCount} articles</div>
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
