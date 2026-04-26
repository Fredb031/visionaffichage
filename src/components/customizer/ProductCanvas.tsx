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
import { toast } from 'sonner';
import {
  AlignCenter, AlignLeft, AlignRight, RotateCcw, ZoomIn, ZoomOut,
  ImageOff, Move, Trash2, Type, X, Undo2, Redo2,
} from 'lucide-react';
import { pickDefaultZone, type Product, type PrintZone } from '@/data/products';
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
  // Mirror textAssets in a ref so callbacks bound to long-lived handlers
  // (keydown listener registered once at mount, render-props passed to
  // child buttons, fabric.js events) always read the LIVE list instead of
  // the snapshot captured at declaration time. Mirrors the bboxRef
  // pattern from af39f3d — rapid-fire deletes on the asset panel were
  // otherwise racing the re-render and could remove the wrong asset or
  // fail silently when the id had already been pruned in the captured
  // closure but was still visible in the new list.
  const textAssetsRef = useRef(textAssets);
  useEffect(() => { textAssetsRef.current = textAssets; }, [textAssets]);
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
  // Fabric canvas zoom for preview-only zoom controls (corner +/−). Purely
  // a viewport transform — does NOT alter placement math, emitted coords,
  // or the canvas lifecycle. Clamped 0.5–2.0 at a 0.25 step.
  const [zoomLevel, setZoomLevel] = useState(1);
  // Local mirror of the detected bbox so we can render a centre crosshair
  // over the canvas without asking the parent to feed it back.
  const [localBbox, setLocalBbox] = useState<{ cx: number; cy: number } | null>(null);
  // Ref mirror so the drag-snap handler (registered once at canvas init)
  // reads live bbox values instead of the snapshot captured when the
  // effect first ran. Otherwise snap-to-center always targets canvas
  // 50,50 even after the real garment center is detected.
  const bboxRef = useRef<{ cx: number; cy: number } | null>(null);
  bboxRef.current = localBbox;
  // Ref mirror of currentPlacement so the logo re-add effect (deps
  // [ready, logoUrl]) reads the LIVE placement instead of whatever was
  // captured in its closure. Without this, a rapid resize in the middle
  // of a drag would fire the effect with a stale currentPlacement and
  // snap the logo back to its pre-drag coordinates. Same pattern as
  // bboxRef / textAssetsRef / zoneIdRef.
  const currentPlacementRef = useRef(currentPlacement);
  useEffect(() => { currentPlacementRef.current = currentPlacement; }, [currentPlacement]);

  // ── Undo / redo history ─────────────────────────────────────────────────
  // Snapshot-based: push `canvas.toJSON()` strings onto `past` every time a
  // user action mutates the canvas (logo add/move/resize/delete, text add/
  // delete). `future` fills up as the user undoes. Capped at 30 entries so
  // a long editing session can't balloon memory — a single canvas JSON is
  // already ~1-5 KB with a base64 logo.
  // `skipHistoryRef` is raised during programmatic replay (loadFromJSON) so
  // the mutation events fired by fabric during restore don't record a new
  // snapshot (which would nuke the redo stack).
  const historyRef = useRef<{ past: string[]; future: string[] }>({ past: [], future: [] });
  const skipHistoryRef = useRef(false);
  const [historyTick, setHistoryTick] = useState(0); // bumps when past/future lengths change → re-renders toolbar disabled states
  const HISTORY_CAP = 30;
  const EXTRA_PROPS = ['vaRole', 'vaId', 'side', 'selectable', 'evented', 'lockMovementX', 'lockMovementY', 'lockUniScaling', 'lockScalingFlip', 'hoverCursor', 'hasControls', 'hasBorders', 'padding', 'excludeFromExport', 'originX', 'originY'];

  const [canvasKey, setCanvasKey] = useState(0); // bumped on resize to force rebuild
  const [zoneId, setZoneId] = useState<string>(
    currentPlacement?.zoneId ?? (pickDefaultZone(product.printZones)?.id ?? ''),
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
  // Debounced because ResizeObserver fires continuously while a desktop
  // user drags the window edge. Without the debounce, canvasKey+1'd on
  // every frame and the fabric canvas got torn down + rebuilt 30-60
  // times a second — visible flicker, thrashed GPU, lost logo placement.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let debounceId: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(() => {
      if (debounceId != null) clearTimeout(debounceId);
      debounceId = setTimeout(() => { setCanvasKey(k => k + 1); debounceId = null; }, 150);
    });
    ro.observe(el);
    return () => {
      if (debounceId != null) clearTimeout(debounceId);
      ro.disconnect();
    };
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

      // Keep refs to the OLD photo/tint so we can dispose them only AFTER
      // the replacement image has actually loaded. Removing them up-front
      // leaves the canvas blank (#F4F3EF flash) while the new image is
      // still fetching — that flash is what made rapid color picks look
      // sluggish. Swap-on-arrival = no perceived gap.
      const prevPhoto = photoObj.current;
      const prevTint  = tintObj.current;

      // Probe first so we catch load failures (back photo may 404 even
      // if front loaded fine). fabric.Image.fromURL silently fails on
      // error which leaves the canvas visibly blank with no explanation.
      const probe = new Image();
      probe.crossOrigin = 'anonymous';
      const reportLoadFailure = () => {
        setImgError(true);
        toast.error('Impossible de charger cette couleur — réessayez ou choisissez une autre');
      };
      probe.onerror = () => {
        if (disposed) return;
        reportLoadFailure();
      };
      probe.onload = () => {
        if (disposed || !fc.current) return;
        setImgError(false);
        fabric.Image.fromURL(
          photoUrl,
          (img: FabricObj) => {
            if (disposed || !fc.current) return;
            // fromURL silently resolves with a falsy/zero-sized image when
            // the decode blows up (Drive 403 on a cross-origin GET, CORS
            // mismatch, corrupt bytes, etc). Bail out here instead of
            // wiping the previous photo — swap-on-arrival means the old
            // color stays visible until a replacement actually decodes.
            if (!img || !img.width) {
              reportLoadFailure();
              return;
            }
            // Now that the new photo is ready, retire the old one. This
            // keeps the canvas painted with the previous color until the
            // pixel-perfect replacement lands — eliminates the flash.
            if (prevPhoto) {
              canvas.remove(prevPhoto);
              try { prevPhoto.dispose?.(); } catch { /* noop */ }
              if (photoObj.current === prevPhoto) photoObj.current = null;
            }
            if (prevTint) {
              canvas.remove(prevTint);
              if (tintObj.current === prevTint) tintObj.current = null;
            }
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
            (img as unknown as { vaRole?: string }).vaRole = 'photo';
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
            (tint as unknown as { vaRole?: string }).vaRole = 'tint';
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

      // Bail early if we don't have a photo URL at all. Setting
      // probe.src = '' or undefined resolves as the current page
      // URL in Chrome — which then "loads" successfully and leads
      // to fabric.Image.fromURL being called with nonsense. Show
      // the error state immediately instead.
      if (!photoUrl) {
        setImgError(true);
        setReady(true);
        return;
      }

      // Pre-load with a regular Image so we can detect failures fast
      const probe = new Image();
      probe.crossOrigin = 'anonymous';
      const reportInitLoadFailure = () => {
        setImgError(true);
        setReady(true);
        toast.error('Impossible de charger cette couleur — réessayez ou choisissez une autre');
      };
      probe.onerror = () => {
        if (disposed) return;
        reportInitLoadFailure();
      };
      probe.onload = () => {
        if (disposed || !fc.current) return;
        fabric.Image.fromURL(
          photoUrl,
          (img: FabricObj) => {
            if (disposed || !fc.current) return;
            // fromURL can silently resolve with a falsy/zero-sized image
            // even after the probe succeeded (CORS-tainted decode, etc).
            // Converge on the same error state the probe.onerror path
            // uses so the user gets feedback instead of an empty canvas.
            if (!img || !img.width) {
              reportInitLoadFailure();
              return;
            }
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
            (img as unknown as { vaRole?: string; excludeFromExport?: boolean }).vaRole = 'photo';
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
              (tint as unknown as { vaRole?: string }).vaRole = 'tint';
              canvas.add(tint);
              tintObj.current = tint;
            }

            // Print-zone outline — adaptive contrast so it's visible on
            // both dark AND light garments. Shown on BOTH front and back
            // so the user knows where the safe area is when placing a
            // back-side logo. (Previously only on front.)
            {
              const zone = pickDefaultZone(product.printZones);
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
                (outline as unknown as { vaRole?: string }).vaRole = 'mask';
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
      (guideX as unknown as { vaRole?: string }).vaRole = 'guide';
      (guideY as unknown as { vaRole?: string }).vaRole = 'guide';
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

      // ── Undo/redo snapshot capture ──────────────────────────────────
      // Subscribe to content-mutating events and push a JSON snapshot
      // onto `past`. We ignore events fired during programmatic replay
      // (skipHistoryRef) and events whose target is infrastructure
      // (photo/tint/mask/guide) — only user content changes should
      // record history. The `ready` gate suppresses the flood of
      // add events from the initial photo/tint/mask setup.
      const pushSnapshot = () => {
        if (skipHistoryRef.current) return;
        if (!fc.current) return;
        try {
          const snap = JSON.stringify(fc.current.toJSON(EXTRA_PROPS));
          const h = historyRef.current;
          h.past.push(snap);
          if (h.past.length > HISTORY_CAP) h.past.shift();
          h.future = [];
          setHistoryTick(t => t + 1);
        } catch {
          // toJSON can throw on tainted canvases; history is a polish
          // feature — never let it break the canvas.
        }
      };
      const isUserContent = (target?: { vaRole?: string }) => {
        const role = target?.vaRole;
        return role === 'logo' || role === 'text';
      };
      canvas.on('object:added', (e: { target?: { vaRole?: string } }) => {
        if (!isUserContent(e.target)) return;
        pushSnapshot();
      });
      canvas.on('object:modified', (e: { target?: { vaRole?: string } }) => {
        if (!isUserContent(e.target)) return;
        pushSnapshot();
      });
      canvas.on('object:removed', (e: { target?: { vaRole?: string } }) => {
        if (!isUserContent(e.target)) return;
        pushSnapshot();
      });
    });

    return () => {
      disposed = true;
      // Explicitly dispose every fabric object we tracked so their internal
      // listeners unbind from the canvas we're about to tear down. Without
      // this the fabric IText objects stayed in the Map pointing at a
      // disposed canvas — on the next canvasKey bump the text silently
      // vanished from the canvas while still showing in the assets list.
      textObjects.current.forEach(t => {
        (t as FabricObj & { dispose?: () => void }).dispose?.();
      });
      textObjects.current.clear();
      (logoObj.current as (FabricObj & { dispose?: () => void }) | null)?.dispose?.();
      logoObj.current = null;
      fc.current?.dispose();
      fc.current = null;
    };
    // Init effect: only fires on first mount + on canvas resize.
    // Photo/color/view changes are handled by the swap-in-place effect above
    // so the user's logo placement survives a color pick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasKey]);

  // ── Re-hydrate text assets after a canvas rebuild ───────────────────────
  // When canvasKey bumps (resize), the init effect disposes the old canvas
  // and recreates it, but React keeps our textAssets state. Without this
  // effect, the text would be gone from the canvas while still present in
  // the asset list — so re-add each asset as a fresh fabric IText whenever
  // `ready` flips true after a rebuild. Mirrors the initial add-text logic.
  useEffect(() => {
    if (!ready || !fc.current) return;
    const assets = textAssetsRef.current;
    if (assets.length === 0) return;
    let disposed = false;
    import('fabric').then(({ fabric }) => {
      if (disposed || !fc.current) return;
      const canvas = fc.current;
      const W = canvas.width as number;
      const H = canvas.height as number;
      const zone = pickDefaultZone(product.printZones);
      const cx = zone ? (zone.x / 100) * W + (zone.width / 100) * W / 2 : W / 2;
      const cy = zone ? (zone.y / 100) * H + (zone.height / 100) * H / 2 + 40 : H / 2;
      for (const asset of assets) {
        // Skip if we already re-added this one (guards against double-fire)
        if (textObjects.current.has(asset.id)) continue;
        const hex = asset.color.replace('#', '');
        const isLightText = hex.length >= 6
          ? (parseInt(hex.slice(0, 2), 16) * 299 +
             parseInt(hex.slice(2, 4), 16) * 587 +
             parseInt(hex.slice(4, 6), 16) * 114) / 1000 > 160
          : false;
        const baseSize = W * 0.06;
        const lengthFactor = Math.max(0.5, Math.min(1, 14 / Math.max(1, asset.text.length)));
        const fontSize = Math.max(14, Math.round(baseSize * lengthFactor));
        const t = new fabric.IText(asset.text, {
          left: cx, top: cy,
          originX: 'center', originY: 'center',
          fontFamily: textFont,
          fontSize,
          fontWeight: 'bold',
          fill: asset.color,
          stroke: isLightText ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.35)',
          strokeWidth: 1,
          strokeUniform: true,
          paintFirst: 'stroke',
          textAlign: 'center',
          editable: true,
          selectable: asset.side === activeView,
          evented: asset.side === activeView,
          visible: asset.side === activeView,
          hasControls: true,
          lockUniScaling: true,
          cornerStyle: 'circle', cornerSize: 10,
          cornerColor: '#0052CC', borderColor: '#0052CC',
          cornerStrokeColor: '#FFFFFF',
          borderScaleFactor: 1.5,
          transparentCorners: false,
        });
        t.setControlsVisibility({ mt: false, mb: false, ml: false, mr: false });
        (t as FabricObj & { side: ProductView }).side = asset.side;
        (t as unknown as { vaRole?: string; vaId?: string }).vaRole = 'text';
        (t as unknown as { vaRole?: string; vaId?: string }).vaId = asset.id;
        canvas.add(t);
        textObjects.current.set(asset.id, t as FabricObj & { side: ProductView });
      }
      canvas.renderAll();
    });
    return () => { disposed = true; };
    // textAssetsRef/textFont/activeView/product are stable-enough — we only
    // want this to run when a rebuild flips `ready` back true.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

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
      // Otherwise, default to the zone center. Read from the ref so a
      // resize mid-drag doesn't re-bind the effect to a stale closure
      // and snap the logo back to its pre-drag coordinates.
      const livePlacement = currentPlacementRef.current;
      const hasExistingPlacement = livePlacement?.x != null && livePlacement?.y != null;
      let cx: number, cy: number, initWidthPct: number;

      if (hasExistingPlacement) {
        cx = (livePlacement!.x! / 100) * W;
        cy = (livePlacement!.y! / 100) * H;
        initWidthPct = (livePlacement!.width ?? 26) / 100;
      } else {
        const zone = product.printZones.find(z => z.id === zoneId) ?? pickDefaultZone(product.printZones);
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
            angle: livePlacement?.rotation ?? 0,
            // Logo is only draggable / selectable during the placement
            // step ("Where to print"). On other steps it's locked so
            // the user can't accidentally shove it off the garment.
            selectable: showPlacementTools,
            evented:    showPlacementTools,
            hasControls: showPlacementTools,
            hasBorders:  showPlacementTools,
            cornerStyle: 'circle', cornerSize: 10,
            cornerColor: '#0052CC', borderColor: '#0052CC',
            cornerStrokeColor: '#FFFFFF',
            borderScaleFactor: 1.5, transparentCorners: false,
            // Expand the hit area by 8px on every side so small logos
            // (<30px per dimension) are still draggable on touch screens.
            // Default fabric hit-test is the rect, which is roughly the
            // logo's visible size — that's a ~20×20 target on mobile
            // after the uniform scale, painfully small for thumbs.
            padding: 8,
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
          // Tag so the undo/redo replay can rebind logoObj.current after
          // loadFromJSON swaps in a fresh set of fabric objects.
          (img as unknown as { vaRole?: string }).vaRole = 'logo';
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
    // The init effect sets originX/Y='center', so left/top ARE the center
    // of the logo, not its top-left corner. The old math here subtracted
    // width/2 + height/2 anyway — which shifted the logo up-left by half
    // its size on every "Center on garment" / zone preset click. Match
    // the origin so pre-set placements land exactly on the target point.
    const originX = (img as unknown as { originX?: string }).originX;
    const originY = (img as unknown as { originY?: string }).originY;
    img.set({
      left: originX === 'center'
        ? targetX
        : targetX - (img.width ?? 0) * (img.scaleX ?? 1) / 2,
      top: originY === 'center'
        ? targetY
        : targetY - (img.height ?? 0) * (img.scaleY ?? 1) / 2,
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
  // Center-origin aware: with originX='center', fabric's `left` is the
  // center of the object — so snap-left/right has to target the VISIBLE
  // edge by shifting by half the scaled width. Without this compensation
  // (the pre-iter-153 math), every snap button was off by half a logo.
  const snapLeft = () => {
    if (!logoObj.current || !fc.current) return;
    const obj = logoObj.current;
    const W = fc.current.width as number;
    const halfW = ((obj.width ?? 0) * (obj.scaleX ?? 1)) / 2;
    const originX = (obj as unknown as { originX?: string }).originX;
    obj.set({ left: originX === 'center' ? W * 0.07 + halfW : W * 0.07 });
    fc.current.renderAll(); emit(obj, 'manual');
  };
  const snapCenter = () => {
    if (!logoObj.current || !fc.current) return;
    const obj = logoObj.current;
    const W = fc.current.width as number;
    const originX = (obj as unknown as { originX?: string }).originX;
    obj.set({
      left: originX === 'center'
        ? W / 2
        : (W - (obj.width ?? 0) * (obj.scaleX ?? 1)) / 2,
    });
    fc.current.renderAll(); emit(obj, zoneId);
  };
  const snapRight = () => {
    if (!logoObj.current || !fc.current) return;
    const obj = logoObj.current;
    const W = fc.current.width as number;
    const halfW = ((obj.width ?? 0) * (obj.scaleX ?? 1)) / 2;
    const originX = (obj as unknown as { originX?: string }).originX;
    obj.set({ left: originX === 'center' ? W * 0.93 - halfW : W * 0.93 - halfW * 2 });
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
      const zone = pickDefaultZone(product.printZones);
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
        cornerStyle: 'circle', cornerSize: 10,
        cornerColor: '#0052CC', borderColor: '#0052CC',
        cornerStrokeColor: '#FFFFFF',
        borderScaleFactor: 1.5,
        transparentCorners: false,
      });
      t.setControlsVisibility({ mt: false, mb: false, ml: false, mr: false });
      // Tag the fabric object with the side it was created for. The
      // swap-in-place effect uses this to show/hide it when activeView
      // changes, so text on the back doesn't bleed onto the front view.
      const side = activeView;
      (t as FabricObj & { side: ProductView }).side = side;
      (t as unknown as { vaRole?: string; vaId?: string }).vaRole = 'text';
      (t as unknown as { vaRole?: string; vaId?: string }).vaId = id;
      canvas.add(t);
      canvas.setActiveObject(t);
      canvas.bringToFront(t);
      canvas.renderAll();
      textObjects.current.set(id, t as FabricObj & { side: ProductView });
      setTextAssets(prev => [...prev, { id, text, color, side }]);
    });
  };

  const removeTextAsset = (id: string) => {
    // Read the LIVE assets list from the ref, not the closure variable:
    // this callback is bound to per-row delete buttons AND invoked by the
    // keydown handler (registered once at mount with []-deps), so the
    // `textAssets` captured at declaration time can be many renders
    // behind. Bail with a warn when the id is unknown rather than
    // silently desyncing the fabric canvas and the assets list.
    const live = textAssetsRef.current;
    if (!live.some(t => t.id === id)) {
      // Still clean up any orphan fabric object for this id, then noop.
      const orphan = textObjects.current.get(id);
      if (orphan && fc.current) {
        fc.current.remove(orphan);
        fc.current.renderAll();
        textObjects.current.delete(id);
      }
      // eslint-disable-next-line no-console
      console.warn(`[ProductCanvas] removeTextAsset: id "${id}" not in live asset list — ignoring.`);
      return;
    }
    const obj = textObjects.current.get(id);
    if (obj && fc.current) {
      fc.current.remove(obj);
      fc.current.renderAll();
    }
    textObjects.current.delete(id);
    setTextAssets(prev => prev.filter(t => t.id !== id));
  };

  // Apply zoom level to the fabric canvas whenever the user bumps the
  // corner +/- buttons. Zoom is a viewport transform: placement math,
  // emitted percentages, and bbox detection all continue to operate in
  // UN-zoomed canvas coordinates. Zooming around the canvas centre keeps
  // the garment centred instead of drifting toward the top-left. We do
  // NOT tear down / rebuild the fabric canvas here.
  useEffect(() => {
    if (!ready || !fc.current) return;
    const canvas = fc.current;
    const W = canvas.width as number;
    const H = canvas.height as number;
    try {
      // Prefer zoomToPoint so the zoom anchors at the canvas centre
      // instead of the top-left (fabric's setZoom default). We fall back
      // to setZoom if zoomToPoint is unavailable on this fabric build.
      if (typeof canvas.zoomToPoint === 'function') {
        canvas.zoomToPoint({ x: W / 2, y: H / 2 }, zoomLevel);
      } else if (typeof canvas.setZoom === 'function') {
        canvas.setZoom(zoomLevel);
      }
      canvas.requestRenderAll?.();
    } catch {
      // Fabric API variations — swallow; zoom is a polish feature and
      // must never break the core canvas.
    }
  }, [zoomLevel, ready, canvasKey]);

  // Reset zoom back to 1 whenever the canvas is rebuilt (resize / first
  // mount). The fresh fabric canvas starts at zoom 1, so our state has
  // to match reality.
  useEffect(() => {
    setZoomLevel(1);
  }, [canvasKey]);

  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 2.0;
  const ZOOM_STEP = 0.25;
  const clampZoom = (z: number) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(z / ZOOM_STEP) * ZOOM_STEP));
  const zoomIn  = () => setZoomLevel(z => clampZoom(z + ZOOM_STEP));
  const zoomOut = () => setZoomLevel(z => clampZoom(z - ZOOM_STEP));
  const zoomReset = () => setZoomLevel(1);

  // ── Undo / redo restore ────────────────────────────────────────────────
  // Replay a snapshot: loadFromJSON swaps every fabric object on the canvas
  // for fresh instances, so the logo / text / photo / mask refs we hold are
  // all stale afterwards. Walk the fresh object list and re-bind refs by
  // the vaRole tag we attach at creation time. skipHistoryRef suppresses
  // the object:added/removed/modified firehose fabric fires during load.
  const restoreFromSnapshot = useCallback((snap: string) => {
    if (!fc.current) return;
    const canvas = fc.current;
    skipHistoryRef.current = true;
    try {
      canvas.loadFromJSON(snap, () => {
        try {
          // Rebind refs from the freshly-loaded object list.
          logoObj.current = null;
          photoObj.current = null;
          tintObj.current = null;
          maskRef.current = null;
          textObjects.current.clear();
          const objs = (canvas.getObjects?.() ?? []) as Array<FabricObj & { vaRole?: string; vaId?: string; side?: ProductView }>;
          for (const o of objs) {
            switch (o.vaRole) {
              case 'logo':  logoObj.current = o; break;
              case 'photo': photoObj.current = o; break;
              case 'tint':  tintObj.current = o; break;
              case 'mask':  maskRef.current = o; break;
              case 'text':
                if (o.vaId) textObjects.current.set(o.vaId, o as FabricObj & { side: ProductView });
                break;
            }
          }
          // loadFromJSON drops controlsVisibility — reapply on the logo so
          // the user can still resize only from corners after an undo.
          const logo = logoObj.current as unknown as { setControlsVisibility?: (v: Record<string, boolean>) => void } | null;
          logo?.setControlsVisibility?.({ mt: false, mb: false, ml: false, mr: false, tl: true, tr: true, bl: true, br: true, mtr: true });
          textObjects.current.forEach(t => {
            (t as unknown as { setControlsVisibility?: (v: Record<string, boolean>) => void }).setControlsVisibility?.({ mt: false, mb: false, ml: false, mr: false });
          });
          // Push placement back to the parent so the store + size column
          // reflects the restored logo position.
          if (logoObj.current) {
            emitRef.current(logoObj.current, zoneIdRef.current || 'manual');
          } else {
            // Logo was removed in this snapshot — tell parent to clear.
            onPlacementChange({ zoneId: zoneIdRef.current, mode: 'preset', previewUrl: undefined });
          }
          canvas.requestRenderAll?.();
        } finally {
          skipHistoryRef.current = false;
        }
      }, (_obj: unknown, _err?: unknown) => {
        // per-object reviver; nothing to do — tag props are restored
        // automatically because we listed them in EXTRA_PROPS at save time.
      });
    } catch {
      skipHistoryRef.current = false;
    }
  }, [onPlacementChange]);

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h.past.length < 2) return; // need the current + at least one prior
    const current = h.past.pop()!;
    h.future.push(current);
    const prev = h.past[h.past.length - 1];
    restoreFromSnapshot(prev);
    setHistoryTick(t => t + 1);
  }, [restoreFromSnapshot]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (h.future.length === 0) return;
    const next = h.future.pop()!;
    h.past.push(next);
    restoreFromSnapshot(next);
    setHistoryTick(t => t + 1);
  }, [restoreFromSnapshot]);

  // Seed the history stack with the "empty canvas" state once ready flips
  // true. This way the first user action has a previous snapshot to undo
  // back to (undo removes whatever they just added). Cleared when the
  // canvas rebuilds (canvasKey change) — init effect recreates everything.
  useEffect(() => {
    if (!ready || !fc.current) return;
    historyRef.current = { past: [], future: [] };
    try {
      const snap = JSON.stringify(fc.current.toJSON(EXTRA_PROPS));
      historyRef.current.past.push(snap);
      setHistoryTick(t => t + 1);
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, canvasKey]);

  // Delete/Backspace key removes the currently selected canvas object.
  // Arrow keys nudge the selected object by 1 px (default) / 5 px (Shift)
  // / 10 px (Cmd or Ctrl). Both behaviours share the same global listener
  // so they inherit the same step-1 gate and INPUT/TEXTAREA/contenteditable
  // guard. (Skips when user is typing in an IText — fabric.js handles
  // editing mode separately so backspace inside an editing text won't nuke
  // it, and arrow keys should move the caret, not the whole object.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!showPlacementTools) return;
      if (!fc.current) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

      // Undo / redo — Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z (also Ctrl+Y on
      // Windows muscle memory). Handled before the arrow/delete branches
      // so neither bubbles into a nudge/delete on Z keys that somehow
      // arrive without the modifier. Skips when an IText is in edit
      // mode so in-text undo (fabric's own char history) still works.
      const mod = e.metaKey || e.ctrlKey;
      const isZ = e.key === 'z' || e.key === 'Z';
      const isY = e.key === 'y' || e.key === 'Y';
      if (mod && (isZ || isY)) {
        const active = fc.current.getActiveObject?.();
        if (active && (active as unknown as { isEditing?: boolean }).isEditing) return;
        if (isY || (isZ && e.shiftKey)) {
          redo();
        } else {
          undo();
        }
        e.preventDefault();
        return;
      }

      const isArrow = e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight';
      const isDelete = e.key === 'Delete' || e.key === 'Backspace';
      if (!isArrow && !isDelete) return;

      const active = fc.current.getActiveObject();
      if (!active) return;
      // Don't touch the photo, tint, or print-zone outline — those are
      // background infrastructure, not user content.
      if (active === photoObj.current || active === tintObj.current || active === maskRef.current) return;
      // If the active IText is in edit mode, let fabric handle arrows/delete
      // (caret movement, character delete) instead of moving/removing the object.
      if ((active as unknown as { isEditing?: boolean }).isEditing) return;

      if (isArrow) {
        // Cmd (macOS) / Ctrl (Windows) = 10 px, Shift = 5 px, default = 1 px.
        // Cmd/Ctrl wins over Shift if both modifiers are held.
        const step = (e.metaKey || e.ctrlKey) ? 10 : e.shiftKey ? 5 : 1;
        let dx = 0, dy = 0;
        if (e.key === 'ArrowUp')    dy = -step;
        if (e.key === 'ArrowDown')  dy =  step;
        if (e.key === 'ArrowLeft')  dx = -step;
        if (e.key === 'ArrowRight') dx =  step;
        active.set({
          left: (active.left ?? 0) + dx,
          top:  (active.top  ?? 0) + dy,
        });
        active.setCoords?.();
        fc.current.requestRenderAll?.();
        // Fabric does not emit object:modified for programmatic .set()
        // calls, so the history-capture listeners (registered on the
        // canvas in the init effect) never see arrow-nudges. Without
        // this fire(), Cmd+Z silently skips over a chain of nudges and
        // the user's prior position is lost. Mirrors what fabric emits
        // at the end of a real drag.
        fc.current.fire?.('object:modified', { target: active });
        // Nudging counts as manual placement — matches drag/align-left/right
        // behaviour. Text assets aren't in the placement store so emit only
        // when we just moved the logo.
        if (active === logoObj.current) {
          emitRef.current(active, 'manual');
        }
        // One-time hint: teach the Shift / Ctrl modifiers the first time
        // someone actually uses arrow nudge. Gated on localStorage so we
        // don't spam them every session.
        try {
          const seen = localStorage.getItem('vision-customizer-nudge-hint-seen');
          if (!seen) {
            toast('Astuce : Shift+Flèche = 5 px · Ctrl+Flèche = 10 px');
            localStorage.setItem('vision-customizer-nudge-hint-seen', '1');
          }
        } catch {
          // localStorage can throw in private mode / blocked storage —
          // swallow; the nudge itself still worked.
        }
        e.preventDefault();
        return;
      }

      // Delete / Backspace branch
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
    // fresh state via refs. showPlacementTools is included so the early
    // bail-out reflects the current step (step 3/4 must not delete the logo
    // or nudge it — review/checkout steps are read-only). undo/redo are
    // listed so the listener captures the latest history callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPlacementTools, undo, redo]);

  return (
    <div className="flex flex-col gap-2.5">
      {/* The interactive canvas — premium frame with subtle gradient + drop shadow */}
      {/* aspectRatio syncs with the JS ratio above: narrow = 1/1.2 (tall)
          on phones, widescreen on desktop. CSS-only so there's no flash
          before JS kicks in. */}
      <div
        ref={containerRef}
        tabIndex={0}
        role="application"
        aria-label={lang === 'en'
          ? 'Product canvas. Use arrow keys to nudge the selected item (Shift = 5px, Ctrl/Cmd = 10px).'
          : "Canvas du produit. Utilise les flèches pour déplacer l'élément sélectionné (Maj = 5 px, Ctrl/Cmd = 10 px)."}
        className="relative rounded-2xl overflow-hidden border border-border bg-gradient-to-br from-[#F8F7F3] via-[#F4F3EF] to-[#EDEAE3] shadow-[0_8px_32px_rgba(27,58,107,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] aspect-[5/6] md:aspect-[1/1.05] lg:aspect-[1.28/1] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        {/* Subtle radial accent in the corner — looks like studio lighting */}
        <div
          className="absolute top-0 right-0 w-1/2 h-1/2 pointer-events-none opacity-40"
          style={{ background: 'radial-gradient(circle at 70% 30%, rgba(255,255,255,0.7) 0%, transparent 60%)' }}
          aria-hidden="true"
        />
        <canvas ref={canvasElRef} className="relative w-full h-full block" style={{ touchAction: 'manipulation' }} />

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

        {/* Undo / Redo — always visible during placement so the user can
            recover from an accidental delete even after the toolbar below
            (gated on logoUrl) disappears. Anchored bottom-right of the
            canvas so it mirrors the zoom controls on the bottom-left. */}
        {ready && showPlacementTools && (() => {
          const canUndo = historyRef.current.past.length > 1;
          const canRedo = historyRef.current.future.length > 0;
          // Reference historyTick so lint/React re-runs this block when
          // past/future mutate; value itself is unused.
          void historyTick;
          return (
            <div
              className="absolute bottom-3 right-3 flex items-center gap-0.5 bg-white/95 backdrop-blur-sm rounded-full p-0.5 border border-border shadow-sm"
              role="group"
              aria-label={lang === 'en' ? 'History' : 'Historique'}
            >
              <button
                type="button"
                onClick={undo}
                disabled={!canUndo}
                aria-label={lang === 'en' ? 'Undo (Cmd/Ctrl+Z)' : 'Annuler (Cmd/Ctrl+Z)'}
                title={lang === 'en' ? 'Undo (Cmd/Ctrl+Z)' : 'Annuler (Cmd/Ctrl+Z)'}
                className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 disabled:hover:bg-transparent transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
              >
                <Undo2 size={13} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={!canRedo}
                aria-label={lang === 'en' ? 'Redo (Cmd/Ctrl+Shift+Z)' : 'Rétablir (Cmd/Ctrl+Maj+Z)'}
                title={lang === 'en' ? 'Redo (Cmd/Ctrl+Shift+Z)' : 'Rétablir (Cmd/Ctrl+Maj+Z)'}
                className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 disabled:hover:bg-transparent transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
              >
                <Redo2 size={13} aria-hidden="true" />
              </button>
            </div>
          );
        })()}

        {/* Zoom controls — preview-only viewport zoom, anchored bottom-left.
            Clamped 0.5x – 2.0x at 0.25 steps. Reset returns to 1.0. Does
            NOT affect placement math / emitted percentages / persistence;
            it's a view transform on the fabric canvas only. */}
        {ready && (
          <div
            className="absolute bottom-3 left-3 flex items-center gap-0.5 bg-white/95 backdrop-blur-sm rounded-full p-0.5 border border-border shadow-sm"
            role="group"
            aria-label={lang === 'en' ? 'Zoom' : 'Zoom'}
          >
            <button
              type="button"
              onClick={zoomOut}
              disabled={zoomLevel <= ZOOM_MIN + 1e-6}
              aria-label={lang === 'en' ? 'Zoom out' : 'Dézoomer'}
              title={lang === 'en' ? 'Zoom out' : 'Dézoomer'}
              className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 disabled:hover:bg-transparent transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
            >
              <ZoomOut size={13} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={zoomReset}
              aria-label={lang === 'en' ? `Reset zoom (currently ${Math.round(zoomLevel * 100)}%)` : `Réinitialiser le zoom (${Math.round(zoomLevel * 100)}%)`}
              title={lang === 'en' ? 'Reset zoom' : 'Réinitialiser'}
              className="px-2 h-7 min-w-[44px] rounded-full text-[10px] font-bold tabular-nums text-foreground hover:bg-secondary transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
            >
              {Math.round(zoomLevel * 100)}%
            </button>
            <button
              type="button"
              onClick={zoomIn}
              disabled={zoomLevel >= ZOOM_MAX - 1e-6}
              aria-label={lang === 'en' ? 'Zoom in' : 'Zoomer'}
              title={lang === 'en' ? 'Zoom in' : 'Zoomer'}
              className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 disabled:hover:bg-transparent transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
            >
              <ZoomIn size={13} aria-hidden="true" />
            </button>
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
                className={`relative text-[10px] font-extrabold px-2.5 py-1 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
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
                className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
              >
                <Icon size={14} aria-hidden="true" />
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
                className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
              >
                <Icon size={14} aria-hidden="true" />
              </button>
            ))}
          </div>
          <div className="w-px h-4 bg-border" />
          <button
            type="button"
            onClick={removeLogo}
            title={lang === 'en' ? 'Remove logo' : 'Supprimer le logo'}
            aria-label={lang === 'en' ? 'Remove logo' : 'Supprimer le logo'}
            className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-background transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-1"
          >
            <Trash2 size={14} aria-hidden="true" />
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
                className="w-6 h-6 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-1"
                aria-label={lang === 'en' ? `Remove text ${a.text}` : `Retirer le texte ${a.text}`}
              >
                <X size={12} aria-hidden="true" />
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
              <Type size={13} className="text-muted-foreground flex-shrink-0" aria-hidden="true" />
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
              type="button"
              onClick={() => { if (textInput.trim()) { addText(textInput, textColor, textFont); setTextInput(''); } }}
              disabled={!textInput.trim()}
              aria-label={lang === 'en' ? 'Add text to garment' : 'Ajouter le texte au vêtement'}
              className="px-3 py-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-xl disabled:opacity-30 hover:opacity-90 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
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
                    role="radio"
                    aria-checked={textFont === f.font}
                    onClick={() => setTextFont(f.font)}
                    className={`w-7 h-7 rounded-md border text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                      textFont === f.font ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border hover:border-primary'
                    }`}
                    style={f.style}
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
                      role="radio"
                      aria-checked={textColor === c.hex}
                      onClick={() => setTextColor(c.hex)}
                      className={`w-5 h-5 rounded-full border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                        textColor === c.hex ? 'ring-2 ring-primary ring-offset-1 scale-110' : 'border-border hover:scale-105'
                      }`}
                      style={{ background: c.hex, borderColor: c.hex === '#FFFFFF' ? '#cbd5e1' : c.hex }}
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
