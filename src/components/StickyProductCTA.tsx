import { useEffect, useState, type RefObject } from 'react';
import { Shirt, ChevronRight } from 'lucide-react';
import { useLang } from '@/lib/langContext';
import { findColorImage, PRINT_PRICE } from '@/data/products';
import { fmtMoney } from '@/lib/format';
import { categoryLabel } from '@/lib/productLabels';

// Volume II — Section 01 — Sticky add-to-cart bar.
// Baymard flags this as the single highest-ROI mobile-conversion lift
// for a long PDP (their field studies show 18–32% lift on small
// viewports). The inline "Personnaliser ce produit" CTA scrolls out
// of view as soon as a visitor starts reading the description, the
// bulk calculator, or the similar-products grid; once it's gone, the
// path to purchase requires a scroll-back-to-top, which is exactly
// where mobile flows leak.
//
// Behaviour summary
//   - Hidden until the anchor (the inline primary CTA button) leaves
//     the viewport, measured via getBoundingClientRect().bottom < 0
//     so we react to the *bottom edge* of the button passing the top
//     of the viewport (matches user mental model of "the button is
//     gone").
//   - Slides in from the bottom over 300ms with a translate-y +
//     opacity pair. prefers-reduced-motion strips the slide and just
//     toggles visibility, so motion-averse visitors aren't punished.
//   - pb-safe via env(safe-area-inset-bottom) keeps the CTA clear of
//     the iOS home-indicator strip on notched iPhones.
//   - Tapping "Personnaliser →" scrolls the page back to the original
//     CTA and focuses it; that lets us keep one source of truth for
//     the customizer-open state (the inline button's onClick) instead
//     of duplicating the wiring here and risking divergence.
//
// We don't render this on desktop (md+) because the sidebar layout
// already keeps the inline CTA within the viewport on a wide screen,
// and a fixed bar at the bottom would just compete with the global
// footer.
type Product = {
  title: string;
  images?: { edges?: Array<{ node?: { url?: string } }> };
};

type LocalProduct = {
  sku?: string;
  category?: string;
  imageDevant?: string;
};

interface StickyProductCTAProps {
  product: Product;
  localProduct?: LocalProduct | null;
  selectedColor?: string;
  /** Per-unit price *with print included* — what the user actually
   *  pays per piece at the smallest tier. The bar shows this as
   *  "À partir de X $/pce" to anchor the price expectation. */
  pricePerUnit: number;
  /** Ref to the inline primary "Personnaliser ce produit" button.
   *  Used both for visibility detection (bounding-rect scroll
   *  listener) and as the scroll target when the sticky CTA is
   *  tapped. */
  anchorRef: RefObject<HTMLButtonElement | null>;
  /** Disable the CTA when the selected variant is sold out — mirrors
   *  the inline button's disabled state so we never offer a tap that
   *  would land on a disabled customizer trigger. */
  disabled?: boolean;
  /** Hide the sticky bar entirely while the customizer modal is open
   *  — otherwise the fixed bar bleeds through the modal backdrop on
   *  iOS Safari, which renders position:fixed elements above
   *  position:fixed siblings if their stacking context differs. */
  hidden?: boolean;
}

export function StickyProductCTA({
  product,
  localProduct,
  selectedColor,
  pricePerUnit,
  anchorRef,
  disabled = false,
  hidden = false,
}: StickyProductCTAProps) {
  const { lang } = useLang();
  const [visible, setVisible] = useState(false);

  // Visibility gate. We use getBoundingClientRect on a scroll listener
  // rather than IntersectionObserver here because the brief
  // explicitly calls for `bottom < 0` semantics and because it lets
  // us react instantly to a programmatic scroll back to the anchor
  // (IO fires asynchronously on the next animation frame, which made
  // the bar visibly linger after the scroll-back tap).
  //
  // The listener is passive + throttled to one rAF per frame; on a
  // 60fps mid-tier Android the cost is well under a 1ms budget per
  // frame, and we early-exit if the ref isn't mounted yet.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // bottom < 0 means the entire button has scrolled past the top
      // of the viewport — the visitor can no longer see it without
      // scrolling back. That's our cue to slide the sticky in.
      setVisible(rect.bottom < 0);
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [anchorRef]);

  // Resolve thumbnail. Prefer the per-color asset when we know which
  // color the visitor has selected; that visual continuity is what
  // makes the sticky feel like the same product they were just
  // looking at, not a generic header image. Fall back to the local
  // catalog imageDevant, then to the first Shopify image.
  const thumbnail =
    (localProduct?.sku && selectedColor
      ? findColorImage(localProduct.sku, selectedColor)
      : undefined)
    ?? localProduct?.imageDevant
    ?? product.images?.edges?.[0]?.node?.url
    ?? '';

  // Title — prefer the localized category label (e.g. "T-shirt
  // marin") which reads more naturally in a 1-line truncated bar
  // than the verbose Shopify title ("ATC1000 Adult Everyday Cotton
  // Tee"). Fall back to product.title if we don't have a local
  // entry.
  const displayTitle = localProduct?.category
    ? categoryLabel(localProduct.category, lang)
    : product.title;

  const handleTap = () => {
    const el = anchorRef.current;
    if (!el) return;
    // Scroll the inline CTA back into view, then focus it. The
    // smooth scroll respects prefers-reduced-motion at the browser
    // level (Chrome/Firefox/Safari all collapse smooth → auto under
    // the media query). Focus drives the customizer to open via the
    // existing keyboard-activation path on the inline button — no
    // new state plumbing needed, which is what keeps the wiring
    // single-sourced.
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch {
      el.scrollIntoView();
    }
    // Defer focus until after the scroll begins; iOS Safari steals
    // focus back to the document body if we focus mid-scroll.
    window.setTimeout(() => {
      try { el.focus({ preventScroll: true }); } catch { /* noop */ }
    }, 120);
  };

  if (hidden) return null;

  // Format price. fmtMoney handles the FR/EN currency presentation
  // (no decimals only when round, dollar-sign suffix in FR, prefix
  // in EN). The "/pce" suffix is the same abbreviation used in the
  // BulkCalculator tier table so the two prices read consistently.
  const priceLabel = lang === 'en'
    ? `From ${fmtMoney(pricePerUnit, lang)}/unit`
    : `À partir de ${fmtMoney(pricePerUnit, lang)}/pce`;

  return (
    <div
      role="region"
      aria-label={lang === 'en' ? 'Sticky purchase bar' : 'Barre d\'achat persistante'}
      aria-hidden={!visible}
      className={[
        'md:hidden fixed bottom-0 left-0 right-0 z-40',
        'bg-white border-t border-border shadow-lg',
        'transition-[transform,opacity] duration-300 ease-out',
        // Hidden state: pushed fully off the bottom edge + fully
        // transparent so it doesn't intercept taps. pointer-events
        // is keyed off the same flag so screen readers won't surface
        // the buttons while the bar is dismissed.
        visible
          ? 'translate-y-0 opacity-100 pointer-events-auto'
          : 'translate-y-full opacity-0 pointer-events-none',
      ].join(' ')}
      style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="flex items-center gap-3 px-3 py-2">
        {thumbnail && (
          <img
            src={thumbnail}
            alt=""
            aria-hidden="true"
            width={48}
            height={48}
            loading="lazy"
            decoding="async"
            className="w-12 h-12 rounded-lg object-cover bg-muted shrink-0 border border-border"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-foreground truncate leading-tight">
            {displayTitle}
          </div>
          <div className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
            {selectedColor ? (
              <>
                <span>{selectedColor}</span>
                <span className="mx-1.5 opacity-50">·</span>
                <span className="font-semibold text-foreground">{priceLabel}</span>
              </>
            ) : (
              <span className="font-semibold text-foreground">{priceLabel}</span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={handleTap}
          disabled={disabled}
          aria-disabled={disabled || undefined}
          tabIndex={visible ? 0 : -1}
          aria-label={lang === 'en' ? 'Customize this product' : 'Personnaliser ce produit'}
          className="shrink-0 px-4 py-2.5 gradient-navy-dark text-primary-foreground rounded-xl text-[13px] font-extrabold cursor-pointer flex items-center gap-1.5 transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-[#0052CC]/50 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ boxShadow: '0 4px 14px hsla(var(--navy), 0.3)' }}
        >
          <Shirt size={14} aria-hidden="true" />
          <span>{lang === 'en' ? 'Customize' : 'Personnaliser'}</span>
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

// Re-export PRINT_PRICE so callers can compute pricePerUnit without
// duplicating the data import — the per-unit price the bar shows
// always equals shopifyBase + PRINT_PRICE (matches the inline pricing
// row's "/unité, avant impression" + the BulkCalculator tier 1).
export { PRINT_PRICE };
