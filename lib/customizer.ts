/**
 * Customizer file analysis helpers — runs entirely in the browser.
 *
 * The customizer is a CONFIDENCE BUILDER (Vol III §07): we run lightweight
 * client-side checks (DPI, vector detection, color count, average lightness)
 * to give the customer reassurance their file will print well, then route
 * the actual quality work to our human production team.
 *
 * Do NOT try to do anything fancy here — the goal is fast, friendly, honest
 * feedback, not a substitute for prepress.
 */

export type FileKind = 'raster' | 'vector' | 'unknown';

export type DpiVerdict = 'pass' | 'warn' | 'fail';

export type ColorCountVerdict = 'pass' | 'warn';

export type FileChecks = {
  kind: FileKind;
  /** Raster only — natural pixel dimensions. */
  width?: number;
  height?: number;
  /** Raster only — DPI assuming 4-inch print width. */
  dpi?: number;
  dpiVerdict?: DpiVerdict;
  /** Raster only — distinct colors sampled on a 10×10 grid. */
  colorCount?: number;
  colorCountVerdict?: ColorCountVerdict;
  /** Raster only — average lightness 0–1 of the center 50×50 region. */
  avgLightness?: number;
  /** Raster only — small data URL thumbnail for round-tripping via sessionStorage. */
  thumbnailDataUrl?: string;
};

const RASTER_EXT = ['.png', '.jpg', '.jpeg'];
const VECTOR_EXT = ['.pdf', '.ai', '.svg'];

export function detectFileKind(file: File): FileKind {
  const name = file.name.toLowerCase();
  if (RASTER_EXT.some((ext) => name.endsWith(ext))) return 'raster';
  if (VECTOR_EXT.some((ext) => name.endsWith(ext))) return 'vector';
  return 'unknown';
}

export const ACCEPTED_EXTENSIONS = '.pdf,.ai,.svg,.png,.jpg,.jpeg';
export const MAX_BYTES = 25 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function dpiVerdictFor(dpi: number): DpiVerdict {
  if (dpi >= 150) return 'pass';
  if (dpi >= 100) return 'warn';
  return 'fail';
}

function colorCountVerdictFor(count: number): ColorCountVerdict {
  return count > 8 ? 'warn' : 'pass';
}

/** Read an image file into an HTMLImageElement. Caller must revoke the URL. */
function loadImage(file: File): Promise<{ img: HTMLImageElement; url: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image_load_failed'));
    };
    img.src = url;
  });
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Lightness 0–1 from sRGB, perceptual approximation. */
export function lightnessFromHex(hex: string): number {
  const m = hex.replace('#', '').match(/.{2}/g);
  if (!m || m.length < 3) return 0.5;
  const [rs, gs, bs] = m;
  if (!rs || !gs || !bs) return 0.5;
  const r = parseInt(rs, 16) / 255;
  const g = parseInt(gs, 16) / 255;
  const b = parseInt(bs, 16) / 255;
  // Rec. 709 luma
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function lightnessFromRgb(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Quantize to 5 bits/channel so near-duplicates collapse to one bucket. */
function quantize(value: number): number {
  return value & 0xf8;
}

/**
 * Sample a 10×10 grid + read the center 50×50 for average lightness.
 * Single canvas pass to keep things fast on phones.
 */
async function analyzeRaster(file: File): Promise<FileChecks> {
  const { img, url } = await loadImage(file);
  try {
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    const dpi = Math.round(width / 4);
    const dpiV = dpiVerdictFor(dpi);

    // Downscaled canvas for color sampling + center patch.
    const sampleCanvas = document.createElement('canvas');
    const SAMPLE_W = 100;
    const SAMPLE_H = 100;
    sampleCanvas.width = SAMPLE_W;
    sampleCanvas.height = SAMPLE_H;
    const ctx = sampleCanvas.getContext('2d');
    if (!ctx) throw new Error('canvas_unavailable');
    ctx.drawImage(img, 0, 0, SAMPLE_W, SAMPLE_H);

    // Color count: 10×10 grid of distinct quantized colors.
    const colorSet = new Set<string>();
    for (let gy = 0; gy < 10; gy++) {
      for (let gx = 0; gx < 10; gx++) {
        const x = Math.floor((gx + 0.5) * (SAMPLE_W / 10));
        const y = Math.floor((gy + 0.5) * (SAMPLE_H / 10));
        const data = ctx.getImageData(x, y, 1, 1).data;
        const r = data[0] ?? 0;
        const g = data[1] ?? 0;
        const b = data[2] ?? 0;
        const a = data[3] ?? 255;
        if (a < 32) continue; // skip transparent
        colorSet.add(rgbToHex(quantize(r), quantize(g), quantize(b)));
      }
    }
    const colorCount = Math.max(1, colorSet.size);

    // Avg lightness from center 50×50 of the sample canvas.
    const cx = Math.max(0, Math.floor((SAMPLE_W - 50) / 2));
    const cy = Math.max(0, Math.floor((SAMPLE_H - 50) / 2));
    const center = ctx.getImageData(cx, cy, 50, 50).data;
    let sum = 0;
    let opaque = 0;
    for (let i = 0; i < center.length; i += 4) {
      const a = center[i + 3] ?? 255;
      if (a < 32) continue;
      const r = center[i] ?? 0;
      const g = center[i + 1] ?? 0;
      const b = center[i + 2] ?? 0;
      sum += lightnessFromRgb(r, g, b);
      opaque++;
    }
    const avgLightness = opaque > 0 ? sum / opaque : 0.5;

    // Thumbnail (small, for sessionStorage round-trip preview).
    const thumbCanvas = document.createElement('canvas');
    const ratio = Math.min(160 / Math.max(1, width), 160 / Math.max(1, height));
    thumbCanvas.width = Math.max(1, Math.round(width * ratio));
    thumbCanvas.height = Math.max(1, Math.round(height * ratio));
    const thumbCtx = thumbCanvas.getContext('2d');
    let thumbnailDataUrl: string | undefined;
    if (thumbCtx) {
      thumbCtx.drawImage(img, 0, 0, thumbCanvas.width, thumbCanvas.height);
      try {
        thumbnailDataUrl = thumbCanvas.toDataURL('image/png');
      } catch {
        thumbnailDataUrl = undefined;
      }
    }

    return {
      kind: 'raster',
      width,
      height,
      dpi,
      dpiVerdict: dpiV,
      colorCount,
      colorCountVerdict: colorCountVerdictFor(colorCount),
      avgLightness,
      thumbnailDataUrl,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function analyzeFile(file: File): Promise<FileChecks> {
  const kind = detectFileKind(file);
  if (kind === 'raster') {
    return analyzeRaster(file);
  }
  // For vector + unknown we don't crack the file — vectors pass through,
  // and humans review everything before production anyway.
  return { kind };
}

export type ContrastVerdict = 'ok' | 'low';

/**
 * Low contrast = both ink-dark or both highlight-light.
 * Threshold of 0.25 between lightnesses is roughly the "do you trust this?"
 * gut check for an embroidered or printed logo on a garment.
 */
export function contrastVerdict(
  logoLightness: number,
  garmentLightness: number,
): ContrastVerdict {
  const delta = Math.abs(logoLightness - garmentLightness);
  if (delta < 0.25) return 'low';
  return 'ok';
}

export type Placement = 'heart' | 'centerChest' | 'fullBack';

/**
 * Mockup overlay geometry as a fraction of the product mockup box.
 * Tuned to roughly match the phase-1 product SVG layout.
 */
export const PLACEMENT_GEOMETRY: Record<
  Placement,
  { top: string; left: string; width: string; transform: string }
> = {
  heart: { top: '32%', left: '32%', width: '14%', transform: 'translate(-50%, -50%)' },
  centerChest: { top: '38%', left: '50%', width: '24%', transform: 'translate(-50%, -50%)' },
  fullBack: { top: '40%', left: '50%', width: '46%', transform: 'translate(-50%, -50%)' },
};

/** Short stable token used in sessionStorage keys. Not security-sensitive. */
export function makeShortId(): string {
  const seed = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return seed.slice(0, 12);
}

export type SavedCustomizer = {
  productSlug: string | null;
  color: string | null;
  size: string | null;
  fileName: string;
  fileSize: number;
  kind: FileKind;
  placement: Placement;
  notes: string;
  thumbnailDataUrl?: string;
  width?: number;
  height?: number;
  dpi?: number;
  colorCount?: number;
  savedAt: number;
};

export const STORAGE_PREFIX = 'va-customizer-';
