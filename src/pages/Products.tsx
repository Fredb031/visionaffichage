import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { CartDrawer } from '@/components/CartDrawer';
import { ProductCard } from '@/components/ProductCard';
import { RecentlyViewed } from '@/components/RecentlyViewed';
import { useProducts } from '@/hooks/useProducts';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { findProductByHandle, matchProductByTitle, PRODUCTS } from '@/data/products';
import { filterRealColors } from '@/lib/colorFilter';
import { plural } from '@/lib/plural';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useLang } from '@/lib/langContext';
import { Search, SearchX, X, Sparkles, Shirt, Shell, Snowflake, type LucideIcon } from 'lucide-react';
import { AIChat } from '@/components/AIChat';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

// Task 2.1 — each category now carries a lucide icon so the tab row
// reads as a visual shortcut rather than a wall of text. Icons picked
// for quickest recognition:
//   overview  -> Sparkles  (generic "see everything / featured")
//   chandails -> Shirt     (hoodies/crewnecks — same silhouette family)
//   tshirts   -> Shirt     (the canonical tee)
//   polos     -> Shirt     (same silhouette; active-state accent disambiguates)
//   headwear  -> Shell     (rounded cap-like silhouette; lucide has no dedicated cap)
// Snowflake kept in the import for later toques-only split if headwear
// is ever broken into caps vs toques.
const CATEGORIES: Array<{ id: string; fr: string; en: string; icon: LucideIcon }> = [
  { id: 'overview',  fr: 'Tout',                 en: 'All',            icon: Sparkles },
  { id: 'chandails', fr: 'Chandails',            en: 'Sweaters',       icon: Shirt },
  { id: 'tshirts',   fr: 'T-Shirts',             en: 'T-Shirts',       icon: Shirt },
  { id: 'polos',     fr: 'Polos',                en: 'Polos',          icon: Shirt },
  { id: 'headwear',  fr: 'Casquettes & Tuques',  en: 'Caps & Beanies', icon: Shell },
];
// Suppress unused-warning for Snowflake — kept intentionally for the
// future toques-only split (see CATEGORIES comment above).
void Snowflake;

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
  // Sort resolution order on mount:
  //   1. ?sort=... in the URL (shareable deep-link wins)
  //   2. localStorage['va:products-sort'] (returning visitor's last pick)
  //   3. 'popularity' default
  // localStorage is wrapped because SSR / strict private-mode Safari can
  // throw on access; we silently swallow and fall through to the default.
  const SORT_STORAGE_KEY = 'va:products-sort';
  const initialSort: SortMode = (() => {
    const raw = searchParams.get('sort');
    if ((SORT_VALUES as readonly string[]).includes(raw ?? '')) return raw as SortMode;
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem(SORT_STORAGE_KEY) : null;
      if (stored && (SORT_VALUES as readonly string[]).includes(stored)) return stored as SortMode;
    } catch {
      /* localStorage blocked — fall through to default */
    }
    return 'popularity';
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
  // Task 2.17 — client-side pagination. Sub-30 catalogs render the
  // whole set (page size equals 30, so the first page already covers
  // today's 22-product baseline). Once the filtered count crosses 30
  // we reveal 30 more per "Charger plus" click instead of paying for
  // the full grid's initial paint cost. Counter resets to PAGE_SIZE
  // on any filter/sort/search change (see effect below).
  const PAGE_SIZE = 30;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
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
  // Persist the sort mode to localStorage so a returning visitor lands
  // on their last pick even without a ?sort=... URL. The URL still wins
  // on mount (see initialSort) — this just captures the quiet default
  // case where the shopper lands on bare /products.
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(SORT_STORAGE_KEY, sortMode);
    } catch {
      /* localStorage blocked (private mode, quota, etc.) — ignore */
    }
  }, [sortMode]);

  // Active-filter surface: a filter is "active" whenever it's not at
  // its default. Category default is 'overview' and search default is
  // the empty string. Sort is intentionally excluded from the chip row
  // and the Réinitialiser-les-filtres action — it always has a value
  // and a dedicated dropdown already, so wiping it on "clear filters"
  // would surprise more than help.
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

  const searchDesktopRef = useRef<HTMLInputElement>(null);
  const searchMobileRef  = useRef<HTMLInputElement>(null);
  // Task 2.19 — ref to the main ProductCard grid. Arrow-key navigation
  // walks the role="link" children of this node, so we don't need to
  // wire per-card refs (the card list is already keyed and stable).
  const gridRef = useRef<HTMLDivElement>(null);

  // Task 2.19 — arrow-key navigation across the product grid.
  //   ←/→ : previous / next card in DOM order
  //   ↑/↓ : jump one row up / down, preserving the column when possible
  //   Enter : already handled by ProductCard's own onKeyDown, so we
  //           leave it alone here (no synthetic click needed).
  // The column count is read from the grid's computed
  // grid-template-columns — that way we stay honest to whatever
  // Tailwind breakpoint is active (2/3/4/5 cols) without hard-coding
  // breakpoints in JS. Keys are ignored when focus is inside an
  // input/textarea/select (or a contentEditable) so the search bar's
  // native caret movement still works.
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

    // Only the immediate card children carry role="link" — nested
    // buttons (wishlist, customize) are <button> so this selector
    // can't accidentally pick them up.
    const cards = Array.from(
      grid.querySelectorAll<HTMLElement>(':scope > [role="link"]'),
    );
    if (cards.length === 0) return;

    // Resolve which card currently holds (or contains) focus. When
    // a nested control like the wishlist heart is focused, we still
    // want arrow keys to move to the neighbouring card, so we walk
    // up to the nearest role=link ancestor inside the grid.
    let currentIndex = -1;
    if (active) {
      const ownerCard = active.closest('[role="link"]') as HTMLElement | null;
      if (ownerCard && grid.contains(ownerCard)) {
        currentIndex = cards.indexOf(ownerCard);
      }
    }
    if (currentIndex === -1) return; // arrow key fired outside the grid

    // Column count from the computed grid-template-columns — a space-
    // separated list of track sizes ("200px 200px 200px"). Length of
    // the split gives us the live column count regardless of the
    // Tailwind breakpoint that produced it. Fallback of 1 keeps the
    // math safe if the style isn't computed yet (SSR/first paint).
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
        // Jump one row. If the target row has fewer cards than the
        // current column (last row partial), clamp to the last card
        // so we don't fall off the grid.
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

  // Task 8.12 — catalog-specific meta description. Google SERP for
  // "/products" previously inherited the homepage default, so the
  // snippet pitched "personnalise tes vêtements" instead of the catalog
  // itself. Bilingual copy swaps when the user toggles EN.
  useDocumentTitle(
    lang === 'en' ? 'Products — Vision Affichage' : 'Produits — Vision Affichage',
    lang === 'en'
      ? 'Full catalog of customizable merch — t-shirts, hoodies, polos, caps. Secure checkout, printed in Québec.'
      : 'Catalogue complet de merchs personnalisables — t-shirts, hoodies, polos, casquettes. Paiement sécurisé, imprimé au Québec.',
    // Task 8.5 — /products shares the same default og-image as / since
    // the catalog page is a generic entry point rather than a specific
    // product. og:type stays 'website' (product type is reserved for
    // the PDP so Facebook / LinkedIn can surface price widgets).
    {},
  );

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

  // Task 2.17 — reset pagination whenever the filter surface changes
  // (category, debounced search, or sort). Scroll back to top so the
  // shopper doesn't land mid-page on a newly narrowed result set.
  // Guarded on the client (typeof window) so SSR/tests don't blow up.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeCategory, debouncedQuery, sortMode]);

  // Task 2.17 — slice applied just before render. Using min() keeps us
  // safe when the filter tightens mid-page (e.g. 60 -> 12) before the
  // reset effect above has a chance to run.
  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, Math.min(visibleCount, filteredProducts.length)),
    [filteredProducts, visibleCount],
  );
  const hasMore = visibleProducts.length < filteredProducts.length;

  // Task 2.15 — total real-color count across the currently filtered
  // products. We resolve each Shopify product back to its local entry
  // (same handle→then→title fallback ProductCard uses) and sum
  // `filterRealColors` so the headline number matches exactly what the
  // cards below advertise — no ghost variants padding the total.
  const totalRealColors = useMemo(() => {
    let sum = 0;
    for (const p of filteredProducts) {
      const handle = p?.node?.handle ?? '';
      const title = p?.node?.title ?? '';
      const local = (handle && findProductByHandle(handle))
        || (title && matchProductByTitle(title))
        || null;
      if (!local) continue;
      try {
        sum += filterRealColors(local.sku, local.colors).length;
      } catch (err) {
        console.warn('[Products] filterRealColors threw for', local.sku, err);
      }
    }
    return sum;
  }, [filteredProducts]);

  // Task 6.10 — screen-reader announcement for the filtered product
  // count. Keyed off `debouncedQuery` (not `searchQuery`) via
  // filteredProducts so AT users hear the SETTLED result once per
  // 300ms debounce, not a torrent of "1 product… 0 products… 3
  // products…" as they type each letter. `aria-live=polite` yields to
  // the user's typing; `aria-atomic` forces the whole message to
  // re-announce even when only the numeric prefix changed.
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

  return (
    <div id="main-content" tabIndex={-1} className="min-h-screen bg-background focus:outline-none">
      <Navbar onOpenCart={() => setCartOpen(true)} />
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />

      {/* Task 6.10 — visually-hidden live region announcing the filtered
          product count to screen readers. Kept OUTSIDE the main content
          branches (loading / error / grid) so the same node persists
          across renders — React swapping a role=status node in and out
          can cause AT to miss the announcement on some engines. */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {liveRegionMessage}
      </div>

      {/* Banner — premium hero */}
      <div className="pt-[58px]">
        <div className="relative overflow-hidden bg-brand-black px-6 md:px-10 pt-[44px] pb-2">
          {/* Subtle radial accent */}
          <div
            className="absolute top-0 right-0 w-[500px] h-[500px] pointer-events-none opacity-40"
            style={{ background: 'radial-gradient(circle at 70% 0%, rgba(0, 82, 204, 0.22) 0%, transparent 60%)' }}
            aria-hidden="true"
          />
          <div className="relative max-w-[1200px] mx-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 text-[10px] font-bold tracking-[2px] uppercase text-brand-blue mb-3">
                  <span>⚡</span>
                  {lang === 'en' ? 'Made in Québec · 5 business days' : 'Fabriqué au Québec · 5 jours ouvrables'}
                </div>
                <h1 className="text-3xl md:text-5xl font-extrabold tracking-[-1px] text-brand-white mb-2 leading-[1.05]">
                  {lang === 'en' ? (
                    <>Dress your team<br /><span className="text-brand-blue">to your image.</span></>
                  ) : (
                    <>Habille ton équipe<br /><span className="text-brand-blue">à ton image.</span></>
                  )}
                </h1>
                <p className="text-[13px] text-brand-white/60 mb-4">
                  {lang === 'en'
                    ? `${PRODUCTS.length} customizable products · No minimum order`
                    : `${PRODUCTS.length} produits personnalisables · Aucun minimum`}
                </p>
              </div>

              {/* Desktop search */}
              <div className="relative hidden md:flex items-center mt-2">
                <Search aria-hidden="true" className="absolute left-3 w-[15px] h-[15px] text-brand-white/50 pointer-events-none" />
                <input
                  ref={searchDesktopRef}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={lang === 'en' ? 'Search products… (⌘K)' : 'Rechercher… (⌘K)'}
                  aria-label={lang === 'en' ? 'Search products' : 'Rechercher des produits'}
                  aria-keyshortcuts="Meta+K"
                  className="pl-9 pr-8 py-[9px] text-[13px] rounded-xl bg-brand-white/10 text-brand-white placeholder:text-brand-white/40 border border-brand-white/20 focus:outline-none focus:ring-2 focus:ring-brand-white/25 transition-all w-56"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label={lang === 'en' ? 'Clear search' : 'Effacer la recherche'}
                    className="absolute right-2.5 text-brand-white/60 hover:text-brand-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-white/40 rounded"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            {/* Mobile search */}
            <div className="relative flex md:hidden items-center mb-4">
              <Search aria-hidden="true" className="absolute left-3 w-[15px] h-[15px] text-brand-white/50 pointer-events-none" />
              <input
                ref={searchMobileRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={lang === 'en' ? 'Search products…' : 'Rechercher…'}
                aria-label={lang === 'en' ? 'Search products' : 'Rechercher des produits'}
                className="w-full pl-9 pr-11 py-[9px] text-[13px] rounded-xl bg-brand-white/10 text-brand-white placeholder:text-brand-white/40 border border-brand-white/20 focus:outline-none focus:ring-2 focus:ring-brand-white/25 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label={lang === 'en' ? 'Clear search' : 'Effacer la recherche'}
                  className="absolute right-0 inset-y-0 w-11 flex items-center justify-center text-brand-white/60 hover:text-brand-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-white/40 rounded-r-xl"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Category tabs row — pill tabs on the left, sort dropdown on the right (desktop). Stacks on mobile. */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-4">
              {/* Task 2.1 — snap-x horizontal scroll on mobile, centered
                  wrap on desktop. snap-mandatory keeps a tab fully
                  flush with the viewport edge after a flick so half-
                  visible pills never linger. md:flex-wrap unlocks the
                  wrap behavior once the row is no longer the cramped
                  mobile strip; md:justify-start keeps the tabs left-
                  aligned next to the sort dropdown on the right. */}
              <div
                className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 md:flex-1 md:min-w-0 md:flex-wrap md:overflow-visible snap-x snap-mandatory md:snap-none"
                role="tablist"
                aria-label={lang === 'en' ? 'Product categories' : 'Catégories de produits'}
              >
                {CATEGORIES.map((cat) => {
                  const isActive = activeCategory === cat.id && !searchQuery;
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => selectCategory(cat.id)}
                      role="tab"
                      aria-selected={isActive}
                      aria-current={isActive ? 'page' : undefined}
                      className={`group inline-flex items-center gap-1.5 text-[12px] font-bold px-3.5 py-2 whitespace-nowrap cursor-pointer transition-all rounded-full border snap-start focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-black ${
                        isActive
                          // Active: white fill + dark text + stronger
                          // border + blue-tinted shadow so the selection
                          // reads even at a glance on mobile.
                          ? 'bg-brand-white text-brand-black border-brand-blue/70 shadow-[0_2px_12px_-2px_rgba(0,82,204,0.55)]'
                          // Inactive: same translucent chip as before
                          // but with an explicit transparent border so
                          // the active/inactive swap doesn't jump 1px.
                          : 'bg-brand-white/10 text-brand-white/70 border-brand-white/10 hover:bg-brand-white/15 hover:text-brand-white hover:border-brand-white/25'
                      }`}
                    >
                      <Icon
                        aria-hidden="true"
                        className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                          // Blue accent on the active icon — matches the
                          // brand accent used on hero CTAs and trust
                          // badges. Inactive icon inherits the muted
                          // white so the row reads calm.
                          isActive ? 'text-brand-blue' : 'text-brand-white/60 group-hover:text-brand-white/90'
                        }`}
                      />
                      <span>{lang === 'en' ? cat.en : cat.fr}</span>
                    </button>
                  );
                })}
              </div>

              {/* Sort dropdown — stacks under tabs on mobile, sits top-right on desktop */}
              <div className="flex items-center gap-2 pb-1 md:pb-0 md:shrink-0">
                <label htmlFor="sort-mode" className="text-[11px] font-semibold tracking-wide uppercase text-brand-white/60 whitespace-nowrap">
                  {lang === 'en' ? 'Sort' : 'Trier'}
                </label>
                <select
                  id="sort-mode"
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as SortMode)}
                  aria-label={lang === 'en' ? 'Sort products' : 'Trier les produits'}
                  className="text-[12px] font-bold bg-brand-white/10 text-brand-white border border-brand-white/20 rounded-full px-3 py-1.5 outline-none focus:ring-2 focus:ring-brand-white/70 focus:ring-offset-2 focus:ring-offset-brand-black cursor-pointer hover:bg-brand-white/15 transition-colors"
                >
                  <option value="popularity" className="text-brand-black">{lang === 'en' ? 'Popular' : 'Populaire'}</option>
                  <option value="price-asc" className="text-brand-black">{lang === 'en' ? 'Price ↑' : 'Prix ↑'}</option>
                  <option value="price-desc" className="text-brand-black">{lang === 'en' ? 'Price ↓' : 'Prix ↓'}</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-9 pb-32">
        {isLoading ? (
          // Task 2.5 — skeleton mirrors ProductCard's real DOM so the
          // catalog doesn't visually jump when the fetch resolves.
          // Matching knobs (kept in sync with ProductCard.tsx):
          //   - Outer: border-border rounded-[18px] bg-card
          //   - Image container: aspectRatio 1 + bg-secondary
          //   - Info: p-3.5 pb-4, three stacked placeholder lines
          //     (title w-3/4, meta w-1/2, price w-1/3)
          //   - Grid columns: 2 / md:3 / lg:4 — identical to the real
          //     grid below so first-paint column count is stable
          // prefers-reduced-motion disables the shimmer keyframe —
          // static placeholder is still semantically the same loading
          // state, it just doesn't animate.
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
              className="inline-flex items-center gap-2 text-sm font-extrabold text-brand-white bg-brand-black hover:bg-brand-dark px-6 py-3 rounded-full transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-blue/60 focus-visible:ring-offset-2"
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

            {/* Active-filter chip row + global Reset. Only rendered
                when at least one filter is non-default so the chrome
                stays out of the way on a clean /products view. Each
                chip's × peels off exactly one filter; the trailing
                "Réinitialiser les filtres" button nukes them all. */}
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-2 mb-5">
                {activeCategory !== 'overview' && (
                  <span
                    className="inline-flex items-center gap-1.5 text-[12px] font-semibold rounded-full bg-secondary text-foreground pl-3 pr-1 py-1"
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
                      className="inline-flex items-center justify-center w-5 h-5 rounded-full hover:bg-foreground/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <X className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </span>
                )}
                {trimmedDebouncedQuery !== '' && (
                  <span
                    className="inline-flex items-center gap-1.5 text-[12px] font-semibold rounded-full bg-secondary text-foreground pl-3 pr-1 py-1"
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
                      className="inline-flex items-center justify-center w-5 h-5 rounded-full hover:bg-foreground/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <X className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </span>
                )}
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="inline-flex items-center gap-1.5 text-[12px] font-bold text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-full px-2 py-1"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                  {lang === 'en' ? 'Clear filters' : 'Réinitialiser les filtres'}
                </button>
              </div>
            )}

            {activeCategory !== 'overview' && !searchQuery && (
              <h2 className="text-xl font-extrabold text-foreground mb-[18px]">
                {lang === 'en'
                  ? CATEGORIES.find(c => c.id === activeCategory)?.en
                  : CATEGORIES.find(c => c.id === activeCategory)?.fr}
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  {lang === 'en'
                    ? plural(filteredProducts.length, { one: '{count} product', other: '{count} products' }, 'en')
                    : plural(filteredProducts.length, { one: '{count} produit', other: '{count} produits' }, 'fr')}
                </span>
              </h2>
            )}

            {/* Task 2.15 — breadth-of-catalog meta line. Product count +
                real-color total (via filterRealColors so ghosts don't
                inflate) give shoppers a one-glance read on what's
                filtered. Shown whenever there are results, regardless
                of category/search, so the answer to "how much is
                here?" is always visible above the grid. */}
            {filteredProducts.length > 0 && (
              <p className="text-[12px] text-muted-foreground mb-4">
                {lang === 'en'
                  ? plural(filteredProducts.length, { one: '{count} product', other: '{count} products' }, 'en')
                  : plural(filteredProducts.length, { one: '{count} produit', other: '{count} produits' }, 'fr')}
                {totalRealColors > 0 && (
                  <>
                    {' \u00b7 '}
                    {lang === 'en'
                      ? plural(totalRealColors, { one: '{count} color available', other: '{count} colors available' }, 'en')
                      : plural(totalRealColors, { one: '{count} couleur disponible', other: '{count} couleurs disponibles' }, 'fr')}
                  </>
                )}
              </p>
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
                        <SearchX className="w-7 h-7 text-muted-foreground" />
                      </div>
                      <h2 className="text-xl md:text-2xl font-extrabold text-foreground mb-2">
                        {lang === 'en' ? 'No results' : 'Aucun r\u00e9sultat'}
                      </h2>
                      <p className="text-sm text-muted-foreground mb-1">
                        {lang === 'en'
                          ? `for \u00ab ${searchQuery} \u00bb`
                          : `pour \u00ab ${searchQuery} \u00bb`}
                      </p>
                      <p className="text-sm text-muted-foreground mb-5">
                        {lang === 'en'
                          ? 'Try adjusting your filters or explore our best-sellers below.'
                          : 'Ajuste tes filtres ou explore nos best-sellers ci-dessous.'}
                      </p>
                      <button
                        type="button"
                        onClick={clearAllFilters}
                        className="inline-flex items-center gap-2 text-sm font-extrabold text-brand-white bg-brand-black hover:bg-brand-dark px-6 py-2.5 rounded-full transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-blue/60 focus-visible:ring-offset-2"
                      >
                        <X className="w-4 h-4" aria-hidden="true" />
                        {lang === 'en' ? 'Clear filters' : 'R\u00e9initialiser les filtres'}
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
                      <SearchX className="w-7 h-7 text-muted-foreground" />
                    </div>
                    <h2 className="text-xl md:text-2xl font-extrabold text-foreground mb-2">
                      {lang === 'en' ? 'No results' : 'Aucun r\u00e9sultat'}
                    </h2>
                    <p className="text-sm text-muted-foreground mb-5">
                      {lang === 'en'
                        ? 'Try adjusting your filters or browse the full catalog.'
                        : 'Ajuste tes filtres ou parcours le catalogue complet.'}
                    </p>
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="inline-flex items-center gap-2 text-sm font-extrabold text-brand-white bg-brand-black hover:bg-brand-dark px-6 py-2.5 rounded-full transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-blue/60 focus-visible:ring-offset-2"
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                      {lang === 'en' ? 'Clear filters' : 'R\u00e9initialiser les filtres'}
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
                <div
                  ref={gridRef}
                  onKeyDown={handleGridKeyDown}
                  className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5"
                >
                {visibleProducts.map((product, i) => {
                  // Defensive key fallback: an id might be missing on a
                  // brand-new product. Fall back to handle, then to
                  // index — React just needs uniqueness within the list.
                  const key = product?.node?.id ?? product?.node?.handle ?? `idx-${i}`;
                  try {
                    // First row is above the fold (2-col mobile, 4-col desktop)
                    // — mark those eager so the LCP image isn't lazy-loaded.
                    // Task 2.18 — pass the debounced search query so the
                    // card's title highlights the matching substring.
                    return <ProductCard key={key} product={product} eager={i < 4} highlight={debouncedQuery} />;
                  } catch (err) {
                    console.warn('[Products] ProductCard threw, skipping', key, err);
                    return null;
                  }
                })}
                </div>

                {/* Task 2.17 — pagination footer. Only renders when the
                    filtered set crosses PAGE_SIZE (30). The count line
                    ("Affichage de 1-30 sur 42") sits above a load-more
                    pill that reveals PAGE_SIZE more per click. Full-
                    width on mobile so it reads as a primary action;
                    auto width / centered on desktop so it doesn't feel
                    like a form field stretched edge-to-edge. */}
                {filteredProducts.length > PAGE_SIZE && (
                  <div className="mt-10 flex flex-col items-center gap-4">
                    <p className="text-[12px] text-muted-foreground" aria-live="polite">
                      {lang === 'en'
                        ? `Showing 1-${visibleProducts.length} of ${filteredProducts.length}`
                        : `Affichage de 1-${visibleProducts.length} sur ${filteredProducts.length}`}
                    </p>
                    {hasMore && (
                      <button
                        type="button"
                        onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                        className="w-full md:w-auto inline-flex items-center justify-center gap-2 text-sm font-extrabold text-brand-white bg-brand-black hover:bg-brand-dark px-8 py-3 rounded-full transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-blue/60 focus-visible:ring-offset-2"
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

