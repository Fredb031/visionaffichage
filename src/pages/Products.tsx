import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { CartDrawer } from '@/components/CartDrawer';
import { ProductCard } from '@/components/ProductCard';
import { RecentlyViewed } from '@/components/RecentlyViewed';
import { useProducts } from '@/hooks/useProducts';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { findProductByHandle, PRODUCTS } from '@/data/products';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useLang } from '@/lib/langContext';
import { Search, X } from 'lucide-react';
import { AIChat } from '@/components/AIChat';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

const CATEGORIES = [
  { id: 'overview',  fr: 'Tout',                 en: 'All' },
  { id: 'chandails', fr: 'Chandails',            en: 'Sweaters' },
  { id: 'tshirts',   fr: 'T-Shirts',             en: 'T-Shirts' },
  { id: 'polos',     fr: 'Polos',                en: 'Polos' },
  { id: 'headwear',  fr: 'Casquettes & Tuques',  en: 'Caps & Beanies' },
];

function matchesCategory(
  product: { node: { handle: string; productType: string; title: string } },
  catId: string,
): boolean {
  // Defensive: a malformed product could be missing node or any of
  // its fields. Return false for unknown products (they won't appear
  // in a category view) rather than crashing the whole grid.
  const handle = product?.node?.handle;
  if (!handle) return false;
  const local = findProductByHandle(handle);

  if (!local) return false;
  switch (catId) {
    case 'chandails': return ['hoodie','crewneck'].includes(local.category);
    case 'tshirts':   return ['tshirt','longsleeve','sport'].includes(local.category);
    case 'polos':     return local.category === 'polo';
    case 'headwear':  return ['cap','toque'].includes(local.category);
    default:          return true;
  }
}

export default function Products() {
  const { lang } = useLang();
  const { data: products, isLoading, isError, refetch } = useProducts();
  const [cartOpen, setCartOpen] = useState(false);
  // Read the category off ?cat= on first mount so footer links like
  // /products?cat=tshirts land directly on the right filter, and so a
  // refresh or back-nav preserves the selected category.
  const [searchParams, setSearchParams] = useSearchParams();
  // Validate ?cat=... against the known category list on first mount.
  // Without this, pasting /products?cat=xyz landed in a weird state: the
  // grid showed 'all products' (matchesCategory's default branch) while
  // no tab in the filter bar was highlighted, so the user had no cue
  // that the param was garbage. Fall back to 'overview' instead.
  const KNOWN_CATS = new Set(['overview', 'chandails', 'tshirts', 'polos', 'headwear']);
  const rawCat = searchParams.get('cat');
  const initialCat = rawCat && KNOWN_CATS.has(rawCat) ? rawCat : 'overview';
  // Task 2.2 — URL-backed sort. 'popularity' is the default and maps to
  // the natural Shopify catalog order (no client-side reordering). The
  // 'newest' option that the spec mentions is gated on a createdAt /
  // publishedAt field which the current PRODUCTS_QUERY doesn't request
  // and ShopifyProduct doesn't expose — intentionally omitted here per
  // task instructions ("otherwise skip this option") so we don't ship a
  // dropdown entry that silently behaves like the default.
  const SORT_VALUES = ['popularity', 'price-asc', 'price-desc'] as const;
  type SortMode = typeof SORT_VALUES[number];
  const initialSort: SortMode = (() => {
    const raw = searchParams.get('sort');
    return (SORT_VALUES as readonly string[]).includes(raw ?? '') ? (raw as SortMode) : 'popularity';
  })();
  const [activeCategory, setActiveCategory] = useState(initialCat);
  // Hydrate the search field from ?q= so shareable URLs like
  // /products?q=hoodie round-trip back into the same filtered view.
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');
  // Task 7.11 — debounce the search query so the filter AND the URL
  // sync don't re-fire on every keystroke. The controlled input value
  // (`searchQuery`) updates instantly so typing never feels laggy,
  // while `debouncedQuery` lags 300ms and is what actually drives the
  // expensive filter pipeline and the history.replaceState in the URL
  // sync effect below.
  const debouncedQuery = useDebouncedValue(searchQuery, 300);
  const [sortMode, setSortMode] = useState<SortMode>(initialSort);
  // Task 2.16 — surface a RecentlyViewed row above the catalog grid so
  // returning visitors see their last-browsed items one click away.
  // Gated at >=2 items: a fresh visitor (0) or a single-view visitor
  // (1) would otherwise see a near-empty strip that reads as clutter.
  const { handles: recentlyViewedHandles } = useRecentlyViewed();
  const showRecentlyViewed = recentlyViewedHandles.length >= 2;

  // Keep the URL in sync with category + sort + debounced search —
  // replace history so Back still returns to the previous page. All
  // three params are combined in a single pass so we don't fire
  // consecutive history replaces, and the search param is keyed off
  // `debouncedQuery` (not `searchQuery`) so we don't push a new URL
  // on every keystroke while the user is still typing.
  useEffect(() => {
    const curCat = searchParams.get('cat') ?? 'overview';
    const curSort = searchParams.get('sort') ?? 'popularity';
    const curQ = searchParams.get('q') ?? '';
    const trimmedQ = debouncedQuery.trim();
    if (activeCategory === curCat && sortMode === curSort && trimmedQ === curQ) return;
    const next = new URLSearchParams(searchParams);
    if (activeCategory === 'overview') next.delete('cat');
    else next.set('cat', activeCategory);
    // popularity is the default — omit from the URL so a fresh /products
    // link stays clean and shareable ?sort=... URLs stay meaningful.
    if (sortMode === 'popularity') next.delete('sort');
    else next.set('sort', sortMode);
    // Empty search is the default — omit ?q= entirely instead of
    // leaving ?q= dangling in the URL bar.
    if (trimmedQ === '') next.delete('q');
    else next.set('q', trimmedQ);
    setSearchParams(next, { replace: true });
  }, [activeCategory, sortMode, debouncedQuery, searchParams, setSearchParams]);

  // Also sync URL → state so browser Back/Forward actually updates the
  // visible filter. Without this, the state → URL effect above would
  // notice the mismatch and shove the URL back to the previous filter,
  // silently cancelling the user's nav intent.
  useEffect(() => {
    const urlCatRaw = searchParams.get('cat') ?? 'overview';
    const urlCat = KNOWN_CATS.has(urlCatRaw) ? urlCatRaw : 'overview';
    const urlSortRaw = searchParams.get('sort') ?? 'popularity';
    const urlSort: SortMode = (SORT_VALUES as readonly string[]).includes(urlSortRaw)
      ? (urlSortRaw as SortMode)
      : 'popularity';
    const urlQ = searchParams.get('q') ?? '';
    if (urlCat !== activeCategory) setActiveCategory(urlCat);
    if (urlSort !== sortMode) setSortMode(urlSort);
    // Only push back into searchQuery when the URL's q differs from
    // the already-debounced copy. Comparing against debouncedQuery
    // (not searchQuery) avoids a feedback loop where mid-typing the
    // URL-sync effect hasn't yet written the new q, and we'd clobber
    // the live input with the stale URL value on every re-render.
    if (urlQ !== debouncedQuery.trim()) setSearchQuery(urlQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const searchDesktopRef = useRef<HTMLInputElement>(null);
  const searchMobileRef  = useRef<HTMLInputElement>(null);

  useDocumentTitle(lang === 'en' ? 'Products — Vision Affichage' : 'Produits — Vision Affichage');

  // Cmd+K (macOS) / Ctrl+K (Windows/Linux) focuses the search input —
  // standard power-user shortcut on commerce sites (Linear, Vercel, etc.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // Focus whichever input is visible (CSS hides one or the other)
        const desktop = searchDesktopRef.current;
        const mobile  = searchMobileRef.current;
        const desktopVisible = desktop && desktop.offsetParent !== null;
        (desktopVisible ? desktop : mobile)?.focus();
      } else if (e.key === 'Escape' && document.activeElement === searchDesktopRef.current) {
        // Esc clears search when input is focused
        setSearchQuery('');
        searchDesktopRef.current?.blur();
      } else if (e.key === 'Escape' && document.activeElement === searchMobileRef.current) {
        setSearchQuery('');
        searchMobileRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const selectCategory = (catId: string) => {
    setActiveCategory(catId);
    setSearchQuery('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Popular product suggestions shown when a search yields nothing.
  // Task 2.4: surface a curated 3-SKU fallback (ATC1000 cotton tee,
  // ATCF2500 hoodie, ATC6606 cap) so the user always has a one-click
  // path to a real product page even if their query was a typo.
  // We map those SKUs onto the live Shopify list (which may not include
  // every local SKU) and keep first 3 matches.
  const EMPTY_STATE_POPULAR_SKUS = ['ATC1000', 'ATCF2500', 'ATC6606'] as const;
  const popularSuggestions = useMemo(() => {
    try {
      // Defensive: products can be null/undefined while loading, or if
      // Shopify returned a malformed payload that React Query still
      // accepted. Guarding with Array.isArray covers both nullish and
      // "it was an object, not a list" cases.
      if (!products || !Array.isArray(products)) return [];
      const matched = EMPTY_STATE_POPULAR_SKUS
        .map(sku => {
          const local = PRODUCTS.find(p => p.sku === sku);
          if (!local) return undefined;
          return products.find(p => {
            // A NEW product could come back without a handle/title —
            // don't blow up .toLowerCase() on undefined.
            const handle = p?.node?.handle ?? '';
            const title = p?.node?.title ?? '';
            return (
              handle === local.shopifyHandle ||
              handle.toLowerCase().includes(sku.toLowerCase()) ||
              title.toLowerCase().includes(sku.toLowerCase())
            );
          });
        })
        .filter((p): p is NonNullable<typeof p> => Boolean(p?.node?.handle));
      // Dedupe by handle in case two SKUs map to the same Shopify product.
      const seen = new Set<string>();
      return matched.filter(p => {
        const handle = p.node.handle;
        if (seen.has(handle)) return false;
        seen.add(handle);
        return true;
      }).slice(0, 3);
    } catch (err) {
      console.warn('[Products] popularSuggestions failed, returning []', err);
      return [];
    }
  }, [products]);
  // Nearest category matches for an empty search. A category is
  // "near" if its label (FR or EN) contains any token from the query,
  // or vice-versa — e.g. searching "tshrt" surfaces T-Shirts because
  // "tsh" is a shared substring after the typo.
  const nearestCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const tokens = q.split(/\s+/).filter(Boolean);
    return CATEGORIES.filter(cat => {
      if (cat.id === 'overview') return false;
      const fr = cat.fr.toLowerCase();
      const en = cat.en.toLowerCase();
      return tokens.some(tok =>
        fr.includes(tok) || en.includes(tok) || tok.includes(cat.id) || cat.id.includes(tok)
      );
    }).slice(0, 3);
  }, [searchQuery]);

  const filteredProducts = useMemo(() => {
    try {
      // Defensive: Shopify (or a buggy intermediate cache) could hand
      // back null/undefined/non-array. Coerce to [] so the grid simply
      // renders the empty state instead of throwing on .filter().
      if (!products || !Array.isArray(products)) return [];
      // Filter out entries missing the critical `node` sub-tree up
      // front — every downstream read assumes it exists.
      const safeProducts = products.filter(p => p && p.node && typeof p.node === 'object');
      let result = activeCategory === 'overview'
        ? safeProducts
        : safeProducts.filter(p => {
            try {
              return matchesCategory(p, activeCategory);
            } catch (err) {
              console.warn('[Products] matchesCategory threw, skipping product', p?.node?.handle, err);
              return false;
            }
          });
      if (debouncedQuery.trim()) {
        const q = debouncedQuery.toLowerCase();
        result = result.filter(p => {
          const title = p?.node?.title ?? '';
          const handle = p?.node?.handle ?? '';
          return title.toLowerCase().includes(q) || handle.toLowerCase().includes(q);
        });
      }
      if (sortMode !== 'popularity') {
        // Copy before sort — useMemo would otherwise mutate the upstream
        // products array and invalidate React Query's cached reference.
        // Array.prototype.sort in modern V8/JSC is stable (ECMA-262
        // since ES2019), so equal prices keep their natural-catalog
        // relative order as the task requires.
        const sorted = [...result];
        // Defensive: a NEW product or partial response may be missing
        // priceRange.minVariantPrice.amount entirely. Optional chain +
        // NaN-safe fallback keeps sort stable instead of flinging items
        // to the front/back unpredictably.
        const priceOf = (p: typeof result[number]) => {
          const raw = p?.node?.priceRange?.minVariantPrice?.amount;
          const n = raw != null ? parseFloat(raw) : NaN;
          return Number.isFinite(n) ? n : 0;
        };
        switch (sortMode) {
          case 'price-asc':
            sorted.sort((a, b) => priceOf(a) - priceOf(b));
            break;
          case 'price-desc':
            sorted.sort((a, b) => priceOf(b) - priceOf(a));
            break;
        }
        result = sorted;
      }
      return result;
    } catch (err) {
      console.warn('[Products] filteredProducts failed, falling back to []', err);
      return [];
    }
  }, [products, activeCategory, debouncedQuery, sortMode]);

  return (
    <div id="main-content" tabIndex={-1} className="min-h-screen bg-background focus:outline-none">
      <Navbar onOpenCart={() => setCartOpen(true)} />
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />

      {/* Banner — premium hero */}
      <div className="pt-[58px]">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#0F2341] via-[#1B3A6B] to-[#0F2341] px-6 md:px-10 pt-[44px] pb-2">
          {/* Subtle radial accent */}
          <div
            className="absolute top-0 right-0 w-[500px] h-[500px] pointer-events-none opacity-40"
            style={{ background: 'radial-gradient(circle at 70% 0%, hsla(40, 82%, 55%, 0.18) 0%, transparent 60%)' }}
            aria-hidden="true"
          />
          <div className="relative max-w-[1200px] mx-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 text-[10px] font-bold tracking-[2px] uppercase text-[#E8A838] mb-3">
                  <span>⚡</span>
                  {lang === 'en' ? 'Made in Québec · 5 business days' : 'Fabriqué au Québec · 5 jours ouvrables'}
                </div>
                <h1 className="text-3xl md:text-5xl font-extrabold tracking-[-1px] text-primary-foreground mb-2 leading-[1.05]">
                  {lang === 'en' ? (
                    <>Dress your team<br /><span className="text-[#E8A838]">to your image.</span></>
                  ) : (
                    <>Habille ton équipe<br /><span className="text-[#E8A838]">à ton image.</span></>
                  )}
                </h1>
                <p className="text-[13px] text-primary-foreground/60 mb-4">
                  {lang === 'en'
                    ? `${PRODUCTS.length} customizable products · No minimum order`
                    : `${PRODUCTS.length} produits personnalisables · Aucun minimum`}
                </p>
              </div>

              {/* Desktop search */}
              <div className="relative hidden md:flex items-center mt-2">
                <Search aria-hidden="true" className="absolute left-3 w-[15px] h-[15px] text-primary-foreground/50 pointer-events-none" />
                <input
                  ref={searchDesktopRef}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={lang === 'en' ? 'Search products… (⌘K)' : 'Rechercher… (⌘K)'}
                  aria-label={lang === 'en' ? 'Search products' : 'Rechercher des produits'}
                  aria-keyshortcuts="Meta+K"
                  className="pl-9 pr-8 py-[9px] text-[13px] rounded-xl bg-white/10 text-primary-foreground placeholder:text-primary-foreground/40 border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/25 transition-all w-56"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label={lang === 'en' ? 'Clear search' : 'Effacer la recherche'}
                    className="absolute right-2.5 text-primary-foreground/60 hover:text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            {/* Mobile search */}
            <div className="relative flex md:hidden items-center mb-4">
              <Search aria-hidden="true" className="absolute left-3 w-[15px] h-[15px] text-primary-foreground/50 pointer-events-none" />
              <input
                ref={searchMobileRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={lang === 'en' ? 'Search products…' : 'Rechercher…'}
                aria-label={lang === 'en' ? 'Search products' : 'Rechercher des produits'}
                className="w-full pl-9 pr-11 py-[9px] text-[13px] rounded-xl bg-white/10 text-primary-foreground placeholder:text-primary-foreground/40 border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/25 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label={lang === 'en' ? 'Clear search' : 'Effacer la recherche'}
                  className="absolute right-0 inset-y-0 w-11 flex items-center justify-center text-primary-foreground/60 hover:text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded-r-xl"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Category tabs row — pill tabs on the left, sort dropdown on the right (desktop). Stacks on mobile. */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-4">
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 md:flex-1 md:min-w-0" role="tablist" aria-label={lang === 'en' ? 'Product categories' : 'Catégories de produits'}>
                {CATEGORIES.map((cat) => {
                  const isActive = activeCategory === cat.id && !searchQuery;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => selectCategory(cat.id)}
                      role="tab"
                      aria-selected={isActive}
                      aria-current={isActive ? 'page' : undefined}
                      className={`text-[12px] font-bold px-4 py-2 whitespace-nowrap cursor-pointer transition-all rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1B3A6B] ${
                        isActive
                          ? 'bg-white text-[#1B3A6B] shadow-md'
                          : 'bg-white/10 text-white/70 hover:bg-white/15 hover:text-white'
                      }`}
                    >
                      {lang === 'en' ? cat.en : cat.fr}
                    </button>
                  );
                })}
              </div>

              {/* Sort dropdown — stacks under tabs on mobile, sits top-right on desktop */}
              <div className="flex items-center gap-2 pb-1 md:pb-0 md:shrink-0">
                <label htmlFor="sort-mode" className="text-[11px] font-semibold tracking-wide uppercase text-white/60 whitespace-nowrap">
                  {lang === 'en' ? 'Sort' : 'Trier'}
                </label>
                <select
                  id="sort-mode"
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as SortMode)}
                  aria-label={lang === 'en' ? 'Sort products' : 'Trier les produits'}
                  className="text-[12px] font-bold bg-white/10 text-white border border-white/20 rounded-full px-3 py-1.5 outline-none focus:ring-2 focus:ring-white/70 focus:ring-offset-2 focus:ring-offset-[#1B3A6B] cursor-pointer hover:bg-white/15 transition-colors"
                >
                  <option value="popularity" className="text-foreground">{lang === 'en' ? 'Popular' : 'Populaire'}</option>
                  <option value="price-asc" className="text-foreground">{lang === 'en' ? 'Price ↑' : 'Prix ↑'}</option>
                  <option value="price-desc" className="text-foreground">{lang === 'en' ? 'Price ↓' : 'Prix ↓'}</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-9 pb-32">
        {isLoading ? (
          <div
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5"
            role="status"
            aria-live="polite"
            aria-label={lang === 'en' ? 'Loading products' : 'Chargement des produits'}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-2xl bg-secondary animate-pulse" aria-hidden="true" />
            ))}
            <span className="sr-only">{lang === 'en' ? 'Loading products…' : 'Chargement des produits…'}</span>
          </div>
        ) : isError ? (
          // Shopify Storefront returned an error (network, auth, 5xx).
          // Before this, we just showed "no products" with no way to
          // recover — the customer had to reload the whole tab to
          // retry. Give them a scoped retry button.
          <div className="text-center py-20" role="alert">
            <p className="text-foreground text-lg font-bold mb-2">
              {lang === 'en' ? 'Couldn\u2019t load the catalog' : 'Impossible de charger le catalogue'}
            </p>
            <p className="text-sm text-muted-foreground mb-5">
              {lang === 'en'
                ? 'Check your connection and try again.'
                : 'Vérifie ta connexion et réessaie.'}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 text-sm font-extrabold text-primary-foreground gradient-navy px-6 py-3 rounded-full shadow-navy focus:outline-none focus-visible:ring-4 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2"
            >
              {lang === 'en' ? 'Retry' : 'Réessayer'}
            </button>
          </div>
        ) : !products || products.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg">
              {lang === 'en' ? 'No products found' : 'Aucun produit trouvé'}
            </p>
          </div>
        ) : (
          <>
            {searchQuery && (
              <div className="flex items-center gap-3 mb-5 flex-wrap">
                <span className="text-[13px] text-muted-foreground">
                  {lang === 'en'
                    ? `Results for "${searchQuery}"`
                    : `Résultats pour \u00ab ${searchQuery} \u00bb`}
                </span>
              </div>
            )}

            {activeCategory !== 'overview' && !searchQuery && (
              <h2 className="text-xl font-extrabold text-foreground mb-[18px]">
                {lang === 'en'
                  ? CATEGORIES.find(c => c.id === activeCategory)?.en
                  : CATEGORIES.find(c => c.id === activeCategory)?.fr}
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  {filteredProducts.length}{' '}
                  {lang === 'en'
                    ? `product${filteredProducts.length !== 1 ? 's' : ''}`
                    : `produit${filteredProducts.length !== 1 ? 's' : ''}`}
                </span>
              </h2>
            )}

            {/* Result count — sort control lives up in the category tabs row now */}
            {filteredProducts.length > 1 && activeCategory === 'overview' && !searchQuery && (
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <span className="text-[12px] text-muted-foreground">
                  {filteredProducts.length}{' '}
                  {lang === 'en'
                    ? `product${filteredProducts.length !== 1 ? 's' : ''}`
                    : `produit${filteredProducts.length !== 1 ? 's' : ''}`}
                </span>
              </div>
            )}

            {filteredProducts.length === 0 ? (
              <div className="py-12">
                {searchQuery ? (
                  // Search-driven empty state: big muted Search icon,
                  // friendly heading echoing the query, helper subtext,
                  // a Clear-search button, nearest-category chips, and
                  // a 3-card Populaires row of curated best-sellers.
                  <>
                    <div className="mx-auto max-w-[480px] text-center flex flex-col items-center">
                      <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-5" aria-hidden="true">
                        <Search className="w-7 h-7 text-muted-foreground" />
                      </div>
                      <h2 className="text-xl md:text-2xl font-extrabold text-foreground mb-2">
                        {lang === 'en'
                          ? `No results for \u00ab ${searchQuery} \u00bb`
                          : `Aucun r\u00e9sultat pour \u00ab ${searchQuery} \u00bb`}
                      </h2>
                      <p className="text-sm text-muted-foreground mb-5">
                        {lang === 'en'
                          ? 'Try another keyword or explore our best-sellers below.'
                          : 'Essayez un autre mot ou explorez nos best-sellers ci-dessous.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setActiveCategory('overview');
                        }}
                        className="inline-flex items-center gap-2 text-sm font-extrabold text-primary-foreground gradient-navy px-6 py-2.5 rounded-full shadow-navy focus:outline-none focus-visible:ring-4 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2"
                      >
                        <X className="w-4 h-4" aria-hidden="true" />
                        {lang === 'en' ? 'Clear search' : 'Effacer la recherche'}
                      </button>
                    </div>

                    {nearestCategories.length > 0 && (
                      <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
                        <span className="text-[12px] text-muted-foreground">
                          {lang === 'en' ? 'Try a category:' : 'Essaie une cat\u00e9gorie :'}
                        </span>
                        {nearestCategories.map(cat => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => selectCategory(cat.id)}
                            className="text-[12px] font-bold px-3 py-1.5 rounded-full bg-secondary text-foreground hover:bg-primary hover:text-primary-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                          >
                            {lang === 'en' ? cat.en : cat.fr}
                          </button>
                        ))}
                      </div>
                    )}

                    {popularSuggestions.length > 0 && (
                      <div className="mt-10">
                        <div className="flex items-baseline justify-between gap-3 mb-4 flex-wrap">
                          <h3 className="text-lg font-extrabold text-foreground">
                            {lang === 'en' ? 'Popular' : 'Populaires'}
                          </h3>
                          <button
                            type="button"
                            onClick={() => {
                              setSearchQuery('');
                              setActiveCategory('overview');
                            }}
                            className="text-[12px] font-bold text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
                          >
                            {lang === 'en' ? 'See all \u2192' : 'Voir tous \u2192'}
                          </button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
                          {popularSuggestions.map((product, i) => {
                            const key = product?.node?.id ?? product?.node?.handle ?? `pop-${i}`;
                            try {
                              return <ProductCard key={key} product={product} />;
                            } catch (err) {
                              console.warn('[Products] popular ProductCard threw, skipping', key, err);
                              return null;
                            }
                          })}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  // Truly empty catalog slice: a category filter matched
                  // nothing. No search to clear — instead, a "Voir tout"
                  // button resets the category filter back to overview.
                  <div className="mx-auto max-w-[480px] text-center flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-5" aria-hidden="true">
                      <Search className="w-7 h-7 text-muted-foreground" />
                    </div>
                    <p className="text-base text-foreground font-semibold mb-5">
                      {lang === 'en'
                        ? 'No products in this category.'
                        : 'Aucun produit dans cette cat\u00e9gorie.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveCategory('overview')}
                      className="inline-flex items-center gap-2 text-sm font-extrabold text-primary-foreground gradient-navy px-6 py-2.5 rounded-full shadow-navy focus:outline-none focus-visible:ring-4 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2"
                    >
                      {lang === 'en' ? 'See all' : 'Voir tout'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {showRecentlyViewed && (
                  // Task 2.16 — rendered inside the same max-w-[1200px] container
                  // as the grid so its edges align with the product cards below.
                  // RecentlyViewed internally renders a 2-col mobile / 4-col
                  // desktop grid which reads as a horizontal strip on narrow
                  // viewports and a tidy row on wide ones. Capped at 6 via the
                  // `limit` prop so it never outruns the grid width.
                  <div className="mb-8">
                    <RecentlyViewed limit={6} />
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                {filteredProducts.map((product, i) => {
                  // Defensive key fallback: an id might be missing on a
                  // brand-new product. Fall back to handle, then to
                  // index — React just needs uniqueness within the list.
                  const key = product?.node?.id ?? product?.node?.handle ?? `idx-${i}`;
                  try {
                    // First row is above the fold (2-col mobile, 4-col desktop)
                    // — mark those eager so the LCP image isn't lazy-loaded.
                    return <ProductCard key={key} product={product} eager={i < 4} />;
                  } catch (err) {
                    console.warn('[Products] ProductCard threw, skipping', key, err);
                    return null;
                  }
                })}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <AIChat />
      <BottomNav />
    </div>
  );
}

