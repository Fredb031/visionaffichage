import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { CartDrawer } from '@/components/CartDrawer';
import { ProductCard } from '@/components/ProductCard';
import { useProducts } from '@/hooks/useProducts';
import { findProductByHandle, PRODUCTS } from '@/data/products';
import { plural } from '@/lib/plural';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useLang } from '@/lib/langContext';
import { Search, SearchX, X } from 'lucide-react';
import { AIChat } from '@/components/AIChat';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

// Categories. Icons removed in the brand-black/blue redesign — the
// label alone is the affordance now, matching the homepage's clean
// typography-driven treatment.
const CATEGORIES: Array<{ id: string; fr: string; en: string }> = [
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
  // URL-backed sort. 'popularity' is the default and maps to the
  // natural Shopify catalog order (no client-side reordering).
  const SORT_VALUES = ['popularity', 'price-asc', 'price-desc'] as const;
  type SortMode = typeof SORT_VALUES[number];
  // Sort resolution order on mount:
  //   1. ?sort=... in the URL (shareable deep-link wins)
  //   2. localStorage['va:products-sort'] (returning visitor's last pick)
  //   3. 'popularity' default
  const SORT_STORAGE_KEY = 'va:products-sort';
  const [activeCategory, setActiveCategory] = useState(initialCat);
  // Hydrate the search field from ?q= so shareable URLs like
  // /products?q=hoodie round-trip back into the same filtered view.
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');
  // Debounce so the filter pipeline + URL sync don't re-fire on every
  // keystroke. Controlled input updates instantly; debounced lags 300ms.
  const debouncedQuery = useDebouncedValue(searchQuery, 300);
  // Lazy initializer: resolve sort once at mount instead of running the
  // IIFE (which reads localStorage and parses ?sort=...) on every render.
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    const raw = searchParams.get('sort');
    if ((SORT_VALUES as readonly string[]).includes(raw ?? '')) return raw as SortMode;
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem(SORT_STORAGE_KEY) : null;
      if (stored && (SORT_VALUES as readonly string[]).includes(stored)) return stored as SortMode;
    } catch {
      /* localStorage blocked — fall through to default */
    }
    return 'popularity';
  });
  // Client-side pagination. Sub-30 catalogs render the whole set.
  const PAGE_SIZE = 30;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  // Recently-viewed strip removed from /produits — hoodie + t-shirt are
  // pinned at the top of the catalog so the strip was redundant. The
  // RecentlyViewed component is still rendered on PDP/cart/account.

  // Keep the URL in sync with category + sort + debounced search.
  useEffect(() => {
    const curCat = searchParams.get('cat') ?? 'overview';
    const curSort = searchParams.get('sort') ?? 'popularity';
    const curQ = searchParams.get('q') ?? '';
    const trimmedQ = debouncedQuery.trim();
    if (activeCategory === curCat && sortMode === curSort && trimmedQ === curQ) return;
    const next = new URLSearchParams(searchParams);
    if (activeCategory === 'overview') next.delete('cat');
    else next.set('cat', activeCategory);
    if (sortMode === 'popularity') next.delete('sort');
    else next.set('sort', sortMode);
    if (trimmedQ === '') next.delete('q');
    else next.set('q', trimmedQ);
    setSearchParams(next, { replace: true });
  }, [activeCategory, sortMode, debouncedQuery, searchParams, setSearchParams]);

  // URL → state so browser Back/Forward updates the visible filter.
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
    if (urlQ !== debouncedQuery.trim()) setSearchQuery(urlQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Persist sort to localStorage so a returning visitor lands on
  // their last pick even without ?sort=...
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(SORT_STORAGE_KEY, sortMode);
    } catch {
      /* localStorage blocked — ignore */
    }
  }, [sortMode]);

  // Active-filter surface: a filter is "active" whenever it's not at
  // its default. Sort is intentionally excluded from the chip row.
  const trimmedDebouncedQuery = debouncedQuery.trim();
  const hasActiveFilters = activeCategory !== 'overview' || trimmedDebouncedQuery !== '';

  const clearAllFilters = () => {
    setActiveCategory('overview');
    setSearchQuery('');
  };

  const activeCategoryLabel = (() => {
    const cat = CATEGORIES.find(c => c.id === activeCategory);
    if (!cat) return '';
    return lang === 'en' ? cat.en : cat.fr;
  })();

  const searchInputRef = useRef<HTMLInputElement>(null);
  // Ref to the main ProductCard grid for arrow-key navigation.
  const gridRef = useRef<HTMLDivElement>(null);

  // Sticky filter bar — sentinel sits where the hero ends. Once it
  // leaves the viewport (user scrolls past hero) the filter strip
  // pins itself under the navbar.
  const filterSentinelRef = useRef<HTMLDivElement>(null);
  const [filterSticky, setFilterSticky] = useState(false);
  useEffect(() => {
    const el = filterSentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      ([entry]) => setFilterSticky(!entry.isIntersecting),
      { threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Arrow-key navigation across the product grid.
  //   ←/→ : previous / next card in DOM order
  //   ↑/↓ : jump one row up / down, preserving column when possible
  const handleGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const key = e.key;
    if (
      key !== 'ArrowRight' && key !== 'ArrowLeft' &&
      key !== 'ArrowDown'  && key !== 'ArrowUp'
    ) return;

    const active = document.activeElement as HTMLElement | null;
    if (active) {
      const tag = active.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (active.isContentEditable) return;
    }

    const grid = gridRef.current;
    if (!grid) return;

    const cards = Array.from(
      grid.querySelectorAll<HTMLElement>(':scope > [role="link"]'),
    );
    if (cards.length === 0) return;

    let currentIndex = -1;
    if (active) {
      const ownerCard = active.closest('[role="link"]') as HTMLElement | null;
      if (ownerCard && grid.contains(ownerCard)) {
        currentIndex = cards.indexOf(ownerCard);
      }
    }
    if (currentIndex === -1) return;

    const tpl = window.getComputedStyle(grid).gridTemplateColumns;
    const cols = Math.max(1, tpl ? tpl.split(' ').filter(Boolean).length : 1);

    let nextIndex = currentIndex;
    switch (key) {
      case 'ArrowRight':
        nextIndex = Math.min(cards.length - 1, currentIndex + 1);
        break;
      case 'ArrowLeft':
        nextIndex = Math.max(0, currentIndex - 1);
        break;
      case 'ArrowDown': {
        const candidate = currentIndex + cols;
        nextIndex = candidate < cards.length ? candidate : cards.length - 1;
        break;
      }
      case 'ArrowUp': {
        const candidate = currentIndex - cols;
        nextIndex = candidate >= 0 ? candidate : 0;
        break;
      }
    }

    if (nextIndex === currentIndex) return;
    e.preventDefault();
    cards[nextIndex]?.focus();
  };

  // Catalog-specific meta description. Bilingual swap on EN toggle.
  useDocumentTitle(
    lang === 'en'
      ? 'Shop — T-shirts, Polos, Hoodies, Jackets | Vision Affichage'
      : 'Boutique — T-shirts, Polos, Hoodies, Vestes | Vision Affichage',
    lang === 'en'
      ? 'Choose your product and customize it with your logo online.'
      : 'Choisissez votre produit et personnalisez-le avec votre logo en ligne.',
    {},
  );

  // Cmd+K (macOS) / Ctrl+K focuses the search input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        setSearchQuery('');
        searchInputRef.current?.blur();
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

  // Curated 3-SKU fallback for empty search states.
  const EMPTY_STATE_POPULAR_SKUS = ['ATC1000', 'ATCF2500', 'ATC6606'] as const;
  const popularSuggestions = useMemo(() => {
    try {
      if (!products || !Array.isArray(products)) return [];
      const matched = EMPTY_STATE_POPULAR_SKUS
        .map(sku => {
          const local = PRODUCTS.find(p => p.sku === sku);
          if (!local) return undefined;
          return products.find(p => {
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
      const seen = new Set<string>();
      return matched.filter(p => {
        const handle = p.node.handle;
        if (seen.has(handle)) return false;
        seen.add(handle);
        return true;
      }).slice(0, 3);
    } catch {
      // silent
      return [];
    }
  }, [products]);
  // Nearest category matches for an empty search.
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
      if (!products || !Array.isArray(products)) return [];
      const safeProducts = products.filter(p => p && p.node && typeof p.node === 'object');
      let result = activeCategory === 'overview'
        ? safeProducts
        : safeProducts.filter(p => {
            try {
              return matchesCategory(p, activeCategory);
            } catch {
              // silent
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
        const sorted = [...result];
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
    } catch {
      // silent
      return [];
    }
  }, [products, activeCategory, debouncedQuery, sortMode]);

  // Reset pagination whenever the filter surface changes.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeCategory, debouncedQuery, sortMode]);

  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, Math.min(visibleCount, filteredProducts.length)),
    [filteredProducts, visibleCount],
  );
  const hasMore = visibleProducts.length < filteredProducts.length;

  // Screen-reader announcement for filtered count, debounced.
  const liveRegionMessage = useMemo(() => {
    if (isLoading) {
      return lang === 'en' ? 'Loading products\u2026' : 'Chargement des produits\u2026';
    }
    const count = filteredProducts.length;
    const trimmed = debouncedQuery.trim();
    if (count === 0 && trimmed) {
      return lang === 'en'
        ? `No results for \u00ab ${trimmed} \u00bb`
        : `Aucun r\u00e9sultat pour \u00ab ${trimmed} \u00bb`;
    }
    if (count === 0) return '';
    return lang === 'en'
      ? plural(count, { one: '{count} product shown', other: '{count} products shown' }, 'en')
      : plural(count, { one: '{count} produit affich\u00e9s', other: '{count} produits affich\u00e9s' }, 'fr');
  }, [isLoading, filteredProducts, debouncedQuery, lang]);

  // ----- Render helpers ---------------------------------------------------
  // The filter strip (categories + sort) appears in two places: inside
  // the hero AND in the sticky drop-in bar that snaps under the navbar
  // once the user scrolls past the hero. Both share this single source.
  const renderFilterStrip = (variant: 'hero' | 'sticky') => {
    const onLight = variant === 'sticky';
    return (
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div
          className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 md:flex-1 md:min-w-0 md:flex-wrap md:overflow-visible snap-x snap-mandatory md:snap-none"
          role="tablist"
          aria-label={lang === 'en' ? 'Product categories' : 'Catégories de produits'}
        >
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id && !searchQuery;
            return (
              <button
                key={cat.id}
                onClick={() => selectCategory(cat.id)}
                role="tab"
                aria-selected={isActive}
                aria-current={isActive ? 'page' : undefined}
                className={`text-[13px] font-bold px-4 py-2 whitespace-nowrap cursor-pointer transition-all rounded-full border snap-start focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2 ${
                  isActive
                    ? 'bg-[#0052CC] text-white border-[#0052CC]'
                    : onLight
                      ? 'bg-white text-[#374151] border-[#E5E7EB] hover:border-[#0052CC] hover:text-[#0A0A0A]'
                      : 'bg-white text-[#374151] border-[#E5E7EB] hover:border-white hover:text-[#0A0A0A]'
                }`}
              >
                {lang === 'en' ? cat.en : cat.fr}
              </button>
            );
          })}
        </div>

        {/* Sort dropdown */}
        <div className="flex items-center gap-2 pb-1 md:pb-0 md:shrink-0">
          <label
            htmlFor={variant === 'hero' ? 'sort-mode' : 'sort-mode-sticky'}
            className={`text-[11px] font-semibold tracking-wide uppercase whitespace-nowrap ${onLight ? 'text-[#374151]' : 'text-white/60'}`}
          >
            {lang === 'en' ? 'Sort' : 'Trier'}
          </label>
          <select
            id={variant === 'hero' ? 'sort-mode' : 'sort-mode-sticky'}
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            aria-label={lang === 'en' ? 'Sort products' : 'Trier les produits'}
            className={`text-[12px] font-bold rounded-full px-3 py-1.5 outline-none focus:ring-2 focus:ring-[#0052CC] focus:ring-offset-2 cursor-pointer transition-colors border ${
              onLight
                ? 'bg-white text-[#0A0A0A] border-[#E5E7EB] hover:border-[#0052CC]'
                : 'bg-white/10 text-white border-white/20 hover:bg-white/15'
            }`}
          >
            <option value="popularity" className="text-[#0A0A0A]">{lang === 'en' ? 'Popular' : 'Populaire'}</option>
            <option value="price-asc" className="text-[#0A0A0A]">{lang === 'en' ? 'Price ↑' : 'Prix ↑'}</option>
            <option value="price-desc" className="text-[#0A0A0A]">{lang === 'en' ? 'Price ↓' : 'Prix ↓'}</option>
          </select>
        </div>
      </div>
    );
  };

  return (
    <div id="main-content" tabIndex={-1} className="min-h-screen bg-background focus:outline-none">
      <Navbar onOpenCart={() => setCartOpen(true)} />
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />

      {/* Visually-hidden live region announcing the filtered product
          count to screen readers. Persists across renders. */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {liveRegionMessage}
      </div>

      {/* ============================================================
          1. HERO — brand-black, tight, loss-aversion-adjacent copy.
          Mirrors the homepage redesign at c08e02e: bg-[#0A0A0A],
          brand-blue accent, brand-blue CTA, single trust strip.
          ============================================================ */}
      <section className="relative bg-[#0A0A0A] px-6 md:px-10 pt-[88px] pb-14 md:pb-16">
        <div className="relative max-w-[1200px] mx-auto">
          <div className="text-[11px] font-bold tracking-[2.5px] uppercase text-[#0052CC] mb-3">
            {lang === 'en'
              ? 'Made in Québec · 5 business days'
              : 'Fabriqué au Québec · 5 jours ouvrables'}
          </div>
          <h1
            className="font-bold text-white tracking-[-1.5px] leading-[1.02] text-[clamp(32px,5.2vw,64px)] max-w-[920px]"
            style={{ fontFamily: '"DM Sans", system-ui, -apple-system, "Segoe UI", sans-serif', fontWeight: 800 }}
          >
            {lang === 'en' ? (
              <>Your professional uniforms — <span className="text-[#0052CC]">delivered in 5 days.</span></>
            ) : (
              <>Tes uniformes professionnels — <span className="text-[#0052CC]">livrés en 5 jours.</span></>
            )}
          </h1>
          <p className="mt-5 text-[15px] md:text-[17px] text-white/75 max-w-[640px] leading-relaxed">
            {lang === 'en'
              ? 'T-shirts, polos, hoodies, jackets, caps. Personalized with your logo. Starting at one piece.'
              : 'T-shirts, polos, hoodies, vestes, casquettes. Personnalisés avec ton logo. À partir d\u2019une seule pièce.'}
          </p>

          {/* Single trust strip */}
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] md:text-[13px] text-white/70">
            <span className="font-bold">
              {lang === 'en' ? `${PRODUCTS.length} customizable products` : `${PRODUCTS.length} produits personnalisables`}
            </span>
            <span aria-hidden="true" className="text-white/30">·</span>
            <span>{lang === 'en' ? 'No minimum order' : 'Aucun minimum'}</span>
            <span aria-hidden="true" className="text-white/30">·</span>
            <span>{lang === 'en' ? 'Free shipping $300+' : 'Livraison gratuite 300$+'}</span>
          </div>

          {/* Search */}
          <div className="relative mt-7 max-w-[520px]">
            <Search aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'en' ? 'Search products… (\u2318K)' : 'Rechercher… (\u2318K)'}
              aria-label={lang === 'en' ? 'Search products' : 'Rechercher des produits'}
              aria-keyshortcuts="Meta+K"
              className="w-full pl-11 pr-10 h-12 text-[14px] rounded-full bg-white/10 text-white placeholder:text-white/40 border border-white/20 focus:outline-none focus:ring-2 focus:ring-[#0052CC] focus:border-transparent transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label={lang === 'en' ? 'Clear search' : 'Effacer la recherche'}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 inline-flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Filter strip — categories + sort */}
          <div className="mt-7">
            {renderFilterStrip('hero')}
          </div>
        </div>

        {/* Sentinel: when this leaves the viewport (user scrolls past
            the hero), the sticky filter bar above the grid drops in. */}
        <div ref={filterSentinelRef} aria-hidden="true" className="absolute bottom-0 left-0 h-px w-full pointer-events-none" />
      </section>

      {/* Sticky filter bar — appears under the navbar once the user
          scrolls past the hero. Clean white background with the same
          pill controls so the filter never feels lost. */}
      <div
        className={`sticky top-[58px] z-30 bg-white/95 backdrop-blur-md border-b border-[#E5E7EB] transition-opacity duration-200 ${
          filterSticky ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!filterSticky}
      >
        <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-3">
          {renderFilterStrip('sticky')}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-10 pb-32">
        {isLoading ? (
          // Skeleton mirrors ProductCard's real DOM so the catalog
          // doesn't visually jump when the fetch resolves.
          <div
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5"
            role="status"
            aria-live="polite"
            aria-label={lang === 'en' ? 'Loading products' : 'Chargement des produits'}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="va-skel-card border border-border rounded-[18px] overflow-hidden bg-card"
                aria-hidden="true"
              >
                <div
                  className="va-skel-block relative overflow-hidden bg-secondary"
                  style={{ aspectRatio: '1' }}
                />
                <div className="p-3.5 pb-4">
                  <div className="va-skel-block h-3 w-3/4 rounded bg-secondary mb-2" />
                  <div className="va-skel-block h-2.5 w-1/2 rounded bg-secondary mb-3" />
                  <div className="va-skel-block h-3 w-1/3 rounded bg-secondary" />
                </div>
              </div>
            ))}
            <span className="sr-only">{lang === 'en' ? 'Loading products…' : 'Chargement des produits…'}</span>
            <style>{`
              @keyframes va-skel-shimmer {
                0%   { background-position: -200% 0; }
                100% { background-position: 200% 0; }
              }
              .va-skel-block {
                background-image: linear-gradient(
                  90deg,
                  hsl(var(--secondary)) 0%,
                  hsl(var(--muted)) 50%,
                  hsl(var(--secondary)) 100%
                );
                background-size: 200% 100%;
                animation: va-skel-shimmer 1.4s ease-in-out infinite;
              }
              @media (prefers-reduced-motion: reduce) {
                .va-skel-block {
                  animation: none;
                  background-image: none;
                }
              }
            `}</style>
          </div>
        ) : isError ? (
          // Storefront error — scoped retry button.
          <div className="text-center py-20" role="alert">
            <p className="text-[#0A0A0A] text-lg font-bold mb-2">
              {lang === 'en' ? 'Couldn\u2019t load the catalog' : 'Impossible de charger le catalogue'}
            </p>
            <p className="text-sm text-[#374151] mb-5">
              {lang === 'en'
                ? 'Check your connection and try again.'
                : 'Vérifie ta connexion et réessaie.'}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 text-sm font-extrabold text-white bg-[#0052CC] px-6 py-3 rounded-full shadow-[0_10px_30px_rgba(0,82,204,0.4)] hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(0,82,204,0.55)] transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-[#0052CC]/50 focus-visible:ring-offset-2"
            >
              {lang === 'en' ? 'Retry' : 'Réessayer'}
            </button>
          </div>
        ) : !products || products.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[#374151] text-lg">
              {lang === 'en' ? 'No products found' : 'Aucun produit trouvé'}
            </p>
          </div>
        ) : (
          <>
            {/* Active-filter chip row + global Reset. Only rendered
                when at least one filter is non-default. */}
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-2 mb-6">
                {activeCategory !== 'overview' && (
                  <span
                    className="inline-flex items-center gap-1.5 text-[12px] font-semibold rounded-full bg-[#F3F4F6] text-[#0A0A0A] pl-3 pr-1 py-1"
                    aria-label={lang === 'en' ? `Category: ${activeCategoryLabel}` : `Catégorie : ${activeCategoryLabel}`}
                  >
                    <span>
                      {lang === 'en' ? 'Category: ' : 'Catégorie\u202f: '}
                      <span className="font-bold">{activeCategoryLabel}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveCategory('overview')}
                      aria-label={lang === 'en' ? `Remove category filter ${activeCategoryLabel}` : `Retirer la catégorie ${activeCategoryLabel}`}
                      className="inline-flex items-center justify-center w-5 h-5 rounded-full hover:bg-[#0A0A0A]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]"
                    >
                      <X className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </span>
                )}
                {trimmedDebouncedQuery !== '' && (
                  <span
                    className="inline-flex items-center gap-1.5 text-[12px] font-semibold rounded-full bg-[#F3F4F6] text-[#0A0A0A] pl-3 pr-1 py-1"
                    aria-label={lang === 'en' ? `Search: ${trimmedDebouncedQuery}` : `Recherche : ${trimmedDebouncedQuery}`}
                  >
                    <span>
                      {lang === 'en' ? 'Search: ' : 'Recherche\u202f: '}
                      <span className="font-bold">{trimmedDebouncedQuery}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label={lang === 'en' ? 'Clear search filter' : 'Effacer la recherche'}
                      className="inline-flex items-center justify-center w-5 h-5 rounded-full hover:bg-[#0A0A0A]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]"
                    >
                      <X className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </span>
                )}
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#0052CC] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2 rounded-full px-2 py-1"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                  {lang === 'en' ? 'Clear filters' : 'Réinitialiser les filtres'}
                </button>
              </div>
            )}

            {/* Single result count line — replaces the redundant h2 +
                breadth meta paragraph from the previous design. */}
            {filteredProducts.length > 0 && (
              <p className="text-[12px] text-[#374151] mb-5">
                {lang === 'en'
                  ? plural(filteredProducts.length, { one: '{count} product', other: '{count} products' }, 'en')
                  : plural(filteredProducts.length, { one: '{count} produit', other: '{count} produits' }, 'fr')}
              </p>
            )}

            {filteredProducts.length === 0 ? (
              <div className="py-12">
                {searchQuery ? (
                  // Search-driven empty state.
                  <>
                    <div className="mx-auto max-w-[480px] text-center flex flex-col items-center">
                      <div className="w-16 h-16 rounded-full bg-[#F3F4F6] flex items-center justify-center mb-5" aria-hidden="true">
                        <SearchX className="w-7 h-7 text-[#6B7280]" />
                      </div>
                      <h2 className="text-xl md:text-2xl font-extrabold text-[#0A0A0A] mb-2">
                        {lang === 'en' ? 'No results' : 'Aucun r\u00e9sultat'}
                      </h2>
                      <p className="text-sm text-[#374151] mb-1">
                        {lang === 'en'
                          ? `for \u00ab ${searchQuery} \u00bb`
                          : `pour \u00ab ${searchQuery} \u00bb`}
                      </p>
                      <p className="text-sm text-[#374151] mb-5">
                        {lang === 'en'
                          ? 'Try adjusting your filters or explore our best-sellers below.'
                          : 'Ajuste tes filtres ou explore nos best-sellers ci-dessous.'}
                      </p>
                      <button
                        type="button"
                        onClick={clearAllFilters}
                        className="inline-flex items-center gap-2 text-sm font-extrabold text-white bg-[#0052CC] px-6 py-2.5 rounded-full shadow-[0_10px_30px_rgba(0,82,204,0.4)] hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(0,82,204,0.55)] transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-[#0052CC]/50 focus-visible:ring-offset-2"
                      >
                        <X className="w-4 h-4" aria-hidden="true" />
                        {lang === 'en' ? 'Clear filters' : 'R\u00e9initialiser les filtres'}
                      </button>
                    </div>

                    {nearestCategories.length > 0 && (
                      <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
                        <span className="text-[12px] text-[#6B7280]">
                          {lang === 'en' ? 'Try a category:' : 'Essaie une cat\u00e9gorie :'}
                        </span>
                        {nearestCategories.map(cat => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => selectCategory(cat.id)}
                            className="text-[12px] font-bold px-3 py-1.5 rounded-full bg-white text-[#374151] border border-[#E5E7EB] hover:bg-[#0052CC] hover:text-white hover:border-[#0052CC] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2"
                          >
                            {lang === 'en' ? cat.en : cat.fr}
                          </button>
                        ))}
                      </div>
                    )}

                    {popularSuggestions.length > 0 && (
                      <div className="mt-10">
                        <div className="flex items-baseline justify-between gap-3 mb-4 flex-wrap">
                          <h3 className="text-lg font-extrabold text-[#0A0A0A]">
                            {lang === 'en' ? 'Popular' : 'Populaires'}
                          </h3>
                          <button
                            type="button"
                            onClick={() => {
                              setSearchQuery('');
                              setActiveCategory('overview');
                            }}
                            className="text-[12px] font-bold text-[#0052CC] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2 rounded"
                          >
                            {lang === 'en' ? 'See all \u2192' : 'Voir tous \u2192'}
                          </button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
                          {popularSuggestions.map((product, i) => {
                            const key = product?.node?.id ?? product?.node?.handle ?? `pop-${i}`;
                            try {
                              return <ProductCard key={key} product={product} />;
                            } catch {
                              // silent
                              return null;
                            }
                          })}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  // Truly empty catalog slice — no search to clear.
                  <div className="mx-auto max-w-[480px] text-center flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-[#F3F4F6] flex items-center justify-center mb-5" aria-hidden="true">
                      <SearchX className="w-7 h-7 text-[#6B7280]" />
                    </div>
                    <h2 className="text-xl md:text-2xl font-extrabold text-[#0A0A0A] mb-2">
                      {lang === 'en' ? 'No results' : 'Aucun r\u00e9sultat'}
                    </h2>
                    <p className="text-sm text-[#374151] mb-5">
                      {lang === 'en'
                        ? 'Try adjusting your filters or browse the full catalog.'
                        : 'Ajuste tes filtres ou parcours le catalogue complet.'}
                    </p>
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="inline-flex items-center gap-2 text-sm font-extrabold text-white bg-[#0052CC] px-6 py-2.5 rounded-full shadow-[0_10px_30px_rgba(0,82,204,0.4)] hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(0,82,204,0.55)] transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-[#0052CC]/50 focus-visible:ring-offset-2"
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                      {lang === 'en' ? 'Clear filters' : 'R\u00e9initialiser les filtres'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div
                  ref={gridRef}
                  onKeyDown={handleGridKeyDown}
                  className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5"
                >
                {visibleProducts.map((product, i) => {
                  const key = product?.node?.id ?? product?.node?.handle ?? `idx-${i}`;
                  try {
                    return <ProductCard key={key} product={product} eager={i < 4} highlight={debouncedQuery} />;
                  } catch {
                    // silent
                    return null;
                  }
                })}
                </div>

                {/* Pagination footer — only when filtered set > PAGE_SIZE. */}
                {filteredProducts.length > PAGE_SIZE && (
                  <div className="mt-10 flex flex-col items-center gap-4">
                    <p className="text-[12px] text-[#374151]" aria-live="polite">
                      {lang === 'en'
                        ? `Showing 1-${visibleProducts.length} of ${filteredProducts.length}`
                        : `Affichage de 1-${visibleProducts.length} sur ${filteredProducts.length}`}
                    </p>
                    {hasMore && (
                      <button
                        type="button"
                        onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                        className="w-full md:w-auto inline-flex items-center justify-center gap-2 text-sm font-extrabold text-white bg-[#0052CC] px-9 h-[52px] rounded-full shadow-[0_10px_30px_rgba(0,82,204,0.4)] hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(0,82,204,0.55)] transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-[#0052CC]/50 focus-visible:ring-offset-2"
                      >
                        {lang === 'en' ? 'Load more' : 'Charger plus'}
                      </button>
                    )}
                  </div>
                )}
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
