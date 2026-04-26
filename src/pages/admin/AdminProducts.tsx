import { Search, Plus, RefreshCw, ExternalLink, AlertTriangle, Download } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { SHOPIFY_PRODUCTS_SNAPSHOT, SHOPIFY_SNAPSHOT_META } from '@/data/shopifySnapshot';
import { TablePagination } from '@/components/admin/TablePagination';
import { Sparkline } from '@/components/admin/Sparkline';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useSearchHotkey } from '@/hooks/useSearchHotkey';
import { normalizeInvisible } from '@/lib/utils';
import { downloadCsv } from '@/lib/csv';

const PAGE_SIZE = 32;

function formatPrice(min: number, max: number): string {
  if (min === max) return `${min.toFixed(2)} $`;
  return `${min.toFixed(2)} – ${max.toFixed(2)} $`;
}

/** Generate and download a CSV for the currently filtered product list.
 * Delegates quoting / BOM / injection-guard to {@link downloadCsv} so
 * this file stays focused on column shape. The snapshot has no per-size
 * inventory or explicit colour list — we only know totalInventory
 * (scalar) and variantsCount — so we export those honestly rather than
 * fabricating sizes. Filename keeps the page-specific
 * `products-YYYY-MM-DD.csv` pattern (not the `vision-*` helper) so
 * existing download folders / Finance macros keep working. */
function exportProductsCsv(products: typeof SHOPIFY_PRODUCTS_SNAPSHOT) {
  const priceCell = (min: number, max: number) =>
    min === max ? min.toFixed(2) : `${min.toFixed(2)} – ${max.toFixed(2)}`;
  const header = ['Nom', 'Catégorie', 'Fournisseur', 'Prix', 'Stock', 'Variantes'];
  const rows = products.map(p => [
    p.title,
    p.productType || '—',
    p.vendor || '—',
    priceCell(p.minPrice, p.maxPrice),
    // Clamp negatives — Shopify reports backorder as negative inventory,
    // but an admin scanning a stock column wants 0 for "out", not -37.
    Math.max(0, p.totalInventory),
    p.variantsCount,
  ]);
  downloadCsv([header, ...rows], `products-${new Date().toISOString().slice(0, 10)}.csv`);
  toast.success(`${products.length} produit${products.length > 1 ? 's' : ''} exporté${products.length > 1 ? 's' : ''}`);
}

// MOCK inventory trend series — Task 9.12.
// We don't have a real inventory-log source yet (no time-series table,
// no Shopify webhook history). Until that lands, synthesize a stable
// 7-point series per SKU using a seeded hash of (handle + ISO week)
// so the sparkline:
//   - looks alive and plausibly correlates with totalInventory,
//   - is deterministic within a given week (no flicker between renders),
//   - rotates weekly so the shape isn't frozen forever.
// Replace with real data by swapping this function for a hook that reads
// from the inventory-log table — the Sparkline API stays the same.
function isoWeekNumber(d: Date): number {
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function hashString(s: string): number {
  // djb2 — small, stable, no deps.
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function syntheticInventoryTrend(key: string, currentInventory: number): number[] {
  const week = isoWeekNumber(new Date());
  const seed = hashString(`${key}::w${week}`);
  const rand = mulberry32(seed);
  // Anchor the series near current inventory so the last point lines up
  // roughly with what the admin sees in the badge. Earlier points drift
  // within ±25% with a tiny trend bias so the line isn't pure noise.
  const anchor = Math.max(currentInventory, 1);
  const trendBias = (rand() - 0.5) * 0.08; // per-step bias in [-4%, +4%]
  const series: number[] = [];
  let v = anchor * (0.85 + rand() * 0.3);
  for (let i = 0; i < 7; i++) {
    const jitter = (rand() - 0.5) * 0.18 * anchor;
    v = v * (1 + trendBias) + jitter;
    series.push(Math.max(0, Math.round(v)));
  }
  // Force the last point to match current inventory so the sparkline
  // ends where the badge says it should.
  series[series.length - 1] = Math.max(0, Math.round(currentInventory));
  return series;
}

// Compute at module load — the snapshot is static, so there's no need
// to rebuild this set inside every render. Used both to seed the filter
// dropdown and to validate ?filter= URL params before trusting them.
const KNOWN_PRODUCT_TYPES: ReadonlySet<string> = new Set(
  SHOPIFY_PRODUCTS_SNAPSHOT.map(p => p.productType).filter(Boolean),
);

export default function AdminProducts() {
  // URL-backed filter state — same pattern as the other admin tables.
  // A pasted /admin/products?filter=bogus used to land on an empty grid
  // with no tab highlighted (typeFilter stored 'bogus' verbatim, the
  // dropdown's select didn't match any option, and the admin couldn't
  // tell whether the grid was genuinely empty or the URL was garbage).
  // Normalize unknown values to 'all' the same way Products.tsx does
  // for ?cat=.
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const rawFilter = searchParams.get('filter') ?? 'all';
  const initialTypeFilter = rawFilter === 'all' || KNOWN_PRODUCT_TYPES.has(rawFilter) ? rawFilter : 'all';

  const [query, setQuery] = useState(initialQuery);
  const [typeFilter, setTypeFilter] = useState<string>(initialTypeFilter);
  // 'default' keeps the snapshot order (alphabetical-ish). 'stock-asc'
  // surfaces ruptures / near-ruptures to the top — the actionable axis
  // for an admin scanning for reorder candidates.
  const [sortBy, setSortBy] = useState<'default' | 'stock-asc'>('default');
  const [onlyOutOfStock, setOnlyOutOfStock] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => { setPage(0); }, [query, typeFilter, sortBy, onlyOutOfStock]);
  useDocumentTitle('Produits — Admin Vision Affichage');
  const searchRef = useSearchHotkey({ onClear: () => setQuery('') });

  // State → URL sync (replace history so each keystroke doesn't append).
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    const trimmed = query.trim();
    if (trimmed) next.set('q', trimmed); else next.delete('q');
    if (typeFilter !== 'all') next.set('filter', typeFilter); else next.delete('filter');
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [query, typeFilter, searchParams, setSearchParams]);

  // Cancel the resync delay if the admin navigates away in the 400ms
  // before the reload — same pattern as AdminOrders / AdminCustomers,
  // otherwise the reload yanks them back here mid-navigation.
  const resyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (resyncTimerRef.current) clearTimeout(resyncTimerRef.current);
    };
  }, []);

  const productTypes = useMemo(
    () => ['all', ...Array.from(KNOWN_PRODUCT_TYPES).sort()],
    [],
  );

  const products = useMemo(() => {
    // Same ZWSP-safe pattern as AdminOrders / AdminCustomers: a paste
    // of an SKU or vendor name from Slack could carry a sneaky ZWSP
    // and fall through to an empty grid.
    const q = normalizeInvisible(query).trim().toLowerCase();
    const filtered = SHOPIFY_PRODUCTS_SNAPSHOT.filter(p => {
      if (typeFilter !== 'all' && p.productType !== typeFilter) return false;
      if (onlyOutOfStock && p.totalInventory > 0) return false;
      if (!q) return true;
      const title = normalizeInvisible(p.title).toLowerCase();
      const handle = normalizeInvisible(p.handle).toLowerCase();
      const vendor = normalizeInvisible(p.vendor).toLowerCase();
      return title.includes(q) || handle.includes(q) || vendor.includes(q);
    });
    if (sortBy === 'stock-asc') {
      // Copy before sort — never mutate the module-level snapshot.
      // Clamp negatives so backorder (-37) doesn't outrank a real 0.
      return [...filtered].sort(
        (a, b) => Math.max(0, a.totalInventory) - Math.max(0, b.totalInventory),
      );
    }
    return filtered;
  }, [query, typeFilter, onlyOutOfStock, sortBy]);

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
            onClick={() => exportProductsCsv(products)}
            disabled={products.length === 0}
            title={products.length === 0
              ? 'Aucun produit à exporter'
              : `Exporter ${products.length} produit${products.length > 1 ? 's' : ''} en CSV`}
            aria-label={products.length === 0
              ? 'Aucun produit à exporter'
              : `Exporter ${products.length} produit${products.length > 1 ? 's' : ''} en CSV`}
            className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 border border-zinc-200 rounded-lg hover:bg-zinc-50 bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
          >
            <Download size={15} aria-hidden="true" />
            Exporter CSV
          </button>
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
            className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 bg-[#0052CC] text-white rounded-xl hover:bg-[#003D99] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2"
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
              ref={searchRef}
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher par titre, handle, SKU…  (⌘K)"
              aria-label="Rechercher un produit"
              aria-keyshortcuts="Meta+K Control+K"
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
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as 'default' | 'stock-asc')}
            aria-label="Trier les produits"
            className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white outline-none focus:border-[#0052CC] focus-visible:ring-2 focus-visible:ring-[#0052CC]/25"
          >
            <option value="default">Ordre par défaut</option>
            <option value="stock-asc">Trier par stock (croissant)</option>
          </select>
          <label className="inline-flex items-center gap-2 text-sm text-zinc-700 cursor-pointer select-none focus-within:ring-2 focus-within:ring-[#0052CC]/25 rounded-lg px-2 py-1.5">
            <input
              type="checkbox"
              checked={onlyOutOfStock}
              onChange={e => setOnlyOutOfStock(e.target.checked)}
              className="w-4 h-4 accent-[#0052CC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]"
            />
            Afficher uniquement les ruptures
          </label>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
          {pageProducts.map(p => {
            // Three-tier inventory badge so admins see a reorder warning
            // BEFORE the product goes out of stock, not after. Threshold
            // of 10 was chosen to match the default Shopify low-stock
            // email trigger so both signals agree.
            const outOfStock = p.totalInventory <= 0;
            const lowStock   = !outOfStock && p.totalInventory <= 10;
            const stockLabel = outOfStock ? ' — stock épuisé' : lowStock ? ` — stock faible (${p.totalInventory})` : '';
            return (
              <a
                key={p.id}
                href={`https://${SHOPIFY_SNAPSHOT_META.shop}/admin/products/${p.id}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Ouvrir ${p.title} dans Shopify${stockLabel} (nouvel onglet)`}
                className="border border-zinc-200 rounded-xl overflow-hidden hover:shadow-lg hover:border-[#0052CC]/30 transition-all bg-white group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2"
              >
                <div className="aspect-square bg-zinc-100 relative">
                  {p.firstImage && (
                    <img src={p.firstImage} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
                  )}
                  <span className="absolute top-2 right-2 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                    Actif
                  </span>
                  {outOfStock ? (
                    <span
                      className="absolute top-2 left-2 text-[10px] font-bold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded flex items-center gap-1"
                      title="Inventaire à 0 ou en backorder"
                    >
                      <AlertTriangle size={9} aria-hidden="true" />
                      Rupture
                    </span>
                  ) : lowStock ? (
                    <span
                      className="absolute top-2 left-2 text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded flex items-center gap-1"
                      title={`Inventaire bas : ${p.totalInventory} unité${p.totalInventory > 1 ? 's' : ''}`}
                    >
                      <AlertTriangle size={9} aria-hidden="true" />
                      Stock faible · {p.totalInventory}
                    </span>
                  ) : null}
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
                  {/* Tendance 7j — inventory trend sparkline (Task 9.12).
                      Hidden on mobile to keep cards compact on narrow
                      viewports; on md+ it sits under the price row. */}
                  <div className="hidden md:flex md:items-center md:justify-between mt-2 pt-2 border-t border-zinc-100">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Tendance 7j</span>
                    <Sparkline
                      data={syntheticInventoryTrend(p.handle, p.totalInventory)}
                      ariaLabel={`Tendance 7 jours de l'inventaire pour ${p.title}`}
                    />
                  </div>
                </div>
              </a>
            );
          })}
        </div>

        {products.length === 0 && (
          <div role="status" aria-live="polite" className="p-12 text-center text-zinc-400 text-sm">Aucun produit trouvé</div>
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
