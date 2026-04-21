import { useNavigate } from 'react-router-dom';
import { lazy, Suspense, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Heart } from 'lucide-react';
import { ShopifyProduct } from '@/lib/shopify';
import { useWishlist } from '@/hooks/useWishlist';
// Customizer pulls in fabric.js (~310kB) and its own siblings — lazy-
// load so just rendering the grid doesn't eagerly fetch it. The
// customizer only opens when the user clicks the inline 'Personnaliser'.
const ProductCustomizer = lazy(() => import('@/components/customizer/ProductCustomizer').then(m => ({ default: m.ProductCustomizer })));
import { findProductByHandle, matchProductByTitle, PRINT_PRICE, BULK_DISCOUNT_RATE, BULK_DISCOUNT_THRESHOLD, POPULAR_SKUS } from '@/data/products';
import { useLang } from '@/lib/langContext';
import { categoryLabel } from '@/lib/productLabels';
import { filterRealColors } from '@/lib/colorFilter';
import { fmtMoney } from '@/lib/format';

interface ProductCardProps {
  product: ShopifyProduct;
  /** Set true for the handful of above-the-fold cards so their image
   *  competes for LCP instead of being lazy-loaded. */
  eager?: boolean;
}

export function ProductCard({ product, eager = false }: ProductCardProps) {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [customizerOpen, setCustomizerOpen] = useState(false);

  // Defensive: a malformed Shopify payload (new product without full
  // data, or a partial response) can hand us `product` without a
  // `node`. Bail out with null rather than crash the whole grid.
  if (!product || !product.node) {
    console.warn('[ProductCard] missing product.node, rendering null', product);
    return null;
  }
  const { node } = product;

  // Every nested access below is wrapped in optional-chaining +
  // defaults. Shopify Storefront can legally omit `images.edges` or
  // `variants.edges` for a brand-new product that hasn't been fully
  // populated yet, and a NEW product without a local data/products.ts
  // mapping used to crash this component outright.
  const imageEdges = Array.isArray(node.images?.edges) ? node.images.edges : [];
  const shopifyImage = imageEdges[0]?.node;
  const shopifyBackImage = imageEdges[1]?.node;

  const variantEdges = Array.isArray(node.variants?.edges) ? node.variants.edges : [];
  const firstVariant = variantEdges[0]?.node;

  // `price` is consumed below as `parseFloat(price.amount)`. A partial
  // response can omit priceRange entirely — fall through to the
  // first variant's price, then to "0.00" so the template never
  // sees undefined.
  const price = node.priceRange?.minVariantPrice
    ?? firstVariant?.price
    ?? { amount: '0', currencyCode: 'CAD' };

  const handle = node.handle ?? '';
  const title = node.title ?? (lang === 'en' ? 'Product' : 'Produit');

  const local = (handle && findProductByHandle(handle))
    || (title && matchProductByTitle(title))
    || null;
  const isPopular = local ? POPULAR_SKUS.has(local.sku) : false;

  // Use clean Drive images when available, fall back to Shopify CDN
  const image = local
    ? { url: local.imageDevant, altText: local.shortName }
    : shopifyImage;
  const backImage = local
    ? { url: local.imageDos, altText: `${local.shortName} dos` }
    : shopifyBackImage;

  const { toggle: toggleWishlist, has: isWishlisted } = useWishlist();
  const saved = isWishlisted(handle);
  const handleWishlistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (handle) toggleWishlist(handle);
  };

  const handleCardClick = () => { if (handle) navigate(`/product/${handle}`); };
  const handleCustomize = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (local) setCustomizerOpen(true);
    else if (handle) navigate(`/product/${handle}`);
  };

  const onCardKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Screen readers announce this as a link, keyboard users expect
    // Enter/Space to activate. Ignore when a child button has focus
    // (e.g. Customize) so its own handler runs instead.
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if ((e.target as HTMLElement).tagName === 'BUTTON') return;
    e.preventDefault();
    if (handle) navigate(`/product/${handle}`);
  };

  return (
    <>
      <div
        onClick={handleCardClick}
        onKeyDown={onCardKey}
        role="link"
        tabIndex={0}
        /* Title + SKU when we have a local match, else just the Shopify
           title — joining with " — " when SKU is absent leaves a stray
           trailing em-dash ('T-shirt — ') that screen readers read out
           loud. */
        aria-label={local ? `${categoryLabel(local.category, lang)} — ${local.sku}` : title}
        className="group border border-border rounded-[18px] overflow-hidden bg-card cursor-pointer transition-all duration-300 hover:border-primary/30 hover:shadow-[0_16px_40px_rgba(27,58,107,0.14)] hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        {/* Image */}
        <div className="relative overflow-hidden bg-secondary" style={{ aspectRatio: '1' }}>
          {image ? (
            <>
              <img
                src={image.url}
                alt={image.altText || title}
                width={400}
                height={400}
                className={`w-full h-full object-cover transition-all duration-500 ${backImage ? 'group-hover:opacity-0' : 'group-hover:scale-105'}`}
                loading={eager ? 'eager' : 'lazy'}
                fetchPriority={eager ? 'high' : 'auto'}
                decoding="async"
                // Hide on load failure so the secondary-coloured
                // aspect-ratio container shows through instead of the
                // native broken-image glyph (tiny ⊘ icon in a gray box).
                // A 404 on a Shopify CDN image or a yanked per-color
                // Drive file used to render as that glyph across the
                // whole grid — reads as "the site is broken".
                onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
              />
              {backImage && (
                <img
                  src={backImage.url}
                  alt={lang === 'en'
                    ? `${local?.shortName ?? title} — back view`
                    : `${local?.shortName ?? title} — vue arrière`}
                  width={400}
                  height={400}
                  className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500 scale-105"
                  loading="lazy"
                  decoding="async"
                  onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                />
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">{lang === 'en' ? 'No image' : "Pas d'image"}</div>
          )}

          {/* Popular badge */}
          {isPopular && (
            <div className="absolute top-2.5 left-2.5 z-[5] text-[10px] font-extrabold text-primary-foreground gradient-navy-dark px-2.5 py-[3px] rounded-full shadow-sm">
              {lang === 'en' ? '⭐ Popular' : '⭐ Populaire'}
            </div>
          )}

          {/* Wishlist heart — lets users save from the grid without
              opening the PDP. stopPropagation so the card's link
              handler doesn't also fire. */}
          <button
            type="button"
            onClick={handleWishlistClick}
            aria-label={saved
              ? (lang === 'en' ? `Remove ${title} from wishlist` : `Retirer ${title} des favoris`)
              : (lang === 'en' ? `Save ${title} to wishlist` : `Ajouter ${title} aux favoris`)}
            aria-pressed={saved}
            className={`absolute top-2.5 right-2.5 z-[5] w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm border flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838] focus-visible:ring-offset-1 ${
              saved
                ? 'border-[#E8A838] text-[#B37D10]'
                : 'border-white/70 text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            <Heart size={15} fill={saved ? '#E8A838' : 'none'} strokeWidth={2} aria-hidden="true" />
          </button>

          {/* Customize CTA — visible on mobile, fade-in on desktop hover */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/40 via-foreground/10 to-transparent opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-3 pt-12 z-[3]">
            <button
              type="button"
              onClick={handleCustomize}
              aria-label={`${t('personnaliserProduit')} — ${local?.shortName ?? title}`}
              className="text-[11px] font-extrabold px-4 py-2 rounded-full bg-white text-primary shadow-lg border border-primary/15 transition-transform duration-300 md:translate-y-3 md:group-hover:translate-y-0 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-95"
            >
              {t('personnaliserProduit')} →
            </button>
          </div>

          {/* Colour dots — only colors with real per-color images */}
          {local && (() => {
            const realColors = filterRealColors(local.sku, local.colors);
            if (realColors.length === 0) return null;
            return (
              <div className="absolute bottom-2 left-2 flex gap-1 z-[4]">
                {realColors.slice(0, 8).map(c => (
                  <div key={c.id} className="w-3.5 h-3.5 rounded-full ring-1 ring-white/70 shadow-sm flex-shrink-0" style={{ background: c.hex }} title={c.name} />
                ))}
                {realColors.length > 8 && (
                  <div className="w-3.5 h-3.5 rounded-full bg-white/85 ring-1 ring-white/50 flex items-center justify-center text-[7px] font-black text-foreground">
                    +{realColors.length - 8}
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Info */}
        <div className="p-3.5 pb-4">
          <p
            className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-[2px] mb-0.5"
            data-sku={local?.sku}
          >
            {local?.sku ?? node.productType ?? ''}
          </p>
          <div className="text-[14px] font-extrabold text-foreground leading-tight mb-1">
            {local ? categoryLabel(local.category, lang) : title}
          </div>

          {/* Pricing with quantity breaks */}
          {local ? (() => {
            const unit = local.basePrice + PRINT_PRICE;
            const bulk = unit * (1 - BULK_DISCOUNT_RATE);
            return (
              <div className="mt-2 space-y-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[14px] font-extrabold text-primary">{fmtMoney(unit, lang)}</span>
                  <span className="text-[10px] text-muted-foreground">/ {lang === 'en' ? 'unit' : 'unité'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-green-700">{fmtMoney(bulk, lang)}</span>
                  <span className="text-[9px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full font-bold">
                    {BULK_DISCOUNT_THRESHOLD}+ = -{Math.round(BULK_DISCOUNT_RATE * 100)}%
                  </span>
                </div>
              </div>
            );
          })() : (
            <div className="mt-2">
              <span className="text-[14px] font-extrabold text-primary">{(() => {
                // Defensive: price.amount can be missing/non-numeric on
                // a partial Shopify response. fmtMoney handles NaN /
                // nullish by returning '—' so we render something visible
                // instead of 'NaN $'.
                const raw = price?.amount;
                const n = raw != null ? parseFloat(raw) : NaN;
                return fmtMoney(n, lang);
              })()}</span>
            </div>
          )}

          <div className="mt-2.5">
            <span className="text-[10px] font-bold text-muted-foreground border border-border px-2 py-0.5 rounded-full group-hover:border-primary/50 group-hover:text-primary transition-colors">
              {lang === 'en' ? 'Customize' : 'Personnaliser'}
            </span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {customizerOpen && local && (
          <Suspense fallback={null}>
            <ProductCustomizer productId={local.id} onClose={() => setCustomizerOpen(false)} />
          </Suspense>
        )}
      </AnimatePresence>
    </>
  );
}

