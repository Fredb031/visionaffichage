import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { storefrontApiRequest, PRODUCT_BY_HANDLE_QUERY } from '@/lib/shopify';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { CartDrawer } from '@/components/CartDrawer';
import { ProductCustomizer } from '@/components/customizer/ProductCustomizer';
import { AnimatePresence } from 'framer-motion';
import { ArrowLeft, Lock, Shirt, Check, ChevronRight, Package } from 'lucide-react';
import { useState } from 'react';
import { findProductByHandle, PRINT_PRICE, BULK_DISCOUNT_RATE } from '@/data/products';
import { useLang } from '@/lib/langContext';
import { useSanmarInventory } from '@/hooks/useSanmarInventory';

export default function ProductDetail() {
  const { handle } = useParams<{ handle: string }>();
  const { lang } = useLang();
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

  const localProduct = findProductByHandle(handle ?? '');
  const localProductId = localProduct?.id ?? 'atcf2500';

  // Live SanMar Canada stock — degrades silently if the edge function is not deployed
  const { summary: stock, isLoading: stockLoading } = useSanmarInventory(localProduct?.sku ?? null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar onOpenCart={() => setCartOpen(true)} />
        <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
        <div className="max-w-[1100px] mx-auto px-6 md:px-10 pt-24 pb-32">
          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            <div className="aspect-square rounded-2xl bg-secondary animate-pulse" />
            <div className="space-y-4">
              <div className="h-8 bg-secondary rounded-xl animate-pulse w-3/4" />
              <div className="h-6 bg-secondary rounded-xl animate-pulse w-1/3" />
              <div className="h-4 bg-secondary rounded-lg animate-pulse w-full" />
              <div className="h-4 bg-secondary rounded-lg animate-pulse w-5/6" />
              <div className="h-12 bg-secondary rounded-xl animate-pulse mt-6" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar onOpenCart={() => setCartOpen(true)} />
        <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
        <div className="container mx-auto px-4 py-20 text-center pt-24">
          <p className="text-muted-foreground text-lg">
            {lang === 'en' ? 'Product not found' : 'Produit non trouvé'}
          </p>
          <Link
            to="/products"
            className="inline-block mt-4 text-sm font-bold text-primary-foreground gradient-navy px-6 py-2.5 rounded-full"
          >
            {lang === 'en' ? 'Back to products' : 'Retour aux produits'}
          </Link>
        </div>
      </div>
    );
  }

  // Prefer clean Drive images over Shopify CDN (which has VOTRE LOGO embedded)
  const shopifyImages = product.images.edges;
  const images = localProduct
    ? [
        { node: { url: localProduct.imageDevant, altText: `${localProduct.shortName} devant` } },
        { node: { url: localProduct.imageDos, altText: `${localProduct.shortName} dos` } },
      ]
    : shopifyImages;
  const options = product.options.filter(
    (o: { name: string; values: string[] }) =>
      !(o.values.length === 1 && o.values[0] === 'Default Title'),
  );
  const currentOptions = {
    ...Object.fromEntries(options.map((o: { name: string; values: string[] }) => [o.name, o.values[0]])),
    ...selectedOptions,
  };

  const selectedVariant =
    product.variants.edges.find(
      (v: { node: { selectedOptions: Array<{ name: string; value: string }> } }) =>
        v.node.selectedOptions.every(
          (so: { name: string; value: string }) => currentOptions[so.name] === so.value,
        ),
    )?.node || product.variants.edges[0]?.node;

  const price = selectedVariant
    ? parseFloat(selectedVariant.price.amount).toFixed(2)
    : parseFloat(product.priceRange.minVariantPrice.amount).toFixed(2);

  const currency = product.priceRange.minVariantPrice.currencyCode;

  return (
    <div className="min-h-screen bg-background">
      <Navbar onOpenCart={() => setCartOpen(true)} />
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />

      <div className="max-w-[1100px] mx-auto px-6 md:px-10 pt-20 pb-32">
        <Link
          to="/products"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {lang === 'en' ? 'Back to products' : 'Retour aux produits'}
        </Link>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {/* Images */}
          <div className="space-y-3">
            <div className="aspect-square overflow-hidden rounded-2xl bg-secondary border border-border">
              {images[selectedImageIndex]?.node ? (
                <img
                  src={images[selectedImageIndex].node.url}
                  alt={images[selectedImageIndex].node.altText || product.title}
                  className="w-full h-full object-cover transition-opacity duration-200"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                  {lang === 'en' ? 'No image' : 'Pas d\'image'}
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {images.map(
                  (img: { node: { url: string; altText: string | null } }, i: number) => (
                    <button
                      key={i}
                      onClick={() => setSelectedImageIndex(i)}
                      className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors ${
                        i === selectedImageIndex
                          ? 'border-primary'
                          : 'border-transparent hover:border-border'
                      }`}
                    >
                      <img
                        src={img.node.url}
                        alt={img.node.altText || ''}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ),
                )}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
                {product.title}
              </h1>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-extrabold text-primary">
                  {price} {currency}
                </span>
                <span className="text-xs text-muted-foreground">
                  {lang === 'en' ? '/ unit, before print' : '/ unité, avant impression'}
                </span>
              </div>
            </div>

            {/* Pricing tiers table — inspired by CustomInk/RushOrderTees */}
            {(() => {
              const shopifyBase = parseFloat(price);
              const unitWithPrint = shopifyBase + PRINT_PRICE;
              const discountedUnit = unitWithPrint * (1 - BULK_DISCOUNT_RATE);
              return (
                <div className="overflow-hidden rounded-xl border border-border text-sm">
                  <div className="px-3.5 py-2 bg-secondary border-b border-border text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                    {lang === 'en' ? 'Price per unit (print included)' : 'Prix / unité (impression incluse)'}
                  </div>
                  <div className="divide-y divide-border">
                    <div className="flex items-center justify-between px-3.5 py-2.5">
                      <span className="text-muted-foreground">1–11 {lang === 'en' ? 'units' : 'unités'}</span>
                      <span className="font-extrabold text-foreground">{unitWithPrint.toFixed(2)} $</span>
                    </div>
                    <div className="flex items-center justify-between px-3.5 py-2.5 bg-green-50/60">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">12+ {lang === 'en' ? 'units' : 'unités'}</span>
                        <span className="text-[10px] font-extrabold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">
                          -{Math.round(BULK_DISCOUNT_RATE * 100)}%
                        </span>
                      </div>
                      <span className="font-extrabold text-green-700">{discountedUnit.toFixed(2)} $</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Live SanMar stock — only shows when the edge function returns real data */}
            {stockLoading ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-xs text-muted-foreground">
                <Package className="w-3.5 h-3.5 animate-pulse" />
                {lang === 'en' ? 'Checking live inventory…' : 'Vérification du stock en direct…'}
              </div>
            ) : stock.totalAvailable > 0 ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-green-200 bg-green-50 text-xs">
                <Package className="w-3.5 h-3.5 text-green-700" />
                <span className="font-bold text-green-800">
                  {stock.totalAvailable.toLocaleString()} {lang === 'en' ? 'units in stock' : 'unités en stock'}
                </span>
                <span className="text-green-700">
                  · {stock.byColor.size} {lang === 'en' ? 'colors' : 'couleurs'}
                  · {stock.bySize.size} {lang === 'en' ? 'sizes' : 'tailles'}
                </span>
              </div>
            ) : null}

            {/* Options */}
            {options.map((option: { name: string; values: string[] }) => (
              <div key={option.name}>
                <label className="text-sm font-bold mb-2 block text-foreground">
                  {option.name}
                  {currentOptions[option.name] && (
                    <span className="font-normal text-muted-foreground ml-2">
                      — {currentOptions[option.name]}
                    </span>
                  )}
                </label>
                <div className="flex flex-wrap gap-2">
                  {option.values.map((value: string) => (
                    <button
                      key={value}
                      onClick={() => setSelectedOptions((prev) => ({ ...prev, [option.name]: value }))}
                      className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
                        currentOptions[option.name] === value
                          ? 'gradient-navy-dark text-primary-foreground border-transparent shadow-sm'
                          : 'bg-background text-foreground border-border hover:border-primary'
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* CTA */}
            <button
              className="w-full py-4 gradient-navy-dark text-primary-foreground border-none rounded-xl text-[15px] font-extrabold cursor-pointer transition-all hover:opacity-90 hover:-translate-y-px flex items-center justify-center gap-2"
              style={{ boxShadow: '0 8px 24px hsla(var(--navy), 0.35)' }}
              onClick={() => setCustomizerOpen(true)}
            >
              <Shirt size={18} />
              {lang === 'en' ? 'Customize this product' : 'Personnaliser ce produit'}
              <ChevronRight size={16} className="ml-auto opacity-60" />
            </button>

            <p className="text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
              <Lock size={11} />
              {lang === 'en'
                ? 'Secure payment · Delivered in 5 business days'
                : 'Paiement sécurisé · Livré en 5 jours ouvrables'}
            </p>

            {product.description && (
              <div className="pt-3 border-t border-border">
                <h3 className="font-bold mb-2 text-sm text-foreground">Description</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{product.description}</p>
              </div>
            )}

            {/* Product features from local data */}
            {localProduct?.features && localProduct.features.length > 0 && (
              <div className="pt-3 border-t border-border">
                <h3 className="font-bold mb-2.5 text-sm text-foreground">
                  {lang === 'en' ? 'Features' : 'Caractéristiques'}
                </h3>
                <ul className="space-y-1.5">
                  {localProduct.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {customizerOpen && (
          <ProductCustomizer
            productId={localProductId}
            onClose={() => setCustomizerOpen(false)}
          />
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}

