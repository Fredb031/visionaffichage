import { useEffect, useState, Suspense, lazy, useMemo, useRef, useId, type KeyboardEventHandler } from 'react';
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
import { ArrowLeft, Shirt, Check, CheckCircle, ChevronRight, Package, Ruler, Calculator, Minus, Plus, AlertTriangle, PackageX, Share2, HelpCircle, X, Heart, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { SizeGuide } from '@/components/SizeGuide';
import { findProductByHandle, findColorImage, PRINT_PRICE, BULK_DISCOUNT_RATE, BULK_DISCOUNT_THRESHOLD } from '@/data/products';
import { fmtMoney } from '@/lib/format';
import { getDescription } from '@/data/productDescriptions';
import { categoryLabel } from '@/lib/productLabels';
import { DeliveryBadge } from '@/components/DeliveryBadge';
import { AIChat } from '@/components/AIChat';
import { useLang } from '@/lib/langContext';
import { useSanmarInventory } from '@/hooks/useSanmarInventory';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { useWishlist } from '@/hooks/useWishlist';
import { useProductColors } from '@/hooks/useProductColors';
import { useProducts } from '@/hooks/useProducts';
import { readLS, writeLS } from '@/lib/storage';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { ProductCard } from '@/components/ProductCard';
import { ProductViewersNudge } from '@/components/ProductViewersNudge';

// Task 3.19 — per-handle last-viewed variant cache. A returning visitor
// who previously picked "Bleu marine / L" should land back on that exact
// swatch+pill instead of whatever the option's first value happens to
// be. Stored per-handle so switching products doesn't bleed picks, with
// a 30-day TTL to avoid stamping seasonal picks onto a much-later visit
// and to give storage a natural eviction path without a cron job.
//
// Shape: { v: 1, options: Record<string, string>, savedAt: epoch-ms }.
// `v` is a schema tag so a future breaking change can bump it and the
// old payload gets ignored (readLS returns the fallback when the parsed
// shape doesn't match). options is the full Shopify option bag, not
// just color+size, because some products add a "Matériel" or "Manche"
// axis that's equally worth restoring. Storage failure is already
// silent in writeLS/readLS so private-mode Safari just falls back to
// fresh defaults.
const LAST_VARIANT_PREFIX = 'vision-pdp-lastvariant:';
const LAST_VARIANT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
type LastVariantPayload = { v: 1; options: Record<string, string>; savedAt: number };

function readLastVariant(handle: string | undefined): Record<string, string> | null {
  if (!handle) return null;
  const stored = readLS<LastVariantPayload | null>(`${LAST_VARIANT_PREFIX}${handle}`, null);
  if (!stored || stored.v !== 1 || typeof stored.savedAt !== 'number') return null;
  if (Date.now() - stored.savedAt > LAST_VARIANT_TTL_MS) return null;
  if (!stored.options || typeof stored.options !== 'object') return null;
  return stored.options;
}

// Small scroll-reveal hook for the PDP lower sections (Description,
// Features, Similar products). Attaches the global `.fi` / `.fi.in`
// fade+translate-y pair defined in src/index.css via an
// IntersectionObserver that unobserves on first intersection (no
// churn from subsequent scrolls). Respects prefers-reduced-motion
// STRICTLY — motion-averse visitors skip the fi opacity class
// entirely rather than relying on the CSS @media override that only
// collapses transition durations; otherwise a very fast device could
// briefly flash `opacity:0` before the near-instant transition runs.
//
// Returns { ref, className } so the caller splats both onto the
// target element. className is '' under reduced-motion so the element
// renders at its natural opacity with no observer attached.
function useRevealOnScroll(): {
  ref: (node: HTMLElement | null) => void;
  className: string;
} {
  // Lazy init from matchMedia so the very first render already knows
  // whether reduced-motion is on — prevents a one-frame flash of
  // opacity:0 for motion-averse users before the first effect commit
  // flips the flag. SSR-safe guard returns false there; the
  // subsequent effect reconciles if the real media state differs.
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch { return false; }
  });
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mq.matches);
    update();
    if (mq.addEventListener) mq.addEventListener('change', update);
    else mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', update);
      else mq.removeListener(update);
    };
  }, []);

  // We use a callback ref (not useRef) so the observer wires up the
  // moment the DOM node attaches, even in StrictMode's double-invoke
  // world. Keeping the observer instance in a ref lets us tear it
  // down cleanly on unmount without leaking a handle on a detached
  // node.
  const observerRef = useRef<IntersectionObserver | null>(null);
  const nodeRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, []);

  const setRef = (node: HTMLElement | null) => {
    if (nodeRef.current === node) return;
    // Detach old observer before attaching to the new node.
    observerRef.current?.disconnect();
    observerRef.current = null;
    nodeRef.current = node;
    if (!node) return;
    if (reducedMotion) return;
    if (typeof IntersectionObserver === 'undefined') {
      // Legacy browser — just reveal immediately so no content is
      // stranded behind an observer that'll never fire.
      node.classList.add('in');
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add('in');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    io.observe(node);
    observerRef.current = io;
  };

  return {
    ref: setRef,
    // Under reduced-motion we skip `fi` entirely so the element
    // never starts at opacity:0 — no animation at all is the
    // correct reading of "prefers reduced motion".
    className: reducedMotion ? '' : 'fi',
  };
}

// Thin wrapper that opts a block of content into the scroll-reveal
// treatment. Used three times on the PDP (Description, Features,
// Similar products) without repeating the hook wiring or the
// className plumbing at each call site. `as` lets the caller keep
// the original semantic element (e.g. section) so we don't introduce
// an extra generic <div> that would break the existing
// aria-labelledby hookup on "Produits similaires".
function RevealBlock({
  as: Tag = 'div',
  className = '',
  children,
  ...rest
}: {
  as?: 'div' | 'section';
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  const { ref, className: fadeClass } = useRevealOnScroll();
  // Merge the caller's layout classes with the (possibly empty under
  // reduced-motion) fade class. Trim trailing space so the DOM stays
  // clean for snapshot tests.
  const merged = `${fadeClass} ${className}`.trim();
  // Tag-level switch because a generic `createElement` would drop the
  // strong typing on props we spread below (role, aria-*, etc).
  if (Tag === 'section') {
    return (
      <section ref={ref as (node: HTMLElement | null) => void} className={merged} {...rest}>
        {children}
      </section>
    );
  }
  return (
    <div ref={ref as (node: HTMLElement | null) => void} className={merged} {...rest}>
      {children}
    </div>
  );
}

export default function ProductDetail() {
  const { handle } = useParams<{ handle: string }>();
  const { lang } = useLang();
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [cartOpen, setCartOpen] = useState(false);
  // Task 4.15 — auto-open the customizer when the PDP is reached via a
  // shared config link (?customize=1). The customizer itself reads the
  // same query string on mount to pre-apply colour + placement. Lazy
  // initialiser runs once per mount so an in-session URL change (we
  // don't do any, but a future push-state might) doesn't re-open the
  // modal after a user closes it. typeof-window guard keeps SSR-safe.
  const [customizerOpen, setCustomizerOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('customize') === '1';
  });
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);

  // Task 3.19 — has the user manually picked anything this mount? The
  // hydrate-from-localStorage effect (below) must NOT overwrite a pick
  // that happened between mount and the Shopify product fetch
  // resolving. A returning visitor who already tapped "L" should keep
  // "L" even if their prior session had "M" cached. Ref (not state) on
  // purpose: flipping it should NOT re-run the effect.
  const userInteractedRef = useRef(false);
  const hydratedRef = useRef(false);

  // Task 3.12 — Shipping ETA calculator. The buyer types an FSA (first
  // 3 chars of a Canadian postal code, e.g. "H2X" for Montréal or "J2S"
  // for Saint-Hyacinthe) and we surface a concrete arrival date before
  // add-to-cart instead of the vague "5-day delivery" trust badge. FSA
  // persists to localStorage so repeat visitors don't retype on every
  // PDP. lazy-init from storage to skip a needless re-render and to
  // survive SSR gracefully (typeof window guard).
  const [shipFsa, setShipFsa] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      return window.localStorage.getItem('vision-ship-to-fsa') ?? '';
    } catch {
      return '';
    }
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (shipFsa) window.localStorage.setItem('vision-ship-to-fsa', shipFsa);
      else window.localStorage.removeItem('vision-ship-to-fsa');
    } catch {
      /* storage blocked (private mode, quota) — ignore */
    }
  }, [shipFsa]);

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

  // Task 3.5 — "Produits similaires" scroller. Pull the full live
  // Shopify catalog (cached 30 min via useProducts) and keep only
  // items whose local-catalogue entry shares the current product's
  // category, excluding the current SKU itself. Capped at 6 so the
  // horizontal strip stays browsable on mobile without turning into
  // an infinite swipe. ProductCard is fed the live Shopify node
  // directly so wishlist hearts, colour swatches, and price parity
  // all match the main grid.
  const { data: allShopifyProducts } = useProducts();
  const similarProducts = useMemo(() => {
    if (!localProduct || !allShopifyProducts) return [];
    const currentCategory = localProduct.category;
    const currentHandle = handle ?? localProduct.shopifyHandle;
    return allShopifyProducts
      .filter(p => {
        const h = p?.node?.handle;
        if (!h || h === currentHandle) return false;
        const local = findProductByHandle(h);
        return local?.category === currentCategory;
      })
      .slice(0, 6);
  }, [allShopifyProducts, localProduct, handle]);

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
  // Task 3.16 — wishlist heart parity with ProductCard. Key-based
  // remount pattern: bumping `wishlistBurstKey` swaps the particle
  // overlay with a fresh DOM node, restarting the CSS keyframe from
  // frame 0. Only bumped on ADD so removing feels like the heart
  // quietly clearing rather than a second celebration.
  const [wishlistBurstKey, setWishlistBurstKey] = useState(0);
  // Task 18.4 — double-click guard on the Web Share CTA. A rapid tap
  // queues two navigator.share() invocations: the first pops the
  // native share sheet, the second arrives while the first's Promise
  // is still pending and throws "InvalidStateError" on iOS Safari
  // (fires twice on Android). Lock the button for the duration of
  // the share/clipboard async so the second click is swallowed.
  const [sharing, setSharing] = useState(false);

  // Hunt 133 — sticky mobile CTA visibility. We only want the pinned
  // Personnaliser button to appear once the user has scrolled the
  // in-flow CTA off-screen; otherwise we'd stack two identical
  // buttons on top of each other on small phones. IntersectionObserver
  // on the inline CTA's ref toggles the sticky variant's hidden state.
  // The observer is cheap (1 target, default threshold) and cleans up
  // on unmount; falls back to "always show" if IO is unavailable
  // (old Safari < 12.2) rather than silently hiding the button.
  const inlineCtaRef = useRef<HTMLButtonElement | null>(null);
  const [inlineCtaInView, setInlineCtaInView] = useState(true);
  useEffect(() => {
    const el = inlineCtaRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInlineCtaInView(false); // force sticky visible as a fallback
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => setInlineCtaInView(!!entry?.isIntersecting),
      { threshold: 0, rootMargin: '0px 0px -60px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [product]);
  const handleWishlistClick = () => {
    if (!handle) return;
    const wasAdding = !saved;
    toggleWishlist(handle);
    if (wasAdding) setWishlistBurstKey(k => k + 1);
  };

  // React Router keeps ProductDetail mounted across /product/:handle
  // nav — meaning selectedOptions from the previous product leaks
  // onto the new one. If the old variant 'Color: Sky Blue' exists on
  // A but not B, the swatch UI shows Sky Blue selected even though B
  // has no such option. Reset on handle change.
  //
  // Task 3.19 — also reset the interaction/hydration flags so the
  // next product's hydrate effect can run exactly once. Without this,
  // navigating from /product/a (already interacted with) to
  // /product/b would treat b as pre-interacted and skip hydration.
  useEffect(() => {
    setSelectedOptions({});
    userInteractedRef.current = false;
    hydratedRef.current = false;
  }, [handle]);

  // Task 3.19 — hydrate from localStorage once the Shopify product has
  // loaded (so we can validate the stored pick against the current
  // option values). Gated on:
  //   1) hydratedRef — only once per handle mount
  //   2) userInteractedRef — don't clobber a pick the user made between
  //      mount and Shopify resolving (race where a fast tap beats the
  //      product query)
  //   3) validity — only copy over option values that STILL exist on
  //      this product; a colour that's been discontinued just gets
  //      dropped rather than selecting a non-existent variant.
  useEffect(() => {
    if (hydratedRef.current) return;
    if (userInteractedRef.current) return;
    if (!handle || !product) return;
    const stored = readLastVariant(handle);
    if (!stored) { hydratedRef.current = true; return; }
    const productOptions = (product.options ?? []) as Array<{ name: string; values: string[] }>;
    const restorable: Record<string, string> = {};
    for (const opt of productOptions) {
      const val = stored[opt.name];
      if (!val) continue;
      // Normalize for case/accent so a stored "Bleu marine" still
      // matches an option whose casing has drifted slightly.
      const norm = (s: string) => s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const match = (opt.values ?? []).find(v => norm(v) === norm(val));
      if (match) restorable[opt.name] = match;
    }
    if (Object.keys(restorable).length > 0) {
      setSelectedOptions(prev => ({ ...restorable, ...prev }));
    }
    hydratedRef.current = true;
  }, [handle, product]);

  // Task 3.19 — persist every user-initiated option change. Piggybacks
  // on userInteractedRef so the initial hydrate write (which already
  // came FROM storage) doesn't rewrite the same payload with a new
  // `savedAt` and effectively reset the TTL on every visit (which
  // would defeat the 30-day eviction goal). Empty bags are a no-op
  // (the handle-reset effect runs before the user touches anything).
  useEffect(() => {
    if (!handle) return;
    if (!userInteractedRef.current) return;
    if (Object.keys(selectedOptions).length === 0) return;
    const payload: LastVariantPayload = {
      v: 1,
      options: selectedOptions,
      savedAt: Date.now(),
    };
    writeLS(`${LAST_VARIANT_PREFIX}${handle}`, payload);
  }, [handle, selectedOptions]);

  // Set a product-specific document title + meta description so browser
  // tabs, bookmarks, shared links, AND Google SERP snippets reflect the
  // actual product instead of the default site title/description.
  // Restore on unmount so SPA nav doesn't leak stale values.
  //
  // Task 8.12 — meta description is now dynamic based on product name
  // + category label (e.g. "Hoodies unisexe ATCF2500 — personnalise ton
  // logo. Livré en 5 jours au Québec."). Falls back to the product
  // title when the local catalog doesn't know this handle yet.
  const pdpTitle = product
    ? `${localProduct ? categoryLabel(localProduct.category, lang) : product.title} ${localProduct?.sku ?? ''} — Vision Affichage`.trim()
    : lang === 'en' ? 'Product — Vision Affichage' : 'Produit — Vision Affichage';
  const pdpDescription = product
    ? (() => {
        const label = localProduct ? categoryLabel(localProduct.category, lang) : product.title;
        return lang === 'en'
          ? `${product.title} — ${label}. Customize with your logo, printed in Québec, delivered in 5 business days.`
          : `${product.title} — ${label}. Personnalise avec ton logo, imprimé au Québec, livré en 5 jours ouvrables.`;
      })()
    : undefined;
  // Task 8.5 — OG + Twitter card image points at the actual product
  // photo so a PDP link pasted into Slack/Facebook/LinkedIn renders a
  // card showing the garment itself. Falls back through the same chain
  // the JSON-LD schema uses (local catalog preferred over Shopify CDN)
  // and finally to the generic /og-default.png when neither is known.
  // og:type=product is the canonical schema for a sellable item — it
  // tells Facebook/LinkedIn to render the extra price/availability row.
  const pdpOgImage = product
    ? (localProduct?.imageDevant ?? product.images?.edges?.[0]?.node?.url)
    : undefined;
  useDocumentTitle(pdpTitle, pdpDescription, {
    ogImage: pdpOgImage,
    ogType: 'product',
  });

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
    // og:price:amount + og:price:currency complete the og:type=product
    // card so Facebook/LinkedIn/Slack previews show the price row under
    // the title. useDocumentTitle already emits og:type=product but not
    // these two — Facebook's OG Product spec treats them as required
    // for the price widget to render. Piggybacks on price/currency
    // already computed above so the numbers match the JSON-LD offer.
    const ogPriceAmount = document.createElement('meta');
    ogPriceAmount.setAttribute('property', 'og:price:amount');
    ogPriceAmount.setAttribute('content', price.toFixed(2));
    document.head.appendChild(ogPriceAmount);
    const ogPriceCurrency = document.createElement('meta');
    ogPriceCurrency.setAttribute('property', 'og:price:currency');
    ogPriceCurrency.setAttribute('content', currency);
    document.head.appendChild(ogPriceCurrency);
    // product:price:* is the newer OG Product namespace — Meta and
    // LinkedIn both accept it, and some scrapers only look for the
    // namespaced form. Emitting both is cheap and maximises coverage.
    const productPriceAmount = document.createElement('meta');
    productPriceAmount.setAttribute('property', 'product:price:amount');
    productPriceAmount.setAttribute('content', price.toFixed(2));
    document.head.appendChild(productPriceAmount);
    const productPriceCurrency = document.createElement('meta');
    productPriceCurrency.setAttribute('property', 'product:price:currency');
    productPriceCurrency.setAttribute('content', currency);
    document.head.appendChild(productPriceCurrency);
    return () => {
      document.head.removeChild(el);
      document.head.removeChild(crumbsEl);
      document.head.removeChild(ogPriceAmount);
      document.head.removeChild(ogPriceCurrency);
      document.head.removeChild(productPriceAmount);
      document.head.removeChild(productPriceCurrency);
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
  // Resolve the picked Color/Size labels once so both the SanMar
  // lookup and the low-stock/out-of-stock pill (Task 3.17) can reuse
  // them without re-scanning the options list twice.
  const colorOption = options.find((o: { name: string }) => /color|colour|couleur/i.test(o.name));
  const sizeOption = options.find((o: { name: string }) => /size|taille/i.test(o.name));
  const selectedColor = colorOption ? currentOptions[colorOption.name] : undefined;
  const selectedSize = sizeOption ? currentOptions[sizeOption.name] : undefined;

  // SanMar keys are raw strings; match case-insensitively so 'Black'
  // vs 'BLACK' / 'S' vs 's' differences between Shopify option labels
  // and SanMar partColor/labelSize don't silently skip the lookup.
  const normKey = (s: string) => s.toLowerCase().trim();
  const sanmarVariantQty: number | undefined = (() => {
    const byColorSize = stock?.byColorSize;
    if (!byColorSize || byColorSize.size === 0) return undefined;
    if (!selectedColor || !selectedSize) return undefined;
    const wanted = `${normKey(selectedColor)}|${normKey(selectedSize)}`;
    for (const [key, qty] of byColorSize.entries()) {
      const [k1, k2] = key.split('|');
      if (k1 && k2 && `${normKey(k1)}|${normKey(k2)}` === wanted) return qty;
    }
    return undefined;
  })();

  const variantMaxQty: number | undefined = (() => {
    if (selectedVariant && selectedVariant.availableForSale === false) return 0;
    return sanmarVariantQty;
  })();

  // Low-stock / out-of-stock warning state for Task 3.17. Only fires
  // when SanMar has loaded AND both color+size are selected — stale
  // data or a half-made selection must stay silent (spec rule 5).
  // Shopify's `availableForSale === false` counts as "sold out" even
  // if SanMar's byColorSize is missing, so people can't add a variant
  // Shopify already rejects.
  const stockSelectionReady = !stockLoading
    && !!stock.byColorSize
    && stock.byColorSize.size > 0
    && !!selectedColor
    && !!selectedSize;
  const shopifySoldOut = selectedVariant?.availableForSale === false;
  const isVariantSoldOut = (stockSelectionReady && sanmarVariantQty === 0)
    || (shopifySoldOut && !!selectedColor && !!selectedSize);
  const isVariantLowStock = stockSelectionReady
    && !isVariantSoldOut
    && typeof sanmarVariantQty === 'number'
    && sanmarVariantQty > 0
    && sanmarVariantQty <= 5;
  // Task 3.4 — positive "In stock" reassurance. Only shown when SanMar
  // reports comfortable inventory (> 5) for the exact selected variant,
  // so it never fights with the low-stock amber pill or the sold-out red
  // pill. Stays silent while loading or before the user has picked both
  // color + size — stale reassurance is worse than no reassurance.
  const isVariantInStock = stockSelectionReady
    && !isVariantSoldOut
    && !isVariantLowStock
    && typeof sanmarVariantQty === 'number'
    && sanmarVariantQty > 5;

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
                  type="button"
                  onClick={handleWishlistClick}
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
                  style={{ overflow: 'visible' }}
                >
                  {/* Task 3.16 — heart-burst parity with ProductCard.
                      Particle overlay sits inside an overflow-visible
                      span so the 6 particles fan outside the button
                      without being clipped. Only rendered on ADD (saved
                      && burstKey > 0); remove is a silent color flip.
                      prefers-reduced-motion drops the animation and
                      hides the particles — see the @media rule below. */}
                  <span
                    key={wishlistBurstKey}
                    className="pdp-heart-burst relative inline-flex items-center justify-center"
                    aria-hidden="true"
                  >
                    <Heart
                      size={16}
                      fill={saved ? '#E8362B' : 'none'}
                      color={saved ? '#E8362B' : 'currentColor'}
                      strokeWidth={2}
                      className="pdp-heart-icon"
                      aria-hidden="true"
                    />
                    {wishlistBurstKey > 0 && saved && (
                      <span className="pdp-heart-particles" aria-hidden="true">
                        {[0, 1, 2, 3, 4, 5].map(i => (
                          <span key={i} className={`pdp-heart-particle pdp-heart-particle-${i}`} />
                        ))}
                      </span>
                    )}
                  </span>
                  <style>{`
                    @keyframes pdp-heart-pulse {
                      0%   { transform: scale(1); }
                      40%  { transform: scale(1.35); }
                      100% { transform: scale(1); }
                    }
                    @keyframes pdp-heart-flash {
                      0%   { filter: brightness(1.4) saturate(1.4); }
                      60%  { filter: brightness(1.1) saturate(1.1); }
                      100% { filter: none; }
                    }
                    @keyframes pdp-heart-particle-out {
                      0%   { transform: translate(-50%, -50%) translate(0, 0) scale(0.4); opacity: 1; }
                      60%  { opacity: 1; }
                      100% { transform: translate(-50%, -50%) translate(var(--pdp-dx), var(--pdp-dy)) scale(0.9); opacity: 0; }
                    }
                    .pdp-heart-burst .pdp-heart-icon {
                      animation: pdp-heart-pulse 400ms ease-out, pdp-heart-flash 400ms ease-out;
                      transform-origin: center;
                      will-change: transform;
                    }
                    .pdp-heart-particles {
                      position: absolute;
                      left: 50%;
                      top: 50%;
                      width: 0;
                      height: 0;
                      pointer-events: none;
                    }
                    .pdp-heart-particle {
                      position: absolute;
                      left: 0;
                      top: 0;
                      width: 5px;
                      height: 5px;
                      margin-left: -2.5px;
                      margin-top: -2.5px;
                      border-radius: 9999px;
                      background: #E8362B;
                      box-shadow: 0 0 3px rgba(232, 54, 43, 0.6);
                      transform: translate(-50%, -50%);
                      animation: pdp-heart-particle-out 520ms ease-out forwards;
                      will-change: transform, opacity;
                    }
                    .pdp-heart-particle-0 { --pdp-dx: 14px;  --pdp-dy: -14px; }
                    .pdp-heart-particle-1 { --pdp-dx: 18px;  --pdp-dy: 2px;   }
                    .pdp-heart-particle-2 { --pdp-dx: 10px;  --pdp-dy: 16px;  }
                    .pdp-heart-particle-3 { --pdp-dx: -10px; --pdp-dy: 16px;  }
                    .pdp-heart-particle-4 { --pdp-dx: -18px; --pdp-dy: 2px;   }
                    .pdp-heart-particle-5 { --pdp-dx: -14px; --pdp-dy: -14px; }
                    @media (prefers-reduced-motion: reduce) {
                      .pdp-heart-burst .pdp-heart-icon { animation: none; }
                      .pdp-heart-particles { display: none; }
                    }
                  `}</style>
                </button>
                <button
                  onClick={async () => {
                    // Task 3.18 — Prefer the native Web Share sheet on mobile
                    // (iOS Safari, Chrome Android) so users can ping the page
                    // to Messages / Slack / email; otherwise fall back to
                    // clipboard. `text` gives apps without a URL field
                    // (WhatsApp preview) a useful caption.
                    if (sharing) return;
                    setSharing(true);
                    const productTitle = localProduct
                      ? categoryLabel(localProduct.category, lang)
                      : product.title;
                    const shareData = {
                      title: productTitle,
                      text: `Vision Affichage \u2014 ${productTitle}`,
                      url: window.location.href,
                    };
                    try {
                      if (typeof navigator.share === 'function') {
                        // User-cancel throws AbortError here. Stay silent on
                        // dismissal — no "copied" toast and no error toast,
                        // the share sheet itself was the feedback.
                        try {
                          await navigator.share(shareData);
                        } catch {
                          /* share dismissed — swallow */
                        }
                        return;
                      }
                      // Clipboard fallback. Only toast on *success* so a
                      // silently failing clipboard (iframe / HTTP / denied)
                      // doesn't lie to the user with "Lien copié".
                      try {
                        await navigator.clipboard.writeText(window.location.href);
                        toast.success(lang === 'en' ? 'Link copied' : 'Lien copié');
                      } catch {
                        /* clipboard unavailable — stay silent */
                      }
                    } finally {
                      setSharing(false);
                    }
                  }}
                  disabled={sharing}
                  aria-busy={sharing || undefined}
                  className="w-11 h-11 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed"
                  aria-label={lang === 'en' ? 'Share this product' : 'Partager ce produit'}
                  title={lang === 'en' ? 'Share' : 'Partager'}
                >
                  <Share2 size={16} aria-hidden="true" />
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
              return <BulkCalculator key={handle} basePrice={shopifyBase} unitWithPrint={unitWithPrint} discountedUnit={discountedUnit} lang={lang} variantMaxQty={variantMaxQty} />;
            })()}

            {/* Compact info row: stock + size guide + delivery.
                The generic "In stock" badge stays for products/variants
                without a specific warning, but steps aside when Task 3.17's
                per-variant pill (low-stock / out-of-stock) has something
                more urgent to say — we don't want both pills fighting for
                the user's attention right above the CTA.

                Hunt 133 — product-level urgency pills sit next to the
                "In stock" badge. When SanMar reports total < 10 we nudge
                with an amber "Plus que N en stock" / "Only N left"; when
                totalAvailable === 0 we flip red "Rupture de stock". Only
                rendered once SanMar has loaded (stockLoading === false)
                AND returned a non-empty Maps payload, so a missing edge
                function degrades to silence instead of "0 left" noise. */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              {!stockLoading && stock.totalAvailable > 0 && stock.totalAvailable < 10 && !isVariantLowStock && !isVariantSoldOut && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-700 font-bold"
                  role="status"
                >
                  <AlertTriangle size={11} aria-hidden="true" />
                  {lang === 'en'
                    ? `Only ${stock.totalAvailable} left`
                    : `Plus que ${stock.totalAvailable} en stock`}
                </span>
              )}
              {!stockLoading && stock.byColorSize && stock.byColorSize.size > 0 && stock.totalAvailable === 0 && !isVariantSoldOut && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 border border-red-200 text-red-700 font-bold"
                  role="status"
                >
                  <PackageX size={11} aria-hidden="true" />
                  {lang === 'en' ? 'Out of stock' : 'Rupture de stock'}
                </span>
              )}
              {!stockLoading && stock.totalAvailable >= 10 && !isVariantLowStock && !isVariantSoldOut && (
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
                            // Task 3.2 — show unavailable colours as struck-through/
                            // disabled rather than hiding them. Users were asking
                            // "did I imagine that they had Navy earlier?" — keeping
                            // the swatch visible answers that. pointer-events-none
                            // makes the state unambiguous (no silent no-op click +
                            // toast), and the title surfaces the reason on hover.
                            const soldOutTitle = lang === 'en' ? 'Out of stock' : 'Pas en stock';
                            // Task 3.6 — surface the hex in the tooltip + aria-label
                            // next to the human-readable name. Before this, a
                            // colour-blind or uncertain shopper hovering "Bleu
                            // marine" had to guess whether that meant royal or
                            // navy; the hex gives a deterministic second signal.
                            // `hex` is already normalised to #RRGGBB via the
                            // local-catalog/colorNameToHex chain a few lines up
                            // so we can splice it straight into the title.
                            // Screen-reader output reads "Bleu marine, code
                            // couleur #1B3A6B" because aria-label sits on the
                            // button and the SR announces it before `title`.
                            const hexTooltip = hex ? `${value} (${hex.toUpperCase()})` : value;
                            const hexAriaLabel = hex
                              ? (lang === 'en'
                                  ? `${value}, color code ${hex.toUpperCase()}`
                                  : `${value}, code couleur ${hex.toUpperCase()}`)
                              : value;
                            return (
                              <button
                                key={value}
                                type="button"
                                role="radio"
                                aria-checked={isSelected}
                                aria-disabled={!isAvailable || undefined}
                                disabled={!isAvailable}
                                onClick={() => {
                                  if (!isAvailable) return;
                                  // Task 3.19 — this tap is the user's
                                  // pick, so freeze hydration and start
                                  // persisting via the effect below.
                                  userInteractedRef.current = true;
                                  setSelectedOptions(prev => ({ ...prev, [option.name]: shopifyValueForMatch }));
                                }}
                                className={`relative w-11 h-11 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                                  isSelected
                                    ? 'ring-2 ring-primary ring-offset-2 scale-110'
                                    : 'ring-1 ring-border hover:ring-primary/50'
                                } ${!isAvailable ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
                                style={{ background: hex }}
                                aria-label={isAvailable ? hexAriaLabel : `${hexAriaLabel} — ${soldOutTitle}`}
                                title={isAvailable ? hexTooltip : `${hexTooltip} — ${soldOutTitle}`}
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
                          // Task 3.2 — unavailable sizes stay visible (line-through
                          // + dimmed + pointer-events-none). Hiding them used to
                          // cause "I swear M was there 10 minutes ago" confusion.
                          const soldOutTitle = lang === 'en' ? 'Out of stock' : 'Pas en stock';
                          return (
                            <button
                              key={value}
                              type="button"
                              role="radio"
                              aria-checked={isSel}
                              aria-disabled={!isAvailable || undefined}
                              disabled={!isAvailable}
                              onClick={() => {
                                if (!isAvailable) return;
                                // Task 3.19 — same interaction-gate as
                                // the colour swatch click: mark this
                                // as a user pick so the persist effect
                                // picks it up and hydration won't run.
                                userInteractedRef.current = true;
                                setSelectedOptions(prev => ({ ...prev, [option.name]: value }));
                              }}
                              title={isAvailable ? undefined : `${value} — ${soldOutTitle}`}
                              aria-label={isAvailable ? undefined : `${value} — ${soldOutTitle}`}
                              className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                                isSel
                                  ? 'gradient-navy-dark text-primary-foreground border-transparent shadow-sm'
                                  : 'bg-background text-foreground border-border hover:border-primary'
                              } ${!isAvailable ? 'line-through opacity-50 hover:border-border cursor-not-allowed pointer-events-none' : ''}`}
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

            {/* Task 3.2 — inline "this combo is sold out" notice.
                If a user had a variant selected and it later went
                out of stock (or they deliberately clicked through a
                struck-through combination), don't silently de-select
                for them — keep their pick visible and explain it
                here. Scoped to both color+size being picked + Shopify
                marking the variant unavailable. */}
            {shopifySoldOut && !!selectedColor && !!selectedSize && (
              <div
                role="status"
                aria-live="polite"
                className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium"
              >
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  {lang === 'en'
                    ? 'This combination is out of stock.'
                    : "Cette combinaison n'est pas en stock"}
                </span>
              </div>
            )}

            {/* Task 3.17 — low-stock / out-of-stock warning pill.
                Sits right above the CTA so the nudge lands exactly where
                the purchase decision is made. role=status + aria-live
                polite so screen readers announce "Only 3 left in Navy XL"
                when the user changes color/size without stealing focus.
                Never rendered when SanMar hasn't loaded or the user hasn't
                picked both color+size — we never show stale numbers. */}
            <div role="status" aria-live="polite" aria-atomic="true">
              {isVariantSoldOut && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-600 text-xs font-bold">
                  <PackageX size={13} aria-hidden="true" />
                  {lang === 'en' ? 'Out of stock' : 'Rupture de stock'}
                </span>
              )}
              {isVariantLowStock && typeof sanmarVariantQty === 'number' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-600 text-xs font-bold">
                  <AlertTriangle size={13} aria-hidden="true" />
                  {lang === 'en'
                    ? `Only ${sanmarVariantQty} left in ${selectedColor} ${selectedSize}`
                    : `Il ne reste que ${sanmarVariantQty} en ${selectedColor} ${selectedSize}`}
                </span>
              )}
              {isVariantInStock && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                  <CheckCircle size={13} aria-hidden="true" />
                  {lang === 'en' ? 'In stock · Ships fast' : 'En stock · Livraison rapide'}
                </span>
              )}
            </div>

            {/* CTA */}
            <button
              ref={inlineCtaRef}
              type="button"
              className="w-full py-4 gradient-navy-dark text-primary-foreground border-none rounded-xl text-[15px] font-extrabold cursor-pointer transition-all hover:opacity-90 hover:-translate-y-px flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:opacity-50 disabled:hover:translate-y-0"
              style={{ boxShadow: '0 8px 24px hsla(var(--navy), 0.35)' }}
              onClick={() => setCustomizerOpen(true)}
              disabled={isVariantSoldOut}
              aria-disabled={isVariantSoldOut || undefined}
            >
              <Shirt size={18} aria-hidden="true" />
              {isVariantSoldOut
                ? (lang === 'en' ? 'Out of stock' : 'Rupture de stock')
                : (lang === 'en' ? 'Customize this product' : 'Personnaliser ce produit')}
              <ChevronRight size={16} className="ml-auto opacity-60" aria-hidden="true" />
            </button>

            {/* Social-proof viewer nudge. Sits directly under the CTA
                on purpose — it reads as "you're not alone looking at
                this" right when the purchase commitment is happening.
                Hidden when the variant is sold out so we never pair a
                greyed button with a "3 people viewing" line (which
                would feel like a taunt rather than a nudge). */}
            <ProductViewersNudge
              handle={handle}
              inStock={!isVariantSoldOut}
              className="-mt-1"
            />

            {/* Task 3.12 — FSA postal-code → ETA calculator.
                Small subtle field tucked right below the primary CTA.
                The buyer types an FSA (e.g. "H2X" or "J2S") and we
                resolve to a concrete arrival date using business-day
                skip logic matching Checkout.tsx (from Task 5.13). First
                letter of the FSA is the geographic prefix:
                  H/J/G → Québec (4 business days, local couriers)
                  A/B/C/E/K/L/M/N/P/R/S/T/V/X/Y → rest of Canada (6 days)
                  anything else (US ZIP, UK, random text) → friendly
                  "Contactez-nous pour l'international" fallback so we
                  don't silently show a wrong date.
                We uppercase + strip non-alphanumerics client-side so
                pasted "h2x 1a1" still registers. Only the first 3 chars
                matter; the rest of the postal is ignored locally — full
                postal gets captured at the Checkout shipping step. */}
            {(() => {
              const normalized = shipFsa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
              const isFsa = /^[A-Z][0-9][A-Z]$/.test(normalized);
              const firstLetter = normalized[0];
              const isQuebec = isFsa && (firstLetter === 'H' || firstLetter === 'J' || firstLetter === 'G');
              const businessDays = isQuebec ? 4 : isFsa ? 6 : null;
              const addBizDays = (from: Date, n: number) => {
                const out = new Date(from);
                let remaining = n;
                while (remaining > 0) {
                  out.setDate(out.getDate() + 1);
                  const dow = out.getDay();
                  if (dow !== 0 && dow !== 6) remaining--;
                }
                return out;
              };
              const hasInput = normalized.length > 0;
              let resultText: string | null = null;
              if (businessDays !== null) {
                const eta = addBizDays(new Date(), businessDays);
                const formatter = new Intl.DateTimeFormat(
                  lang === 'en' ? 'en-CA' : 'fr-CA',
                  { weekday: 'long', day: 'numeric', month: 'long' },
                );
                resultText = lang === 'en'
                  ? `Arrives by ${formatter.format(eta)}`
                  : `Reçu vers le ${formatter.format(eta)}`;
              } else if (hasInput && normalized.length >= 3) {
                // Non-FSA input (US ZIP digits, random letters, UK outward
                // code) — treat as international and point them to sales.
                resultText = lang === 'en'
                  ? 'Contact us for international shipping'
                  : "Contactez-nous pour l'international";
              }
              return (
                <div className="flex flex-col gap-1.5 -mt-1">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Truck size={13} aria-hidden="true" className="flex-shrink-0" />
                    <span className="font-bold text-foreground">
                      {lang === 'en' ? 'Ship to?' : 'Livraison vers ?'}
                    </span>
                    <input
                      type="text"
                      inputMode="text"
                      autoComplete="postal-code"
                      maxLength={3}
                      placeholder={lang === 'en' ? 'e.g. H2X' : 'ex. J2S'}
                      aria-label={lang === 'en' ? 'Your postal code FSA (first 3 characters)' : 'Votre code postal FSA (3 premiers caractères)'}
                      value={shipFsa}
                      onChange={(e) => {
                        const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
                        setShipFsa(raw);
                      }}
                      className="w-20 px-2 py-1 text-xs font-bold tabular-nums uppercase tracking-wider border border-border rounded-md bg-background text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 placeholder:font-normal placeholder:text-muted-foreground/70 placeholder:normal-case placeholder:tracking-normal"
                    />
                  </label>
                  {resultText && (
                    <p
                      className="text-xs text-muted-foreground pl-[22px] leading-snug"
                      role="status"
                      aria-live="polite"
                    >
                      {resultText}
                    </p>
                  )}
                </div>
              );
            })()}

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
                  {/* Scroll-reveal: Description / tagline block. Fades
                      + translates in as the user scrolls it into view.
                      Skipped entirely under prefers-reduced-motion
                      (see useRevealOnScroll). */}
                  <RevealBlock className="pt-3 border-t border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold text-[#0052CC] uppercase tracking-wider">
                        {categoryLabel(localProduct.category, lang)}
                      </span>
                      <DeliveryBadge size="sm" variant="inline" />
                    </div>
                    <p className="text-base font-bold text-foreground leading-snug mb-3">
                      {desc.tagline}
                    </p>
                    {/* Task 3.14 — On mobile the multi-paragraph fabric/care
                        copy was pushing the Add-to-cart button well below
                        the fold. We collapse it to a teaser on <md and
                        keep the full body visible on desktop. The teaser
                        is a truncated first paragraph (~150 chars);
                        tapping the gold link toggles to the full copy
                        with a max-height transition that respects
                        prefers-reduced-motion. */}
                    <CollapsibleDescription
                      paragraphs={desc.paragraphs}
                      lang={lang}
                    />
                  </RevealBlock>

                  {/* Scroll-reveal: Specs / Caractéristiques block. */}
                  <RevealBlock className="pt-3 border-t border-border">
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
                  </RevealBlock>

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

        {/* Task 3.5 — "Produits similaires" horizontal scroller. Hidden
            when fewer than 2 matches so a lone hoodie doesn't render a
            one-card section that reads as a dead end. Horizontal
            snap-scroll on mobile turns it into a finger-flick
            discovery strip; desktop collapses to a clean 4-col grid
            matching the catalog aesthetic. scroll-mt-20 keeps the
            heading clear of the sticky Navbar on in-page anchor nav. */}
        {/* Scroll-reveal also applies to "Produits similaires". We
            keep the semantic <section> tag via RevealBlock's `as`
            prop so the aria-labelledby relationship stays intact. */}
        {similarProducts.length >= 2 && (
          <RevealBlock
            as="section"
            aria-labelledby="similar-products-heading"
            className="scroll-mt-20 mt-16 pt-10 border-t border-border"
          >
            <h2
              id="similar-products-heading"
              className="scroll-mt-20 text-[clamp(22px,3vw,30px)] font-extrabold tracking-[-0.5px] text-foreground mb-6"
            >
              {lang === 'en' ? 'Similar products' : 'Produits similaires'}
            </h2>
            {/* Mobile: horizontal scroller with snap. Each card gets a
                fixed basis so the row stays predictable and iOS doesn't
                compress the last card when it runs out of viewport.
                Desktop: snap/flex melts away into a 4-col grid. */}
            <div
              className="flex md:grid md:grid-cols-4 gap-4 overflow-x-auto md:overflow-visible snap-x snap-mandatory -mx-4 md:mx-0 px-4 md:px-0 pb-2 md:pb-0 [scrollbar-width:thin]"
            >
              {similarProducts.map((p, i) => {
                const key = p?.node?.id ?? p?.node?.handle ?? `sim-${i}`;
                try {
                  return (
                    <div
                      key={key}
                      className="shrink-0 basis-[70%] sm:basis-[45%] md:basis-auto snap-start"
                    >
                      <ProductCard product={p} />
                    </div>
                  );
                } catch (err) {
                  console.warn('[ProductDetail] similar ProductCard threw, skipping', key, err);
                  return null;
                }
              })}
            </div>
          </RevealBlock>
        )}
      </div>

      {/* Hunt 133 — mobile sticky Personnaliser CTA.
          On narrow viewports the inline "Personnaliser ce produit"
          button scrolls out of view as soon as the user starts reading
          the description / features / similar products. Pinning a
          mirror of that CTA to the bottom of the viewport keeps the
          purchase path one tap away at all times. Desktop (>=md) is
          unaffected — the inline CTA is already within reach on a
          wide layout. Bottom offset of 60px clears the BottomNav so
          we don't cover its icons; the fade-in gate driven by the
          IntersectionObserver above makes sure the pinned button
          only appears once the inline CTA is off-screen. Safe-area
          inset keeps it clear of iOS home-indicator territory. */}
      {!inlineCtaInView && !customizerOpen && (
        <div
          className="md:hidden fixed left-0 right-0 bottom-[60px] bg-white/95 backdrop-blur border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.08)] p-3 z-30"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <button
            type="button"
            onClick={() => setCustomizerOpen(true)}
            disabled={isVariantSoldOut}
            aria-disabled={isVariantSoldOut || undefined}
            aria-label={isVariantSoldOut
              ? (lang === 'en' ? 'Out of stock' : 'Rupture de stock')
              : (lang === 'en' ? 'Customize this product' : 'Personnaliser ce produit')}
            className="w-full py-3.5 gradient-navy-dark text-primary-foreground border-none rounded-xl text-[15px] font-extrabold cursor-pointer flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ boxShadow: '0 8px 24px hsla(var(--navy), 0.35)' }}
          >
            <Shirt size={18} aria-hidden="true" />
            {isVariantSoldOut
              ? (lang === 'en' ? 'Out of stock' : 'Rupture de stock')
              : (lang === 'en' ? 'Customize' : 'Personnaliser')}
            <ChevronRight size={16} className="ml-auto opacity-60" aria-hidden="true" />
          </button>
        </div>
      )}

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

/**
 * Task 3.14 — mobile-only collapsible description.
 *
 * Renders the full paragraph list on desktop (>=md) and a ~150-char
 * teaser with a "Voir plus / Voir moins" gold link on mobile. The
 * expanded state uses a `max-height` transition with a generous
 * fallback ceiling so variable copy lengths still animate cleanly;
 * `motion-reduce` callers get the state change without the animation.
 *
 * We keep this colocated with ProductDetail since it's a one-off and
 * lifting it to /components would need props typing + tests just to
 * own a single toggle.
 */
function CollapsibleDescription({
  paragraphs,
  lang,
}: {
  paragraphs: string[];
  lang: 'fr' | 'en';
}) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const joined = paragraphs.join(' ');
  const TEASER_LEN = 150;
  const needsToggle = joined.length > TEASER_LEN;
  // Trim at a word boundary so we don't cut mid-word and produce
  // "the fabric is comf…" — hunt backwards from the raw slice.
  const teaser = (() => {
    if (!needsToggle) return joined;
    const raw = joined.slice(0, TEASER_LEN);
    const lastSpace = raw.lastIndexOf(' ');
    return (lastSpace > 80 ? raw.slice(0, lastSpace) : raw).trimEnd() + '…';
  })();

  const moreLabel = lang === 'en' ? 'Show more' : 'Voir plus';
  const lessLabel = lang === 'en' ? 'Show less' : 'Voir moins';

  return (
    <>
      {/* Desktop: always render the full body, no collapse UI. Hidden
          on mobile so we don't ship both copies to the DOM twice. */}
      <div className="hidden md:block">
        {paragraphs.map((p, i) => (
          <p key={i} className="text-muted-foreground text-sm leading-relaxed mb-2">
            {p}
          </p>
        ))}
      </div>

      {/* Mobile: teaser + collapsible full body. We keep the full text
          in the DOM (not conditionally rendered) so the max-height
          transition has something to animate into. */}
      <div className="md:hidden">
        {!expanded && needsToggle && (
          <p className="text-muted-foreground text-sm leading-relaxed mb-2">
            {teaser}
          </p>
        )}
        <div
          id={contentId}
          aria-hidden={!expanded && needsToggle ? 'true' : undefined}
          className={
            'overflow-hidden transition-[max-height] duration-300 ease-out motion-reduce:transition-none ' +
            (expanded || !needsToggle ? 'max-h-[2000px]' : 'max-h-0')
          }
        >
          {paragraphs.map((p, i) => (
            <p key={i} className="text-muted-foreground text-sm leading-relaxed mb-2">
              {p}
            </p>
          ))}
        </div>
        {needsToggle && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls={contentId}
            className="mt-1 text-sm font-semibold text-gold hover:text-gold-light underline underline-offset-4 decoration-gold/40 hover:decoration-gold transition-colors"
          >
            {expanded ? lessLabel : moreLabel}
          </button>
        )}
      </div>
    </>
  );
}

type GalleryShot = { url: string; alt: string; labelEn: string; labelFr: string };

function ProductGallery({ shots, lang }: { shots: GalleryShot[]; lang: 'fr' | 'en' }) {
  const [active, setActive] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
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
      <button
        id={mainId}
        type="button"
        onClick={() => setZoomOpen(true)}
        aria-label={lang === 'en' ? 'Zoom image' : "Agrandir l'image"}
        aria-haspopup="dialog"
        className="aspect-square overflow-hidden rounded-2xl bg-secondary border border-border relative w-full block cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
      </button>
      {zoomOpen && (
        <PhotoZoomOverlay
          shots={shots}
          startIndex={active}
          lang={lang}
          onClose={(finalIndex) => {
            setZoomOpen(false);
            if (typeof finalIndex === 'number') setActive(finalIndex);
          }}
        />
      )}

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

// Fullscreen zoom overlay: black backdrop, close X + Escape + backdrop-
// click dismiss, focus trap (useFocusTrap), body scroll lock, arrow-key
// cycling through siblings when multiple images exist, and
// touch-action: pinch-zoom so mobile users can pinch the photo without
// any custom zoom math. Kept intentionally small — this is a photo
// viewer, not a gallery rewrite.
function PhotoZoomOverlay({
  shots,
  startIndex,
  lang,
  onClose,
}: {
  shots: GalleryShot[];
  startIndex: number;
  lang: 'fr' | 'en';
  onClose: (finalIndex?: number) => void;
}) {
  const [index, setIndex] = useState(() => {
    if (!shots.length) return 0;
    const clamped = ((startIndex % shots.length) + shots.length) % shots.length;
    return clamped;
  });
  const trapRef = useFocusTrap<HTMLDivElement>(true);
  useBodyScrollLock(true);

  const hasMultiple = shots.length > 1;
  const current = shots[Math.min(index, shots.length - 1)] ?? shots[0];

  const step = (delta: number) => {
    if (!shots.length) return;
    const next = ((index + delta) % shots.length + shots.length) % shots.length;
    setIndex(next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose(index);
      } else if (e.key === 'ArrowRight' && hasMultiple) {
        e.preventDefault();
        step(1);
      } else if (e.key === 'ArrowLeft' && hasMultiple) {
        e.preventDefault();
        step(-1);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, hasMultiple]);

  if (!current) return null;

  const closeLabel = lang === 'en' ? 'Close' : 'Fermer';
  const prevLabel = lang === 'en' ? 'Previous image' : 'Image précédente';
  const nextLabel = lang === 'en' ? 'Next image' : 'Image suivante';

  return (
    <div
      ref={trapRef}
      role="dialog"
      aria-modal="true"
      aria-label={lang === 'en' ? 'Zoomed product image' : 'Image produit agrandie'}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
      // Click the backdrop (i.e. the dialog root itself, not a child) to
      // dismiss. Guarding on e.target === e.currentTarget prevents a
      // click on the image or a button from bubbling up and closing
      // the overlay unexpectedly.
      onClick={(e) => { if (e.target === e.currentTarget) onClose(index); }}
    >
      <button
        type="button"
        aria-label={closeLabel}
        onClick={() => onClose(index)}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors"
      >
        <X className="w-6 h-6" aria-hidden="true" />
      </button>

      {hasMultiple && (
        <button
          type="button"
          aria-label={prevLabel}
          onClick={() => step(-1)}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors hidden sm:inline-flex"
        >
          <ChevronRight className="w-6 h-6 rotate-180" aria-hidden="true" />
        </button>
      )}

      <img
        src={current.url}
        alt={current.alt}
        className="max-w-[95vw] max-h-[85vh] object-contain select-none"
        style={{ touchAction: 'pinch-zoom' }}
        draggable={false}
        key={`zoom-${current.url}`}
      />

      {hasMultiple && (
        <button
          type="button"
          aria-label={nextLabel}
          onClick={() => step(1)}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors hidden sm:inline-flex"
        >
          <ChevronRight className="w-6 h-6" aria-hidden="true" />
        </button>
      )}

      {hasMultiple && (
        <div
          role="tablist"
          aria-label={lang === 'en' ? 'Product image thumbnails' : 'Vignettes du produit'}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 px-3 py-2 rounded-full bg-black/40 backdrop-blur-sm max-w-[90vw] overflow-x-auto"
        >
          {shots.map((shot, i) => {
            const isActive = i === index;
            return (
              <button
                key={`zt-${shot.url}-${i}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setIndex(i)}
                aria-label={lang === 'en' ? shot.labelEn : shot.labelFr}
                title={lang === 'en' ? shot.labelEn : shot.labelFr}
                className={`relative flex-shrink-0 w-12 h-12 rounded-md overflow-hidden border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                  isActive ? 'border-white' : 'border-white/30 hover:border-white/70 opacity-70 hover:opacity-100'
                }`}
              >
                <img
                  src={shot.url}
                  alt=""
                  aria-hidden="true"
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

function BulkCalculator({ basePrice, unitWithPrint, discountedUnit, lang, variantMaxQty }: { basePrice: number; unitWithPrint: number; discountedUnit: number; lang: 'fr' | 'en'; variantMaxQty?: number }) {
  const [qty, setQty] = useState(12);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const breakdownId = useId();
  const breakdownRef = useRef<HTMLDivElement | null>(null);
  const breakdownBtnRef = useRef<HTMLButtonElement | null>(null);

  // Close the breakdown popover on Escape and on outside click — keeps
  // keyboard and touch users able to dismiss it without hunting for the
  // trigger icon again. Hover open/close is handled by onMouseEnter /
  // onMouseLeave on the wrapper; click toggles for touch devices where
  // hover events never fire.
  useEffect(() => {
    if (!breakdownOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setBreakdownOpen(false);
        breakdownBtnRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        breakdownRef.current && !breakdownRef.current.contains(target) &&
        breakdownBtnRef.current && !breakdownBtnRef.current.contains(target)
      ) {
        setBreakdownOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [breakdownOpen]);

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

  // Line-item breakdown surfaced in the tooltip. The PDP calculator
  // assumes a single print placement (the fuller multi-placement math
  // lives inside the customizer); we still expose the 'placements' row
  // so buyers see the fee isn't free and recognize it'll scale if they
  // add more sides in the customizer.
  const placementCount = 1;
  const printFeePerUnit = PRINT_PRICE * placementCount;
  const subtotalBeforeDiscount = unitWithPrint * qty;
  const discountPct = Math.round(BULK_DISCOUNT_RATE * 100);
  const discountAmount = isBulk ? subtotalBeforeDiscount - total : 0;
  const effectivePerUnit = qty > 0 ? total / qty : unit;

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
          <div className="flex items-center justify-end gap-1.5">
            <div
              className="relative"
              onMouseEnter={() => setBreakdownOpen(true)}
              onMouseLeave={() => setBreakdownOpen(false)}
            >
              <button
                ref={breakdownBtnRef}
                type="button"
                onClick={() => setBreakdownOpen(v => !v)}
                onFocus={() => setBreakdownOpen(true)}
                onBlur={e => {
                  // Only close on blur when focus leaves the wrapper entirely —
                  // otherwise tabbing into the popover itself would slam it shut.
                  const next = e.relatedTarget as Node | null;
                  if (!next || !breakdownRef.current?.contains(next)) {
                    setBreakdownOpen(false);
                  }
                }}
                aria-label={lang === 'en' ? 'Show price breakdown' : 'Afficher le détail du prix'}
                aria-describedby={breakdownId}
                aria-expanded={breakdownOpen}
                className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
              >
                <HelpCircle size={14} aria-hidden="true" />
              </button>
              {breakdownOpen && (
                <div
                  ref={breakdownRef}
                  id={breakdownId}
                  role="tooltip"
                  tabIndex={-1}
                  className="absolute right-0 top-full mt-2 z-50 w-72 max-w-[calc(100vw-2rem)] rounded-xl bg-[#0B1E3F] text-white shadow-2xl ring-1 ring-white/10 p-4 text-left"
                >
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#C9A34E] mb-2">
                    {lang === 'en' ? 'Price breakdown' : 'Détail du prix'}
                  </div>
                  <dl className="text-xs space-y-1.5">
                    <div className="flex justify-between gap-4">
                      <dt className="text-white/70">
                        {lang === 'en' ? 'Base unit price' : 'Prix unitaire de base'}
                      </dt>
                      <dd className="font-semibold tabular-nums">{fmtMoney(basePrice, lang)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-white/70">
                        {lang === 'en'
                          ? `Print fee (${fmtMoney(PRINT_PRICE, lang)} × ${placementCount} side)`
                          : `Impression (${fmtMoney(PRINT_PRICE, lang)} × ${placementCount} côté)`}
                      </dt>
                      <dd className="font-semibold tabular-nums">{fmtMoney(printFeePerUnit, lang)}</dd>
                    </div>
                    <div className="flex justify-between gap-4 pt-1.5 border-t border-white/15">
                      <dt className="text-white/70">
                        {lang === 'en' ? `Subtotal (${qty} × unit)` : `Sous-total (${qty} × unité)`}
                      </dt>
                      <dd className="font-semibold tabular-nums">{fmtMoney(subtotalBeforeDiscount, lang)}</dd>
                    </div>
                    {isBulk ? (
                      <div className="flex justify-between gap-4 text-[#C9A34E]">
                        <dt className="font-semibold">
                          {lang === 'en'
                            ? `Bulk discount (−${discountPct}%)`
                            : `Rabais volume (−${discountPct} %)`}
                        </dt>
                        <dd className="font-extrabold tabular-nums">−{fmtMoney(discountAmount, lang)}</dd>
                      </div>
                    ) : (
                      <div className="flex justify-between gap-4 text-white/50 italic">
                        <dt>
                          {lang === 'en'
                            ? `Bulk discount at ${BULK_DISCOUNT_THRESHOLD}+`
                            : `Rabais volume dès ${BULK_DISCOUNT_THRESHOLD}+`}
                        </dt>
                        <dd className="tabular-nums">—</dd>
                      </div>
                    )}
                    <div className="flex justify-between gap-4 pt-1.5 border-t border-white/15">
                      <dt className="font-bold">
                        {lang === 'en' ? 'Total' : 'Total'}
                      </dt>
                      <dd className="font-extrabold tabular-nums">{fmtMoney(total, lang)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-white/70">
                        {lang === 'en' ? 'Effective per unit' : 'Coût réel par unité'}
                      </dt>
                      <dd className="font-semibold tabular-nums">{fmtMoney(effectivePerUnit, lang)}</dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>
            <div className="text-2xl font-extrabold text-foreground">{fmt(total)} $</div>
          </div>
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

