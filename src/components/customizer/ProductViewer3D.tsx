import { Suspense, useRef, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useTexture, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import type { Product, ProductColor } from '@/data/products';
import type { LogoPlacement } from '@/types/customization';
import { createFabricMaterial, createLogoMaterial } from '@/lib/garmentGeometry';
import { useLang } from '@/lib/langContext';

// ── Colour-correct product texture ──────────────────────────────────────────
function useProductTexture(url: string) {
  const texture = useTexture(url);
  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
  }, [texture]);
  return texture;
}

// ── Shirt / Hoodie 3D mesh ───────────────────────────────────────────────────
function ShirtMesh({
  textureUrl, colorHex, logoUrl, logoPlacement, isRotating,
}: {
  textureUrl: string; colorHex: string; logoUrl?: string;
  logoPlacement?: LogoPlacement; isRotating: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const texture = useProductTexture(textureUrl);

  useFrame((_, delta) => {
    if (groupRef.current && isRotating) {
      groupRef.current.rotation.y += delta * 0.38;
    }
  });

  // Build fresh material on color/texture change
  const mat = createFabricMaterial(texture, colorHex);
  const colorOverlay = colorHex !== '#f5f5f0' && colorHex !== '#ffffff'
    ? new THREE.Color(colorHex).lerp(new THREE.Color('#ffffff'), 0.78)
    : null;

  // Logo positioning
  const lx = logoPlacement ? ((logoPlacement.x ?? 50) - 50) / 100 * 1.8 : 0;
  const ly = logoPlacement ? (50 - (logoPlacement.y ?? 32)) / 100 * 2.4 : 0;
  const lw = logoPlacement?.width ? (logoPlacement.width / 100) * 1.8 * 0.9 : 0.34;

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Main fabric plane — high poly for smooth waves */}
      <mesh receiveShadow castShadow>
        <planeGeometry args={[1.8, 2.4, 48, 64]} />
        <meshStandardMaterial
          map={texture}
          color={colorOverlay ?? '#ffffff'}
          transparent
          side={THREE.DoubleSide}
          roughness={0.82}
          metalness={0}
        />
      </mesh>

      {/* Color tint overlay for non-white products */}
      {colorHex !== '#f5f5f0' && colorHex !== '#ffffff' && (
        <mesh position={[0, 0, 0.004]}>
          <planeGeometry args={[1.62, 2.16, 1, 1]} />
          <meshBasicMaterial
            color={new THREE.Color(colorHex)}
            transparent
            opacity={0.18}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Logo overlay */}
      {logoUrl && logoPlacement && (
        <LogoMesh url={logoUrl} x={lx} y={ly} width={lw} rotation={logoPlacement.rotation ?? 0} />
      )}
    </group>
  );
}

// ── Cap 3D mesh ──────────────────────────────────────────────────────────────
function CapMesh({
  textureUrl, colorHex, logoUrl, logoPlacement, isRotating,
}: {
  textureUrl: string; colorHex: string; logoUrl?: string;
  logoPlacement?: LogoPlacement; isRotating: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const texture = useProductTexture(textureUrl);
  const colorTint = colorHex !== '#f5f5f0' && colorHex !== '#ffffff'
    ? new THREE.Color(colorHex).lerp(new THREE.Color('#ffffff'), 0.7)
    : new THREE.Color('#ffffff');

  useFrame((_, delta) => {
    if (groupRef.current && isRotating) groupRef.current.rotation.y += delta * 0.38;
  });

  // Logo on front panel of cap
  const lx = logoPlacement ? ((logoPlacement.x ?? 50) - 50) / 100 * 0.6 : 0;
  const ly = logoPlacement ? (50 - (logoPlacement.y ?? 40)) / 100 * 0.5 : 0;
  const lz = 0.86;
  const lw = logoPlacement?.width ? (logoPlacement.width / 100) * 0.5 : 0.18;

  return (
    <group ref={groupRef} rotation={[-0.15, 0, 0]}>
      {/* Dome */}
      <mesh castShadow>
        <sphereGeometry args={[0.85, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial map={texture} color={colorTint} roughness={0.75} />
      </mesh>
      {/* Brim */}
      <mesh position={[0, -0.01, 0.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0, 1.2, 48]} />
        <meshStandardMaterial map={texture} color={colorTint} roughness={0.75} side={THREE.DoubleSide} />
      </mesh>
      {/* Button on top */}
      <mesh position={[0, 0.85, 0]}>
        <sphereGeometry args={[0.06, 12, 8]} />
        <meshStandardMaterial color={colorTint} roughness={0.6} />
      </mesh>

      {/* Logo on front */}
      {logoUrl && logoPlacement && (
        <LogoMeshSpherical url={logoUrl} x={lx} y={ly} z={lz} width={lw} />
      )}
    </group>
  );
}

// ── Beanie/Toque 3D mesh ─────────────────────────────────────────────────────
function BeanieMesh({
  textureUrl, colorHex, logoUrl, logoPlacement, isRotating,
}: {
  textureUrl: string; colorHex: string; logoUrl?: string;
  logoPlacement?: LogoPlacement; isRotating: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const texture = useProductTexture(textureUrl);
  const colorTint = colorHex !== '#f5f5f0' && colorHex !== '#ffffff'
    ? new THREE.Color(colorHex).lerp(new THREE.Color('#ffffff'), 0.72)
    : new THREE.Color('#ffffff');

  useFrame((_, delta) => {
    if (groupRef.current && isRotating) groupRef.current.rotation.y += delta * 0.38;
  });

  const lx = logoPlacement ? ((logoPlacement.x ?? 50) - 50) / 100 * 0.55 : 0;
  const ly = logoPlacement ? (50 - (logoPlacement.y ?? 40)) / 100 * 0.45 : -0.05;
  const lz = 0.75;
  const lw = logoPlacement?.width ? (logoPlacement.width / 100) * 0.5 : 0.16;

  return (
    <group ref={groupRef}>
      {/* Body cylinder */}
      <mesh castShadow>
        <cylinderGeometry args={[0.72, 0.65, 1.35, 64, 24]} />
        <meshStandardMaterial map={texture} color={colorTint} roughness={0.9} />
      </mesh>
      {/* Rounded top cap */}
      <mesh position={[0, 0.675, 0]}>
        <sphereGeometry args={[0.72, 48, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial map={texture} color={colorTint} roughness={0.9} />
      </mesh>
      {/* Ribbed cuff ring */}
      <mesh position={[0, -0.62, 0]}>
        <cylinderGeometry args={[0.67, 0.65, 0.18, 48, 4]} />
        <meshStandardMaterial color={colorTint} roughness={0.95} />
      </mesh>

      {logoUrl && logoPlacement && (
        <LogoMeshSpherical url={logoUrl} x={lx} y={ly} z={lz} width={lw} />
      )}
    </group>
  );
}

// ── Logo overlay for flat surfaces ─────────────────────────────────────────
function LogoMesh({ url, x, y, width, rotation }: { url: string; x: number; y: number; width: number; rotation: number }) {
  const texture = useTexture(url);
  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.premultiplyAlpha = false;
    texture.needsUpdate = true;
  }, [texture]);

  return (
    <mesh position={[x, y, 0.018]} rotation={[0, 0, (rotation * Math.PI) / 180]}>
      <planeGeometry args={[width, width * 0.6]} />
      <meshBasicMaterial map={texture} transparent alphaTest={0.01} depthWrite={false} />
    </mesh>
  );
}

// ── Logo overlay for curved surfaces ───────────────────────────────────────
function LogoMeshSpherical({ url, x, y, z, width }: { url: string; x: number; y: number; z: number; width: number }) {
  const texture = useTexture(url);
  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.premultiplyAlpha = false;
    texture.needsUpdate = true;
  }, [texture]);

  return (
    <mesh position={[x, y, z]}>
      <planeGeometry args={[width, width * 0.6]} />
      <meshBasicMaterial map={texture} transparent alphaTest={0.01} depthWrite={false} />
    </mesh>
  );
}

// ── Placeholder while texture loads ────────────────────────────────────────
function LoadingFallback({ category }: { category: string }) {
  return (
    <mesh>
      <planeGeometry args={[1.8, 2.4]} />
      <meshBasicMaterial color="#E9E7E1" />
    </mesh>
  );
}

// ── Scene wrapper ────────────────────────────────────────────────────────────
function Scene({
  product, selectedColor, logoPlacement, isRotating, isDragging,
}: {
  product: Product; selectedColor: ProductColor | null;
  logoPlacement: LogoPlacement | null; isRotating: boolean; isDragging: boolean;
}) {
  const { camera } = useThree();

  useEffect(() => {
    // Adjust camera for caps/beanies
    if (product.category === 'cap' || product.category === 'toque') {
      camera.position.set(0, 0.3, 2.6);
    } else {
      camera.position.set(0, 0, 2.8);
    }
  }, [product.category, camera]);

  const getImageUrl = (view: string) => {
    if (view === 'back') return selectedColor?.imageDos ?? product.imageDos;
    return selectedColor?.imageDevant ?? product.imageDevant;
  };

  const colorHex = selectedColor?.hex ?? '#f5f5f0';
  const logoUrl = logoPlacement?.previewUrl ?? logoPlacement?.processedUrl;

  const meshProps = {
    textureUrl: getImageUrl('front'),
    colorHex,
    logoUrl,
    logoPlacement: logoPlacement ?? undefined,
    isRotating: isRotating && !isDragging,
  };

  return (
    <>
      <ambientLight intensity={1.3} />
      <directionalLight position={[3, 5, 4]} intensity={0.9} castShadow />
      <directionalLight position={[-2, 2, -3]} intensity={0.35} />
      <pointLight position={[0, -3, 2]} intensity={0.2} color="#e8e4dc" />

      <Suspense fallback={<LoadingFallback category={product.category} />}>
        {(product.category === 'tshirt' || product.category === 'hoodie' || product.category === 'polo' || product.category === 'manteau') && (
          <ShirtMesh {...meshProps} />
        )}
        {product.category === 'cap' && <CapMesh {...meshProps} />}
        {product.category === 'toque' && <BeanieMesh {...meshProps} />}
      </Suspense>

      <OrbitControls
        enablePan={false}
        enableZoom={false}
        minPolarAngle={Math.PI / 3.5}
        maxPolarAngle={Math.PI / 1.7}
        rotateSpeed={0.62}
      />
    </>
  );
}

// ── Main exported component ──────────────────────────────────────────────────
export function ProductViewer3D({
  product, selectedColor, logoPlacement, activeView, onViewChange, compact = false,
}: {
  product: Product; selectedColor: ProductColor | null;
  logoPlacement: LogoPlacement | null;
  activeView: 'front' | 'back' | 'left' | 'right';
  onViewChange: (v: 'front' | 'back' | 'left' | 'right') => void;
  compact?: boolean;
}) {
  const { t } = useLang();
  const [isAutoRotating, setIsAutoRotating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const canvasHeight = compact ? 280 : 360;

  const VIEW_LABELS: Record<string, string> = {
    front: t('devant'), back: t('dos'), left: t('gauche'), right: t('droite'),
  };

  return (
    <div
      className="relative w-full flex flex-col rounded-2xl overflow-hidden bg-secondary border border-border"
      style={{ minHeight: canvasHeight + 48 }}
    >
      {/* 3D Canvas */}
      <div
        style={{ height: canvasHeight }}
        className="relative"
        onPointerDown={() => { setIsDragging(true); setIsAutoRotating(false); setShowHint(false); }}
        onPointerUp={() => setIsDragging(false)}
      >
        <Canvas
          camera={{ position: [0, 0, 2.8], fov: 38 }}
          style={{ background: 'transparent' }}
          gl={{ antialias: true, alpha: true, shadowMap: { enabled: true } } as any}
          shadows
        >
          <Suspense fallback={null}>
            <Scene
              product={product}
              selectedColor={selectedColor}
              logoPlacement={logoPlacement}
              isRotating={isAutoRotating}
              isDragging={isDragging}
            />
          </Suspense>
        </Canvas>

        {/* Drag hint */}
        <AnimatePresence>
          {showHint && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 0.7, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 1.4 }}
              className="absolute top-3 left-1/2 -translate-x-1/2 bg-foreground/65 backdrop-blur-sm text-background text-[11px] font-semibold px-3 py-1.5 rounded-full pointer-events-none"
            >
              ⟳ {t('glisserTourner')}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Color pill */}
        {selectedColor && (
          <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-background/85 backdrop-blur-sm rounded-full px-2.5 py-1.5 border border-border">
            <div className="w-3 h-3 rounded-full ring-1 ring-border flex-shrink-0" style={{ background: selectedColor.hex }} />
            <span className="text-[11px] font-semibold text-foreground">{selectedColor.name}</span>
          </div>
        )}

        {/* Logo badge */}
        {logoPlacement?.previewUrl && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute bottom-3 right-3 bg-green-700/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-full"
          >
            {t('logoPlace')}
          </motion.div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-1.5 py-2.5 border-t border-border bg-background/60 backdrop-blur-sm flex-wrap px-3">
        {(['front', 'back', 'left', 'right'] as const).map((v) => (
          <button
            key={v}
            onClick={() => onViewChange(v)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
              activeView === v
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-background text-muted-foreground border border-border hover:border-primary hover:text-primary'
            }`}
          >
            {VIEW_LABELS[v]}
          </button>
        ))}
        <button
          onClick={() => setIsAutoRotating(!isAutoRotating)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
            isAutoRotating ? 'bg-accent text-accent-foreground' : 'bg-background text-muted-foreground border border-border'
          }`}
        >
          {isAutoRotating ? '■ Stop' : `▶ ${t('auto')}`}
        </button>
      </div>
    </div>
  );
}
