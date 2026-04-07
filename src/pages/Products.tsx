import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { CartDrawer } from '@/components/CartDrawer';
import { ProductCard } from '@/components/ProductCard';
import { useProducts } from '@/hooks/useProducts';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useState } from 'react';

const CATEGORIES = [
  { id: 'overview', label: 'Tout' },
  { id: 'tshirts', label: 'T-Shirts' },
  { id: 'hoodies', label: 'Hoodies' },
  { id: 'headwear', label: 'Casquettes & Tuques' },
  { id: 'manteaux', label: 'Manteaux' },
  { id: 'enfants', label: 'Enfants' },
];

const CATEGORY_TILES = [
  { id: 'tshirts', name: 'T-Shirts', img: 'https://visionaffichage.com/cdn/shop/files/ATC1000-Devant.jpg?v=1770866927&width=800' },
  { id: 'hoodies', name: 'Hoodies', img: 'https://visionaffichage.com/cdn/shop/files/ATCF2500-Devant.jpg?v=1770866896&width=800' },
  { id: 'headwear', name: 'Casquettes & Tuques', img: 'https://visionaffichage.com/cdn/shop/files/yupoong-6606-noir-2_cb488769-745e-41f0-91fd-f317d9787cae.jpg?v=1763598460&width=800' },
  { id: 'manteaux', name: 'Manteaux', img: 'https://visionaffichage.com/cdn/shop/files/ATCF2600-Devant.jpg?v=1770866896&width=800' },
  { id: 'enfants', name: 'Enfants', img: 'https://visionaffichage.com/cdn/shop/files/ATCFY2500-Devant.jpg?v=1770866961&width=800' },
];

export default function Products() {
  const { data: products, isLoading } = useProducts();
  const [cartOpen, setCartOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('overview');

  const selectCategory = (catId: string) => {
    setActiveCategory(catId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar onOpenCart={() => setCartOpen(true)} />
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />

      {/* Banner */}
      <div className="pt-[58px]">
        <div className="gradient-navy-dark px-6 md:px-10 pt-[34px]">
          <div className="max-w-[1200px] mx-auto">
            <h1 className="text-4xl font-extrabold tracking-[-0.5px] text-primary-foreground mb-[3px]">Boutique</h1>
            <p className="text-[13px] text-primary-foreground/45 mb-5">Clique sur une catégorie pour explorer</p>
            <div className="flex overflow-x-auto scrollbar-hide">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => selectCategory(cat.id)}
                  className={`text-[13px] font-semibold px-[18px] py-[11px] bg-transparent border-none border-b-2 whitespace-nowrap cursor-pointer transition-all ${
                    activeCategory === cat.id
                      ? 'text-primary-foreground border-b-primary-foreground'
                      : 'text-primary-foreground/40 border-b-transparent hover:text-primary-foreground/80'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-9 pb-32">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !products || products.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg">Aucun produit trouvé</p>
            <p className="text-sm text-muted-foreground mt-2">Dites-nous quel produit vous souhaitez créer!</p>
          </div>
        ) : activeCategory === 'overview' ? (
          /* Category tiles overview */
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
            {CATEGORY_TILES.map((tile) => (
              <div
                key={tile.id}
                onClick={() => selectCategory(tile.id)}
                className="rounded-[18px] overflow-hidden cursor-pointer relative aspect-[4/3] transition-transform hover:scale-[1.02] group"
              >
                <img src={tile.img} alt={tile.name} className="w-full h-full object-cover transition-transform duration-350 group-hover:scale-105" />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(8,14,32,0.75) 0%, transparent 55%)' }} />
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <div className="text-[17px] font-extrabold text-primary-foreground">{tile.name}</div>
                  <div className="text-[12px] text-primary-foreground/60 mt-[3px]">
                    {products.length > 0 ? `${products.length} produits` : ''}
                  </div>
                </div>
                <div className="absolute top-4 right-4 w-7 h-7 bg-primary-foreground/15 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 stroke-primary-foreground fill-none" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Product grid for selected category */
          <>
            <button
              onClick={() => selectCategory('overview')}
              className="flex items-center gap-2 text-[13px] font-semibold text-primary mb-5 cursor-pointer bg-transparent border-none"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour
            </button>
            <h2 className="text-xl font-extrabold text-foreground mb-[18px]">
              {CATEGORIES.find(c => c.id === activeCategory)?.label}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
              {products.map((product) => (
                <ProductCard key={product.node.id} product={product} />
              ))}
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}