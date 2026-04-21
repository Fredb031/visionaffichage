import { useEffect, useState, Suspense, lazy, useMemo, useRef, type KeyboardEventHandler } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { storefrontApiRequest, PRODUCT_BY_HANDLE_QUERY, colorNameToHex } from '@/lib/shopify';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { CartDrawer } from '@/components/CartDrawer';
// Keep fabric.js + customizer siblings out of the ProductDetail chunk;
// they're only needed when the user actually opens the customizer. The
// lazy() call MUST sit after React's import — Vite's HMR transform
// doesn't hoist named imports the way plain ESM does, so calling
// lazy() before its import line produced "Cannot access 'lazy' before
// initialization" and crashed every /product/:handle in dev.
const ProductCustomizer = lazy(() => import('@/components/customizer/ProductCustomizer').then(m => ({ default: m.ProductCustomizer })));
import { AnimatePresence } from 'framer-motion';
import { ArrowLeft, Shirt, Check, ChevronRight, Package, Ruler, Calculator, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { SizeGuide } from '@/components/SizeGuide';
import { findProductByHandle, findColorImage, PRINT_PRICE, BULK_DISCOUNT_RATE } from '@/data/products';
import { getDescription } from '@/data/productDescriptions';
import { categoryLabel } from '@/lib/productLabels';
import { DeliveryBadge } from '@/components/DeliveryBadge';
import { AIChat } from '@/components/AIChat';
import { useLang } from '@/lib/langContext';
import { useSanmarInventory } from '@/hooks/useSanmarInventory';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { useWishlist } from '@/hooks/useWishlist';
import { useProductColors } from '@/hooks/useProductColors';

export default function ProductDetail() {
  const { handle } = useParams<{ handle: string }>();
  const { lang } = useLang();
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);

  const { data: product, isLoading, isError, refetch } = useQuery({
    queryKey: ['shopify-product', handle],
    queryFn: async () => {
      const data = await storefrontApiRequest(PRODUCT_BY_HANDLE_QUERY, { handle });
      return data?.data?.product;
    },
    enabled: !!handle,
    // Exponential-backoff retry so a transient Shopify blip doesn't
    // immediately shove the user to a 'product not found' page.
    // Matches the useProducts / useProductColors retry shape.
    retry: 2,
    retryDelay: attempt => Math.min(1000 * 2 ** attempt, 5000),
  });

  // Parallel-prefetch the Shopify variant/colors list (PRODUCT_FULL_QUERY)
  // alongside the PDP's product fetch. Without this, the round-trip only
  // starts when the user clicks "Customize", which lazy-loads the
  // ProductCustomizer chunk and then calls useProductColors — a textbook
  // network waterfall (chunk download → query dispatch → Shopify RTT)
  // before the colour swatches render. Firing the query here keyed on
  // `handle` means the two Storefront requests travel in parallel over
  // the same connection, and by the time the customizer mounts the data
  // is already sitting in React Query's cache. React Query dedupes by
  // queryKey so the customizer's own useProductColors call becomes a
  // sync cache hit, not a second network fetch. Safe: the hook is
  // enabled-guarded on `handle`, retries match the PDP fetch, and the
  // 5-min staleTime means a brief pause on the PDP before customizing
  // still hits the cache.
  useProductColors(handle);

  const localProduct = findProductByHandle(handle ?? '');
  const localProductId = localProduct?.id ?? 'atcf2500';

  // Live SanMar Canada stock — degrades silently if the edge function is not deployed
  const { summary: stock, isLoading: stockLoading } = useSanmarInventory(localProduct?.sku ?? null);

  // Track the viewed product so the Cart empty state (and future
  // "recently viewed" surfaces) can show the last handful of products
  // the user was considering.
  const { track: trackRecentlyViewed } = useRecentlyViewed();
  useEffect(() => {
    // Only record once the product actually resolves — a dead handle
    // (404) shouldn't pollute the Recently Viewed surface with a URL
    // that will 404 again when the user clicks it from the cart empty
    // state.
    if (handle && product) trackRecentlyViewed(handle);
  }, [handle, product, trackRecentlyViewed]);

  const { toggle: toggleWishlist, has: isWishlisted } = useWishlist();
  const saved = handle ? isWishlisted(handle) : false;

  // React Router keeps ProductDetail mounted across /product/:handle
  // nav — meaning selectedOptions from the previous product leaks
  // onto the new one. If the old variant 'Color: Sky Blue' exists on
  // A but not B, the swatch UI shows Sky Blue selected even though B
  // has no such option. Reset on handle change.
  useEffect(() => {
    setSelectedOptions({});
  }, [handle]);

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
    // Guard against a partial Shopify response (see the main-render
    // comment) — if priceRange is missing we just skip the JSON-LD
    // injection rather than throwing from inside a useEffect (which
    // unmounts the page).
    const amount = product.priceRange?.minVariantPrice?.amount;
    const currency = product.priceRange?.minVariantPrice?.currencyCode;
    if (amount === undefined || currency === undefined) return;
    const price = parseFloat(amount);
    if (!Number.isFinite(price)) return;
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
    // Breadcrumbs give Google the 'Home › Products › <Category> › <Product>'
    // chain to render under the URL in SERP. Mirrors the visible nav so
    // SERP preview matches on-page UI (Google rejects schemas that drift
    // from rendered breadcrumb text). Independent script so the two
    // schemas can be read separately by the crawler.
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://visionaffichage.com';
    const productLabel = localProduct ? categoryLabel(localProduct.category, lang) : product.title;
    const catSlug = (() => {
      if (!localProduct) return null;
      const c = localProduct.category;
      if (c === 'hoodie' || c === 'crewneck') return 'chandails';
      if (c === 'tshirt' || c === 'longsleeve' || c === 'sport') return 'tshirts';
      if (c === 'polo') return 'polos';
      if (c === 'cap' || c === 'toque') return 'headwear';
      return null;
    })();
    const catCrumbName = (() => {
      switch (catSlug) {
        case 'chandails': return lang === 'en' ? 'Sweaters' : 'Chandails';
        case 'tshirts':   return 'T-Shirts';
        case 'polos':     return 'Polos';
        case 'headwear':  return lang === 'en' ? 'Caps & Beanies' : 'Casquettes & Tuques';
        default: return null;
      }
    })();
    const crumbItems: Array<Record<string, unknown>> = [
      { '@type': 'ListItem', position: 1, name: lang === 'en' ? 'Home' : 'Accueil', item: `${origin}/` },
      { '@type': 'ListItem', position: 2, name: lang === 'en' ? 'Products' : 'Produits', item: `${origin}/products` },
    ];
    if (catSlug && catCrumbName) {
      crumbItems.push({
        '@type': 'ListItem',
        position: 3,
        name: catCrumbName,
        item: `${origin}/products?cat=${catSlug}`,
      });
    }
    crumbItems.push({
      '@type': 'ListItem',
      position: crumbItems.length + 1,
      name: productLabel,
    });
    const breadcrumbs = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbItems,
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
        <div
          className="max-w-[1100px] mx-auto px-6 md:px-10 pt-24 pb-32"
          role="status"
          aria-busy="true"
          aria-live="polite"
        >
          <span className="sr-only">{lang === 'en' ? 'Loading product…' : 'Chargement du produit…'}</span>
          <div className="grid md:grid-cols-2 gap-8 lg:gap-12" aria-hidden="true">
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
    // Distinguish network error (retriable) from genuine missing product.
    // Before this, a Shopify outage looked identical to a deleted product,
    // so customers hit the back button and assumed the link was bad.
    const isNetworkError = isError;
    return (
      <div className="min-h-screen bg-background">
        <Navbar onOpenCart={() => setCartOpen(true)} />
        <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
        <div className="container mx-auto px-4 py-20 text-center pt-24" role={isNetworkError ? 'alert' : undefined}>
          <p className="text-foreground text-lg font-bold mb-2">
            {isNetworkError
              ? (lang === 'en' ? 'Couldn\u2019t load this product' : 'Impossible de charger ce produit')
              : (lang === 'en' ? 'Product not found' : 'Produit non trouvé')}
          </p>
          {isNetworkError && (
            <p className="text-sm text-muted-foreground mb-4">
              {lang === 'en' ? 'Check your connection and retry.' : 'Vérifie ta connexion et réessaie.'}
            </p>
          )}
          <div className="inline-flex items-center gap-3 mt-2">
            {isNetworkError && (
              <button
                type="button"
                onClick={() => refetch()}
                className="text-sm font-bold text-primary-foreground gradient-navy px-6 py-2.5 rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2"
              >
                {lang === 'en' ? 'Retry' : 'Réessayer'}
              </button>
            )}
            <Link
              to="/products"
              className="text-sm font-bold text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
            >
              {lang === 'en' ? 'Back to products' : 'Retour aux produits'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Prefer clean Drive images over Shopify CDN (which has VOTRE LOGO embedded).
  //
  // Defensive: Shopify Storefront can legitimately return a product
  // with missing images/options/variants/priceRange nesting when the
  // response is partial — throttled request, half-indexed product,
  // a newly unpublished variant that strips its media edges, or the
  // transport layer handing back a truncated payload on a flaky
  // connection. Before this, `product.images.edges` / `product.options.filter(...)`
  // / `product.variants.edges.find(...)` would throw TypeError at
  // render, the ErrorBoundary would catch it, and the customer would
  // see the generic "something went wrong" screen and assume the whole
  // store is down — the reported "can't access the store" symptom.
  // Coalesce each unchecked access to an empty array so the PDP
  // degrades gracefully (no swatches, fallback price) instead of
  // crashing the entire route. Matches the da587ec price.amount guard.
  const shopifyImages = product.images?.edges ?? [];
  const images = localProduct
    ? [
        { node: { url: localProduct.imageDevant, altText: `${localProduct.shortName} devant` } },
        { node: { url: localProduct.imageDos, altText: `${localProduct.shortName} dos` } },
      ]
    : shopifyImages;
  const productOptions: Array<{ name: string; values: string[] }> = product.options ?? [];
  const options = productOptions.filter(
    (o: { name: string; values: string[] }) => {
      const vals = o.values ?? [];
      return !(vals.length === 1 && vals[0] === 'Default Title');
    },
  );
  const currentOptions = {
    ...Object.fromEntries(options.map((o: { name: string; values: string[] }) => [o.name, (o.values ?? [])[0]])),
    ...selectedOptions,
  };

  const variantEdges = product.variants?.edges ?? [];
  const selectedVariant =
    variantEdges.find(
      (v: { node: { selectedOptions: Array<{ name: string; value: string }> } }) =>
        (v.node.selectedOptions ?? []).every(
          (so: { name: string; value: string }) => currentOptions[so.name] === so.value,
        ),
    )?.node || variantEdges[0]?.node || null;

  // Defence in depth: Shopify Storefront normally ships price on every
  // variant, but intermittent schema hiccups / partial cache hydration
  // have produced payloads where selectedVariant.price is undefined.
  // Before this guard, reading `.amount` off that undefined blew up the
  // whole PDP render with a TypeError. Fall back through variant price
  // → product.priceRange.minVariantPrice → '0.00' so the page still
  // paints instead of white-screening on a missing field.
  const variantAmount = selectedVariant?.price?.amount;
  const fallbackAmount = product.priceRange?.minVariantPrice?.amount;
  const rawPrice = variantAmount ?? fallbackAmount;
  const parsedPrice = rawPrice != null ? parseFloat(rawPrice) : NaN;
  const price = Number.isFinite(parsedPrice) ? parsedPrice.toFixed(2) : '0.00';

  // Per-variant stock ceiling for the BulkCalculator. The calculator is
  // keyed on `handle` (intentionally, so size/color tweaks don't blow
  // away the user's chosen qty — see the BulkCalculator key comment
  // below). But that means qty can outlast a variant switch into a
  // lower-stock combo (e.g. 200 of Royal/M then switch to Sky Blue/XS
  // which only has 14). Compute a best-effort ceiling from Shopify's
  // availableForSale + SanMar's byColorSize map; the calculator clamps
  // qty down to it on change, without unmounting. Undefined = unknown,
  // leave qty alone (typical path when SanMar edge fn isn't deployed).
  const variantMaxQty: number | undefined = (() => {
    if (selectedVariant && selectedVariant.availableForSale === false) return 0;
    const byColorSize = stock?.byColorSize;
    if (!byColorSize || byColorSize.size === 0) return undefined;
    const colorOpt = options.find((o: { name: string }) => /color|colour|couleur/i.test(o.name));
    const sizeOpt = options.find((o: { name: string }) => /size|taille/i.test(o.name));
    const color = colorOpt ? currentOptions[colorOpt.name] : undefined;
    const size = sizeOpt ? currentOptions[sizeOpt.name] : undefined;
    if (!color || !size) return undefined;
    // SanMar keys are raw strings; match case-insensitively so 'Black'
    // vs 'BLACK' / 'S' vs 's' differences between Shopify option labels
    // and SanMar partColor/labelSize don't silently skip the clamp.
    const norm = (s: string) => s.toLowerCase().trim();
    const wanted = `${norm(color)}|${norm(size)}`;
    for (const [key, qty] of byColorSize.entries()) {
      const [k1, k2] = key.split('|');
      if (k1 && k2 && `${norm(k1)}|${norm(k2)}` === wanted) return qty;
    }
    return undefined;
  })();

  const currency = product.priceRange?.minVariantPrice?.currencyCode ?? '';

  // Check whether a given option value is available given the other
  // currently selected options. e.g. if Color=Black is picked, is
  // Size=XS available? We look for any variant that matches the
  // (other options fixed, this option = candidate value) combination
  // and has availableForSale === true. When no variant matches (the
  // combo doesn't exist at all), treat it as unavailable too — there's
  // no point letting users pick a combination Shopify doesn't carry.
  // Strikethrough + opacity + tooltip is better UX than hiding the
  // option outright: users can *see* the combinations that are
  // temporarily out of stock and pick a different size/color to fix it.
  const isOptionValueAvailable = (optionName: string, candidateValue: string): boolean => {
    const probe = { ...currentOptions, [optionName]: candidateValue };
    // Any variant that fully matches probe AND is available?
    return variantEdges.some(
      (v: { node: { availableForSale: boolean; selectedOptions: Array<{ name: string; value: string }> } }) =>
        v.node.availableForSale &&
        (v.node.selectedOptions ?? []).every(
          (so: { name: string; value: string }) => probe[so.name] === so.value,
        ),
    );
  };

  return (
    <div id="main-content" tabIndex={-1} className="min-h-screen bg-background focus:outline-none">
      <Navbar onOpenCart={() => setCartOpen(true)} />
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />

      <div className="max-w-[1100px] mx-auto px-4 md:px-8 pt-20 pb-32">
        {/* Breadcrumb (§3.10): Home → Products → Category → Product.
            Mirrors the JSON-LD BreadcrumbList fed to Google so the
            visible trail and the structured-data trail agree. Each
            non-terminal crumb is a link; the final crumb is marked
            aria-current so screen readers announce "current page".
            Falls back to product.title when a handle isn't in the
            local catalogue (new Shopify product not yet synced).

            Also keeps the Back-to-products affordance for thumb-reach
            mobile users — rendered on its own row under the crumbs so
            the chevron chain isn't polluted by a leading arrow. */}
        {(() => {
          // Map Product.category → Products.tsx filter slug so the
          // category crumb actually lands on the right filtered grid
          // (see matchesCategory in /src/pages/Products.tsx).
          const categorySlug = (() => {
            if (!localProduct) return null;
            const c = localProduct.category;
            if (c === 'hoodie' || c === 'crewneck') return 'chandails';
            if (c === 'tshirt' || c === 'longsleeve' || c === 'sport') return 'tshirts';
            if (c === 'polo') return 'polos';
            if (c === 'cap' || c === 'toque') return 'headwear';
            return null;
          })();
          const categoryCrumbLabel = (() => {
            // Use the same EN/FR category tab labels the Products page
            // uses, not categoryLabel() (which is the singular garment
            // label: "T-Shirt"). Breadcrumbs read as plural sections.
            switch (categorySlug) {
              case 'chandails': return lang === 'en' ? 'Sweaters' : 'Chandails';
              case 'tshirts':   return 'T-Shirts';
              case 'polos':     return 'Polos';
              case 'headwear':  return lang === 'en' ? 'Caps & Beanies' : 'Casquettes & Tuques';
              default: return null;
            }
          })();
          const productCrumb = localProduct
            ? categoryLabel(localProduct.category, lang)
            : product.title;
          const homeLabel = lang === 'en' ? 'Home' : 'Accueil';
          const productsLabel = lang === 'en' ? 'Products' : 'Produits';
          return (
            <nav
              aria-label={lang === 'en' ? 'Breadcrumb' : "Fil d'Ariane"}
              className="mb-2"
            >
              <ol className="flex items-center flex-wrap gap-1.5 text-sm text-muted-foreground">
                <li>
                  <Link
                    to="/"
                    className="hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
                  >
                    {homeLabel}
                  </Link>
                </li>
                <li aria-hidden="true" className="text-muted-foreground/50">
                  <ChevronRight className="h-3.5 w-3.5" />
                </li>
                <li>
                  <Link
                    to="/products"
                    className="hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
                  >
                    {productsLabel}
                  </Link>
                </li>
                {categorySlug && categoryCrumbLabel && (
                  <>
                    <li aria-hidden="true" className="text-muted-foreground/50">
                      <ChevronRight className="h-3.5 w-3.5" />
                    </li>
                    <li>
                      <Link
                        to={`/products?cat=${categorySlug}`}
                        className="hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
                      >
                        {categoryCrumbLabel}
                      </Link>
                    </li>
                  </>
                )}
                <li aria-hidden="true" className="text-muted-foreground/50">
                  <ChevronRight className="h-3.5 w-3.5" />
                </li>
                <li
                  aria-current="page"
                  className="text-foreground font-medium truncate max-w-[55vw] sm:max-w-none"
                  title={productCrumb}
                >
                  {productCrumb}
                </li>
              </ol>
            </nav>
          );
        })()}
        <Link
          to="/products"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {lang === 'en' ? 'Back to products' : 'Retour aux produits'}
        </Link>

        <div className="grid md:grid-cols-[1.1fr_1fr] gap-8 lg:gap-14 items-start">
          {/* Images — main photo + thumbnail strip; main swaps when a color option is picked */}
          {(() => {
            const pickedColor = (() => {
              if (!localProduct) return null;
              const colorOpt = options.find((o: { name: string }) => /color|colour|couleur/i.test(o.name));
              if (!colorOpt) return null;
              const value = currentOptions[colorOpt.name];
              if (!value) return null;
              return findColorImage(localProduct.sku, value);
            })();

            // Front/back always reflect the picked color when available.
            // Extra Shopify CDN shots (detail/logo/fit) become additional
            // thumbnails so users can inspect the garment before customizing.
            const frontUrl = pickedColor?.front ?? images[0]?.node?.url ?? localProduct?.imageDevant;
            const backUrl = pickedColor?.back ?? images[1]?.node?.url ?? localProduct?.imageDos;

            const shots: GalleryShot[] = [];
            if (frontUrl) {
              shots.push({
                url: frontUrl,
                alt: product.title,
                labelEn: 'Front',
                labelFr: 'Devant',
              });
            }
            if (backUrl && backUrl !== frontUrl) {
              shots.push({
                url: backUrl,
                alt: `${product.title} — dos`,
                labelEn: 'Back',
                labelFr: 'Dos',
              });
            }
            // Detail shots: any Shopify CDN image past the first two that
            // isn't already represented by front/back. De-dup on URL so a
            // SKU where Shopify's image[0/1] matches the Drive front/back
            // (or appears again later) doesn't produce duplicate thumbs.
            const seen = new Set(shots.map(s => s.url));
            const extras = (shopifyImages ?? []) as Array<{ node: { url: string; altText?: string | null } }>;
            for (let i = 0; i < extras.length && shots.length < 5; i++) {
              const node = extras[i]?.node;
              if (!node?.url || seen.has(node.url)) continue;
              seen.add(node.url);
              shots.push({
                url: node.url,
                alt: node.altText || `${product.title} — ${lang === 'en' ? 'detail' : 'détail'} ${shots.length}`,
                labelEn: `Detail ${shots.length - 1}`,
                labelFr: `Détail ${shots.length - 1}`,
              });
            }

            if (shots.length === 0) {
              return (
                <div>
                  <div className="aspect-square overflow-hidden rounded-2xl bg-secondary border border-border flex items-center justify-center text-muted-foreground text-sm">
                    {lang === 'en' ? 'No image' : "Pas d'image"}
                  </div>
                </div>
              );
            }

            return <ProductGallery shots={shots} lang={lang} />;
          })()}

          {/* Info */}
          <div className="space-y-6">
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
                    if (typeof navigator.share === 'function') {
                      // User-cancel is a clean path here (AbortError).
                      // Stay silent — no "copied" toast, no error.
                      try { await navigator.share(shareData); } catch { /* cancelled */ }
                      return;
                    }
                    // Clipboard fallback — iframes, non-HTTPS contexts,
                    // and denied permissions all reject the write.
                    // Surface an error toast in that case so the user
                    // doesn't stare at a button that silently did nothing.
                    try {
                      await navigator.clipboard.writeText(window.location.href);
                      toast.success(lang === 'en' ? 'Link copied!' : 'Lien copié !');
                    } catch (err) {
                      console.warn('[ProductDetail] share clipboard failed:', err);
                      toast.error(
                        lang === 'en'
                          ? 'Couldn\u2019t copy the link. Long-press the URL bar instead.'
                          : 'Impossible de copier le lien. Fais un appui long sur la barre d\u2019adresse.',
                      );
                    }
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
              // Key on handle so nav to a new product remounts the calculator
              // with the default qty=12. Without this, ProductDetail stays
              // mounted across /product/:handle (same as selectedOptions
              // reset useEffect) and the previous product's qty leaks onto
              // the new page, confusing the 'unlock volume discount' hint.
              // Keep qty stable across variant (color/size) switches on the
              // *same* product so size/color tweaks don't reset the user's
              // chosen quantity.
              return <BulkCalculator key={handle} unitWithPrint={unitWithPrint} discountedUnit={discountedUnit} lang={lang} variantMaxQty={variantMaxQty} />;
            })()}

            {/* Compact info row: stock + size guide + delivery */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              {!stockLoading && stock.totalAvailable > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 font-bold">
                  <Package size={11} aria-hidden="true" />
                  {lang === 'en' ? 'In stock' : 'En stock'}
                </span>
              )}
              <button
                type="button"
                onClick={() => setSizeGuideOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={sizeGuideOpen}
                className="inline-flex items-center gap-1 text-primary hover:underline font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded"
              >
                <Ruler size={11} aria-hidden="true" />
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
              .filter((opt: { name: string; values: string[] }) => (opt.values ?? []).length > 1)
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
                      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={localizedName}>
                        {(() => {
                          const norm = (s: string) => s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                          const localNames = localProduct.colors
                            .filter(c => !!findColorImage(localProduct.sku, c.nameEn) || !!findColorImage(localProduct.sku, c.name) || /^(black|noir)$/i.test(c.nameEn))
                            .map(c => c.name);
                          const extra = (option.values ?? []).filter(v => !localNames.some(n => norm(n) === norm(v)));
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
                            const shopifyValueForMatch = (option.values ?? []).find(v => norm(v) === norm(value)) ?? value;
                            const isSelected = norm(currentOptions[option.name] ?? '') === norm(shopifyValueForMatch);
                            // Only run availability check against Shopify values;
                            // a local-catalog-only colour (not in option.values)
                            // is treated as available so we don't strike colours
                            // that Shopify just hasn't listed yet.
                            const isInShopify = (option.values ?? []).some(v => norm(v) === norm(value));
                            const isAvailable = !isInShopify || isOptionValueAvailable(option.name, shopifyValueForMatch);
                            const soldOutTitle = lang === 'en' ? 'Sold out' : 'Épuisé';
                            return (
                              <button
                                key={value}
                                type="button"
                                role="radio"
                                aria-checked={isSelected}
                                aria-disabled={!isAvailable || undefined}
                                onClick={() => {
                                  if (!isAvailable) {
                                    // Graceful — surface the state instead of silently
                                    // selecting a variant that can't be bought.
                                    toast.error(
                                      lang === 'en'
                                        ? `${value} — Sold out`
                                        : `${value} — Épuisé`,
                                    );
                                    return;
                                  }
                                  setSelectedOptions(prev => ({ ...prev, [option.name]: shopifyValueForMatch }));
                                }}
                                className={`relative w-11 h-11 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                                  isSelected
                                    ? 'ring-2 ring-primary ring-offset-2 scale-110'
                                    : 'ring-1 ring-border hover:ring-primary/50'
                                } ${!isAvailable ? 'opacity-50' : ''}`}
                                style={{ background: hex }}
                                aria-label={isAvailable ? value : `${value} — ${soldOutTitle}`}
                                title={isAvailable ? value : `${value} — ${soldOutTitle}`}
                              >
                                {isSelected && (
                                  <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <Check size={14} className="text-white drop-shadow" strokeWidth={3} />
                                  </span>
                                )}
                                {!isAvailable && (
                                  /* Diagonal strikethrough line for the circular
                                     swatch — <hr> / text-decoration:line-through
                                     doesn't visually read on an empty round
                                     button, so draw an SVG slash instead. */
                                  <span
                                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                                    aria-hidden="true"
                                  >
                                    <svg width="100%" height="100%" viewBox="0 0 44 44" className="text-foreground/70">
                                      <line x1="6" y1="38" x2="38" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                    </svg>
                                  </span>
                                )}
                              </button>
                            );
                          });
                        })()}
                      </div>
                    ) : (
                      /* Size + others: text pills */
                      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={localizedName}>
                        {(option.values ?? []).map((value: string) => {
                          const isSel = currentOptions[option.name] === value;
                          const isAvailable = isOptionValueAvailable(option.name, value);
                          const soldOutTitle = lang === 'en' ? 'Sold out' : 'Épuisé';
                          return (
                            <button
                              key={value}
                              type="button"
                              role="radio"
                              aria-checked={isSel}
                              aria-disabled={!isAvailable || undefined}
                              onClick={() => {
                                if (!isAvailable) {
                                  // Don't silently change the selection to a
                                  // variant Shopify can't fulfil. Toast surfaces
                                  // the state so the user knows why nothing moved.
                                  toast.error(
                                    lang === 'en'
                                      ? `${value} — Sold out`
                                      : `${value} — Épuisé`,
                                  );
                                  return;
                                }
                                setSelectedOptions(prev => ({ ...prev, [option.name]: value }));
                              }}
                              title={isAvailable ? undefined : `${value} — ${soldOutTitle}`}
                              aria-label={isAvailable ? undefined : `${value} — ${soldOutTitle}`}
                              className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                                isSel
                                  ? 'gradient-navy-dark text-primary-foreground border-transparent shadow-sm'
                                  : 'bg-background text-foreground border-border hover:border-primary'
                              } ${!isAvailable ? 'line-through opacity-50 hover:border-border cursor-not-allowed' : ''}`}
                            >
                              {value}
                            </button>
                          );
                        })}
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
                          <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
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

type GalleryShot = { url: string; alt: string; labelEn: string; labelFr: string };

function ProductGallery({ shots, lang }: { shots: GalleryShot[]; lang: 'fr' | 'en' }) {
  const [active, setActive] = useState(0);
  // When a color swatch is clicked, the parent rebuilds `shots` with new
  // URLs. Keep active index in range and snap back to the front on color
  // change so the user doesn't end up staring at a detail shot of the
  // previous variant. Tracking the first URL is enough — it's the front
  // photo, which is deterministic from picked color.
  const firstUrlRef = useRef(shots[0]?.url ?? '');
  useEffect(() => {
    const currentFirst = shots[0]?.url ?? '';
    if (currentFirst !== firstUrlRef.current) {
      firstUrlRef.current = currentFirst;
      setActive(0);
    } else if (active >= shots.length) {
      setActive(0);
    }
  }, [shots, active]);

  // Build a stable id that belongs to this gallery instance so we can
  // wire aria-controls from each thumbnail to the main image without
  // relying on brittle DOM queries.
  const mainId = useMemo(
    () => `pg-main-${Math.random().toString(36).slice(2, 9)}`,
    [],
  );

  const select = (i: number) => {
    if (!shots.length) return;
    const clamped = ((i % shots.length) + shots.length) % shots.length;
    setActive(clamped);
  };

  const onKeyDown: KeyboardEventHandler<HTMLDivElement> = (e) => {
    // Arrow keys cycle through thumbnails. Home/End jump to the ends.
    // Only intercept when the gallery owns focus so we don't steal
    // arrow-key behaviour from form fields elsewhere on the page.
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      select(active + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      select(active - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      select(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      select(shots.length - 1);
    }
  };

  const current = shots[Math.min(active, shots.length - 1)] ?? shots[0];

  return (
    <div
      role="group"
      aria-roledescription={lang === 'en' ? 'Product image gallery' : "Galerie d'images du produit"}
      aria-label={lang === 'en' ? 'Product image gallery' : "Galerie d'images du produit"}
      onKeyDown={onKeyDown}
      tabIndex={0}
      className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-2xl"
    >
      <div
        id={mainId}
        className="aspect-square overflow-hidden rounded-2xl bg-secondary border border-border relative"
        aria-live="polite"
      >
        <img
          src={current.url}
          alt={current.alt}
          width={800}
          height={800}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
          key={`main-${current.url}`}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
        />
        <div className="absolute bottom-3 left-3 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-white/90 text-foreground shadow-sm pointer-events-none">
          {lang === 'en' ? current.labelEn : current.labelFr}
        </div>
      </div>

      {shots.length > 1 && (
        <div
          role="tablist"
          aria-label={lang === 'en' ? 'Product image thumbnails' : 'Vignettes du produit'}
          className="mt-3 flex gap-2 overflow-x-auto pb-1"
        >
          {shots.map((shot, i) => {
            const isActive = i === active;
            return (
              <button
                key={`${shot.url}-${i}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={mainId}
                tabIndex={isActive ? 0 : -1}
                onClick={() => select(i)}
                title={lang === 'en' ? shot.labelEn : shot.labelFr}
                aria-label={lang === 'en' ? shot.labelEn : shot.labelFr}
                className={`relative flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden border-2 bg-secondary transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                  isActive
                    ? 'border-primary ring-1 ring-primary/40 shadow-sm'
                    : 'border-border hover:border-primary/60 opacity-80 hover:opacity-100'
                }`}
              >
                <img
                  src={shot.url}
                  alt=""
                  aria-hidden="true"
                  width={160}
                  height={160}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BulkCalculator({ unitWithPrint, discountedUnit, lang, variantMaxQty }: { unitWithPrint: number; discountedUnit: number; lang: 'fr' | 'en'; variantMaxQty?: number }) {
  const [qty, setQty] = useState(12);

  // When the user switches to a variant (color/size) with less stock
  // than their current qty, clamp down so the estimate can't quote
  // more units than the variant actually has. We don't remount the
  // calculator on variant change (that would blow away a deliberately
  // chosen qty on every swatch click — see the `key={handle}` comment
  // in ProductDetail); instead, only shrink qty when the new ceiling
  // is lower, and floor at 1 so the input never reads 0 mid-edit.
  // If variantMaxQty is undefined (SanMar edge fn not deployed, or no
  // color+size resolved yet) we leave qty alone.
  useEffect(() => {
    if (typeof variantMaxQty !== 'number' || !Number.isFinite(variantMaxQty)) return;
    const ceiling = Math.max(1, variantMaxQty);
    setQty(q => (q > ceiling ? ceiling : q));
  }, [variantMaxQty]);

  const isBulk = qty >= 12;
  const unit = isBulk ? discountedUnit : unitWithPrint;
  const total = unit * qty;
  const savings = isBulk ? (unitWithPrint - discountedUnit) * qty : 0;

  // Use fr-CA / en-CA locale so French users see '27,54 $' with a comma
  // separator (matches cart totals, quote rows, admin dashboards,
  // CartRecommendations, FeaturedProducts). .toFixed(2) alone always
  // emits a '.' which looks out of place next to every other CAD price
  // in the French build.
  const fmt = (n: number) =>
    n.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const bump = (delta: number) => setQty(q => {
    const next = Math.max(1, q + delta);
    if (typeof variantMaxQty === 'number' && Number.isFinite(variantMaxQty)) {
      const ceiling = Math.max(1, variantMaxQty);
      return Math.min(next, ceiling);
    }
    return next;
  });

  return (
    <div className="bg-gradient-to-br from-secondary/60 to-background border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Calculator size={14} className="text-[#0052CC]" aria-hidden="true" />
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
          <Minus size={14} aria-hidden="true" />
        </button>
        <input
          type="number"
          min="1"
          inputMode="numeric"
          value={qty}
          onChange={e => setQty(() => {
            const raw = Math.max(1, parseInt(e.target.value) || 1);
            if (typeof variantMaxQty === 'number' && Number.isFinite(variantMaxQty)) {
              return Math.min(raw, Math.max(1, variantMaxQty));
            }
            return raw;
          })}
          className="flex-1 text-center text-2xl font-extrabold bg-background border border-border rounded-lg py-1.5 outline-none focus:border-primary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          aria-label={lang === 'en' ? 'Quantity' : 'Quantité'}
        />
        <button
          type="button"
          onClick={() => bump(1)}
          aria-label={lang === 'en' ? 'Increase' : 'Augmenter'}
          className="w-11 h-11 rounded-lg border border-border bg-background hover:bg-secondary active:bg-secondary/80 flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
        >
          <Plus size={14} aria-hidden="true" />
        </button>
      </div>
      <div className="flex justify-between items-baseline">
        <span className="text-xs text-muted-foreground">
          {qty} × {fmt(unit)} $
        </span>
        <div className="text-right">
          <div className="text-2xl font-extrabold text-foreground">{fmt(total)} $</div>
          {savings > 0 && (
            <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
              {lang === 'en' ? 'Save' : 'Économise'} {fmt(savings)} $
            </div>
          )}
        </div>
      </div>
      {!isBulk && qty > 0 && (
        <button
          type="button"
          onClick={() => setQty(12)}
          className="w-full mt-2 text-[11px] font-bold text-emerald-700 hover:underline text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 rounded"
        >
          {lang === 'en'
            ? `+ ${12 - qty} units to unlock 10% volume discount →`
            : `+ ${12 - qty} unités pour débloquer 10% de rabais →`}
        </button>
      )}
    </div>
  );
}

