import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { CartDrawer } from '@/components/CartDrawer';
import { ProductCard } from '@/components/ProductCard';
import { useProducts } from '@/hooks/useProducts';
import { findProductByHandle } from '@/data/products';
import { useLang } from '@/lib/langContext';
import { Loader2, ArrowLeft, Search, X } from 'lucide-react';
import { useState, useMemo } from 'react';

const CATEGORIES = [
  { id: 'overview', fr: 'Tout',                en: 'All' },
  { id: 'tshirts',  fr: 'T-Shirts',            en: 'T-Shirts' },
  { id: 'hoodies',  fr: 'Hoodies',             en: 'Hoodies' },
  { id: 'headwear', fr: 'Casquettes & Tuques', en: 'Caps & Beanies' },
  { id: 'manteaux', fr: 'Manteaux',            en: 'Jackets' },
  { id: 'enfants',  fr: 'Enfants',             en: 'Youth' },
  { id: 'kits',     fr: 'Kits',                en: 'Kits' },
];

const CATEGORY_TILES = [
  { id: 'tshirts',  fr: 'T-Shirts',             en: 'T-Shirts',        img: 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/ATC1000-Devant.jpg?v=1770866927&width=800' },
  { id: 'hoodies',  fr: 'Hoodies',              en: 'Hoodies',         img: 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/ATCF2500-Devant.jpg?v=1770866896&width=800' },
  { id: 'headwear', fr: 'Casquettes & Tuques',  en: 'Caps & Beanies',  img: 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/yupoong-6606-noir-2_cb488769-745e-41f0-91fd-f317d9787cae.jpg?v=1763598460&width=800' },
  { id: 'manteaux', fr: 'Manteaux',             en: 'Jackets',         img: 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/ATCF2600-Devant.jpg?v=1770866896&width=800' },
  { id: 'enfants',  fr: 'Enfants',              en: 'Youth',           img: 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/ATCFY2500-Devant.jpg?v=1770866961&width=800' },
];

function matchesCategory(
  product: { node: { handle: string; productType: string; title: string } },
  catId: string,
): boolean {
  const local = findProductByHandle(product.node.handle);
  const title = product.node.title.toLowerCase();
  const type  = product.node.productType.toLowerCase();

  if (catId === 'kits') return type === '' || title.includes('pack');
  if (!local) return false;
  switch (catId) {
    case 'tshirts':  return ['tshirt','longsleeve','polo','sport'].includes(local.category);
    case 'hoodies':  return ['hoodie','crewneck'].includes(local.category);
    case 'headwear': return ['cap','toque'].includes(local.category);
    case 'enfants':  return local.gender === 'enfant';
    case 'manteaux': return false;
    default:         return true;
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

  const categoryCount = (catId: string) =>
    (products ?? []).filter(p => matchesCategory(p, catId)).length;

  const showTiles = activeCategory === 'overview' && !searchQuery.trim();

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
        ) : showTiles ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
            {CATEGORY_TILES.map((tile) => (
              <div
                key={tile.id}
                onClick={() => selectCategory(tile.id)}
                className="rounded-[18px] overflow-hidden cursor-pointer relative aspect-[4/3] transition-transform hover:scale-[1.02] group"
              >
                <img
                  src={tile.img}
                  alt={lang === 'en' ? tile.en : tile.fr}
                  className="w-full h-full object-cover transition-transform duration-350 group-hover:scale-105"
                />
                <div
                  className="absolute inset-0"
                  style={{ background: 'linear-gradient(to top, rgba(8,14,32,0.75) 0%, transparent 55%)' }}
                />
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <div className="text-[17px] font-extrabold text-primary-foreground">
                    {lang === 'en' ? tile.en : tile.fr}
                  </div>
                  <div className="text-[12px] text-primary-foreground/60 mt-[3px]">
                    {categoryCount(tile.id)}{' '}
                    {lang === 'en'
                      ? `product${categoryCount(tile.id) !== 1 ? 's' : ''}`
                      : `produit${categoryCount(tile.id) !== 1 ? 's' : ''}`}
                  </div>
                </div>
                <div className="absolute top-4 right-4 w-7 h-7 bg-primary-foreground/15 rounded-full flex items-center justify-center">
                  <svg
                    className="w-3 h-3 stroke-primary-foreground fill-none"
                    strokeWidth="2.5"
                    viewBox="0 0 24 24"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              {activeCategory !== 'overview' && (
                <button
                  onClick={() => selectCategory('overview')}
                  className="flex items-center gap-1.5 text-[13px] font-semibold text-primary cursor-pointer bg-transparent border-none"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {lang === 'en' ? 'Back' : 'Retour'}
                </button>
              )}
              {searchQuery && (
                <span className="text-[13px] text-muted-foreground">
                  {lang === 'en'
                    ? `Results for "${searchQuery}"`
                    : `Résultats pour « ${searchQuery} »`}
                </span>
              )}
            </div>

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
                      : `Aucun produit ne correspond à « ${searchQuery} »`
                    : lang === 'en'
                    ? 'No products in this category yet.'
                    : 'Aucun produit dans cette catégorie pour l\'instant.'}
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
