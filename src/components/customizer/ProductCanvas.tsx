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
  ImageOff, Move, Trash2, Type,
} from 'lucide-react';
import type { Product, PrintZone } from '@/data/products';
import type { LogoPlacement, ProductView } from '@/types/customization';
import { useLang } from '@/lib/langContext';

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
}

export function ProductCanvas({
  product, garmentColor, hasRealColorImage, imageDevant, imageDos, logoUrl,
  currentPlacement, activeView, onViewChange, onPlacementChange,
}: Props) {
  const { t, lang } = useLang();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasElRef  = useRef<HTMLCanvasElement>(null);
  const [textInput, setTextInput] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fc      = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logoObj = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maskRef = useRef<any>(null);

  const [ready, setReady] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0); // bumped on resize to force rebuild
  const [zoneId, setZoneId] = useState<string>(
    currentPlacement?.zoneId ?? (product.printZones[0]?.id ?? ''),
  );
  // Ref mirror of zoneId so canvas event listeners always read the current value
  const zoneIdRef = useRef(zoneId);
  zoneIdRef.current = zoneId;

  // Resize listener — rebuild canvas when container width changes (phone rotation, etc.)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCanvasKey(k => k + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Emit placement back to parent ──────────────────────────────────────────
  const emit = useCallback((obj: any, zone: string) => {
    if (!fc.current || !obj) return;
    const W = fc.current.width as number;
    const H = fc.current.height as number;
    const cx = (obj.left ?? 0) + ((obj.width ?? 0) * (obj.scaleX ?? 1)) / 2;
    const cy = (obj.top ?? 0) + ((obj.height ?? 0) * (obj.scaleY ?? 1)) / 2;
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
      const H = Math.round(W * 1.18);

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
          (img: any) => {
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
            }

            // Print-zone outline on the front view
            if (activeView === 'front') {
              const zone = product.printZones[0];
              if (zone) {
                const outline = new fabric.Rect({
                  left: (zone.x / 100) * W,
                  top:  (zone.y / 100) * H,
                  width:  (zone.width  / 100) * W,
                  height: (zone.height / 100) * H,
                  fill: 'transparent',
                  stroke: 'rgba(255,255,255,0.5)',
                  strokeDashArray: [6, 4],
                  strokeWidth: 1.5,
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
        const cx = W / 2;
        const cy = H / 2;
        const left = target.left ?? 0;
        const top = target.top ?? 0;

        const snapToX = Math.abs(left - cx) <= SNAP_TOLERANCE;
        const snapToY = Math.abs(top - cy) <= SNAP_TOLERANCE;

        if (snapToX) {
          target.left = cx;
          guideX.set('opacity', 1);
        } else {
          guideX.set('opacity', 0);
        }
        if (snapToY) {
          target.top = cy;
          guideY.set('opacity', 1);
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

      // Wire up modification → emit placement + guides
      canvas.on('object:moving', (e: any) => {
        if (e.target) updateGuides(e.target);
        if (logoObj.current) emit(logoObj.current, 'manual');
      });
      canvas.on('object:modified', () => {
        hideGuides();
        if (logoObj.current) emit(logoObj.current, zoneIdRef.current);
      });
      canvas.on('mouse:up', hideGuides);
      canvas.on('selection:cleared', hideGuides);
    });

    return () => {
      disposed = true;
      fc.current?.dispose();
      fc.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageDevant, imageDos, activeView, garmentColor, canvasKey]);

  // ── Place / replace the user's logo whenever it changes ───────────────────
  useEffect(() => {
    if (!ready || !fc.current || !logoUrl) return;
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
        (img: any) => {
          if (disposed || !fc.current) return;
          const targetW = W * initWidthPct;
          const naturalW = img.width ?? 100;
          const s = targetW / naturalW;
          img.set({
            left: cx - (img.width  ?? 0) * s / 2,
            top:  cy - (img.height ?? 0) * s / 2,
            scaleX: s, scaleY: s,
            angle: currentPlacement?.rotation ?? 0,
            selectable: true, evented: true,
            hasControls: true, hasBorders: true,
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
  }, [ready, logoUrl, zoneId]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const addText = (text: string, color = '#FFFFFF') => {
    if (!fc.current || !text.trim()) return;
    import('fabric').then(({ fabric }) => {
      if (!fc.current) return;
      const canvas = fc.current;
      const W = canvas.width as number;
      const H = canvas.height as number;
      const zone = product.printZones[0];
      const cx = zone ? (zone.x / 100) * W + (zone.width / 100) * W / 2 : W / 2;
      const cy = zone ? (zone.y / 100) * H + (zone.height / 100) * H / 2 + 40 : H / 2;

      const t = new fabric.IText(text, {
        left: cx, top: cy,
        originX: 'center', originY: 'center',
        fontFamily: 'Arial, sans-serif',
        fontSize: Math.round(W * 0.06),
        fontWeight: 'bold',
        fill: color,
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
      canvas.add(t);
      canvas.setActiveObject(t);
      canvas.bringToFront(t);
      canvas.renderAll();
    });
  };

  return (
    <div className="flex flex-col gap-2.5">
      {/* The interactive canvas */}
      <div
        ref={containerRef}
        className="relative rounded-2xl overflow-hidden border border-border shadow-sm bg-[#F4F3EF]"
        style={{ aspectRatio: '0.85' }}
      >
        <canvas ref={canvasElRef} className="w-full h-full block" style={{ touchAction: 'none' }} />

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
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-white/95 backdrop-blur-sm rounded-full p-0.5 border border-border shadow-sm">
          {(['front', 'back'] as const).map(v => (
            <button
              key={v}
              onClick={() => onViewChange(v)}
              className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full transition-all ${
                activeView === v
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {v === 'front' ? t('devant') : t('dos')}
            </button>
          ))}
        </div>

        {/* Logo placed badge */}
        <AnimatePresence>
          {logoUrl && activeView === 'front' && (
            <motion.div
              initial={{ opacity:0, scale:0.85 }}
              animate={{ opacity:1, scale:1 }}
              exit={{ opacity:0 }}
              className="absolute top-3 left-3 bg-green-700/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-full"
            >
              {t('logoPlace')}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Zone preset buttons — only shown when there's a logo to place */}
      {logoUrl && activeView === 'front' && (
        <div className="grid grid-cols-2 gap-1.5">
          {product.printZones.map(z => (
            <button
              key={z.id}
              onClick={() => selectZone(z)}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left text-[10px] font-semibold transition-all ${
                zoneId === z.id
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/40'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${zoneId === z.id ? 'bg-primary' : 'bg-border'}`} />
              {z.label}
            </button>
          ))}
        </div>
      )}

      {/* Alignment & transform toolbar */}
      {logoUrl && activeView === 'front' && (
        <div className="flex items-center justify-between bg-secondary rounded-xl px-2 py-1.5 border border-border">
          <div className="flex gap-0.5">
            {[
              { icon: AlignLeft,   label: lang === 'en' ? 'Left'   : 'Gauche', fn: snapLeft   },
              { icon: AlignCenter, label: lang === 'en' ? 'Center' : 'Centre', fn: snapCenter },
              { icon: AlignRight,  label: lang === 'en' ? 'Right'  : 'Droite', fn: snapRight  },
            ].map(({ icon: Icon, label, fn }) => (
              <button key={label} onClick={fn} title={label}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background transition-all"
              >
                <Icon size={13} />
              </button>
            ))}
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex gap-0.5">
            {[
              { icon: ZoomOut,   label: lang === 'en' ? 'Smaller' : 'Réduire',  fn: () => rescale(-0.06) },
              { icon: ZoomIn,    label: lang === 'en' ? 'Bigger'  : 'Agrandir', fn: () => rescale(0.06)  },
              { icon: RotateCcw, label: '+15°', fn: rotate },
            ].map(({ icon: Icon, label, fn }) => (
              <button key={label} onClick={fn} title={label}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background transition-all"
              >
                <Icon size={13} />
              </button>
            ))}
          </div>
          <div className="w-px h-4 bg-border" />
          <button
            onClick={removeLogo}
            title={lang === 'en' ? 'Remove logo' : 'Supprimer le logo'}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-background transition-all"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}

      {/* Add text to garment */}
      {activeView === 'front' && ready && (
        <div className="flex gap-1.5">
          <div className="flex-1 flex items-center gap-1.5 bg-secondary rounded-xl px-2.5 py-1.5 border border-border">
            <Type size={13} className="text-muted-foreground flex-shrink-0" />
            <input
              type="text"
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && textInput.trim()) { addText(textInput); setTextInput(''); } }}
              placeholder={lang === 'en' ? 'Add text to garment...' : 'Ajouter du texte...'}
              className="flex-1 bg-transparent text-xs outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <button
            onClick={() => { if (textInput.trim()) { addText(textInput); setTextInput(''); } }}
            disabled={!textInput.trim()}
            className="px-3 py-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-xl disabled:opacity-30 hover:opacity-90 transition-all"
          >
            {lang === 'en' ? 'Add' : 'Ajouter'}
          </button>
        </div>
      )}
    </div>
  );
}
