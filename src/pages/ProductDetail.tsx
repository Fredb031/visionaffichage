import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { storefrontApiRequest, PRODUCT_BY_HANDLE_QUERY } from '@/lib/shopify';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { CartDrawer } from '@/components/CartDrawer';
import { ProductCustomizer } from '@/components/ProductCustomizer';
import { useCartStore } from '@/stores/cartStore';
import { Loader2, ShoppingCart, ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

export default function ProductDetail() {
  const { handle } = useParams<{ handle: string }>();
  const addItem = useCartStore(state => state.addItem);
  const isCartLoading = useCartStore(state => state.isLoading);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [cartOpen, setCartOpen] = useState(false);
  const [customizerOpen, setCustomizerOpen] = useState(false);

  const { data: product, isLoading } = useQuery({
    queryKey: ['shopify-product', handle],
    queryFn: async () => {
      const data = await storefrontApiRequest(PRODUCT_BY_HANDLE_QUERY, { handle });
      return data?.data?.product;
    },
    enabled: !!handle,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar onOpenCart={() => setCartOpen(true)} />
        <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
        <div className="flex justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar onOpenCart={() => setCartOpen(true)} />
        <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
        <div className="container mx-auto px-4 py-20 text-center pt-24">
          <p className="text-muted-foreground text-lg">Produit non trouvé</p>
          <Link to="/products" className="inline-block mt-4 text-sm font-bold text-primary-foreground gradient-navy px-6 py-2.5 rounded-full">
            Retour aux produits
          </Link>
        </div>
      </div>
    );
  }

  const images = product.images.edges;
  const options = product.options.filter((o: { name: string; values: string[] }) => !(o.values.length === 1 && o.values[0] === 'Default Title'));
  const currentOptions = { ...Object.fromEntries(options.map((o: { name: string; values: string[] }) => [o.name, o.values[0]])), ...selectedOptions };

  const selectedVariant = product.variants.edges.find(
    (v: { node: { selectedOptions: Array<{ name: string; value: string }> } }) =>
      v.node.selectedOptions.every((so: { name: string; value: string }) => currentOptions[so.name] === so.value)
  )?.node || product.variants.edges[0]?.node;

  const handleAddToCart = async () => {
    if (!selectedVariant) return;
    const wrappedProduct = { node: product };
    await addItem({
      product: wrappedProduct,
      variantId: selectedVariant.id,
      variantTitle: selectedVariant.title,
      price: selectedVariant.price,
      quantity: 1,
      selectedOptions: selectedVariant.selectedOptions || [],
    });
    toast.success(`${product.title} ajouté au panier`, { position: 'top-center' });
    setCartOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar onOpenCart={() => setCartOpen(true)} />
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />

      <div className="max-w-[1100px] mx-auto px-6 md:px-10 pt-20 pb-32">
        <Link to="/products" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-1" /> Retour aux produits
        </Link>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {/* Images */}
          <div className="space-y-3">
            <div className="aspect-square overflow-hidden rounded-2xl bg-secondary">
              {images[selectedImageIndex]?.node ? (
                <img
                  src={images[selectedImageIndex].node.url}
                  alt={images[selectedImageIndex].node.altText || product.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">Pas d'image</div>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {images.map((img: { node: { url: string; altText: string | null } }, i: number) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImageIndex(i)}
                    className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors ${
                      i === selectedImageIndex ? 'border-primary' : 'border-transparent'
                    }`}
                  >
                    <img src={img.node.url} alt={img.node.altText || ''} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">{product.title}</h1>
              <p className="text-2xl font-extrabold text-primary mt-2">
                {selectedVariant ? parseFloat(selectedVariant.price.amount).toFixed(2) : parseFloat(product.priceRange.minVariantPrice.amount).toFixed(2)}{' '}
                {product.priceRange.minVariantPrice.currencyCode}
              </p>
            </div>

            {/* Options */}
            {options.map((option: { name: string; values: string[] }) => (
              <div key={option.name}>
                <label className="text-sm font-bold mb-2 block">{option.name}</label>
                <div className="flex flex-wrap gap-2">
                  {option.values.map((value: string) => (
                    <button
                      key={value}
                      onClick={() => setSelectedOptions(prev => ({ ...prev, [option.name]: value }))}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                        currentOptions[option.name] === value
                          ? 'gradient-navy text-primary-foreground border-transparent'
                          : 'bg-background text-foreground border-border hover:border-primary'
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* Customizer button */}
            <button
              className="w-full py-4 gradient-navy text-primary-foreground border-none rounded-xl text-[15px] font-extrabold cursor-pointer transition-all shadow-navy hover:opacity-88 flex items-center justify-center gap-2"
              onClick={() => setCustomizerOpen(true)}
            >
              👕 Personnaliser ce produit
            </button>

            <button
              className="w-full py-3 bg-secondary text-foreground border border-border rounded-xl text-[13px] font-bold cursor-pointer transition-all hover:bg-muted disabled:opacity-50 flex items-center justify-center gap-2"
              onClick={handleAddToCart}
              disabled={isCartLoading || !selectedVariant?.availableForSale}
            >
              {isCartLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : !selectedVariant?.availableForSale ? (
                'Rupture de stock'
              ) : (
                <>
                  <ShoppingCart className="h-4 w-4" /> Ajout rapide au panier
                </>
              )}
            </button>

            <div className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1">
              🔒 Paiement sécurisé · Livré en 5 jours
            </div>

            {product.description && (
              <div>
                <h3 className="font-bold mb-2">Description</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{product.description}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <ProductCustomizer
        isOpen={customizerOpen}
        onClose={() => setCustomizerOpen(false)}
        product={product}
        onCartOpen={() => setCartOpen(true)}
      />
      <BottomNav />
    </div>
  );
}
