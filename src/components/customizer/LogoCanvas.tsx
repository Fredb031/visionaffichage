import { useEffect, useRef } from 'react';

interface LogoCanvasProps {
  logoUrl: string;
  width: number;
  height: number;
  onTransform?: (x: number, y: number, w: number, h: number, rotation: number) => void;
}

/**
 * Canvas-based logo placement using Fabric.js.
 * Allows drag, resize, and rotate of the logo on the product.
 */
export function LogoCanvas({ logoUrl, width, height, onTransform }: LogoCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fabricRef = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    import('fabric').then(({ fabric }) => {
      const canvas = new fabric.Canvas(canvasRef.current!, {
        width,
        height,
        backgroundColor: 'transparent',
        selection: true,
      });
      fabricRef.current = canvas;

      fabric.Image.fromURL(logoUrl, (img) => {
        const scale = Math.min((width * 0.6) / (img.width ?? 1), (height * 0.6) / (img.height ?? 1));
        img.set({
          left: width / 2,
          top: height / 2,
          originX: 'center',
          originY: 'center',
          scaleX: scale,
          scaleY: scale,
          cornerStyle: 'circle',
          cornerColor: '#1B3A6B',
          transparentCorners: false,
        });
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();

        img.on('modified', () => {
          onTransform?.(
            img.left ?? 0,
            img.top ?? 0,
            (img.width ?? 0) * (img.scaleX ?? 1),
            (img.height ?? 0) * (img.scaleY ?? 1),
            img.angle ?? 0
          );
        });
      });

      return () => {
        canvas.dispose();
      };
    });
  }, [logoUrl, width, height, onTransform]);

  return (
    <canvas
      ref={canvasRef}
      className="border border-dashed border-border rounded-lg"
      style={{ width, height }}
    />
  );
}
