import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { CartDrawer } from '@/components/CartDrawer';
import { ProductCard } from '@/components/ProductCard';
import { useProducts } from '@/hooks/useProducts';
import { findProductByHandle } from '@/data/products';
import { useLang } from '@/lib/langContext';
import { Search, X } from 'lucide-react';
import { useState, useMemo } from 'react';

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
    <div className="min-h-screen bg-background">
      <Navbar onOpenCart={() => setCartOpen(true)} />
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />

      {/* Banner */}
      <div className="pt-[58px]">
        <div className="gradient-navy-dark px-6 md:px-10 pt-[34px]">
          <div className="max-w-[1200px] mx-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-4xl font-extrabold tracking-[-0.5px] text-primary-foreground mb-[3px]">
                  {lang === 'en' ? 'Shop' : 'Boutique'}
                </h1>
                <p className="text-[13px] text-primary-foreground/45 mb-4">
                  {lang === 'en' ? 'Click a category to explore' : 'Clique sur une catégorie pour explorer'}
                </p>
              </div>

              {/* Desktop search */}
              <div className="relative hidden md:flex items-center mt-2">
                <Search className="absolute left-3 w-[15px] h-[15px] text-primary-foreground/50 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={lang === 'en' ? 'Search products…' : 'Rechercher…'}
                  className="pl-9 pr-8 py-[9px] text-[13px] rounded-xl bg-white/10 text-primary-foreground placeholder:text-primary-foreground/40 border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/25 transition-all w-52"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 text-primary-foreground/60 hover:text-primary-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Mobile search */}
            <div className="relative flex md:hidden items-center mb-4">
              <Search className="absolute left-3 w-[15px] h-[15px] text-primary-foreground/50 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={lang === 'en' ? 'Search products…' : 'Rechercher…'}
                className="w-full pl-9 pr-8 py-[9px] text-[13px] rounded-xl bg-white/10 text-primary-foreground placeholder:text-primary-foreground/40 border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/25 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 text-primary-foreground/60 hover:text-primary-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category tabs */}
            <div className="flex overflow-x-auto scrollbar-hide">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => selectCategory(cat.id)}
                  className={`text-[13px] font-semibold px-[18px] py-[11px] bg-transparent border-none border-b-2 whitespace-nowrap cursor-pointer transition-all ${
                    activeCategory === cat.id && !searchQuery
                      ? 'text-primary-foreground border-b-primary-foreground'
                      : 'text-primary-foreground/40 border-b-transparent hover:text-primary-foreground/80'
                  }`}
                >
                  {lang === 'en' ? cat.en : cat.fr}
                </button>
              ))}
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

      <BottomNav />
    </div>
  );
}

