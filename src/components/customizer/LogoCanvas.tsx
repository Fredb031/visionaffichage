/**
 * LogoCanvas — Canva-style logo placement with Fabric.js
 * - Product image as background
 * - Drag / resize / rotate logo with handles
 * - Align buttons: Left / Center / Right
 * - Recommended zone overlays
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { AlignCenter, AlignLeft, AlignRight, RotateCcw, ZoomIn, ZoomOut, Move } from 'lucide-react';
import type { Product, PrintZone } from '@/data/products';
import type { LogoPlacement } from '@/types/customization';

interface LogoCanvasProps {
  product: Product;
  productImageUrl: string;
  logoUrl: string | null;
  currentPlacement: LogoPlacement | null;
  onPlacementChange: (placement: LogoPlacement) => void;
}

export function LogoCanvas({ product, productImageUrl, logoUrl, currentPlacement, onPlacementChange }: LogoCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<any>(null);
  const logoObjRef = useRef<any>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(currentPlacement?.zoneId ?? null);

  const emitPlacement = useCallback((obj: any, zoneId: string) => {
    if (!fabricRef.current) return;
    const c = fabricRef.current;
    const W = c.width ?? 360;
    const H = c.height ?? 420;
    const cx = (obj.left ?? 0) + ((obj.width ?? 0) * (obj.scaleX ?? 1)) / 2;
    const cy = (obj.top ?? 0) + ((obj.height ?? 0) * (obj.scaleY ?? 1)) / 2;
    onPlacementChange({
      zoneId,
      mode: zoneId === 'manual' ? 'manual' : 'preset',
      x: (cx / W) * 100,
      y: (cy / H) * 100,
      width: ((obj.width ?? 0) * (obj.scaleX ?? 1) / W) * 100,
      rotation: obj.angle ?? 0,
      previewUrl: logoUrl ?? undefined,
    });
  }, [logoUrl, onPlacementChange]);

  // Init Fabric canvas with product background
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    import('fabric').then(({ fabric }) => {
      if (fabricRef.current) fabricRef.current.dispose();

      const W = containerRef.current!.clientWidth || 320;
      const H = Math.round(W * 1.18);

      const canvas = new fabric.Canvas(canvasRef.current!, {
        width: W, height: H,
        backgroundColor: '#F4F3EF',
        selection: false,
      });
      fabricRef.current = canvas;

      // Load product image as non-selectable background
      fabric.Image.fromURL(productImageUrl, (img: any) => {
        img.set({ left: 0, top: 0, selectable: false, evented: false });
        img.scaleToWidth(W);
        canvas.add(img);
        canvas.sendToBack(img);
        setCanvasReady(true);
        canvas.renderAll();
      }, { crossOrigin: 'anonymous' });

      canvas.on('object:modified', () => {
        if (logoObjRef.current) emitPlacement(logoObjRef.current, selectedZoneId ?? 'manual');
      });
    });
    return () => { fabricRef.current?.dispose(); };
  }, [productImageUrl]);

  // Add/update logo on canvas
  useEffect(() => {
    if (!canvasReady || !fabricRef.current || !logoUrl) return;
    import('fabric').then(({ fabric }) => {
      const c = fabricRef.current;
      if (logoObjRef.current) { c.remove(logoObjRef.current); logoObjRef.current = null; }

      const W = c.width ?? 320;
      const H = c.height ?? 380;

      // Determine initial position from zone or centre
      let cx = W / 2, cy = H * 0.33, initScale = 0.28;
      const zone = product.printZones.find(z => z.id === (selectedZoneId ?? product.printZones[0]?.id));
      if (zone) {
        cx = (zone.x / 100) * W + (zone.width / 100) * W / 2;
        cy = (zone.y / 100) * H + (zone.height / 100) * H / 2;
        initScale = (zone.width / 100) * 0.92;
      }

      fabric.Image.fromURL(logoUrl, (img: any) => {
        const targetW = W * initScale;
        const scale = targetW / (img.width ?? 100);
        img.set({
          left: cx - (img.width ?? 0) * scale / 2,
          top: cy - (img.height ?? 0) * scale / 2,
          scaleX: scale, scaleY: scale,
          selectable: true, evented: true,
          hasControls: true, hasBorders: true,
          cornerStyle: 'circle', cornerSize: 9,
          cornerColor: '#1B3A6B', borderColor: '#1B3A6B',
          borderScaleFactor: 1.5, transparentCorners: false,
          lockUniScaling: true,
        });
        c.add(img);
        c.setActiveObject(img);
        c.renderAll();
        logoObjRef.current = img;
        emitPlacement(img, selectedZoneId ?? 'manual');
      }, { crossOrigin: 'anonymous' });
    });
  }, [canvasReady, logoUrl, selectedZoneId]);

  // ── Toolbar helpers ──────────────────────────────────────────────────────
  const snapCenter = () => {
    if (!logoObjRef.current || !fabricRef.current) return;
    const c = fabricRef.current;
    const obj = logoObjRef.current;
    obj.set({ left: (c.width - (obj.width ?? 0) * (obj.scaleX ?? 1)) / 2 });
    c.renderAll(); emitPlacement(obj, selectedZoneId ?? 'manual');
  };
  const snapLeft = () => {
    if (!logoObjRef.current || !fabricRef.current) return;
    const obj = logoObjRef.current;
    obj.set({ left: fabricRef.current.width * 0.06 });
    fabricRef.current.renderAll(); emitPlacement(obj, selectedZoneId ?? 'manual');
  };
  const snapRight = () => {
    if (!logoObjRef.current || !fabricRef.current) return;
    const c = fabricRef.current; const obj = logoObjRef.current;
    obj.set({ left: c.width * 0.94 - (obj.width ?? 0) * (obj.scaleX ?? 1) });
    c.renderAll(); emitPlacement(obj, selectedZoneId ?? 'manual');
  };
  const rotate = () => {
    if (!logoObjRef.current || !fabricRef.current) return;
    logoObjRef.current.set({ angle: ((logoObjRef.current.angle ?? 0) + 15) % 360 });
    fabricRef.current.renderAll(); emitPlacement(logoObjRef.current, selectedZoneId ?? 'manual');
  };
  const scale = (delta: number) => {
    if (!logoObjRef.current || !fabricRef.current) return;
    const s = Math.max(0.05, Math.min(1.5, (logoObjRef.current.scaleX ?? 0.25) + delta));
    logoObjRef.current.set({ scaleX: s, scaleY: s });
    fabricRef.current.renderAll(); emitPlacement(logoObjRef.current, selectedZoneId ?? 'manual');
  };

  const selectZone = (zone: PrintZone) => {
    setSelectedZoneId(zone.id);
    if (!logoObjRef.current || !fabricRef.current) return;
    const c = fabricRef.current;
    const W = c.width ?? 320; const H = c.height ?? 380;
    const obj = logoObjRef.current;
    const cx = (zone.x / 100) * W + (zone.width / 100) * W / 2;
    const cy = (zone.y / 100) * H + (zone.height / 100) * H / 2;
    const ns = (zone.width / 100) * W * 0.85 / (obj.width ?? 100);
    obj.set({ left: cx - (obj.width ?? 0) * ns / 2, top: cy - (obj.height ?? 0) * ns / 2, scaleX: ns, scaleY: ns });
    c.setActiveObject(obj); c.renderAll();
    emitPlacement(obj, zone.id);
  };

  return (
    <div className="space-y-3">
      {/* Zone buttons */}
      <div className="grid grid-cols-2 gap-1.5">
        {product.printZones.map((z) => (
          <button key={z.id} onClick={() => selectZone(z)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-xs transition-all ${
              selectedZoneId === z.id ? 'border-primary bg-primary/5 font-bold text-primary' : 'border-border hover:border-primary/40 text-muted-foreground'
            }`}
          >
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${selectedZoneId === z.id ? 'bg-primary' : 'bg-border'}`} />
            {z.label}
          </button>
        ))}
      </div>

      {/* Fabric canvas */}
      <div ref={containerRef} className="relative rounded-xl overflow-hidden border border-border shadow-sm" style={{ aspectRatio: '0.85' }}>
        <canvas ref={canvasRef} className="w-full h-full block" />
        {!logoUrl && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center px-6">
              <Move className="mx-auto mb-2 text-muted-foreground/40" size={24} />
              <p className="text-xs text-muted-foreground/60 font-medium">Sélectionne une zone ci-dessus<br/>puis upload ton logo</p>
            </div>
          </div>
        )}
      </div>

      {/* Alignment & transform toolbar */}
      {logoUrl && (
        <div className="flex items-center justify-between bg-secondary rounded-xl px-3 py-2 border border-border">
          <div className="flex gap-1">
            <button onClick={snapLeft} title="Gauche" className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background transition-all">
              <AlignLeft size={13} />
            </button>
            <button onClick={snapCenter} title="Centrer" className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background transition-all">
              <AlignCenter size={13} />
            </button>
            <button onClick={snapRight} title="Droite" className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background transition-all">
              <AlignRight size={13} />
            </button>
          </div>
          <div className="w-px h-5 bg-border" />
          <div className="flex gap-1">
            <button onClick={() => scale(-0.06)} title="Réduire" className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background transition-all">
              <ZoomOut size={13} />
            </button>
            <button onClick={() => scale(0.06)} title="Agrandir" className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background transition-all">
              <ZoomIn size={13} />
            </button>
            <button onClick={rotate} title="+15°" className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background transition-all">
              <RotateCcw size={13} />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground hidden sm:block">Glisse pour placer</p>
        </div>
      )}
    </div>
  );
}
