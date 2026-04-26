// Filter colors so only those with real per-color images appear.
// Hides "phantom" colors that exist as Shopify variants or in legacy data
// but don't actually correspond to a real garment image we can show.

import type { ProductColor } from '@/data/products';
import { findColorImage } from '@/data/products';

/**
 * Returns true when this color has a real image:
 *  - explicit imageDevant on the ProductColor itself, OR
 *  - an entry in COLOR_IMAGES[sku] for this color name (FR or EN)
 *
 * `findColorImage` can return null for three reasons:
 *   1. no COLOR_IMAGES map exists for this SKU (e.g. brand-new product)
 *   2. no key matches the color name or its English translation
 *   3. the matched entry has neither `front` nor `back` (shouldn't happen but
 *      we still guard against it)
 * We treat all three as "no real image". The product default image (black/
 * devant) doesn't count — that's just the fallback the customizer tints. The
 * point of this filter is to only show colors that look correct when chosen.
 */
export function hasRealColorImage(sku: string, color: ProductColor): boolean {
  if (!sku || !color) return false;
  if (color.imageDevant) return true;
  const img = findColorImage(sku, color.name);
  if (img?.front || img?.back) return true;
  const imgEn = color.nameEn ? findColorImage(sku, color.nameEn) : null;
  if (imgEn?.front || imgEn?.back) return true;
  return false;
}

/**
 * Single source of truth for "which catalog colours should show on this
 * product?". Used by BOTH the PDP color swatch row and the Merge customizer
 * colour picker so the two surfaces can never drift again.
 *
 * A colour is shown when:
 *   - hasRealColorImage(sku, color) is true (front-or-back drive photo
 *     exists, possibly via the COLOR_ALT_SLUGS / SKU_ALIASES chain), OR
 *   - the colour is Black/Noir on a SKU that has any image at all (Black
 *     is the canonical fallback every garment ships in — keeping it
 *     visible even when the photo set is incomplete avoids the
 *     "where did Noir go?" support tickets).
 *
 * Black-only escape hatch is OFF when the SKU has zero photography at all
 * (returning an empty list, same as `filterRealColors`'s safety net).
 */
export function getDisplayColors(sku: string, colors: ProductColor[] | undefined): ProductColor[] {
  if (!Array.isArray(colors) || colors.length === 0) return [];
  return colors.filter(c => {
    if (hasRealColorImage(sku, c)) return true;
    // Black escape hatch — only when at least one other colour has a
    // real image (i.e. the SKU has photography), so brand-new SKUs
    // with no images still drop their full palette gracefully.
    const isBlack = /^(black|noir)$/i.test(c.nameEn ?? '') || /^(black|noir)$/i.test(c.name ?? '');
    return isBlack;
  });
}

/**
 * Filter a colour list down to only the ones with real imagery.
 * If the filter would remove everything, return the original list (so we
 * never end up with zero colour options).
 *
 * Defensive: callers in the codebase pass `local.colors` from products
 * data, which is typed as `ProductColor[]` but in practice can be
 * `undefined` for legacy/incomplete entries (e.g. a freshly-imported
 * Shopify product whose colours haven't been mapped yet). Guarding
 * here means the grid renders an empty colour-dot row instead of a
 * `TypeError: Cannot read properties of undefined (reading 'filter')`
 * white-screen on the Products page.
 */
export function filterRealColors(sku: string, colors: ProductColor[]): ProductColor[] {
  if (!Array.isArray(colors) || colors.length === 0) return [];
  const filtered = colors.filter(c => hasRealColorImage(sku, c));
  return filtered.length > 0 ? filtered : colors;
}
