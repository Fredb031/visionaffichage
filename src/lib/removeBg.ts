/**
 * removeBg — Background removal with two strategies
 *
 *   1. If VITE_REMOVE_BG_API_KEY is set, hit remove.bg's API for pro-quality
 *      cutouts (handles complex backgrounds, photos of objects, etc.)
 *
 *   2. Otherwise, use a fully in-browser canvas fallback that erases white /
 *      near-white pixels with edge-aware feathering. This works great for the
 *      most common case (a logo on a white or off-white background) and means
 *      the customizer's "Remove background" button always does something
 *      visible — no more silent fail when the API key is missing.
 *
 * SVG files skip both paths and are returned as-is — they don't have a
 * background to remove.
 */

const API_URL = 'https://api.remove.bg/v1.0/removebg';

export async function removeBackground(file: File): Promise<Blob> {
  // SVGs are already transparent
  if (file.type === 'image/svg+xml') return file;

  const apiKey = import.meta.env.VITE_REMOVE_BG_API_KEY;

  // ── Strategy 1: remove.bg API (best quality) ─────────────────────────────
  if (apiKey && apiKey !== '') {
    try {
      const formData = new FormData();
      formData.append('image_file', file);
      formData.append('size', 'auto');

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'X-Api-Key': apiKey },
        body: formData,
      });

      if (res.ok) return await res.blob();
      console.warn(`remove.bg returned ${res.status} — falling back to canvas`);
    } catch (err) {
      console.warn('remove.bg request failed — falling back to canvas:', err);
    }
  }

  // ── Strategy 2: in-browser canvas fallback ───────────────────────────────
  try {
    return await removeWhiteBackground(file);
  } catch (err) {
    console.warn('Canvas background removal failed — returning original:', err);
    return file;
  }
}

/**
 * Erase near-white pixels using a luminance threshold + edge feathering.
 * Works well for logos on white/light backgrounds (the 90% case).
 *
 * Algorithm:
 *   1. Decode the file to a canvas
 *   2. For each pixel: compute luminance (Y = 0.299R + 0.587G + 0.114B)
 *   3. Pixels above HARD threshold → fully transparent
 *   4. Pixels in SOFT range       → linearly feathered alpha (avoids halos)
 *   5. Pixels below SOFT          → kept opaque (the logo content)
 */
async function removeWhiteBackground(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    return await processBitmap(bitmap);
  } finally {
    // createImageBitmap allocates a GPU-backed buffer that only gets
    // freed when .close() is called (or on GC, which is unpredictable
    // and has caused visible memory creep during multi-upload sessions).
    // The polyfill path's try/catch ensures we close even if the main
    // pipeline throws.
    if (typeof bitmap.close === 'function') bitmap.close();
  }
}

async function processBitmap(bitmap: ImageBitmap): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D context available');

  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = imageData.data;

  // Tunable thresholds — these work well on flat-coloured logos
  const HARD = 245; // luminance ≥ 245 → fully transparent
  const SOFT = 215; // luminance in [215..244] → fading

  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], g = px[i + 1], b = px[i + 2];
    const y = 0.299 * r + 0.587 * g + 0.114 * b;

    // Saturation check — skip removal for vivid colours even if they're bright
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    if (sat > 0.18) continue; // saturated → it's logo content, leave it alone

    if (y >= HARD) {
      px[i + 3] = 0;
    } else if (y >= SOFT) {
      // Linear feather between SOFT and HARD
      const t = (y - SOFT) / (HARD - SOFT);
      px[i + 3] = Math.round(px[i + 3] * (1 - t));
    }
  }

  ctx.putImageData(imageData, 0, 0);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob failed'))),
      'image/png',
    );
  });
}
