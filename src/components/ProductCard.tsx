import { useNavigate } from 'react-router-dom';
import { lazy, Suspense, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Heart } from 'lucide-react';
import { ShopifyProduct } from '@/lib/shopify';
import { useWishlist } from '@/hooks/useWishlist';
import { Highlight } from '@/components/Highlight';
import { CompareToggleButton } from '@/components/CompareToggleButton';
// Customizer pulls in fabric.js (~310kB) and its own siblings — lazy-
// load so just rendering the grid doesn't eagerly fetch it. The
// customizer only opens when the user clicks the inline 'Personnaliser'.
const ProductCustomizer = lazy(() => import('@/components/customizer/ProductCustomizer').then(m => ({ default: m.ProductCustomizer })));
import { findProductByHandle, matchProductByTitle, PRINT_PRICE, BULK_DISCOUNT_RATE, BULK_DISCOUNT_THRESHOLD, POPULAR_SKUS } from '@/data/products';
import { useLang } from '@/lib/langContext';
import { categoryLabel } from '@/lib/productLabels';
import { filterRealColors } from '@/lib/colorFilter';
import { fmtMoney } from '@/lib/format';
import { plural } from '@/lib/plural';
import { trackEvent } from '@/lib/analytics';

interface ProductCardProps {
  product: ShopifyProduct;
  /** Set true for the handful of above-the-fold cards so their image
   *  competes for LCP instead of being lazy-loaded. */
  eager?: boolean;
  /** Task 2.18 — when the card is rendered inside a search-results
   *  grid, pass the active (debounced) query. The title will wrap
   *  matching substrings in a gold <mark>. Optional so unrelated
   *  surfaces (RecentlyViewed, 404 popular strip, etc.) stay
   *  un-highlighted by default. */
  highlight?: string;
}

export function ProductCard({ product, eager = false, highlight }: ProductCardProps) {
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
    ? (local.imageDos ? { url: local.imageDos, altText: `${local.shortName} dos` } : null)
    : shopifyBackImage;

  const { toggle: toggleWishlist, has: isWishlisted } = useWishlist();
  const saved = isWishlisted(handle);
  // Key-based remount pattern: bumping `burstKey` swaps the absolute
  // overlay with a fresh DOM node, which restarts the CSS keyframe
  // animation. Only bumped on ADD (not remove) — removing is meant to
  // feel like the heart quietly clearing, not a second celebration.
  const [burstKey, setBurstKey] = useState(0);
  const handleWishlistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!handle) return;
    const wasAdding = !saved;
    toggleWishlist(handle);
    if (wasAdding) setBurstKey(k => k + 1);
  };

  const handleCardClick = () => {
    if (!handle) return;
    // GA4 select_product — consent-gated; dispatches the SKU + title
    // so the owner can see which grid cards turn into PDP visits.
    trackEvent('select_product', {
      product_handle: handle,
      product_name: local?.shortName ?? title,
      sku: local?.sku,
    });
    navigate(`/product/${handle}`);
  };
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
                // Subtle 1.03 zoom on both layers; back (if any) fades
                // in over the front. The `[@media(hover:hover)]:`
                // prefix gates the back-reveal to devices with a real
                // pointer — touch users tap to navigate and would
                // otherwise see a flash of the dos photo before the
                // route change fires.
                className={`w-full h-full object-cover transition-all duration-500 ease-out group-hover:scale-105 ${backImage ? '[@media(hover:hover)]:group-hover:opacity-0' : ''}`}
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
                  className="absolute inset-0 w-full h-full object-cover opacity-0 transition-all duration-500 ease-out group-hover:scale-105 [@media(hover:hover)]:group-hover:opacity-100"
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
              handler doesn't also fire.
              Burst: on ADD, remount a particle overlay (keyed on
              burstKey) so CSS keyframes restart from frame 0. Particles
              sit in an overflow-visible span so they fan outside the
              button's 9x9 bounds without being clipped. Reduced-motion
              users get the color flip and nothing else — see the
              @media rule inlined below. */}
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
            style={{ overflow: 'visible' }}
          >
            <span
              key={burstKey}
              className="pc-heart-burst relative inline-flex items-center justify-center"
              aria-hidden="true"
            >
              <Heart
                size={15}
                fill={saved ? '#E8362B' : 'none'}
                color={saved ? '#E8362B' : 'currentColor'}
                strokeWidth={2}
                className="pc-heart-icon"
                aria-hidden="true"
              />
              {burstKey > 0 && saved && (
                <span className="pc-heart-particles" aria-hidden="true">
                  {[0, 1, 2, 3, 4, 5].map(i => (
                    <span key={i} className={`pc-heart-particle pc-heart-particle-${i}`} />
                  ))}
                </span>
              )}
            </span>
            <style>{`
              @keyframes pc-heart-pulse {
                0%   { transform: scale(1); }
                40%  { transform: scale(1.35); }
                100% { transform: scale(1); }
              }
              @keyframes pc-heart-flash {
                0%   { filter: brightness(1.4) saturate(1.4); }
                60%  { filter: brightness(1.1) saturate(1.1); }
                100% { filter: none; }
              }
              @keyframes pc-heart-particle-out {
                0%   { transform: translate(-50%, -50%) translate(0, 0) scale(0.4); opacity: 1; }
                60%  { opacity: 1; }
                100% { transform: translate(-50%, -50%) translate(var(--pc-dx), var(--pc-dy)) scale(0.9); opacity: 0; }
              }
              .pc-heart-burst .pc-heart-icon {
                animation: pc-heart-pulse 400ms ease-out, pc-heart-flash 400ms ease-out;
                transform-origin: center;
                will-change: transform;
              }
              .pc-heart-particles {
                position: absolute;
                left: 50%;
                top: 50%;
                width: 0;
                height: 0;
                pointer-events: none;
              }
              .pc-heart-particle {
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
                animation: pc-heart-particle-out 520ms ease-out forwards;
                will-change: transform, opacity;
              }
              .pc-heart-particle-0 { --pc-dx: 14px;  --pc-dy: -14px; }
              .pc-heart-particle-1 { --pc-dx: 18px;  --pc-dy: 2px;   }
              .pc-heart-particle-2 { --pc-dx: 10px;  --pc-dy: 16px;  }
              .pc-heart-particle-3 { --pc-dx: -10px; --pc-dy: 16px;  }
              .pc-heart-particle-4 { --pc-dx: -18px; --pc-dy: 2px;   }
              .pc-heart-particle-5 { --pc-dx: -14px; --pc-dy: -14px; }
              @media (prefers-reduced-motion: reduce) {
                .pc-heart-burst .pc-heart-icon { animation: none; }
                .pc-heart-particles { display: none; }
              }
            `}</style>
          </button>

          {/* Volume II §15 — compare toggle. Sits left of the wishlist
              heart in the same absolute-positioned overlay band. Only
              renders when we have a local SKU to key the compare store
              by — Shopify-only products without a data/products.ts
              mapping are excluded. */}
          <CompareToggleButton sku={local?.sku} productName={local?.shortName ?? title} />

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

          {/* Colour dots — only colors with real per-color images.
              Capped at 4 here; the explicit "+N" / "N couleurs" text
              now lives in the info row below so buyers scanning the
              grid can compare variety at a glance without counting dots. */}
          {local && (() => {
            const realColors = filterRealColors(local.sku, local.colors);
            if (realColors.length === 0) return null;
            return (
              <div className="absolute bottom-2 left-2 flex gap-1 z-[4]">
                {realColors.slice(0, 4).map(c => (
                  <div key={c.id} className="w-3.5 h-3.5 rounded-full ring-1 ring-white/70 shadow-sm flex-shrink-0" style={{ background: c.hex }} title={c.name} />
                ))}
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
            {(() => {
              const displayTitle = local ? categoryLabel(local.category, lang) : title;
              // Task 2.18 — only wrap in Highlight when a search query
              // is active. Highlight is a no-op for empty strings, but
              // the explicit guard keeps the DOM output identical to
              // the pre-2.18 surface on the default (non-search) case.
              if (highlight && highlight.trim()) {
                return <Highlight text={displayTitle} query={highlight} />;
              }
              return displayTitle;
            })()}
          </div>

          {/* Explicit color count — derived from the same findColorImage
              filter the customizer uses, so no ghost variant inflates
              the number. Dots alone told buyers "multi-color exists"
              but not *how many*; this text lets them compare variety
              across products in a single scan. */}
          {local && (() => {
            const realColors = filterRealColors(local.sku, local.colors);
            const n = realColors.length;
            if (n === 0) return null;
            let text: string;
            if (n === 1) {
              // Single-color SKUs name the lone color instead of saying
              // "1 color" — buyers scanning the grid learn more from
              // "Noir seulement" than from a count. Still routed
              // through plural() below for the multi-color branches so
              // the pluralization rule is uniform across the grid.
              const only = realColors[0];
              const name = lang === 'en' ? (only.nameEn || only.name) : only.name;
              text = lang === 'en' ? `${name} only` : `${name} seulement`;
            } else if (n <= 4) {
              text = lang === 'en'
                ? plural(n, { one: '{count} color', other: '{count} colors' }, 'en')
                : plural(n, { one: '{count} couleur', other: '{count} couleurs' }, 'fr');
            } else {
              const extra = n - 4;
              // "autres" kept for every count here — legacy copy didn't
              // pluralize this tail (n > 4 so extra >= 1 always) and the
              // design sign-off locked it. Routed through plural() for
              // uniformity; both forms emit the same string today.
              text = lang === 'en'
                ? plural(extra, { one: '+ {count} more', other: '+ {count} more' }, 'en')
                : plural(extra, { one: '+ {count} autres', other: '+ {count} autres' }, 'fr');
            }
            return (
              <p className="text-[10px] text-muted-foreground leading-none mb-1">
                {text}
              </p>
            );
          })()}

          {/* Pricing with quantity breaks */}
          {(() => {
            // Screen readers pronounce "$27.54" as "dollar twenty seven
            // point five four" and "27,54 $" as "twenty seven comma
            // five four dollar sign", neither of which sounds like a
            // real price. Spell out the amount with a decimal comma/dot
            // replaced by the word "and" cents — no, simpler: feed the
            // raw value followed by "dollars" / "dollars" so VoiceOver
            // says "Prix : 27,54 dollars" / "Price: 27.54 dollars".
            const priceAria = (n: number | null | undefined): string | undefined => {
              if (n == null || !Number.isFinite(n)) return undefined;
              const fixed = n.toFixed(2);
              return lang === 'en'
                ? `Price: ${fixed} dollars`
                : `Prix : ${fixed.replace('.', ',')} dollars`;
            };
            if (local) {
              const unit = local.basePrice + PRINT_PRICE;
              const bulk = unit * (1 - BULK_DISCOUNT_RATE);
              return (
                <div className="mt-2 space-y-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[14px] font-extrabold text-primary" aria-label={priceAria(unit)}>{fmtMoney(unit, lang)}</span>
                    <span className="text-[10px] text-muted-foreground">/ {lang === 'en' ? 'unit' : 'unité'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-green-700" aria-label={priceAria(bulk)}>{fmtMoney(bulk, lang)}</span>
                    <span className="text-[9px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full font-bold">
                      {BULK_DISCOUNT_THRESHOLD}+ = -{Math.round(BULK_DISCOUNT_RATE * 100)}%
                    </span>
                  </div>
                </div>
              );
            }
            // Defensive: price.amount can be missing/non-numeric on
            // a partial Shopify response. fmtMoney handles NaN /
            // nullish by returning '—' so we render something visible
            // instead of 'NaN $'.
            const raw = price?.amount;
            const n = raw != null ? parseFloat(raw) : NaN;
            return (
              <div className="mt-2">
                <span className="text-[14px] font-extrabold text-primary" aria-label={priceAria(n)}>{fmtMoney(n, lang)}</span>
              </div>
            );
          })()}

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

