import { Suspense, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import type { Product, ProductColor } from '@/data/products';
import type { LogoPlacement } from '@/types/customization';

// ── Color-tinted product plane ──────────────────────────────────────────────
function ProductPlane({
  textureUrl,
  logoUrl,
  logoPlacement,
  colorHex,
  isRotating,
}: {
  textureUrl: string;
  logoUrl?: string;
  logoPlacement?: LogoPlacement;
  colorHex: string;
  isRotating: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const texture = useTexture(textureUrl);

  // Fix: use correct texture settings for product images
  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
  }, [texture]);

  useFrame((_, delta) => {
    if (groupRef.current && isRotating) {
      groupRef.current.rotation.y += delta * 0.35;
    }
  });

  // Convert hex to THREE.Color for tint overlay
  const tintColor = new THREE.Color(colorHex);

  // Logo position from placement percentages → Three.js coordinates
  const logoX = logoPlacement ? ((logoPlacement.x ?? 50) - 50) / 50 * 0.75 : 0;
  const logoY = logoPlacement ? (50 - (logoPlacement.y ?? 35)) / 50 * 1.05 : 0;
  const logoScale = logoPlacement?.width ? Math.max(0.05, logoPlacement.width / 100 * 1.5) : 0.28;

  return (
    <group ref={groupRef}>
      {/* Product image on a plane — WHITE material so texture shows true colors */}
      <mesh castShadow>
        <planeGeometry args={[1.7, 2.3]} />
        <meshStandardMaterial
          map={texture}
          transparent
          alphaTest={0.05}
          side={THREE.DoubleSide}
          // No color multiply — use white so image colors are accurate
          color={new THREE.Color(1, 1, 1)}
        />
      </mesh>

      {/* Color overlay — semi-transparent tint on top when color is not white/default */}
      {colorHex !== '#f5f5f0' && colorHex !== '#ffffff' && (
        <mesh position={[0, 0, 0.003]}>
          <planeGeometry args={[1.55, 2.1]} />
          <meshBasicMaterial
            color={tintColor}
            transparent
            opacity={0.22}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Logo overlay */}
      {logoUrl && logoPlacement && (
        <LogoOverlay
          logoUrl={logoUrl}
          x={logoX}
          y={logoY}
          scale={logoScale}
          rotation={logoPlacement.rotation ?? 0}
        />
      )}
    </group>
  );
}

function LogoOverlay({
  logoUrl, x, y, scale, rotation,
}: {
  logoUrl: string; x: number; y: number; scale: number; rotation: number;
}) {
  const logoTexture = useTexture(logoUrl);
  useEffect(() => {
    logoTexture.colorSpace = THREE.SRGBColorSpace;
    logoTexture.needsUpdate = true;
  }, [logoTexture]);

  return (
    <mesh position={[x, y, 0.015]} rotation={[0, 0, (rotation * Math.PI) / 180]}>
      <planeGeometry args={[scale, scale * 0.65]} />
      <meshBasicMaterial map={logoTexture} transparent alphaTest={0.02} depthWrite={false} />
    </mesh>
  );
}

// ── Loading skeleton for 3D canvas ─────────────────────────────────────────
function CanvasFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-secondary">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-xs text-muted-foreground font-medium">Chargement 3D...</p>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export function ProductViewer3D({
  product,
  selectedColor,
  logoPlacement,
  activeView,
  onViewChange,
}: {
  product: Product;
  selectedColor: ProductColor | null;
  logoPlacement: LogoPlacement | null;
  activeView: 'front' | 'back' | 'left' | 'right';
  onViewChange: (view: 'front' | 'back' | 'left' | 'right') => void;
}) {
  const [isAutoRotating, setIsAutoRotating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showHint, setShowHint] = useState(true);

  const getImageUrl = () => {
    if (activeView === 'front') return selectedColor?.imageDevant ?? product.imageDevant;
    if (activeView === 'back') return selectedColor?.imageDos ?? product.imageDos;
    // left/right fallback to front
    return selectedColor?.imageDevant ?? product.imageDevant;
  };

  const logoUrl = logoPlacement?.previewUrl ?? logoPlacement?.processedUrl;
  const colorHex = selectedColor?.hex ?? '#f5f5f0';

  const VIEW_BUTTONS = [
    { id: 'front' as const, label: 'Devant' },
    { id: 'back' as const, label: 'Dos' },
    { id: 'left' as const, label: 'Gauche' },
    { id: 'right' as const, label: 'Droite' },
  ];

  return (
    <div className="relative w-full flex flex-col rounded-2xl overflow-hidden bg-secondary border border-border" style={{ minHeight: '400px' }}>
      {/* 3D Canvas */}
      <div
        className="flex-1 relative"
        style={{ height: '360px' }}
        onPointerDown={() => { setIsDragging(true); setIsAutoRotating(false); setShowHint(false); }}
        onPointerUp={() => setIsDragging(false)}
      >
        <Canvas
          camera={{ position: [0, 0, 2.8], fov: 38 }}
          style={{ background: 'transparent' }}
          gl={{ antialias: true, alpha: true }}
        >
          <Suspense fallback={null}>
            <ambientLight intensity={1.1} />
            <directionalLight position={[3, 5, 5]} intensity={0.9} />
            <directionalLight position={[-2, -1, -3]} intensity={0.25} />

            <ProductPlane
              textureUrl={getImageUrl()}
              logoUrl={logoUrl}
              logoPlacement={logoPlacement ?? undefined}
              colorHex={colorHex}
              isRotating={isAutoRotating && !isDragging}
            />

            <OrbitControls
              enablePan={false}
              enableZoom={false}
              minPolarAngle={Math.PI / 2.8}
              maxPolarAngle={Math.PI / 1.6}
              rotateSpeed={0.65}
            />
          </Suspense>
        </Canvas>

        {/* Drag hint — fades out after first drag */}
        <AnimatePresence>
          {showHint && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 1.2 }}
              className="absolute top-3 left-1/2 -translate-x-1/2 bg-foreground/60 backdrop-blur-sm text-background text-[11px] font-semibold px-3 py-1.5 rounded-full pointer-events-none whitespace-nowrap"
            >
              ⟳ Glisse pour tourner
            </motion.div>
          )}
        </AnimatePresence>

        {/* Color indicator */}
        {selectedColor && (
          <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-full px-3 py-1.5 border border-border">
            <div className="w-3 h-3 rounded-full ring-1 ring-border" style={{ background: selectedColor.hex }} />
            <span className="text-[11px] font-semibold text-foreground">{selectedColor.name}</span>
          </div>
        )}

        {/* Logo badge */}
        {logoPlacement?.previewUrl && (
          <div className="absolute bottom-3 right-3 bg-green-700/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
            Logo placé
          </div>
        )}
      </div>

      {/* View controls */}
      <div className="flex items-center justify-center gap-1.5 py-3 border-t border-border bg-background/60 backdrop-blur-sm flex-wrap px-3">
        {VIEW_BUTTONS.map((btn) => (
          <button
            key={btn.id}
            onClick={() => onViewChange(btn.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
              activeView === btn.id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-background text-muted-foreground border border-border hover:border-primary hover:text-primary'
            }`}
          >
            {btn.label}
          </button>
        ))}
        <button
          onClick={() => setIsAutoRotating(!isAutoRotating)}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
            isAutoRotating
              ? 'bg-accent text-accent-foreground'
              : 'bg-background text-muted-foreground border border-border hover:border-accent'
          }`}
        >
          {isAutoRotating ? '■ Stop' : '▶ Auto'}
        </button>
      </div>
    </div>
  );
}
