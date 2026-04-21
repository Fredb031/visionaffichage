/**
 * trimLogo.ts — crop the transparent padding off an uploaded logo so
 * its image bounding box equals its VISIBLE bounding box. See
 * {@link trimTransparentPadding}.
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

/** Reason a {@link TrimLogoError} was raised. Stable string codes so
 * callers can branch without matching on human-readable messages. */
export type TrimLogoErrorCode =
  | 'empty-image'
  | 'fully-transparent'
  | 'canvas-unavailable'
  | 'image-load-failed';

/** Named error for failures inside the trim pipeline. Currently the
 * public {@link trimTransparentPadding} entrypoint absorbs these and
 * returns the original blob unchanged (its documented behaviour), so
 * this class is here for callers that want to wrap the internals
 * directly or for future opt-in strict-mode use. */
export class TrimLogoError extends Error {
  readonly code: TrimLogoErrorCode;
  constructor(code: TrimLogoErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'TrimLogoError';
    this.code = code;
  }
}

/** Visible bounding box in native pixel coordinates. */
export type VisibleBbox = { x: number; y: number; w: number; h: number };

/** Scan non-transparent pixels to find the visible bounding box.
 * Returns null when the image is entirely transparent (shouldn't
 * happen in practice but we bail rather than crop to 0×0). */
function findVisibleBbox(img: HTMLImageElement): VisibleBbox | null {
  // Cap the analysis canvas so a huge user upload (8k × 8k is ~250 MB
  // of RGBA in one getImageData call) can't OOM lower-end phones /
  // older Safari. Downsample to fit within MAX_DIM on the longest
  // edge — the bbox result is scaled back up to native pixel coords
  // at the end, so this is lossless in terms of what gets cropped.
  const MAX_DIM = 2000;
  const natW = img.naturalWidth;
  const natH = img.naturalHeight;
  if (natW === 0 || natH === 0) return null;
  const scale = Math.min(1, MAX_DIM / Math.max(natW, natH));
  const sw = Math.max(1, Math.round(natW * scale));
  const sh = Math.max(1, Math.round(natH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, sw, sh);
  const data = ctx.getImageData(0, 0, sw, sh).data;

  // Alpha threshold — anything less than this is treated as padding.
  // 16 is permissive enough to keep anti-aliased edges while dropping
  // fully-transparent fill.
  const ALPHA_MIN = 16;

  let minX = sw, maxX = -1, minY = sh, maxY = -1;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const i = (y * sw + x) * 4 + 3;
      if (data[i] < ALPHA_MIN) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0 || maxY < 0) return null; // fully transparent

  // Scale the bbox back to native pixel coordinates. Add 1 px margin
  // each side before scaling up so rounding can't clip the edge of
  // the visible pixels.
  const upscale = 1 / scale;
  const x = Math.max(0, Math.floor((minX - 1) * upscale));
  const y = Math.max(0, Math.floor((minY - 1) * upscale));
  const x2 = Math.min(natW, Math.ceil((maxX + 2) * upscale));
  const y2 = Math.min(natH, Math.ceil((maxY + 2) * upscale));
  return { x, y, w: x2 - x, h: y2 - y };
}

/** Load a Blob as an HTMLImageElement (needed because we want to
 * read the pixels, not just display it). Revokes any createObjectURL
 * we allocate so repeated logo trims don't leak blob URLs. */
function loadImage(blobOrUrl: Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const ownedUrl = typeof blobOrUrl === 'string' ? null : URL.createObjectURL(blobOrUrl);
    const cleanup = () => { if (ownedUrl) URL.revokeObjectURL(ownedUrl); };
    img.onload = () => { cleanup(); resolve(img); };
    img.onerror = (e) => { cleanup(); reject(e); };
    img.src = ownedUrl ?? (blobOrUrl as string);
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
