/**
 * ProductViewer3D
 *
 * ATCF2500 Hoodie  → pixel-traced real silhouette + hood bump + pocket + cuffs + drawstrings
 * T-Shirt / Hoodie → accurate shape with sleeves
 * Cap              → dome + brim + button + sweatband
 * Beanie           → ribbed cylinder + rounded crown + cuff + pompom
 */
import { Suspense, useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import type { Product, ProductColor } from '@/data/products';
import type { LogoPlacement } from '@/types/customization';
import {
  createHoodieGeometry, createHoodBumpGeometry,
  createPocketGeometry, createCuffGeometry, createDrawstringGeometry,
} from '@/lib/hoodie3D';
import {
  createShirtShape, createCapParts, createBeanieParts,
  createFabricMaterial, isNeutralColor,
} from '@/lib/garmentGeometry';
import { useLang } from '@/lib/langContext';

// ── Texture helper ──────────────────────────────────────────────────────────
function useProdTex(url: string) {
  const tex = useTexture(url);
  useEffect(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
  }, [tex, url]);
  return tex;
}

// ── Logo — flat (shirt / hoodie body) ──────────────────────────────────────
function LogoFlat({ url, x, y, w, rot = 0 }: { url: string; x: number; y: number; w: number; rot?: number }) {
  const tex = useTexture(url);
  useEffect(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.premultiplyAlpha = false;
    tex.needsUpdate = true;
  }, [tex, url]);
  return (
    <mesh position={[x, y, 0.045]} rotation={[0, 0, rot * Math.PI / 180]}>
      <planeGeometry args={[w, w * 0.62]} />
      <meshBasicMaterial map={tex} transparent alphaTest={0.01} depthWrite={false} />
    </mesh>
  );
}

// ── Logo — curved (cap / beanie front) ─────────────────────────────────────
function LogoCurved({ url, z = 0.91 }: { url: string; z?: number }) {
  const tex = useTexture(url);
  useEffect(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.premultiplyAlpha = false;
    tex.needsUpdate = true;
  }, [tex, url]);
  return (
    <mesh position={[0, -0.06, z]}>
      <planeGeometry args={[0.36, 0.23]} />
      <meshBasicMaterial map={tex} transparent alphaTest={0.01} depthWrite={false} />
    </mesh>
  );
}

// ── ATCF2500 Hoodie — pixel-perfect ────────────────────────────────────────
function HoodieATCF2500({
  texUrl, colorHex, logoUrl, logoPlacement, rotating,
}: {
  texUrl: string; colorHex: string; logoUrl?: string;
  logoPlacement?: LogoPlacement; rotating: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const tex = useProdTex(texUrl);

  // Memoised geometries
  const bodyGeo   = useMemo(() => createHoodieGeometry(), []);
  const hoodGeo   = useMemo(() => createHoodBumpGeometry(), []);
  const pocketGeo = useMemo(() => createPocketGeometry(), []);
  const cuffL     = useMemo(() => createCuffGeometry('left'), []);
  const cuffR     = useMemo(() => createCuffGeometry('right'), []);
  const dsL       = useMemo(() => createDrawstringGeometry('left'), []);
  const dsR       = useMemo(() => createDrawstringGeometry('right'), []);

  useFrame((_, dt) => {
    if (groupRef.current && rotating) groupRef.current.rotation.y += dt * 0.34;
  });

  const neutral = isNeutralColor(colorHex);

  // Materials
  const bodyMat = useMemo(() => createFabricMaterial(tex, colorHex, 0.87), [tex, colorHex]);

  const darkShade = useMemo(() => {
    const c = neutral ? new THREE.Color(0.08, 0.08, 0.08) : new THREE.Color(colorHex).multiplyScalar(0.72);
    return new THREE.MeshStandardMaterial({ color: c, roughness: 0.92 });
  }, [colorHex, neutral]);

  const midShade = useMemo(() => {
    const c = neutral ? new THREE.Color(0.12, 0.12, 0.12) : new THREE.Color(colorHex).multiplyScalar(0.80);
    return new THREE.MeshStandardMaterial({ color: c, roughness: 0.90 });
  }, [colorHex, neutral]);

  const cuffMat = useMemo(() => {
    const c = neutral ? new THREE.Color(0.10, 0.10, 0.10) : new THREE.Color(colorHex).multiplyScalar(0.76);
    return new THREE.MeshStandardMaterial({ color: c, roughness: 0.94 });
  }, [colorHex, neutral]);

  // Logo world coords: placement is % of product image → body is ~1.6W × 2.0H
  const lx = logoPlacement ? ((logoPlacement.x ?? 50) - 50) / 100 * 0.52 : 0;
  const ly = logoPlacement ? (50 - (logoPlacement.y ?? 33)) / 100 * 0.85 + 0.08 : 0.18;
  const lw = logoPlacement?.width ? (logoPlacement.width / 100) * 0.72 : 0.26;

  return (
    <group ref={groupRef} position={[0, -0.05, 0]}>

      {/* ── Main body silhouette ── */}
      <mesh geometry={bodyGeo} material={bodyMat} castShadow />

      {/* ── Colour tint overlay (for non-white colours) ── */}
      {!neutral && (
        <mesh position={[0, -0.05, 0.012]}>
          <planeGeometry args={[0.88, 1.80]} />
          <meshBasicMaterial color={colorHex} transparent opacity={0.17} depthWrite={false} />
        </mesh>
      )}

      {/* ── Hood depth bump ── */}
      <mesh geometry={hoodGeo} material={midShade} castShadow />

      {/* ── Kangaroo pocket ── */}
      <mesh geometry={pocketGeo} material={darkShade} />

      {/* ── Sleeve cuffs ── */}
      <mesh geometry={cuffL} material={cuffMat} />
      <mesh geometry={cuffR} material={cuffMat} />

      {/* ── Drawstrings ── */}
      <mesh geometry={dsL}>
        <meshStandardMaterial color="#0a0a0a" roughness={0.96} />
      </mesh>
      <mesh geometry={dsR}>
        <meshStandardMaterial color="#0a0a0a" roughness={0.96} />
      </mesh>

      {/* ── Metal eyelets ── */}
      {([-0.068, 0.068] as const).map((ex) => (
        <mesh key={ex} position={[ex, 0.868, 0.042]}>
          <torusGeometry args={[0.017, 0.007, 8, 20]} />
          <meshStandardMaterial color="#e0e0e0" metalness={0.75} roughness={0.25} />
        </mesh>
      ))}

      {/* ── Drawstring tips (aglets) ── */}
      {([-0.044, 0.044] as const).map((ax) => (
        <mesh key={ax} position={[ax * 0.6, 0.305, 0.038]}>
          <cylinderGeometry args={[0.009, 0.007, 0.028, 8]} />
          <meshStandardMaterial color="#e8e8e8" metalness={0.6} roughness={0.35} />
        </mesh>
      ))}

      {/* ── Logo overlay ── */}
      {logoUrl && logoPlacement && (
        <LogoFlat url={logoUrl} x={lx} y={ly} w={lw} rot={logoPlacement.rotation ?? 0} />
      )}
    </group>
  );
}

// ── Generic T-Shirt ─────────────────────────────────────────────────────────
function ShirtMesh({ texUrl, colorHex, logoUrl, logoPlacement, rotating }: {
  texUrl: string; colorHex: string; logoUrl?: string;
  logoPlacement?: LogoPlacement; rotating: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const tex = useProdTex(texUrl);
  const geo = useMemo(() => createShirtShape(false), []);
  const mat = useMemo(() => createFabricMaterial(tex, colorHex), [tex, colorHex]);
  useFrame((_, dt) => { if (ref.current && rotating) ref.current.rotation.y += dt * 0.36; });

  const lx = logoPlacement ? ((logoPlacement.x ?? 50) - 50) / 100 * 0.95 : 0;
  const ly = logoPlacement ? (50 - (logoPlacement.y ?? 32)) / 100 * 1.10 : 0.05;
  const lw = logoPlacement?.width ? (logoPlacement.width / 100) * 0.88 : 0.28;

  return (
    <group ref={ref}>
      <mesh geometry={geo} material={mat} castShadow />
      {!isNeutralColor(colorHex) && (
        <mesh position={[0, 0, 0.009]}>
          <planeGeometry args={[0.72, 1.80]} />
          <meshBasicMaterial color={colorHex} transparent opacity={0.16} depthWrite={false} />
        </mesh>
      )}
      {logoUrl && logoPlacement && <LogoFlat url={logoUrl} x={lx} y={ly} w={lw} rot={logoPlacement.rotation ?? 0} />}
    </group>
  );
}

// ── Cap ─────────────────────────────────────────────────────────────────────
function CapMesh({ texUrl, colorHex, logoUrl, rotating }: {
  texUrl: string; colorHex: string; logoUrl?: string; rotating: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const tex = useProdTex(texUrl);
  const parts = useMemo(() => createCapParts(), []);
  const mat = useMemo(() => createFabricMaterial(tex, colorHex, 0.78), [tex, colorHex]);
  const solid = useMemo(() => new THREE.MeshStandardMaterial({
    color: isNeutralColor(colorHex) ? new THREE.Color('#d0cdc8') : new THREE.Color(colorHex).lerp(new THREE.Color('#888'), 0.28),
    roughness: 0.82,
  }), [colorHex]);
  useFrame((_, dt) => { if (ref.current && rotating) ref.current.rotation.y += dt * 0.36; });
  return (
    <group ref={ref} rotation={[-0.1, 0, 0]}>
      <mesh geometry={parts.dome} material={mat} castShadow />
      <mesh geometry={parts.brim} material={solid} castShadow />
      <mesh geometry={parts.button} material={solid} />
      <mesh geometry={parts.sweatband}><meshStandardMaterial color="#111" roughness={0.9} /></mesh>
      {logoUrl && <LogoCurved url={logoUrl} z={0.91} />}
    </group>
  );
}

// ── Beanie ──────────────────────────────────────────────────────────────────
function BeanieMesh({ texUrl, colorHex, logoUrl, rotating }: {
  texUrl: string; colorHex: string; logoUrl?: string; rotating: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const tex = useProdTex(texUrl);
  const parts = useMemo(() => createBeanieParts(), []);
  const mat = useMemo(() => createFabricMaterial(tex, colorHex, 0.92), [tex, colorHex]);
  const cuffMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: isNeutralColor(colorHex) ? new THREE.Color('#c8c5c0') : new THREE.Color(colorHex).multiplyScalar(0.80),
    roughness: 0.95,
  }), [colorHex]);
  useFrame((_, dt) => { if (ref.current && rotating) ref.current.rotation.y += dt * 0.36; });
  return (
    <group ref={ref}>
      <mesh geometry={parts.body} material={mat} castShadow />
      <mesh geometry={parts.crown} material={mat} castShadow />
      <mesh geometry={parts.cuff} material={cuffMat} />
      <mesh geometry={parts.pompom}>
        <meshStandardMaterial color={isNeutralColor(colorHex) ? '#ccc' : colorHex} roughness={1} />
      </mesh>
      {logoUrl && <LogoCurved url={logoUrl} z={0.73} />}
    </group>
  );
}

// ── Skeleton shimmer ────────────────────────────────────────────────────────
function Skeleton() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (ref.current)
      (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.22 + Math.sin(Date.now() / 420) * 0.10;
  });
  return (
    <mesh ref={ref}>
      <planeGeometry args={[1.65, 2.20]} />
      <meshBasicMaterial color="#E3E1DB" transparent opacity={0.3} />
    </mesh>
  );
}

// ── Camera per product ──────────────────────────────────────────────────────
function CameraRig({ cat }: { cat: string }) {
  const { camera } = useThree();
  useEffect(() => {
    if      (cat === 'cap')    camera.position.set(0,  0.5, 2.2);
    else if (cat === 'toque')  camera.position.set(0,  0.2, 2.4);
    else if (cat === 'hoodie') camera.position.set(0,  0.0, 3.0);
    else                       camera.position.set(0, -0.0, 2.8);
    camera.lookAt(0, 0, 0);
  }, [cat, camera]);
  return null;
}

// ── Main exported component ─────────────────────────────────────────────────
export function ProductViewer3D({
  product, selectedColor, logoPlacement, activeView, onViewChange, compact = false,
}: {
  product: Product;
  selectedColor: ProductColor | null;
  logoPlacement: LogoPlacement | null;
  activeView: 'front' | 'back' | 'left' | 'right';
  onViewChange: (v: 'front' | 'back' | 'left' | 'right') => void;
  compact?: boolean;
}) {
  const { t } = useLang();
  const [autoRot, setAutoRot]   = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hint, setHint]         = useState(true);
  const H = compact ? 260 : 360;

  const texUrl  = activeView === 'back'
    ? (selectedColor?.imageDos ?? product.imageDos)
    : (selectedColor?.imageDevant ?? product.imageDevant);
  const colorHex = selectedColor?.hex ?? '#f5f5f0';
  const logoUrl  = logoPlacement?.previewUrl ?? logoPlacement?.processedUrl;

  const sp = {
    texUrl, colorHex, logoUrl,
    logoPlacement: logoPlacement ?? undefined,
    rotating: autoRot && !dragging,
  };

  const views = [
    { id: 'front' as const, label: t('devant') },
    { id: 'back'  as const, label: t('dos') },
    { id: 'left'  as const, label: t('gauche') },
    { id: 'right' as const, label: t('droite') },
  ];

  return (
    <div
      className="relative flex flex-col rounded-2xl overflow-hidden bg-[#F8F7F4] border border-border"
      style={{ minHeight: H + 52 }}
    >
      {/* ── 3D canvas ── */}
      <div
        style={{ height: H }}
        className="relative select-none"
        onPointerDown={() => { setDragging(true); setAutoRot(false); setHint(false); }}
        onPointerUp={() => setDragging(false)}
        onPointerLeave={() => setDragging(false)}
      >
        <Canvas
          shadows
          camera={{ position: [0, 0, 3.0], fov: 36 }}
          gl={{ antialias: true, alpha: true }}
          style={{ background: 'transparent' }}
        >
          <CameraRig cat={product.category} />

          {/* Studio lighting */}
          <ambientLight intensity={1.30} />
          <directionalLight position={[3, 6, 4]}   intensity={0.92} castShadow shadow-mapSize={[2048, 2048] as [number,number]} />
          <directionalLight position={[-3, 2, -2]}  intensity={0.40} />
          <pointLight       position={[0, -5, 3]}   intensity={0.26} color="#ede8e0" />

          <Suspense fallback={<Skeleton />}>
            {product.category === 'hoodie'  && <HoodieATCF2500 {...sp} />}
            {product.category === 'tshirt'  && <ShirtMesh      {...sp} />}
            {product.category === 'polo'    && <ShirtMesh      {...sp} />}
            {product.category === 'manteau' && <ShirtMesh      {...sp} />}
            {product.category === 'cap'     && <CapMesh        {...sp} />}
            {product.category === 'toque'   && <BeanieMesh     {...sp} />}
          </Suspense>

          <OrbitControls
            enablePan={false}
            enableZoom={false}
            minPolarAngle={Math.PI / 3}
            maxPolarAngle={Math.PI / 1.8}
            rotateSpeed={0.62}
          />
        </Canvas>

        {/* Drag hint */}
        <AnimatePresence>
          {hint && (
            <motion.div
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 0.72, y: 0 }} exit={{ opacity: 0 }}
              transition={{ delay: 1.8 }}
              className="absolute top-3 left-1/2 -translate-x-1/2 bg-foreground/60 backdrop-blur-sm text-background text-[11px] font-semibold px-3 py-1.5 rounded-full pointer-events-none whitespace-nowrap"
            >
              ⟳ {t('glisserTourner')}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Colour chip */}
        {selectedColor && (
          <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-background/85 backdrop-blur-sm rounded-full px-2.5 py-1.5 border border-border">
            <div className="w-3 h-3 rounded-full ring-1 ring-border flex-shrink-0" style={{ background: selectedColor.hex }} />
            <span className="text-[11px] font-semibold text-foreground">{selectedColor.name}</span>
          </div>
        )}

        {/* Logo placed badge */}
        {logoPlacement?.previewUrl && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
            className="absolute bottom-3 right-3 bg-green-700/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-full"
          >
            {t('logoPlace')}
          </motion.div>
        )}
      </div>

      {/* ── Controls bar ── */}
      <div className="flex items-center justify-center gap-1.5 py-2.5 border-t border-border bg-background/70 backdrop-blur-sm flex-wrap px-3">
        {views.map((v) => (
          <button
            key={v.id}
            onClick={() => onViewChange(v.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
              activeView === v.id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-background text-muted-foreground border border-border hover:border-primary hover:text-primary'
            }`}
          >
            {v.label}
          </button>
        ))}
        <button
          onClick={() => setAutoRot(!autoRot)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
            autoRot ? 'bg-accent text-accent-foreground' : 'bg-background text-muted-foreground border border-border'
          }`}
        >
          {autoRot ? '■ Stop' : `▶ ${t('auto')}`}
        </button>
      </div>
    </div>
  );
}
