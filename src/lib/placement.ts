/**
 * placement.ts — single source of truth for logo placement math.
 *
 * Every "center on garment", "center on chest", "zone preset", and
 * "first-upload auto-place" call goes through this helper so the math
 * is tuned in one place. Returns canvas-percent coordinates that feed
 * directly into LogoPlacement { x, y, width }.
 */
import type { PrintZone } from '@/data/products';

/** Detected garment bounding box, expressed as canvas percentages. */
export type Bbox = {
  x: number; y: number; w: number; h: number;
  cx: number; cy: number;
};

/** Print zone on a garment (re-exported alias of the catalogue `PrintZone`). */
export type PlacementZone = PrintZone;

/** Resolved logo placement in canvas-percent coordinates (matches LogoPlacement). */
export type Placement = { x: number; y: number; width: number };

/** Input shape for every placement helper: optional bbox, zone, and width override. */
export type PlacementTransform = {
  /** Detected garment bbox (percentages of canvas). When absent, we fall
   * back to the printZone's declared coordinates. */
  bbox?: Bbox | null;
  /** Zone to anchor within when bbox is unavailable. */
  zone?: PrintZone;
  /** Override the logo width percent. When omitted, we use a sensible
   * default relative to the bbox width. */
  widthPct?: number;
};

// Internal alias preserves the original `Params` name used across the module
// without adding a second public surface. `PlacementTransform` is the public
// export; call sites inside this file continue to read as before.
type Params = PlacementTransform;

/** Defensive guard against malformed bboxes coming from upstream
 * fabric.js objects. Degenerate selections (zero-width shapes, freshly
 * rotated groups, transforms mid-update) can emit NaN/Infinity for any
 * of cx/cy/w/h/x/y; if we let those flow through, every downstream
 * helper returns NaN coordinates and the logo silently disappears
 * (or renders at `translate(NaN, NaN)` and breaks the canvas).
 *
 * We also reject non-positive width/height — a w<=0 bbox means the
 * detector failed and the "garment center" math collapses to a point,
 * which produces a more confusing UX than falling back to the zone or
 * canvas center. Returning null here means the helpers below take the
 * `zone` / canvas-center branch instead, which is exactly the behaviour
 * we want when the bbox is untrustworthy. */
const isValidBbox = (b: Bbox | null | undefined): b is Bbox => {
  if (!b) return false;
  const { x, y, w, h, cx, cy } = b;
  return (
    Number.isFinite(x) && Number.isFinite(y) &&
    Number.isFinite(w) && Number.isFinite(h) &&
    Number.isFinite(cx) && Number.isFinite(cy) &&
    w > 0 && h > 0
  );
};

/** Logo width as a percent of the CANVAS. Slightly larger default than
 * before — user feedback: the auto-placed logo was too small to read.
 * Caps keep a slim-fit from ballooning and a wide garment from getting
 * a tiny mark. */
const defaultWidth = (bbox?: Bbox | null) =>
  isValidBbox(bbox) ? Math.min(bbox.w * 0.45, bbox.h * 1.2, 38) : 34;

/** Clamp a user-supplied widthPct to a sane range. Callers occasionally
 * pass a stale slider value (negative after a reset) or a value in the
 * 0–1 range that got divided by 100 twice; both blow past the zone and
 * render the logo off-canvas or inverted. A floor of 5% keeps the logo
 * visible enough to drag; a ceiling of 100% matches the canvas width
 * and prevents the bbox math below from producing NaN after downstream
 * `width / 2` operations. NaN/Infinity fall back to the default. */
const MIN_WIDTH_PCT = 5;
const MAX_WIDTH_PCT = 100;
const clampWidth = (w: number | undefined, fallback: number): number => {
  if (w === undefined || !Number.isFinite(w)) return fallback;
  return Math.min(Math.max(w, MIN_WIDTH_PCT), MAX_WIDTH_PCT);
};

/** Center on the garment. Horizontal center uses the DETECTED bbox.cx
 * because real product photos are often shifted a few percent off the
 * canvas frame — forcing x=50 (canvas center) makes logos visibly
 * lean toward the wider shoulder on asymmetric crops. When no bbox
 * is available, fall back to the declared zone center if provided
 * (closer to the garment than canvas center on off-frame shots), else
 * canvas center as a last resort.
 *
 * Kickflip, Printful, Custom Ink etc. all anchor to the detected
 * silhouette center, not the canvas center, for this exact reason. */
export function centerOnGarment(p: Params) {
  const { bbox, zone } = p;
  if (isValidBbox(bbox)) {
    return {
      x: bbox.cx,
      y: bbox.cy,
      width: clampWidth(p.widthPct, defaultWidth(bbox)),
    };
  }
  if (zone) {
    return {
      x: zone.x + zone.width / 2,
      y: zone.y + zone.height / 2,
      width: clampWidth(p.widthPct, defaultWidth(null)),
    };
  }
  return { x: 50, y: 50, width: clampWidth(p.widthPct, defaultWidth(null)) };
}

/** Chest point = detected garment horizontal centre + vertical 25% from
 * the top of the bbox. If the photo is slightly off-center in the
 * frame, bbox.cx is the real garment center and what the user
 * perceives as "centered". */
export function centerOnChest(p: Params) {
  const { bbox, zone } = p;
  if (isValidBbox(bbox)) {
    return {
      x: bbox.cx,
      y: bbox.y + bbox.h * 0.25,
      width: clampWidth(p.widthPct, Math.min(bbox.w * 0.4, 34)),
    };
  }
  if (zone) {
    return {
      x: zone.x + zone.width / 2,
      y: zone.y + zone.height / 2,
      width: clampWidth(p.widthPct, zone.width * 0.9),
    };
  }
  return { x: 50, y: 37, width: clampWidth(p.widthPct, 32) };
}

/** Center on a specific print zone (used when user picks a zone preset).
 * Width is clamped through the same `clampWidth` floor/ceiling the other
 * helpers use so a future zone with an oversized declared width (or a
 * tiny one a designer half-edited in the catalogue) can't render the
 * logo with `width > 100` (overflowing the canvas) or `width < 5`
 * (invisible). Keeps zone-preset behaviour aligned with chest / garment
 * autoplace instead of silently diverging at this single call site. */
export function centerOnZone(zone: PrintZone) {
  return {
    x: zone.x + zone.width / 2,
    y: zone.y + zone.height / 2,
    width: clampWidth(zone.width * 0.85, defaultWidth(null)),
  };
}

/** Auto-placement on first upload: prefer the chest point if we have a
 * bbox, otherwise the declared default zone.
 *
 * `kind` tunes the vertical anchor: chest-height on a torso lands at
 * `bbox.y + bbox.h * 0.25`, which is correct for shirts/hoodies but
 * drops onto the visor of a cap or the hem of a beanie. For caps and
 * beanies we center vertically on the bbox (crown-front is the widest
 * printable surface in the product photo) and clamp width tighter so
 * the logo doesn't overflow the small face. */
export function autoPlaceOnUpload(
  p: Params,
  kind: 'garment' | 'cap' | 'beanie' = 'garment',
) {
  if (kind === 'cap' || kind === 'beanie') {
    const { bbox, zone } = p;
    if (isValidBbox(bbox)) {
      const capWidth = Math.min(bbox.w * 0.55, bbox.h * 0.9, 32);
      return centerOnGarment({
        bbox: { ...bbox, cy: bbox.y + bbox.h * 0.5 },
        zone,
        widthPct: p.widthPct ?? capWidth,
      });
    }
    return centerOnGarment(p);
  }
  return centerOnChest(p);
}

/** Type guard for deserialized placement data (localStorage, URL params, API).
 *
 * Enforces the canvas-percent contract documented at the top of this
 * module: x/y must land in [0..100] and width must sit inside the
 * MIN_WIDTH_PCT..MAX_WIDTH_PCT band the helpers above clamp into. A
 * tampered localStorage entry like `{ x: -500, y: 9999, width: 5000 }`
 * would otherwise pass the bare-finite check and render the logo
 * invisibly off-canvas (or with NaN-producing geometry after the
 * downstream `width / 2` math). Mirrors the same bounds `clampWidth`
 * applies on writes so reads and writes agree on what counts as valid. */
export function isValidPlacement(p: unknown): p is Placement {
  if (!p || typeof p !== 'object') return false;
  const { x, y, width } = p as Record<string, unknown>;
  return (
    typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 100 &&
    typeof y === 'number' && Number.isFinite(y) && y >= 0 && y <= 100 &&
    typeof width === 'number' && Number.isFinite(width) &&
    width >= MIN_WIDTH_PCT && width <= MAX_WIDTH_PCT
  );
}
