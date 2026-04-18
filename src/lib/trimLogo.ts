/**
 * trimLogo.ts — crop the transparent padding off an uploaded logo so
 * its image bounding box equals its VISIBLE bounding box.
 *
 * Why this exists
 * ---------------
 * Fabric's placement math centres the image (including its transparent
 * borders) on the requested point. If the PNG has 50 px of padding on
 * the right but only 10 px on the left (common when users export from
 * Illustrator), the VISIBLE logo lands off-centre even though the
 * image itself is exactly on target. Every "centre the logo" complaint
 * we've received traced back to this.
 *
 * The fix is to tighten the image to its visible pixels BEFORE handing
 * it to fabric. After a trim the image centre == the logo centre, and
 * every downstream centring calculation just works.
 */

/** Scan non-transparent pixels to find the visible bounding box.
 * Returns null when the image is entirely transparent (shouldn't
 * happen in practice but we bail rather than crop to 0×0). */
function findVisibleBbox(img: HTMLImageElement): { x: number; y: number; w: number; h: number } | null {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  // Alpha threshold — anything less than this is treated as padding.
  // 16 is permissive enough to keep anti-aliased edges while dropping
  // fully-transparent fill.
  const ALPHA_MIN = 16;

  let minX = canvas.width, maxX = -1, minY = canvas.height, maxY = -1;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4 + 3;
      if (data[i] < ALPHA_MIN) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0 || maxY < 0) return null; // fully transparent

  return {
    x: minX,
    y: minY,
    w: maxX - minX + 1,
    h: maxY - minY + 1,
  };
}

/** Load a Blob as an HTMLImageElement (needed because we want to
 * read the pixels, not just display it). */
function loadImage(blobOrUrl: Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
  });
}

/** Returns a new Blob with the transparent padding stripped off. If
 * the image already has zero padding (bbox == full size) returns the
 * original blob unchanged to avoid a needless re-encode. Also adds a
 * small uniform margin (MARGIN_PX per side) so strokes / anti-aliasing
 * don't touch the canvas edge. */
export async function trimTransparentPadding(blob: Blob): Promise<Blob> {
  // SVGs don't have raster padding — nothing to trim, return as-is.
  if (blob.type === 'image/svg+xml') return blob;

  let img: HTMLImageElement;
  try {
    img = await loadImage(blob);
  } catch {
    return blob; // can't read → leave it alone
  }

  const bbox = findVisibleBbox(img);
  if (!bbox) return blob;

  // If the bbox already equals the image dimensions (within 2 px per
  // side), the logo is already tight — no point re-encoding.
  if (
    bbox.x <= 2 && bbox.y <= 2 &&
    bbox.w >= img.naturalWidth - 4 && bbox.h >= img.naturalHeight - 4
  ) {
    return blob;
  }

  const MARGIN_PX = 2;
  const out = document.createElement('canvas');
  out.width  = bbox.w + MARGIN_PX * 2;
  out.height = bbox.h + MARGIN_PX * 2;
  const ctx = out.getContext('2d');
  if (!ctx) return blob;
  ctx.drawImage(img, bbox.x, bbox.y, bbox.w, bbox.h, MARGIN_PX, MARGIN_PX, bbox.w, bbox.h);

  return await new Promise<Blob>((resolve) => {
    out.toBlob(
      trimmed => resolve(trimmed ?? blob),
      'image/png',
      1,
    );
  });
}
