import { Search, Plus, RefreshCw, ExternalLink, AlertTriangle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { SHOPIFY_PRODUCTS_SNAPSHOT, SHOPIFY_SNAPSHOT_META } from '@/data/shopifySnapshot';
import { TablePagination } from '@/components/admin/TablePagination';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { normalizeInvisible } from '@/lib/utils';

const PAGE_SIZE = 32;

function formatPrice(min: number, max: number): string {
  if (min === max) return `${min.toFixed(2)} $`;
  return `${min.toFixed(2)} – ${max.toFixed(2)} $`;
}

export default function AdminProducts() {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [page, setPage] = useState(0);

  useEffect(() => { setPage(0); }, [query, typeFilter]);
  useDocumentTitle('Produits — Admin Vision Affichage');

  // Cancel the resync delay if the admin navigates away in the 400ms
  // before the reload — same pattern as AdminOrders / AdminCustomers,
  // otherwise the reload yanks them back here mid-navigation.
  const resyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (resyncTimerRef.current) clearTimeout(resyncTimerRef.current);
    };
  }, []);

  const productTypes = useMemo(() => {
    const set = new Set(SHOPIFY_PRODUCTS_SNAPSHOT.map(p => p.productType).filter(Boolean));
    return ['all', ...Array.from(set).sort()];
  }, []);

  const products = useMemo(() => {
    // Same ZWSP-safe pattern as AdminOrders / AdminCustomers: a paste
    // of an SKU or vendor name from Slack could carry a sneaky ZWSP
    // and fall through to an empty grid.
    const q = normalizeInvisible(query).trim().toLowerCase();
    return SHOPIFY_PRODUCTS_SNAPSHOT.filter(p => {
      if (typeFilter !== 'all' && p.productType !== typeFilter) return false;
      if (!q) return true;
      const title = normalizeInvisible(p.title).toLowerCase();
      const handle = normalizeInvisible(p.handle).toLowerCase();
      const vendor = normalizeInvisible(p.vendor).toLowerCase();
      return title.includes(q) || handle.includes(q) || vendor.includes(q);
    });
  }, [query, typeFilter]);

  const pageProducts = useMemo(
    () => products.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [products, page],
  );

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Produits Shopify</h1>
          <p className="text-sm text-zinc-500 mt-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {SHOPIFY_PRODUCTS_SNAPSHOT.length} produits actifs
            </span>
            <span className="text-zinc-400">·</span>
            <span>Synchronisés il y a quelques minutes</span>
          </p>
        </div>
        <div className="flex gap-2">
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
            Resynchroniser
          </button>
          <a
            href={`https://${SHOPIFY_SNAPSHOT_META.shop}/admin/products/new`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 bg-[#0052CC] text-white rounded-lg hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2"
          >
            <Plus size={15} aria-hidden="true" />
            Nouveau produit
            <span className="sr-only">(ouvre Shopify dans un nouvel onglet)</span>
          </a>
        </div>
      </header>

      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
        <div className="p-4 flex items-center gap-3 border-b border-zinc-100 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[220px] border border-zinc-200 rounded-lg px-3 py-2 bg-zinc-50">
            <Search size={16} className="text-zinc-400" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher par titre, handle, SKU…"
              aria-label="Rechercher un produit"
              className="bg-transparent border-none outline-none text-sm flex-1"
            />
          </div>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            aria-label="Filtrer par type de produit"
            className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white outline-none focus:border-[#0052CC] focus-visible:ring-2 focus-visible:ring-[#0052CC]/25"
          >
            {productTypes.map(t => (
              <option key={t} value={t}>{t === 'all' ? 'Tous les types' : t || 'Sans type'}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
          {pageProducts.map(p => {
            const lowStock = p.totalInventory <= 0;
            return (
              <a
                key={p.id}
                href={`https://${SHOPIFY_SNAPSHOT_META.shop}/admin/products/${p.id}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Ouvrir ${p.title} dans Shopify${lowStock ? ' — stock épuisé' : ''} (nouvel onglet)`}
                className="border border-zinc-200 rounded-xl overflow-hidden hover:shadow-lg hover:border-[#0052CC]/30 transition-all bg-white group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2"
              >
                <div className="aspect-square bg-zinc-100 relative">
                  {p.firstImage && (
                    <img src={p.firstImage} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
                  )}
                  <span className="absolute top-2 right-2 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                    Actif
                  </span>
                  {lowStock && (
                    <span className="absolute top-2 left-2 text-[10px] font-bold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded flex items-center gap-1">
                      <AlertTriangle size={9} aria-hidden="true" />
                      Stock
                    </span>
                  )}
                  <div className="absolute inset-0 bg-[#0052CC]/0 group-hover:bg-[#0052CC]/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                    <span className="bg-white text-[#0052CC] px-3 py-1.5 rounded-full text-xs font-bold shadow-md flex items-center gap-1">
                      Voir <ExternalLink size={11} aria-hidden="true" />
                    </span>
                  </div>
                </div>
                <div className="p-3">
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{p.productType || '—'}</div>
                  <div className="text-sm font-bold leading-tight truncate mt-0.5" title={p.title}>{p.title}</div>
                  <div className="flex items-baseline justify-between mt-1.5">
                    <div className="text-[13px] font-extrabold text-[#0052CC]">
                      {formatPrice(p.minPrice, p.maxPrice)}
                    </div>
                    <div className="text-[10px] text-zinc-400">
                      {p.variantsCount} var.
                    </div>
                  </div>
                </div>
              </a>
            );
          })}
        </div>

        {products.length === 0 && (
          <div className="p-12 text-center text-zinc-400 text-sm">Aucun produit trouvé</div>
        )}

        <TablePagination
          page={page}
          pageSize={PAGE_SIZE}
          total={products.length}
          onPageChange={setPage}
          itemLabel="produits"
        />
      </div>
    </div>
  );
}
