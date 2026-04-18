// Filter colors so only those with real per-color images appear.
// Hides "phantom" colors that exist as Shopify variants or in legacy data
// but don't actually correspond to a real garment image we can show.

import type { ProductColor } from '@/data/products';
import { findColorImage } from '@/data/products';

/**
 * Returns true when this color has a real image:
 *  - explicit imageDevant on the ProductColor itself, OR
 *  - an entry in COLOR_IMAGES[sku] for this color name
 *
 * The product default image (black/devant) doesn't count — that's just the
 * fallback the customizer tints. The point of this filter is to only show
 * colors that look correct when chosen, not generic tinted previews.
 */
export function hasRealColorImage(sku: string, color: ProductColor): boolean {
  if (color.imageDevant) return true;
  const img = findColorImage(sku, color.name);
  if (img?.front) return true;
  const imgEn = color.nameEn ? findColorImage(sku, color.nameEn) : null;
  if (imgEn?.front) return true;
  return false;
}

/**
 * Filter a colour list down to only the ones with real imagery.
 * If the filter would remove everything, return the original list (so we
 * never end up with zero colour options).
 */
export function filterRealColors(sku: string, colors: ProductColor[]): ProductColor[] {
  const filtered = colors.filter(c => hasRealColorImage(sku, c));
  return filtered.length > 0 ? filtered : colors;
}
