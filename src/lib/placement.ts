/**
 * placement.ts — single source of truth for logo placement math.
 *
 * Every "center on garment", "center on chest", "zone preset", and
 * "first-upload auto-place" call goes through this helper so the math
 * is tuned in one place. Returns canvas-percent coordinates that feed
 * directly into LogoPlacement { x, y, width }.
 */
import type { PrintZone } from '@/data/products';

export type Bbox = {
  x: number; y: number; w: number; h: number;
  cx: number; cy: number;
};

type Params = {
  /** Detected garment bbox (percentages of canvas). When absent, we fall
   * back to the printZone's declared coordinates. */
  bbox?: Bbox | null;
  /** Zone to anchor within when bbox is unavailable. */
  zone?: PrintZone;
  /** Override the logo width percent. When omitted, we use a sensible
   * default relative to the bbox width. */
  widthPct?: number;
};

/** Logo width as a percent of the CANVAS. Slightly larger default than
 * before — user feedback: the auto-placed logo was too small to read.
 * Caps keep a slim-fit from ballooning and a wide garment from getting
 * a tiny mark. */
const defaultWidth = (bbox?: Bbox | null) =>
  bbox ? Math.min(bbox.w * 0.45, 38) : 34;

/** Center on the garment. The horizontal centre is ALWAYS canvas 50 —
 * apparel photos are shot flat and symmetric, so bbox.cx drifts off
 * centre whenever the product photo itself isn't perfectly centred in
 * the frame (which every SanMar photo actually is slightly). The
 * vertical centre uses bbox.cy so logos still land on the shirt body
 * vertically, not on the canvas letterbox. */
export function centerOnGarment(p: Params) {
  const { bbox } = p;
  return {
    x: 50,
    y: bbox ? bbox.cy : 50,
    width: p.widthPct ?? defaultWidth(bbox),
  };
}

/** Chest point = canvas horizontal centre + vertical 25% from the top
 * of the bbox. Same symmetry argument as centerOnGarment: horizontal
 * always 50 so users stop seeing the logo lean right. */
export function centerOnChest(p: Params) {
  const { bbox, zone } = p;
  if (bbox) {
    return {
      x: 50,
      y: bbox.y + bbox.h * 0.25,
      width: p.widthPct ?? Math.min(bbox.w * 0.4, 34),
    };
  }
  if (zone) {
    return {
      x: 50,                                // was zone.x+zone.width/2; for 99% of apparel that's already ~50 but enforce it
      y: zone.y + zone.height / 2,
      width: p.widthPct ?? zone.width * 0.9,
    };
  }
  return { x: 50, y: 37, width: 32 };
}

/** Center on a specific print zone (used when user picks a zone preset). */
export function centerOnZone(zone: PrintZone) {
  return {
    x: zone.x + zone.width / 2,
    y: zone.y + zone.height / 2,
    width: zone.width * 0.85,
  };
}

/** Auto-placement on first upload: prefer the chest point if we have a
 * bbox, otherwise the declared default zone. */
export function autoPlaceOnUpload(p: Params) {
  return centerOnChest(p);
}
