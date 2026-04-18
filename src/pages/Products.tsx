import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { CartDrawer } from '@/components/CartDrawer';
import { ProductCard } from '@/components/ProductCard';
import { useProducts } from '@/hooks/useProducts';
import { findProductByHandle, PRODUCTS } from '@/data/products';
import { useLang } from '@/lib/langContext';
import { Search, X } from 'lucide-react';
import { AIChat } from '@/components/AIChat';
import { useState, useMemo, useEffect, useRef } from 'react';

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
  const local = findProductByHandle(product.node.handle);
  const title = product.node.title.toLowerCase();
  const type  = product.node.productType.toLowerCase();

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
  const { data: products, isLoading } = useProducts();
  const [cartOpen, setCartOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const searchDesktopRef = useRef<HTMLInputElement>(null);
  const searchMobileRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const prev = document.title;
    document.title = lang === 'en'
      ? 'Products — Vision Affichage'
      : 'Produits — Vision Affichage';
    return () => { document.title = prev; };
  }, [lang]);

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

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    let result = activeCategory === 'overview'
      ? products
      : products.filter(p => matchesCategory(p, activeCategory));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.node.title.toLowerCase().includes(q) ||
        p.node.handle.toLowerCase().includes(q)
      );
    }
    return result;
  }, [products, activeCategory, searchQuery]);

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
                className="w-full pl-9 pr-8 py-[9px] text-[13px] rounded-xl bg-white/10 text-primary-foreground placeholder:text-primary-foreground/40 border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/25 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label={lang === 'en' ? 'Clear search' : 'Effacer la recherche'}
                  className="absolute right-2.5 text-primary-foreground/60 hover:text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category tabs — pill style */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1" role="tablist" aria-label={lang === 'en' ? 'Product categories' : 'Catégories de produits'}>
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
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-9 pb-32">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-2xl bg-secondary animate-pulse" />
            ))}
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

            {filteredProducts.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground">
                  {searchQuery
                    ? lang === 'en'
                      ? `No products match "${searchQuery}"`
                      : `Aucun produit ne correspond \u00e0 \u00ab ${searchQuery} \u00bb`
                    : lang === 'en'
                    ? 'No products in this category yet.'
                    : 'Aucun produit dans cette cat\u00e9gorie pour l\'instant.'}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-3 text-sm font-bold text-primary bg-transparent border-none cursor-pointer"
                  >
                    {lang === 'en' ? 'Clear search' : 'Effacer la recherche'}
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.node.id} product={product} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <AIChat />
      <BottomNav />
    </div>
  );
}

