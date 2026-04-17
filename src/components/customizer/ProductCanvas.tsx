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
  ImageOff, Move, Trash2,
} from 'lucide-react';
import type { Product, PrintZone } from '@/data/products';
import type { LogoPlacement, ProductView } from '@/types/customization';
import { useLang } from '@/lib/langContext';

interface Props {
  product: Product;
  garmentColor?: string;        // hex of selected colour
  imageDevant: string;          // real Shopify photo for front
  imageDos: string;             // real Shopify photo for back
  logoUrl: string | null;
  currentPlacement: LogoPlacement | null;
  activeView: ProductView;
  onViewChange: (v: ProductView) => void;
  onPlacementChange: (p: LogoPlacement) => void;
}

export function ProductCanvas({
  product, garmentColor, imageDevant, imageDos, logoUrl,
  currentPlacement, activeView, onViewChange, onPlacementChange,
}: Props) {
  const { t, lang } = useLang();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasElRef  = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fc      = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logoObj = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maskRef = useRef<any>(null);

  const [ready, setReady] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [zoneId, setZoneId] = useState<string>(
    currentPlacement?.zoneId ?? (product.printZones[0]?.id ?? ''),
  );
  // Ref mirror of zoneId so canvas event listeners always read the current value
  const zoneIdRef = useRef(zoneId);
  zoneIdRef.current = zoneId;

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

            // Cover the embedded "VOTRE LOGO" placeholder on the front photo
            // with a coloured mask sized from the first print zone.
            if (activeView === 'front') {
              const zone = product.printZones[0];
              if (zone) {
                const pad = 6;
                const mask = new fabric.Rect({
                  left: (zone.x / 100) * W - pad,
                  top:  (zone.y / 100) * H - pad,
                  width:  (zone.width  / 100) * W + pad * 2,
                  height: (zone.height / 100) * H + pad * 2,
                  fill: garmentColor ?? '#1a1a1a',
                  rx: 10, ry: 10,
                  selectable: false, evented: false,
                  shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.22)', blur: 6, offsetY: 2 }),
                });
                canvas.add(mask);
                maskRef.current = mask;
              }
            }

            setReady(true);
            canvas.renderAll();
          },
          { crossOrigin: 'anonymous' },
        );
      };
      probe.src = photoUrl;

      // Wire up modification → emit placement
      // Use zoneIdRef so the handler always reads the CURRENT zoneId, not the stale closure value
      canvas.on('object:modified', () => { if (logoObj.current) emit(logoObj.current, zoneIdRef.current); });
      canvas.on('object:moving',   () => { if (logoObj.current) emit(logoObj.current, 'manual'); });
    });

    return () => {
      disposed = true;
      fc.current?.dispose();
      fc.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageDevant, imageDos, activeView, garmentColor]);

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

      // Initial position derived from the active zone
      const zone = product.printZones.find(z => z.id === zoneId) ?? product.printZones[0];
      let cx = W / 2, cy = H * 0.36, initWidthPct = 0.26;
      if (zone) {
        cx = (zone.x / 100) * W + (zone.width  / 100) * W / 2;
        cy = (zone.y / 100) * H + (zone.height / 100) * H / 2;
        initWidthPct = (zone.width / 100) * 0.85;
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

    // Move the mask too
    if (maskRef.current && activeView === 'front') {
      const pad = 6;
      maskRef.current.set({
        left: (zone.x / 100) * W - pad,
        top:  (zone.y / 100) * H - pad,
        width:  (zone.width  / 100) * W + pad * 2,
        height: (zone.height / 100) * H + pad * 2,
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
    </div>
  );
}
