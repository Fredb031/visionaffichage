/**
 * ProductCanvas — The single, unified interactive product preview
 *
 * One canvas. One source of truth. Inspired by CustomInk / Printful / Vistaprint
 * where the user customizes directly on the same canvas they preview from.
 *
 * What it does:
 *   1. Loads the real Shopify product photo (front or back) as the canvas
 *      background, scaled to fit.
 *   2. Covers the embedded "VOTRE LOGO" placeholder text on the front photo
 *      with a coloured rectangle that matches the selected garment colour.
 *   3. Lets the user drag, resize (uniform only — no deformation), and rotate
 *      their logo directly on the canvas.
 *   4. Switches between front/back via tabs that live ON the canvas.
 *   5. Emits placement updates so the parent step state stays in sync.
 *
 * Replaces ProductViewer3D + LogoCanvas + PlacementSelector — those existed
 * as separate components and showed the SAME thing twice, which is why the
 * customizer felt "double".
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlignCenter, AlignLeft, AlignRight, RotateCcw, ZoomIn, ZoomOut,
  ImageOff, Move, Trash2, Type, X,
} from 'lucide-react';
import type { Product, PrintZone } from '@/data/products';
import type { LogoPlacement, ProductView } from '@/types/customization';
import { useLang } from '@/lib/langContext';

// Fabric.js dynamic import sidesteps its TS types, so we model the
// subset we use. Keeps ESLint happy without pulling in fabric's heavy
// type surface.
type FabricObj = {
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  scaleX?: number;
  scaleY?: number;
  angle?: number;
  set: (key: string | Record<string, unknown>, value?: unknown) => void;
  setCoords?: () => void;
  dispose?: () => void;
  getElement?: () => HTMLImageElement | HTMLCanvasElement;
  _element?: HTMLImageElement | HTMLCanvasElement;
};

interface Props {
  product: Product;
  garmentColor?: string;        // hex of selected colour
  hasRealColorImage?: boolean;  // true = real per-colour photo, skip tint overlay
  imageDevant: string;          // product photo for front
  imageDos: string;             // product photo for back
  logoUrl: string | null;
  currentPlacement: LogoPlacement | null;
  activeView: ProductView;
  onViewChange: (v: ProductView) => void;
  onPlacementChange: (p: LogoPlacement) => void;
  /** Called once the canvas is ready — gives parent a snapshot function
   * so Step 5 "Download mockup" can export the current preview as PNG. */
  onSnapshotReady?: (getDataUrl: () => string | null) => void;
  /** When true, the canvas shows the alignment toolbar + text input.
   * Used to keep tools OUT of sight on steps where the user isn't
   * actively placing the logo. */
  showPlacementTools?: boolean;
  /** Called once the garment bounding box has been detected, expressed
   * as percentages of canvas dimensions (0-100) so the parent can feed
   * the values straight into placement { x, y, width }. */
  onBboxDetected?: (bboxPct: { x: number; y: number; w: number; h: number; cx: number; cy: number } | null) => void;
  /** Per-side indicator: shows a dot on the Front/Back toggle tab when
   * that side already has artwork (competitor pattern — CustomInk +
   * Printful both do this). */
  hasLogoPerSide?: { front: boolean; back: boolean };
  /** When true, overlay a pulsing crosshair at the detected garment
   * centre so the user can visually verify "Auto-center" is on target. */
  showBboxCenter?: boolean;
  /** Called whenever the canvas text list changes (add/remove). The
   * parent mirrors this into the customizer store so it survives the
   * trip through the cart + Shopify order metadata. */
  onTextAssetsChange?: (assets: Array<{ id: string; text: string; color: string; side: ProductView }>) => void;
}

export function ProductCanvas({
  product, garmentColor, hasRealColorImage, imageDevant, imageDos, logoUrl,
  currentPlacement, activeView, onViewChange, onPlacementChange, onSnapshotReady,
  showPlacementTools = true, onBboxDetected, hasLogoPerSide, showBboxCenter,
  onTextAssetsChange,
}: Props) {
  const { t, lang } = useLang();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasElRef  = useRef<HTMLCanvasElement>(null);
  const [textInput, setTextInput] = useState('');
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [textFont, setTextFont] = useState('Inter, system-ui, sans-serif');
  // Text assets are tagged with the side they belong to so a caption
  // added on the back doesn't render on top of the front photo when
  // the user toggles the view (and vice-versa). Notifies the parent on
  // every change via onTextAssetsChange so the list survives the cart.
  const [textAssets, setTextAssetsInternal] = useState<Array<{ id: string; text: string; color: string; side: ProductView }>>([]);
  const setTextAssets = useCallback((update: Parameters<typeof setTextAssetsInternal>[0]) => {
    setTextAssetsInternal(prev => {
      const next = typeof update === 'function' ? (update as (p: typeof prev) => typeof prev)(prev) : update;
      onTextAssetsChange?.(next);
      return next;
    });
  }, [onTextAssetsChange]);
  const textObjects = useRef<Map<string, FabricObj & { side: ProductView }>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fc      = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logoObj = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maskRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const photoObj = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tintObj = useRef<any>(null);

  const [ready, setReady] = useState(false);
  const [imgError, setImgError] = useState(false);
  // Local mirror of the detected bbox so we can render a centre crosshair
  // over the canvas without asking the parent to feed it back.
  const [localBbox, setLocalBbox] = useState<{ cx: number; cy: number } | null>(null);
  // Ref mirror so the drag-snap handler (registered once at canvas init)
  // reads live bbox values instead of the snapshot captured when the
  // effect first ran. Otherwise snap-to-center always targets canvas
  // 50,50 even after the real garment center is detected.
  const bboxRef = useRef<{ cx: number; cy: number } | null>(null);
  bboxRef.current = localBbox;
  const [canvasKey, setCanvasKey] = useState(0); // bumped on resize to force rebuild
  const [zoneId, setZoneId] = useState<string>(
    currentPlacement?.zoneId ?? (product.printZones[0]?.id ?? ''),
  );
  // Ref mirror of zoneId so canvas event listeners always read the current value
  const zoneIdRef = useRef(zoneId);
  zoneIdRef.current = zoneId;

  // ── Analyze loaded photo to find the garment's bounding box in
  //    CANVAS coordinates (not image pixels). We sample pixels, treat
  //    the bright "seamless background" as empty, and take the
  //    min/max of the dark pixels. This is what makes "center on
  //    garment" land on the shirt body instead of canvas whitespace.
  const analyzeBboxFromFabricImage = useCallback((fabImg: FabricObj) => {
    try {
      const W = fc.current?.width as number;
      const H = fc.current?.height as number;
      const el: HTMLImageElement | HTMLCanvasElement | undefined =
        fabImg.getElement?.() || fabImg._element;
      if (!el || !W || !H) return null;
      const natW = (el as HTMLImageElement).naturalWidth || el.width;
      const natH = (el as HTMLImageElement).naturalHeight || el.height;
      if (!natW || !natH) return null;

      // Offscreen canvas sized to a sampling resolution. Bumped from
      // 200 to 400 so the bbox edges line up with the actual shirt
      // silhouette — at 200px each sample represented ~2px of the real
      // photo, which caused visible misalignment on the "Center on
      // garment" button for narrow or slim-fit products.
      const SAMPLE = 400;
      const sw = SAMPLE;
      const sh = Math.round(SAMPLE * (natH / natW));
      const off = document.createElement('canvas');
      off.width = sw; off.height = sh;
      const ctx = off.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(el as CanvasImageSource, 0, 0, sw, sh);
      const img = ctx.getImageData(0, 0, sw, sh).data;

      // Tighter thresholds: alpha < 200 = transparent-ish, luminance >
      // 245 = paper-white background. Catches subtle background shadows
      // that the old 235 cutoff was including as "garment" pixels.
      let minX = sw, maxX = 0, minY = sh, maxY = 0, hit = 0;
      for (let y = 0; y < sh; y += 1) {
        for (let x = 0; x < sw; x += 1) {
          const i = (y * sw + x) * 4;
          const r = img[i], g = img[i + 1], b = img[i + 2], a = img[i + 3];
          if (a < 200) continue;                     // transparent
          const lum = (r * 299 + g * 587 + b * 114) / 1000;
          if (lum > 245) continue;                   // paper-white background
          // Skip pixels that are near-white AND near-neutral saturation
          // (catches JPEG halo around the shirt on very light backgrounds)
          const maxChan = Math.max(r, g, b), minChan = Math.min(r, g, b);
          const sat = maxChan === 0 ? 0 : (maxChan - minChan) / maxChan;
          if (lum > 230 && sat < 0.05) continue;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          hit++;
        }
      }
      if (hit < 200) return null; // not enough signal — skip

      // Map sample coordinates back to canvas coordinates.
      // The fabric image is centered with uniform scale = min(W/natW, H/natH).
      const scale = Math.min(W / natW, H / natH);
      const drawnW = natW * scale;
      const drawnH = natH * scale;
      const offX = (W - drawnW) / 2;
      const offY = (H - drawnH) / 2;

      const toCanvasX = (sx: number) => offX + (sx / sw) * drawnW;
      const toCanvasY = (sy: number) => offY + (sy / sh) * drawnH;

      const x = toCanvasX(minX);
      const y = toCanvasY(minY);
      const x2 = toCanvasX(maxX);
      const y2 = toCanvasY(maxY);
      // Convert to percentages of the canvas so the parent can pipe
      // directly into a LogoPlacement { x, y, width } without knowing
      // canvas dimensions.
      const pct = (n: number, total: number) => (n / total) * 100;
      return {
        x:  pct(x,  W),
        y:  pct(y,  H),
        w:  pct(x2 - x, W),
        h:  pct(y2 - y, H),
        cx: pct((x + x2) / 2, W),
        cy: pct((y + y2) / 2, H),
      };
    } catch {
      return null;
    }
  }, []);

  // Resize listener — rebuild canvas when container width changes (phone rotation, etc.)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCanvasKey(k => k + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Emit placement back to parent ──────────────────────────────────────────
  // Keep a ref mirror so fabric event listeners (registered ONCE during init)
  // always call the latest emit — otherwise a stale closure captures the
  // initial logoUrl / onPlacementChange and drags emit the wrong previewUrl
  // after the user uploads a second logo.
  // Toggle logo interactivity when the step changes without rebuilding
  // the fabric object. Locks dragging/resizing when the customer is on
  // the colour or size step — they shouldn't be able to move the logo
  // off the garment outside of the placement step.
  useEffect(() => {
    if (!fc.current || !logoObj.current) return;
    logoObj.current.set('selectable', showPlacementTools);
    logoObj.current.set('evented',    showPlacementTools);
    logoObj.current.set('hasControls', showPlacementTools);
    logoObj.current.set('hasBorders',  showPlacementTools);
    if (!showPlacementTools) fc.current.discardActiveObject?.();
    fc.current.requestRenderAll?.();
  }, [showPlacementTools]);

  // Expose PNG export to parent once the canvas is ready. Parent holds the
  // function so Step 5 "Download mockup" can call it on demand.
  useEffect(() => {
    if (!ready || !onSnapshotReady) return;
    onSnapshotReady(() => {
      if (!fc.current) return null;
      try {
        // Clear active selection so no corner handles end up baked into the PNG
        fc.current.discardActiveObject?.();
        fc.current.renderAll();
        return fc.current.toDataURL({ format: 'png', quality: 0.95, multiplier: 2 });
      } catch {
        return null;
      }
    });
  }, [ready, onSnapshotReady]);

  const emit = useCallback((obj: FabricObj, zone: string) => {
    if (!fc.current || !obj) return;
    const W = fc.current.width as number;
    const H = fc.current.height as number;
    // Logo objects now use originX/Y=center (iter fix) so obj.left/top
    // ARE the center already. Old code added width/2 which over-shifted
    // the emitted placement — a no-op on objects still using top-left
    // origin (like text), but we want a single source of truth.
    const originX = (obj as unknown as { originX?: string }).originX;
    const originY = (obj as unknown as { originY?: string }).originY;
    const cx = originX === 'center'
      ? (obj.left ?? 0)
      : (obj.left ?? 0) + ((obj.width ?? 0) * (obj.scaleX ?? 1)) / 2;
    const cy = originY === 'center'
      ? (obj.top ?? 0)
      : (obj.top ?? 0) + ((obj.height ?? 0) * (obj.scaleY ?? 1)) / 2;
    onPlacementChange({
      zoneId: zone,
      mode: zone === 'manual' ? 'manual' : 'preset',
      x: (cx / W) * 100,
      y: (cy / H) * 100,
      width: ((obj.width ?? 0) * (obj.scaleX ?? 1) / W) * 100,
      rotation: obj.angle ?? 0,
      previewUrl: logoUrl ?? undefined,
    });
  }, [logoUrl, onPlacementChange]);
  const emitRef = useRef(emit);
  emitRef.current = emit;

  // ── Swap photo + tint in-place when garment color or view changes,
  //    WITHOUT rebuilding canvas. This preserves the user's logo placement
  //    perfectly across color picks. (Init effect runs only on first mount
  //    or explicit resize.)
  useEffect(() => {
    if (!fc.current || !ready) return;
    let disposed = false;
    import('fabric').then(({ fabric }) => {
      if (disposed || !fc.current) return;
      const canvas = fc.current;
      const W = canvas.width as number;
      const H = canvas.height as number;
      const photoUrl = activeView === 'front' ? imageDevant : imageDos;

      // Replace existing photo. Dispose the fabric object too so the
      // underlying HTMLImageElement can be garbage-collected; otherwise
      // repeated color swaps accumulate DOM nodes.
      if (photoObj.current) {
        canvas.remove(photoObj.current);
        try { photoObj.current.dispose?.(); } catch { /* noop */ }
        photoObj.current = null;
      }
      if (tintObj.current) {
        canvas.remove(tintObj.current);
        tintObj.current = null;
      }

      // Probe first so we catch load failures (back photo may 404 even
      // if front loaded fine). fabric.Image.fromURL silently fails on
      // error which leaves the canvas visibly blank with no explanation.
      const probe = new Image();
      probe.crossOrigin = 'anonymous';
      probe.onerror = () => {
        if (disposed) return;
        setImgError(true);
      };
      probe.onload = () => {
        if (disposed || !fc.current) return;
        setImgError(false);
        fabric.Image.fromURL(
          photoUrl,
          (img: FabricObj) => {
            if (disposed || !fc.current) return;
            const sx = W / (img.width ?? W);
            const sy = H / (img.height ?? H);
            const scale = Math.min(sx, sy);
            img.set({
              left: (W - (img.width ?? W) * scale) / 2,
              top:  (H - (img.height ?? H) * scale) / 2,
              scaleX: scale, scaleY: scale,
              selectable: false, evented: false,
              lockMovementX: true, lockMovementY: true,
              hoverCursor: 'default',
            });
            canvas.add(img);
            canvas.sendToBack(img);
            photoObj.current = img;

            // Report garment bbox to parent so centering buttons land on
            // the actual shirt body (not canvas whitespace).
            {
              const b = analyzeBboxFromFabricImage(img);
              setLocalBbox(b ? { cx: b.cx, cy: b.cy } : null);
              onBboxDetected?.(b);
            }

          // Tint only if no real per-color photo. Opacity is adaptive to
          // the garment's luminance — dark colors need a stronger tint to
          // register, light colors need a softer one so they don't wash
          // the photo out completely.
          if (garmentColor && !hasRealColorImage) {
            const hex = garmentColor.replace('#', '');
            let tintOpacity = 0.35;
            if (hex.length >= 6) {
              const r = parseInt(hex.slice(0, 2), 16);
              const g = parseInt(hex.slice(2, 4), 16);
              const b = parseInt(hex.slice(4, 6), 16);
              const lum = (r * 299 + g * 587 + b * 114) / 1000;
              // Map luminance 0..255 → opacity 0.22..0.55
              tintOpacity = Math.max(0.22, Math.min(0.55, 0.55 - (lum / 255) * 0.33));
            }
            const tint = new fabric.Rect({
              left: 0, top: 0, width: W, height: H,
              fill: garmentColor,
              opacity: tintOpacity,
              globalCompositeOperation: 'multiply',
              selectable: false, evented: false,
            });
            canvas.add(tint);
            tintObj.current = tint;
          }

          // Update print-zone outline contrast based on (new) garment color
          if (maskRef.current && garmentColor) {
            const hex = garmentColor.replace('#', '');
            if (hex.length >= 6) {
              const r = parseInt(hex.slice(0, 2), 16);
              const g = parseInt(hex.slice(2, 4), 16);
              const b = parseInt(hex.slice(4, 6), 16);
              const isLight = (r * 299 + g * 587 + b * 114) / 1000 > 160;
              maskRef.current.set('stroke', isLight ? 'rgba(0, 82, 204, 0.55)' : 'rgba(255, 255, 255, 0.65)');
            }
          }

          // Zone outline stays visible on BOTH front and back so the user
          // can see the safe print area on whichever side they're editing.
          // (Logo is driven by the parent's per-side logoUrl prop, so
          // it naturally flips when activeView changes.)
          if (maskRef.current) {
            maskRef.current.set('visible', true);
          }

          // Show text objects only for the active view — text added on
          // the back must not render on top of the front photo, and
          // vice-versa.
          textObjects.current.forEach(t => {
            const belongsHere = t.side === activeView;
            t.set('visible', belongsHere);
            t.set('selectable', belongsHere);
            t.set('evented', belongsHere);
          });

            // Layer order: photo → tint → outline → logo → text
            if (maskRef.current) canvas.bringToFront(maskRef.current);
            if (logoObj.current) canvas.bringToFront(logoObj.current);
            textObjects.current.forEach((t) => {
              if (t.side === activeView) canvas.bringToFront(t);
            });
            canvas.renderAll();
          },
          { crossOrigin: 'anonymous' },
        );
      };
      probe.src = photoUrl;
    });
    return () => { disposed = true; };
    // Only fires on color/view/photo change — NOT on canvasKey (resize) or first mount
    // (init effect handles the very first photo load)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageDevant, imageDos, activeView, garmentColor, hasRealColorImage]);

  // ── Init Fabric canvas + load photo + add mask ────────────────────────────
  useEffect(() => {
    if (!canvasElRef.current || !containerRef.current) return;
    let disposed = false;
    setImgError(false);
    setReady(false);

    import('fabric').then(({ fabric }) => {
      if (disposed) return;
      if (fc.current) { fc.current.dispose(); fc.current = null; }

      const W = containerRef.current!.clientWidth || 360;
      // Adaptive aspect ratio — on narrow phones the canvas stays
      // portrait (tall) so the garment isn't squashed into a square;
      // on desktop it's closer to 4:3 so the footer fits without
      // scrolling. Threshold is ~tablet width.
      const ratio = W < 500 ? 1.2 : W < 900 ? 1.05 : 0.78;
      const H = Math.round(W * ratio);

      const canvas = new fabric.Canvas(canvasElRef.current!, {
        width: W, height: H,
        backgroundColor: '#F4F3EF',
        selection: false,
        preserveObjectStacking: true,
        // Crisp rendering on high-DPI displays
        enableRetinaScaling: true,
      });
      fc.current = canvas;
      maskRef.current = null;
      logoObj.current = null;
      photoObj.current = null;
      tintObj.current = null;

      const photoUrl = activeView === 'front' ? imageDevant : imageDos;

      // Pre-load with a regular Image so we can detect failures fast
      const probe = new Image();
      probe.crossOrigin = 'anonymous';
      probe.onerror = () => {
        if (disposed) return;
        setImgError(true);
        setReady(true);
      };
      probe.onload = () => {
        if (disposed || !fc.current) return;
        fabric.Image.fromURL(
          photoUrl,
          (img: FabricObj) => {
            if (disposed || !fc.current) return;
            // object-contain — never crop the garment
            const sx = W / (img.width ?? W);
            const sy = H / (img.height ?? H);
            const scale = Math.min(sx, sy);
            img.set({
              left: (W - (img.width ?? W) * scale) / 2,
              top:  (H - (img.height ?? H) * scale) / 2,
              scaleX: scale, scaleY: scale,
              selectable: false, evented: false,
              lockMovementX: true, lockMovementY: true,
              hoverCursor: 'default',
            });
            canvas.add(img);
            canvas.sendToBack(img);
            photoObj.current = img;

            // Report garment bbox to parent on first photo load too.
            {
              const b = analyzeBboxFromFabricImage(img);
              setLocalBbox(b ? { cx: b.cx, cy: b.cy } : null);
              onBboxDetected?.(b);
            }

            // Colour tint overlay — only when we DON'T have a real per-colour photo.
            // When hasRealColorImage is true, the loaded photo IS the right colour already.
            if (garmentColor && !hasRealColorImage) {
              const tint = new fabric.Rect({
                left: 0, top: 0, width: W, height: H,
                fill: garmentColor,
                opacity: 0.35,
                globalCompositeOperation: 'multiply',
                selectable: false, evented: false,
              });
              canvas.add(tint);
              tintObj.current = tint;
            }

            // Print-zone outline — adaptive contrast so it's visible on
            // both dark AND light garments. Shown on BOTH front and back
            // so the user knows where the safe area is when placing a
            // back-side logo. (Previously only on front.)
            {
              const zone = product.printZones[0];
              if (zone) {
                const isLightGarment = (() => {
                  if (!garmentColor) return false;
                  // Quick luminance estimate from hex
                  const hex = garmentColor.replace('#', '');
                  if (hex.length < 6) return false;
                  const r = parseInt(hex.slice(0, 2), 16);
                  const g = parseInt(hex.slice(2, 4), 16);
                  const b = parseInt(hex.slice(4, 6), 16);
                  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
                })();
                const outline = new fabric.Rect({
                  left: (zone.x / 100) * W,
                  top:  (zone.y / 100) * H,
                  width:  (zone.width  / 100) * W,
                  height: (zone.height / 100) * H,
                  fill: 'transparent',
                  stroke: isLightGarment ? 'rgba(0, 82, 204, 0.55)' : 'rgba(255, 255, 255, 0.65)',
                  strokeDashArray: [6, 4],
                  strokeWidth: 1.5,
                  // Keeps stroke crisp at 1.5px even if outline is scaled later
                  strokeUniform: true,
                  rx: 8, ry: 8,
                  selectable: false, evented: false,
                });
                canvas.add(outline);
                maskRef.current = outline;
              }
            }

            setReady(true);
            canvas.renderAll();
          },
          { crossOrigin: 'anonymous' },
        );
      };
      probe.src = photoUrl;

      // ── Photoshop-style alignment guides + snap-to-center ───────────────
      const SNAP_TOLERANCE = 8; // pixels
      const guideX = new fabric.Line([W / 2, 0, W / 2, H], {
        stroke: '#0052CC',
        strokeWidth: 1,
        strokeDashArray: [4, 4],
        selectable: false,
        evented: false,
        opacity: 0,
        excludeFromExport: true,
      });
      const guideY = new fabric.Line([0, H / 2, W, H / 2], {
        stroke: '#0052CC',
        strokeWidth: 1,
        strokeDashArray: [4, 4],
        selectable: false,
        evented: false,
        opacity: 0,
        excludeFromExport: true,
      });
      canvas.add(guideX);
      canvas.add(guideY);

      const updateGuides = (target: { left?: number; top?: number; setCoords?: () => void }) => {
        // Snap to the DETECTED garment center when we have a bbox —
        // otherwise fall back to canvas center. Matches the auto-place
        // behaviour so 'snapped to center' actually means 'centered on
        // the garment' instead of 'centered on the photo frame'.
        const bbox = bboxRef.current;
        const cx = bbox ? (bbox.cx / 100) * W : W / 2;
        const cy = bbox ? (bbox.cy / 100) * H : H / 2;
        const left = target.left ?? 0;
        const top = target.top ?? 0;

        const snapToX = Math.abs(left - cx) <= SNAP_TOLERANCE;
        const snapToY = Math.abs(top - cy) <= SNAP_TOLERANCE;

        if (snapToX) {
          target.left = cx;
          // Reposition the vertical guide to the actual garment center
          // so the visible dashed line matches the snap point.
          guideX.set({ x1: cx, x2: cx, opacity: 1 });
        } else {
          guideX.set('opacity', 0);
        }
        if (snapToY) {
          target.top = cy;
          guideY.set({ y1: cy, y2: cy, opacity: 1 });
        } else {
          guideY.set('opacity', 0);
        }

        target.setCoords?.();
      };

      const hideGuides = () => {
        guideX.set('opacity', 0);
        guideY.set('opacity', 0);
        canvas.requestRenderAll();
      };

      // Wire up modification → emit placement + guides. Use emitRef so
      // listeners always call the LATEST emit (emit captures logoUrl, so a
      // stale closure would emit the wrong previewUrl after a re-upload).
      //
      // During drag we rAF-throttle emits: parent state updates at ~60Hz
      // cause noticeable jank on low-end phones. requestAnimationFrame
      // gives us one emit per frame max, while object:modified (drag end)
      // still fires synchronously so the final position is always exact.
      let moveRafId: number | null = null;
      canvas.on('object:moving', (e: { target?: FabricObj }) => {
        if (e.target) updateGuides(e.target);
        if (moveRafId != null) return;
        moveRafId = requestAnimationFrame(() => {
          moveRafId = null;
          if (logoObj.current) emitRef.current(logoObj.current, 'manual');
        });
      });
      canvas.on('object:modified', () => {
        if (moveRafId != null) {
          cancelAnimationFrame(moveRafId);
          moveRafId = null;
        }
        hideGuides();
        if (logoObj.current) emitRef.current(logoObj.current, zoneIdRef.current);
      });
      canvas.on('mouse:up', hideGuides);
      canvas.on('selection:cleared', hideGuides);
    });

    return () => {
      disposed = true;
      fc.current?.dispose();
      fc.current = null;
    };
    // Init effect: only fires on first mount + on canvas resize.
    // Photo/color/view changes are handled by the swap-in-place effect above
    // so the user's logo placement survives a color pick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasKey]);

  // ── Place / replace the user's logo whenever it changes ───────────────────
  useEffect(() => {
    if (!ready || !fc.current) return;
    // When logoUrl is null, remove any existing logo from the canvas.
    // This matters when the user toggles to the back view in "Front only"
    // mode — the parent passes null, we clean up the fabric object.
    if (!logoUrl) {
      if (logoObj.current && fc.current) {
        fc.current.remove(logoObj.current);
        logoObj.current = null;
        fc.current.requestRenderAll();
      }
      return;
    }
    let disposed = false;

    import('fabric').then(({ fabric }) => {
      if (disposed || !fc.current) return;
      const canvas = fc.current;

      if (logoObj.current) { canvas.remove(logoObj.current); logoObj.current = null; }

      const W = canvas.width as number;
      const H = canvas.height as number;

      // If the user already placed the logo, restore that position.
      // Otherwise, default to the zone center.
      const hasExistingPlacement = currentPlacement?.x != null && currentPlacement?.y != null;
      let cx: number, cy: number, initWidthPct: number;

      if (hasExistingPlacement) {
        cx = (currentPlacement!.x! / 100) * W;
        cy = (currentPlacement!.y! / 100) * H;
        initWidthPct = (currentPlacement!.width ?? 26) / 100;
      } else {
        const zone = product.printZones.find(z => z.id === zoneId) ?? product.printZones[0];
        cx = W / 2; cy = H * 0.36; initWidthPct = 0.26;
        if (zone) {
          cx = (zone.x / 100) * W + (zone.width  / 100) * W / 2;
          cy = (zone.y / 100) * H + (zone.height / 100) * H / 2;
          initWidthPct = (zone.width / 100) * 0.85;
        }
      }

      fabric.Image.fromURL(
        logoUrl,
        (img: FabricObj & { setControlsVisibility?: (v: Record<string, boolean>) => void }) => {
          if (disposed || !fc.current) return;
          const targetW = W * initWidthPct;
          const naturalW = img.width ?? 100;
          const s = targetW / naturalW;
          img.set({
            // Use originX/Y=center so left/top are the CENTER of the logo,
            // not its top-left corner. The old math (cx - width*s/2)
            // returned NaN/wrong position when img.width was 0 or late-
            // resolved, visibly shifting the logo left-ish from where
            // the user aimed. Matches the IText object's origin too.
            originX: 'center', originY: 'center',
            left: cx,
            top:  cy,
            scaleX: s, scaleY: s,
            angle: currentPlacement?.rotation ?? 0,
            // Logo is only draggable / selectable during the placement
            // step ("Where to print"). On other steps it's locked so
            // the user can't accidentally shove it off the garment.
            selectable: showPlacementTools,
            evented:    showPlacementTools,
            hasControls: showPlacementTools,
            hasBorders:  showPlacementTools,
            cornerStyle: 'circle', cornerSize: 12,
            cornerColor: '#FFFFFF', borderColor: '#FFFFFF',
            borderScaleFactor: 2, transparentCorners: false,
            // CRITICAL: uniform-only scaling so logos can never deform
            lockUniScaling: true,
            lockScalingFlip: true,
            centeredScaling: false,
          });
          // Hide middle handles entirely → users can ONLY scale from corners
          img.setControlsVisibility({
            mt: false, mb: false, ml: false, mr: false,
            tl: true, tr: true, bl: true, br: true,
            mtr: true,
          });
          canvas.add(img);
          canvas.setActiveObject(img);
          canvas.bringToFront(img);
          canvas.renderAll();
          logoObj.current = img;
          emit(img, zoneId);
        },
        { crossOrigin: 'anonymous' },
      );
    });

    return () => { disposed = true; };
    // NOTE: zoneId is intentionally NOT a dep. When the user picks a zone
    // preset, selectZone() already moves the logo in place and emits the
    // new position. Including zoneId here would cause a full remove+re-add
    // cycle (visible flicker). The init effect sets up the initial zoneId
    // state and the reposition effect below keeps position/scale in sync.
  }, [ready, logoUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Re-position existing logo when parent updates placement (e.g. center
  //    button click). Does NOT rebuild — just moves the existing fabric
  //    object so center/zone presets work in real time.
  useEffect(() => {
    if (!fc.current || !logoObj.current || !currentPlacement) return;
    if (currentPlacement.x == null || currentPlacement.y == null) return;
    const canvas = fc.current;
    const W = canvas.width as number;
    const H = canvas.height as number;
    const img = logoObj.current;
    const targetX = (currentPlacement.x / 100) * W;
    const targetY = (currentPlacement.y / 100) * H;

    if (currentPlacement.width != null) {
      const targetW = (currentPlacement.width / 100) * W;
      const naturalW = img.width ?? 100;
      const newScale = targetW / naturalW;
      img.set({ scaleX: newScale, scaleY: newScale });
    }
    img.set({
      left: targetX - (img.width ?? 0) * (img.scaleX ?? 1) / 2,
      top:  targetY - (img.height ?? 0) * (img.scaleY ?? 1) / 2,
      angle: currentPlacement.rotation ?? img.angle ?? 0,
    });
    img.setCoords?.();
    canvas.requestRenderAll?.();
    // Tracking individual fields intentionally — a new currentPlacement object
    // every render would retrigger the effect and fight the user's drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlacement?.x, currentPlacement?.y, currentPlacement?.width, currentPlacement?.rotation]);

  // ── Zone preset selector ──────────────────────────────────────────────────
  const selectZone = useCallback((zone: PrintZone) => {
    setZoneId(zone.id);
    if (!fc.current) return;
    const canvas = fc.current;
    const W = canvas.width as number;
    const H = canvas.height as number;

    // Move the print-zone outline too
    if (maskRef.current && activeView === 'front') {
      maskRef.current.set({
        left: (zone.x / 100) * W,
        top:  (zone.y / 100) * H,
        width:  (zone.width  / 100) * W,
        height: (zone.height / 100) * H,
      });
    }

    if (logoObj.current) {
      const obj = logoObj.current;
      const cx = (zone.x / 100) * W + (zone.width  / 100) * W / 2;
      const cy = (zone.y / 100) * H + (zone.height / 100) * H / 2;
      const targetW = (zone.width / 100) * W * 0.88;
      const ns = targetW / (obj.width ?? 100);
      obj.set({
        left: cx - (obj.width  ?? 0) * ns / 2,
        top:  cy - (obj.height ?? 0) * ns / 2,
        scaleX: ns, scaleY: ns,
      });
      canvas.setActiveObject(obj);
      canvas.bringToFront(obj);
      emit(obj, zone.id);
    }
    canvas.renderAll();
  }, [emit, activeView]);

  // ── Toolbar actions ───────────────────────────────────────────────────────
  const snapLeft = () => {
    if (!logoObj.current || !fc.current) return;
    logoObj.current.set({ left: (fc.current.width as number) * 0.07 });
    fc.current.renderAll(); emit(logoObj.current, 'manual');
  };
  const snapCenter = () => {
    if (!logoObj.current || !fc.current) return;
    const obj = logoObj.current;
    obj.set({ left: ((fc.current.width as number) - (obj.width ?? 0) * (obj.scaleX ?? 1)) / 2 });
    fc.current.renderAll(); emit(obj, zoneId);
  };
  const snapRight = () => {
    if (!logoObj.current || !fc.current) return;
    const obj = logoObj.current;
    obj.set({ left: (fc.current.width as number) * 0.93 - (obj.width ?? 0) * (obj.scaleX ?? 1) });
    fc.current.renderAll(); emit(obj, 'manual');
  };
  const rotate = () => {
    if (!logoObj.current || !fc.current) return;
    logoObj.current.set({ angle: ((logoObj.current.angle ?? 0) + 15) % 360 });
    fc.current.renderAll(); emit(logoObj.current, zoneId);
  };
  const rescale = (delta: number) => {
    if (!logoObj.current || !fc.current) return;
    const s = Math.max(0.04, Math.min(1.6, (logoObj.current.scaleX ?? 0.25) + delta));
    logoObj.current.set({ scaleX: s, scaleY: s });
    fc.current.renderAll(); emit(logoObj.current, zoneId);
  };
  const removeLogo = () => {
    if (!logoObj.current || !fc.current) return;
    fc.current.remove(logoObj.current);
    logoObj.current = null;
    fc.current.renderAll();
    onPlacementChange({ zoneId, mode: 'preset', previewUrl: undefined });
  };

  // ── Add text to garment ──────────────────────────────────────────────────
  const addText = (
    text: string,
    color = '#FFFFFF',
    fontFamily = 'Inter, system-ui, sans-serif',
  ) => {
    if (!fc.current || !text.trim()) return;
    import('fabric').then(({ fabric }) => {
      if (!fc.current) return;
      const canvas = fc.current;
      const W = canvas.width as number;
      const H = canvas.height as number;
      const zone = product.printZones[0];
      const cx = zone ? (zone.x / 100) * W + (zone.width / 100) * W / 2 : W / 2;
      const cy = zone ? (zone.y / 100) * H + (zone.height / 100) * H / 2 + 40 : H / 2;

      // Auto-contrast stroke so text stays readable on any garment.
      // Light text gets a subtle dark halo, dark text a light halo.
      const hex = color.replace('#', '');
      const isLightText = hex.length >= 6
        ? (parseInt(hex.slice(0, 2), 16) * 299 +
           parseInt(hex.slice(2, 4), 16) * 587 +
           parseInt(hex.slice(4, 6), 16) * 114) / 1000 > 160
        : false;
      // Adaptive font size: scales with canvas width but shrinks for
      // long strings so a 30-char "SUPPORT YOUR LOCAL ARTISTS" doesn't
      // overflow the garment on a phone.
      const baseSize = W * 0.06;
      const lengthFactor = Math.max(0.5, Math.min(1, 14 / Math.max(1, text.length)));
      const fontSize = Math.max(14, Math.round(baseSize * lengthFactor));

      const id = `txt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const t = new fabric.IText(text, {
        left: cx, top: cy,
        originX: 'center', originY: 'center',
        fontFamily,
        fontSize,
        fontWeight: 'bold',
        fill: color,
        stroke: isLightText ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.35)',
        strokeWidth: 1,
        strokeUniform: true,
        paintFirst: 'stroke',
        textAlign: 'center',
        editable: true,
        selectable: true,
        hasControls: true,
        lockUniScaling: true,
        cornerStyle: 'circle', cornerSize: 12,
        cornerColor: '#FFFFFF', borderColor: '#FFFFFF',
        transparentCorners: false,
      });
      t.setControlsVisibility({ mt: false, mb: false, ml: false, mr: false });
      // Tag the fabric object with the side it was created for. The
      // swap-in-place effect uses this to show/hide it when activeView
      // changes, so text on the back doesn't bleed onto the front view.
      const side = activeView;
      (t as FabricObj & { side: ProductView }).side = side;
      canvas.add(t);
      canvas.setActiveObject(t);
      canvas.bringToFront(t);
      canvas.renderAll();
      textObjects.current.set(id, t as FabricObj & { side: ProductView });
      setTextAssets(prev => [...prev, { id, text, color, side }]);
    });
  };

  const removeTextAsset = (id: string) => {
    const obj = textObjects.current.get(id);
    if (obj && fc.current) {
      fc.current.remove(obj);
      fc.current.renderAll();
    }
    textObjects.current.delete(id);
    setTextAssets(prev => prev.filter(t => t.id !== id));
  };

  // Delete/Backspace key removes the currently selected canvas object.
  // (Skips when user is typing in an IText — fabric.js handles editing
  // mode separately so backspace inside an editing text won't nuke it.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!fc.current) return;
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const active = fc.current.getActiveObject();
      if (!active) return;
      // Don't delete the photo, tint, or print-zone outline
      if (active === photoObj.current || active === tintObj.current || active === maskRef.current) return;
      // If it's a text we tracked, also remove from our state
      const textId = Array.from(textObjects.current.entries()).find(([, obj]) => obj === active)?.[0];
      if (textId) {
        removeTextAsset(textId);
      } else if (active === logoObj.current) {
        fc.current.remove(active);
        logoObj.current = null;
        fc.current.renderAll();
      } else {
        fc.current.remove(active);
        fc.current.renderAll();
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // removeTextAsset is stable within a render; a dep here would just force
    // us to memoize it for no behavioural gain. The handler always reads
    // fresh state via refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-2.5">
      {/* The interactive canvas — premium frame with subtle gradient + drop shadow */}
      {/* aspectRatio syncs with the JS ratio above: narrow = 1/1.2 (tall)
          on phones, widescreen on desktop. CSS-only so there's no flash
          before JS kicks in. */}
      <div
        ref={containerRef}
        className="relative rounded-2xl overflow-hidden border border-border bg-gradient-to-br from-[#F8F7F3] via-[#F4F3EF] to-[#EDEAE3] shadow-[0_8px_32px_rgba(27,58,107,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] aspect-[5/6] md:aspect-[1/1.05] lg:aspect-[1.28/1]"
      >
        {/* Subtle radial accent in the corner — looks like studio lighting */}
        <div
          className="absolute top-0 right-0 w-1/2 h-1/2 pointer-events-none opacity-40"
          style={{ background: 'radial-gradient(circle at 70% 30%, rgba(255,255,255,0.7) 0%, transparent 60%)' }}
          aria-hidden="true"
        />
        <canvas ref={canvasElRef} className="relative w-full h-full block" style={{ touchAction: 'none' }} />

        {/* Centre crosshair — ONLY shown while the user is previewing the
            Auto-center option so they can verify it lands on the shirt,
            not on whitespace. Positioned in canvas % so it tracks even
            when the container resizes. */}
        {showBboxCenter && localBbox && (
          <div
            className="absolute pointer-events-none"
            style={{ left: `${localBbox.cx}%`, top: `${localBbox.cy}%`, transform: 'translate(-50%, -50%)' }}
            aria-hidden="true"
          >
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full bg-[#0052CC]/20 animate-ping" />
              <div className="absolute inset-[30%] rounded-full bg-[#0052CC] shadow-[0_0_0_3px_rgba(255,255,255,0.9)]" />
              <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[#0052CC]/60" />
              <div className="absolute top-1/2 left-0 w-full h-px -translate-y-1/2 bg-[#0052CC]/60" />
            </div>
          </div>
        )}

        {imgError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2">
            <ImageOff size={28} />
            <span className="text-xs">{lang === 'en' ? 'Image unavailable' : 'Image indisponible'}</span>
          </div>
        )}

        {/* Hint when no logo yet */}
        {ready && !logoUrl && !imgError && (
          <div className="absolute inset-x-0 bottom-3 flex items-center justify-center pointer-events-none">
            <div className="px-3.5 py-1.5 rounded-full bg-black/60 backdrop-blur-sm flex items-center gap-1.5">
              <Move className="w-3 h-3 text-white" />
              <p className="text-[11px] text-white font-bold">
                {lang === 'en' ? 'Upload your logo to start' : 'Téléverse ton logo pour commencer'}
              </p>
            </div>
          </div>
        )}

        {/* Front / Back toggle — sits on the canvas, top-right */}
        <div
          className="absolute top-3 right-3 flex items-center gap-1 bg-white/95 backdrop-blur-sm rounded-full p-0.5 border border-border shadow-sm"
          role="tablist"
          aria-label={lang === 'en' ? 'Garment view' : 'Vue du vêtement'}
        >
          {(['front', 'back'] as const).map(v => {
            const hasArt = v === 'front' ? hasLogoPerSide?.front : hasLogoPerSide?.back;
            const sideLabel = v === 'front'
              ? (lang === 'en' ? 'Show front' : 'Voir le devant')
              : (lang === 'en' ? 'Show back'  : 'Voir le dos');
            return (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={activeView === v}
                aria-label={hasArt
                  ? `${sideLabel} (${lang === 'en' ? 'has artwork' : 'avec art'})`
                  : sideLabel}
                onClick={() => onViewChange(v)}
                className={`relative text-[10px] font-extrabold px-2.5 py-1 rounded-full transition-all ${
                  activeView === v
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {v === 'front' ? t('devant') : t('dos')}
                {hasArt && (
                  <span
                    className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-white ${
                      activeView === v ? 'bg-emerald-300' : 'bg-emerald-500'
                    }`}
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Color-sync badge — confirms the photo really matches the picked
            color. Only shown on the FRONT view because hasRealColorImage
            is derived from imageDevant; on the back side we can't
            truthfully claim "real color" without a per-color back image. */}
        {hasRealColorImage && activeView === 'front' && (
          <div className="absolute top-3 left-3 bg-emerald-600/95 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-white" />
            {lang === 'en' ? 'Real color' : 'Vraie couleur'}
          </div>
        )}

        {/* Logo placed badge */}
        <AnimatePresence>
          {logoUrl && activeView === 'front' && (
            <motion.div
              initial={{ opacity:0, scale:0.85 }}
              animate={{ opacity:1, scale:1 }}
              exit={{ opacity:0 }}
              className="absolute top-3 left-3 bg-green-700/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-full"
              style={{ top: hasRealColorImage ? '38px' : '12px' }}
            >
              {t('logoPlace')}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* NOTE: canvas-bottom zone grid intentionally removed — the "Where
          to print" step already has a richer zone picker with pricing.
          Keeping both caused UI duplication and state-divergence bugs. */}

      {/* Alignment & transform toolbar — only while the user is actively
          placing the logo (Step "Where") and there IS a logo. Buttons use
          w-10 h-10 (40px) to meet WCAG touch-target guidance; each has
          aria-label for screen readers. Shown on BOTH front and back —
          back-side placements need the same alignment tools. */}
      {showPlacementTools && logoUrl && (
        <div className="flex items-center justify-between bg-secondary rounded-xl px-2 py-1.5 border border-border">
          <div className="flex gap-0.5">
            {[
              { icon: AlignLeft,   label: lang === 'en' ? 'Align left'   : 'Aligner à gauche',  fn: snapLeft   },
              { icon: AlignCenter, label: lang === 'en' ? 'Align center' : 'Centrer',           fn: snapCenter },
              { icon: AlignRight,  label: lang === 'en' ? 'Align right'  : 'Aligner à droite',  fn: snapRight  },
            ].map(({ icon: Icon, label, fn }) => (
              <button
                key={label}
                type="button"
                onClick={fn}
                title={label}
                aria-label={label}
                className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background transition-all"
              >
                <Icon size={14} />
              </button>
            ))}
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex gap-0.5">
            {[
              { icon: ZoomOut,   label: lang === 'en' ? 'Smaller' : 'Réduire',  fn: () => rescale(-0.06) },
              { icon: ZoomIn,    label: lang === 'en' ? 'Bigger'  : 'Agrandir', fn: () => rescale(0.06)  },
              { icon: RotateCcw, label: lang === 'en' ? 'Rotate +15°' : 'Rotation +15°', fn: rotate },
            ].map(({ icon: Icon, label, fn }) => (
              <button
                key={label}
                type="button"
                onClick={fn}
                title={label}
                aria-label={label}
                className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background transition-all"
              >
                <Icon size={14} />
              </button>
            ))}
          </div>
          <div className="w-px h-4 bg-border" />
          <button
            type="button"
            onClick={removeLogo}
            title={lang === 'en' ? 'Remove logo' : 'Supprimer le logo'}
            aria-label={lang === 'en' ? 'Remove logo' : 'Supprimer le logo'}
            className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-background transition-all"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}

      {/* Assets panel — shows added texts with delete. Visible only while
          placing so it doesn't clutter the color / sizes / review steps.
          Filters to the currently visible side so the list reflects what
          the user actually sees on the canvas. */}
      {(() => {
        const visibleAssets = textAssets.filter(a => a.side === activeView);
        if (!showPlacementTools || visibleAssets.length === 0) return null;
        return (
        <div className="bg-secondary/60 border border-border rounded-xl p-2 space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1 flex items-center justify-between">
            <span>
              {lang === 'en'
                ? `${visibleAssets.length} text element${visibleAssets.length > 1 ? 's' : ''}`
                : `${visibleAssets.length} élément${visibleAssets.length > 1 ? 's' : ''} texte`}
            </span>
            <span className="font-normal normal-case tracking-normal text-[9px]">
              {activeView === 'front'
                ? (lang === 'en' ? 'on Front' : 'au Devant')
                : (lang === 'en' ? 'on Back'  : 'au Dos')}
            </span>
          </div>
          {visibleAssets.map(a => (
            <div key={a.id} className="flex items-center gap-2 bg-background rounded-lg px-2 py-1.5">
              <span className="w-3 h-3 rounded-full ring-1 ring-border flex-shrink-0" style={{ background: a.color }} />
              <span className="flex-1 text-xs font-semibold truncate text-foreground" title={a.text}>{a.text}</span>
              <button
                type="button"
                onClick={() => removeTextAsset(a.id)}
                className="w-6 h-6 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors"
                aria-label={lang === 'en' ? `Remove text ${a.text}` : `Retirer le texte ${a.text}`}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
        );
      })()}

      {/* Add text to garment — during placement, both views. */}
      {showPlacementTools && ready && (
        <div className="space-y-1.5">
          <div className="flex gap-1.5">
            <div className="flex-1 flex items-center gap-1.5 bg-secondary rounded-xl px-2.5 py-1.5 border border-border">
              <Type size={13} className="text-muted-foreground flex-shrink-0" />
              <input
                type="text"
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && textInput.trim()) { addText(textInput, textColor, textFont); setTextInput(''); } }}
                placeholder={lang === 'en' ? 'Add text to garment...' : 'Ajouter du texte...'}
                className="flex-1 bg-transparent text-xs outline-none text-foreground placeholder:text-muted-foreground"
                maxLength={40}
                aria-label={lang === 'en' ? 'Text to add to garment' : 'Texte à ajouter au vêtement'}
              />
              <span
                className={`text-[10px] font-mono flex-shrink-0 ${
                  textInput.length >= 35 ? 'text-amber-600' : 'text-muted-foreground/60'
                }`}
                aria-hidden="true"
              >
                {textInput.length}/40
              </span>
            </div>
            <button
              onClick={() => { if (textInput.trim()) { addText(textInput, textColor, textFont); setTextInput(''); } }}
              disabled={!textInput.trim()}
              className="px-3 py-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-xl disabled:opacity-30 hover:opacity-90 transition-all"
            >
              {lang === 'en' ? 'Add' : 'Ajouter'}
            </button>
          </div>

          {/* Text styling row — only shown when there's something to add */}
          {textInput && (
            <div className="flex items-center gap-2 px-1">
              <div className="flex gap-1" role="radiogroup" aria-label={lang === 'en' ? 'Text font' : 'Police'}>
                {[
                  { id: 'sans',   label: 'Aa', font: 'Inter, system-ui, sans-serif',        readable: 'Sans-serif',      style: { fontFamily: 'Inter, sans-serif' } },
                  { id: 'serif',  label: 'Aa', font: 'Georgia, serif',                      readable: 'Serif',           style: { fontFamily: 'Georgia, serif', fontStyle: 'italic' } },
                  { id: 'impact', label: 'AA', font: 'Impact, "Arial Black", sans-serif',   readable: 'Impact',          style: { fontFamily: 'Impact, sans-serif', letterSpacing: '0.05em' } },
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setTextFont(f.font)}
                    className={`w-7 h-7 rounded-md border text-xs font-bold transition-all ${
                      textFont === f.font ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border hover:border-primary'
                    }`}
                    style={f.style}
                    aria-pressed={textFont === f.font}
                    aria-label={`${lang === 'en' ? 'Font' : 'Police'}: ${f.readable}`}
                    title={f.readable}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="w-px h-5 bg-border" />
              <div className="flex gap-1" role="radiogroup" aria-label={lang === 'en' ? 'Text color' : 'Couleur du texte'}>
                {([
                  { hex: '#FFFFFF', nameFr: 'Blanc',      nameEn: 'White' },
                  { hex: '#000000', nameFr: 'Noir',       nameEn: 'Black' },
                  { hex: '#1B3A6B', nameFr: 'Marine',     nameEn: 'Navy' },
                  { hex: '#E8A838', nameFr: 'Or',         nameEn: 'Gold' },
                  { hex: '#B91C1C', nameFr: 'Rouge',      nameEn: 'Red' },
                ]).map(c => {
                  const label = lang === 'en' ? c.nameEn : c.nameFr;
                  return (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setTextColor(c.hex)}
                      className={`w-5 h-5 rounded-full border-2 transition-all ${
                        textColor === c.hex ? 'ring-2 ring-primary ring-offset-1 scale-110' : 'border-border hover:scale-105'
                      }`}
                      style={{ background: c.hex, borderColor: c.hex === '#FFFFFF' ? '#cbd5e1' : c.hex }}
                      aria-pressed={textColor === c.hex}
                      aria-label={label}
                      title={label}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
