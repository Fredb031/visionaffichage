import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { storefrontApiRequest, PRODUCT_BY_HANDLE_QUERY, colorNameToHex } from '@/lib/shopify';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { CartDrawer } from '@/components/CartDrawer';
// Keep fabric.js + customizer siblings out of the ProductDetail chunk;
// they're only needed when the user actually opens the customizer.
const ProductCustomizer = lazy(() => import('@/components/customizer/ProductCustomizer').then(m => ({ default: m.ProductCustomizer })));
import { AnimatePresence } from 'framer-motion';
import { ArrowLeft, Shirt, Check, ChevronRight, Package, Ruler, Calculator, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { SizeGuide } from '@/components/SizeGuide';
import { useEffect, useState, Suspense, lazy } from 'react';
import { findProductByHandle, findColorImage, PRINT_PRICE, BULK_DISCOUNT_RATE } from '@/data/products';
import { getDescription } from '@/data/productDescriptions';
import { categoryLabel } from '@/lib/productLabels';
import { DeliveryBadge } from '@/components/DeliveryBadge';
import { AIChat } from '@/components/AIChat';
import { useLang } from '@/lib/langContext';
import { useSanmarInventory } from '@/hooks/useSanmarInventory';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { useWishlist } from '@/hooks/useWishlist';

export default function ProductDetail() {
  const { handle } = useParams<{ handle: string }>();
  const { lang } = useLang();
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);

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

  // Track the viewed product so the Cart empty state (and future
  // "recently viewed" surfaces) can show the last handful of products
  // the user was considering.
  const { track: trackRecentlyViewed } = useRecentlyViewed();
  useEffect(() => {
    if (handle) trackRecentlyViewed(handle);
  }, [handle, trackRecentlyViewed]);

  const { toggle: toggleWishlist, has: isWishlisted } = useWishlist();
  const saved = handle ? isWishlisted(handle) : false;

  // Set a product-specific document title so browser tabs, bookmarks,
  // and shared links reflect the actual product instead of the default
  // site title. Restore on unmount so SPA nav doesn't leak stale titles.
  useEffect(() => {
    if (!product) return;
    const prev = document.title;
    const label = localProduct ? categoryLabel(localProduct.category, lang) : product.title;
    document.title = `${label} ${localProduct?.sku ?? ''} — Vision Affichage`.trim();
    return () => { document.title = prev; };
  }, [product, localProduct, lang]);

  // Inject Product JSON-LD so Google shows rich product results
  // (price, image, brand) on SERPs. Data lives inside a script tag in
  // <head> so the crawler picks it up regardless of client-side render.
  useEffect(() => {
    if (!product) return;
    const price = parseFloat(product.priceRange.minVariantPrice.amount);
    const currency = product.priceRange.minVariantPrice.currencyCode;
    const image = localProduct?.imageDevant ?? product.images?.edges?.[0]?.node?.url;
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.title,
      sku: localProduct?.sku,
      image: image ? [image] : undefined,
      description: product.description ?? undefined,
      brand: { '@type': 'Brand', name: 'Vision Affichage' },
      offers: {
        '@type': 'Offer',
        priceCurrency: currency,
        price: price.toFixed(2),
        availability: 'https://schema.org/InStock',
        url: typeof window !== 'undefined' ? window.location.href : undefined,
      },
    };
    // Breadcrumbs give Google the 'Home › Products › <Product>' chain
    // to render under the URL in SERP. Independent script so the two
    // schemas can be read separately by the crawler.
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://visionaffichage.com';
    const productLabel = localProduct ? categoryLabel(localProduct.category, lang) : product.title;
    const breadcrumbs = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: lang === 'en' ? 'Home' : 'Accueil', item: `${origin}/` },
        { '@type': 'ListItem', position: 2, name: lang === 'en' ? 'Products' : 'Produits', item: `${origin}/products` },
        { '@type': 'ListItem', position: 3, name: productLabel },
      ],
    };
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.text = JSON.stringify(schema);
    document.head.appendChild(el);
    const crumbsEl = document.createElement('script');
    crumbsEl.type = 'application/ld+json';
    crumbsEl.text = JSON.stringify(breadcrumbs);
    document.head.appendChild(crumbsEl);
    return () => {
      document.head.removeChild(el);
      document.head.removeChild(crumbsEl);
    };
  }, [product, localProduct, lang]);

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
    <div id="main-content" tabIndex={-1} className="min-h-screen bg-background focus:outline-none">
      <Navbar onOpenCart={() => setCartOpen(true)} />
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />

      <div className="max-w-[1100px] mx-auto px-4 md:px-8 pt-20 pb-32">
        <Link
          to="/products"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {lang === 'en' ? 'Back to products' : 'Retour aux produits'}
        </Link>

        <div className="grid md:grid-cols-[1.1fr_1fr] gap-8 lg:gap-14 items-start">
          {/* Images — main photo swaps when a color option is picked */}
          {(() => {
            const pickedColor = (() => {
              if (!localProduct) return null;
              const colorOpt = options.find((o: { name: string }) => /color|colour|couleur/i.test(o.name));
              if (!colorOpt) return null;
              const value = currentOptions[colorOpt.name];
              if (!value) return null;
              return findColorImage(localProduct.sku, value);
            })();

            // Front always reflects the picked color when available
            const frontUrl = pickedColor?.front ?? images[0]?.node?.url ?? localProduct?.imageDevant;
            const backUrl = pickedColor?.back ?? images[1]?.node?.url ?? localProduct?.imageDos;

            return (
              <div>
                <div className="aspect-square overflow-hidden rounded-2xl bg-secondary border border-border group relative">
                  {frontUrl ? (
                    <>
                      <img
                        src={frontUrl}
                        alt={product.title}
                        width={800}
                        height={800}
                        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500 group-hover:opacity-0"
                        key={`front-${frontUrl}`}
                        loading="eager"
                        fetchPriority="high"
                        decoding="async"
                      />
                      {backUrl && (
                        <img
                          src={backUrl}
                          alt={`${product.title} — dos`}
                          width={800}
                          height={800}
                          className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                          key={`back-${backUrl}`}
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                      <div className="absolute bottom-3 left-3 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-white/90 text-foreground shadow-sm pointer-events-none transition-opacity duration-300 opacity-100 group-hover:opacity-0">
                        {lang === 'en' ? 'Hover for back' : 'Survol pour dos'}
                      </div>
                      <div className="absolute bottom-3 left-3 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-foreground/90 text-background shadow-sm pointer-events-none transition-opacity duration-300 opacity-0 group-hover:opacity-100">
                        {lang === 'en' ? 'Back' : 'Dos'}
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                      {lang === 'en' ? 'No image' : "Pas d'image"}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Info */}
          <div className="space-y-5">
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {/* SKU as small gray subtitle ABOVE the title */}
                  {localProduct && (
                    <div
                      className="text-[11px] font-mono uppercase tracking-[2px] text-muted-foreground/70 mb-1"
                      data-sku={localProduct.sku}
                    >
                      {localProduct.sku}
                    </div>
                  )}
                  {/* Type as the main title */}
                  <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground leading-tight">
                    {localProduct ? categoryLabel(localProduct.category, lang) : product.title}
                  </h1>
                  {/* Garment line in muted */}
                  {localProduct && localProduct.gender !== 'unisex' && (
                    <div className="text-xs text-muted-foreground mt-1 capitalize">
                      {lang === 'en' ? localProduct.gender : `Coupe ${localProduct.gender}`}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-shrink-0">
                <button
                  onClick={() => handle && toggleWishlist(handle)}
                  aria-label={saved
                    ? (lang === 'en' ? 'Remove from wishlist' : 'Retirer des favoris')
                    : (lang === 'en' ? 'Save to wishlist' : 'Ajouter aux favoris')}
                  aria-pressed={saved}
                  title={saved
                    ? (lang === 'en' ? 'Saved' : 'Enregistré')
                    : (lang === 'en' ? 'Save' : 'Enregistrer')}
                  className={`w-11 h-11 rounded-full border flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                    saved
                      ? 'border-[#E8A838] bg-[#E8A838]/10 text-[#B37D10]'
                      : 'border-border text-muted-foreground hover:text-foreground hover:border-primary'
                  }`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                </button>
                <button
                  onClick={async () => {
                    // Prefer the native Web Share sheet on mobile (iOS Safari,
                    // Chrome Android) so users can ping the page to Messages,
                    // Slack, etc. — fall back to clipboard + toast.
                    const shareData = {
                      title: document.title,
                      url: window.location.href,
                    };
                    try {
                      if (typeof navigator.share === 'function') {
                        await navigator.share(shareData);
                        return;
                      }
                      await navigator.clipboard.writeText(window.location.href);
                      toast.success(lang === 'en' ? 'Link copied!' : 'Lien copié !');
                    } catch { /* user cancelled share sheet — no toast needed */ }
                  }}
                  className="w-11 h-11 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                  aria-label={lang === 'en' ? 'Share product' : 'Partager le produit'}
                  title={lang === 'en' ? 'Share' : 'Partager'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/></svg>
                </button>
                </div>
              </div>
              <div className="flex items-baseline gap-2 mt-3">
                <span className="text-2xl font-extrabold text-primary">
                  {price} {currency}
                </span>
                <span className="text-xs text-muted-foreground">
                  {lang === 'en' ? '/ unit, before print' : '/ unité, avant impression'}
                </span>
              </div>

            </div>

            {/* Live quantity calculator (replaces static pricing tier table) */}
            {(() => {
              const shopifyBase = parseFloat(price);
              const unitWithPrint = shopifyBase + PRINT_PRICE;
              const discountedUnit = unitWithPrint * (1 - BULK_DISCOUNT_RATE);
              return <BulkCalculator unitWithPrint={unitWithPrint} discountedUnit={discountedUnit} lang={lang} />;
            })()}

            {/* Compact info row: stock + size guide + delivery */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              {!stockLoading && stock.totalAvailable > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 font-bold">
                  <Package size={11} />
                  {lang === 'en' ? 'In stock' : 'En stock'}
                </span>
              )}
              <button
                onClick={() => setSizeGuideOpen(true)}
                className="inline-flex items-center gap-1 text-primary hover:underline font-bold"
              >
                <Ruler size={11} />
                {lang === 'en' ? 'Size guide' : 'Guide des tailles'}
              </button>
              <span className="text-muted-foreground">
                · {lang === 'en'
                  ? `Receive by ${new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}`
                  : `Reçu le ${new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long' })}`}
              </span>
            </div>

            {/* Options — Color shown as swatches in header above; render Color here too with FR label, hide if a single value */}
            {options
              .filter((opt: { name: string; values: string[] }) => opt.values.length > 1)
              .map((option: { name: string; values: string[] }) => {
                const isColor = /color|colour|couleur/i.test(option.name);
                const localizedName = (() => {
                  if (lang === 'fr') {
                    if (isColor) return 'Couleur';
                    if (/size/i.test(option.name)) return 'Taille';
                    return option.name;
                  }
                  if (isColor) return 'Color';
                  return option.name;
                })();

                return (
                  <div key={option.name}>
                    <label className="text-sm font-bold mb-2 block text-foreground">
                      {localizedName}
                      {currentOptions[option.name] && (
                        <span className="font-normal text-muted-foreground ml-2">
                          — {currentOptions[option.name]}
                        </span>
                      )}
                    </label>

                    {isColor && localProduct ? (
                      /* Color swatches. Source of truth = local catalog
                         (so Black + other core colours can't be missing
                         when Shopify's list is incomplete). Shopify's
                         values are appended for anything extra. Only
                         colours with a real drive image are shown. */
                      <div className="flex flex-wrap gap-2">
                        {(() => {
                          const norm = (s: string) => s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                          const localNames = localProduct.colors
                            .filter(c => !!findColorImage(localProduct.sku, c.nameEn) || !!findColorImage(localProduct.sku, c.name) || /^(black|noir)$/i.test(c.nameEn))
                            .map(c => c.name);
                          const extra = option.values.filter(v => !localNames.some(n => norm(n) === norm(v)));
                          const entries = [...localNames, ...extra];
                          // Put Black first.
                          entries.sort((a, b) => {
                            const ab = /^(noir|black)/i.test(a.trim()) ? 0 : 1;
                            const bb = /^(noir|black)/i.test(b.trim()) ? 0 : 1;
                            return ab - bb;
                          });
                          return entries.map((value: string) => {
                            const match = localProduct.colors.find(
                              c => norm(c.name) === norm(value) || norm(c.nameEn) === norm(value),
                            );
                            const hex = match?.hex ?? colorNameToHex(value);
                            // Select by whichever NAME Shopify uses if it's there,
                            // else by the local name — stays consistent.
                            const shopifyValueForMatch = option.values.find(v => norm(v) === norm(value)) ?? value;
                            const isSelected = norm(currentOptions[option.name] ?? '') === norm(shopifyValueForMatch);
                            return (
                              <button
                                key={value}
                                onClick={() => setSelectedOptions(prev => ({ ...prev, [option.name]: shopifyValueForMatch }))}
                                aria-pressed={isSelected}
                                className={`relative w-11 h-11 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                                  isSelected
                                    ? 'ring-2 ring-primary ring-offset-2 scale-110'
                                    : 'ring-1 ring-border hover:ring-primary/50'
                                }`}
                                style={{ background: hex }}
                                aria-label={value}
                                title={value}
                              >
                                {isSelected && (
                                  <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <Check size={14} className="text-white drop-shadow" strokeWidth={3} />
                                  </span>
                                )}
                              </button>
                            );
                          });
                        })()}
                      </div>
                    ) : (
                      /* Size + others: text pills */
                      <div className="flex flex-wrap gap-2">
                        {option.values.map((value: string) => (
                          <button
                            key={value}
                            onClick={() => setSelectedOptions(prev => ({ ...prev, [option.name]: value }))}
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
                    )}
                  </div>
                );
              })}

            {/* CTA */}
            <button
              className="w-full py-4 gradient-navy-dark text-primary-foreground border-none rounded-xl text-[15px] font-extrabold cursor-pointer transition-all hover:opacity-90 hover:-translate-y-px flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2"
              style={{ boxShadow: '0 8px 24px hsla(var(--navy), 0.35)' }}
              onClick={() => setCustomizerOpen(true)}
            >
              <Shirt size={18} aria-hidden="true" />
              {lang === 'en' ? 'Customize this product' : 'Personnaliser ce produit'}
              <ChevronRight size={16} className="ml-auto opacity-60" aria-hidden="true" />
            </button>

            {/* Trust badges + delivery estimate */}
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { icon: '🚚', en: '5-day delivery', fr: 'Livraison 5 jours' },
                { icon: '🔒', en: 'Secure payment', fr: 'Paiement sécurisé' },
                { icon: '✅', en: 'No minimum', fr: 'Aucun minimum' },
              ].map((b) => (
                <div key={b.en} className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl bg-secondary border border-border">
                  <span className="text-sm">{b.icon}</span>
                  <span className="text-[10px] font-bold text-muted-foreground leading-tight">
                    {lang === 'en' ? b.en : b.fr}
                  </span>
                </div>
              ))}
            </div>

            {localProduct && (() => {
              const desc = getDescription(localProduct.category, lang);
              return (
                <>
                  <div className="pt-3 border-t border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold text-[#0052CC] uppercase tracking-wider">
                        {categoryLabel(localProduct.category, lang)}
                      </span>
                      <DeliveryBadge size="sm" variant="inline" />
                    </div>
                    <p className="text-base font-bold text-foreground leading-snug mb-3">
                      {desc.tagline}
                    </p>
                    {desc.paragraphs.map((p, i) => (
                      <p key={i} className="text-muted-foreground text-sm leading-relaxed mb-2">
                        {p}
                      </p>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-border">
                    <h3 className="font-bold mb-2.5 text-sm text-foreground">
                      {lang === 'en' ? 'Features' : 'Caractéristiques'}
                    </h3>
                    <ul className="space-y-1.5">
                      {desc.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-3 border-t border-border bg-secondary/40 -mx-4 md:mx-0 px-4 md:px-4 py-3 md:rounded-xl">
                    <div className="text-[11px] font-bold text-[#0052CC] uppercase tracking-wider mb-1">
                      {lang === 'en' ? 'Best for' : 'Idéal pour'}
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">{desc.useCase}</p>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {customizerOpen && (
          <Suspense fallback={null}>
            <ProductCustomizer
              productId={localProductId}
              onClose={() => setCustomizerOpen(false)}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {localProduct && (
        <SizeGuide product={localProduct} isOpen={sizeGuideOpen} onClose={() => setSizeGuideOpen(false)} />
      )}

      <AIChat />
      <BottomNav />
    </div>
  );
}

function BulkCalculator({ unitWithPrint, discountedUnit, lang }: { unitWithPrint: number; discountedUnit: number; lang: 'fr' | 'en' }) {
  const [qty, setQty] = useState(12);
  const isBulk = qty >= 12;
  const unit = isBulk ? discountedUnit : unitWithPrint;
  const total = unit * qty;
  const savings = isBulk ? (unitWithPrint - discountedUnit) * qty : 0;

  const bump = (delta: number) => setQty(q => Math.max(1, q + delta));

  return (
    <div className="bg-gradient-to-br from-secondary/60 to-background border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Calculator size={14} className="text-[#0052CC]" />
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0052CC]">
          {lang === 'en' ? 'Quick price estimate' : 'Estimation rapide'}
        </span>
      </div>
      <div className="flex items-center gap-3 mb-3">
        <button
          type="button"
          onClick={() => bump(-1)}
          aria-label={lang === 'en' ? 'Decrease' : 'Diminuer'}
          className="w-11 h-11 rounded-lg border border-border bg-background hover:bg-secondary active:bg-secondary/80 flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
        >
          <Minus size={14} />
        </button>
        <input
          type="number"
          min="1"
          inputMode="numeric"
          value={qty}
          onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
          className="flex-1 text-center text-2xl font-extrabold bg-background border border-border rounded-lg py-1.5 outline-none focus:border-primary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          aria-label={lang === 'en' ? 'Quantity' : 'Quantité'}
        />
        <button
          type="button"
          onClick={() => bump(1)}
          aria-label={lang === 'en' ? 'Increase' : 'Augmenter'}
          className="w-11 h-11 rounded-lg border border-border bg-background hover:bg-secondary active:bg-secondary/80 flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
        >
          <Plus size={14} />
        </button>
      </div>
      <div className="flex justify-between items-baseline">
        <span className="text-xs text-muted-foreground">
          {qty} × {unit.toFixed(2)} $
        </span>
        <div className="text-right">
          <div className="text-2xl font-extrabold text-foreground">{total.toFixed(2)} $</div>
          {savings > 0 && (
            <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
              {lang === 'en' ? 'Save' : 'Économise'} {savings.toFixed(2)} $
            </div>
          )}
        </div>
      </div>
      {!isBulk && qty > 0 && (
        <button
          type="button"
          onClick={() => setQty(12)}
          className="w-full mt-2 text-[11px] font-bold text-emerald-700 hover:underline text-center"
        >
          {lang === 'en'
            ? `+ ${12 - qty} units to unlock 10% volume discount →`
            : `+ ${12 - qty} unités pour débloquer 10% de rabais →`}
        </button>
      )}
    </div>
  );
}

