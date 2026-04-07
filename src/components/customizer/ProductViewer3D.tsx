/**
 * ProductViewer3D — Static 3D viewer with live colour
 * - Solid colour material (no texture background image)
 * - Devant / Dos toggle — thumbnail of OPPOSITE view shown bottom-right
 * - Logo overlaid on 3D model
 * - Colour chip bottom-left, logo badge bottom-right
 */
import { Suspense, useRef, useMemo, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import type { Product, ProductColor } from '@/data/products';
import type { LogoPlacement, ProductView } from '@/types/customization';
import {
  createHoodieGeometry, createHoodBumpGeometry,
  createPocketGeometry, createCuffGeometry, createDrawstringGeometry,
} from '@/lib/hoodie3D';
import { createShirtShape, createCapParts, createBeanieParts } from '@/lib/garmentGeometry';
import { useLang } from '@/lib/langContext';

function useFabricMat(hex: string, roughness = 0.86) {
  return useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color(hex),
    roughness,
    metalness: 0,
    side: THREE.FrontSide,
  }), [hex, roughness]);
}

function LogoPlane({ url, x, y, w, rot = 0 }: { url:string; x:number; y:number; w:number; rot?:number }) {
  const tex = useTexture(url);
  useEffect(() => { tex.colorSpace = THREE.SRGBColorSpace; tex.premultiplyAlpha = false; tex.needsUpdate = true; }, [tex, url]);
  return (
    <mesh position={[x, y, 0.05]} rotation={[0, 0, rot * Math.PI / 180]}>
      <planeGeometry args={[w, w * 0.62]} />
      <meshBasicMaterial map={tex} transparent alphaTest={0.01} depthWrite={false} />
    </mesh>
  );
}

function LogoCurved({ url, z = 0.93 }: { url:string; z?:number }) {
  const tex = useTexture(url);
  useEffect(() => { tex.colorSpace = THREE.SRGBColorSpace; tex.premultiplyAlpha = false; tex.needsUpdate = true; }, [tex, url]);
  return (
    <mesh position={[0, -0.05, z]}>
      <planeGeometry args={[0.38, 0.24]} />
      <meshBasicMaterial map={tex} transparent alphaTest={0.01} depthWrite={false} />
    </mesh>
  );
}

function HoodieModel({ hex, logoUrl, logoPlacement }: { hex:string; logoUrl?:string; logoPlacement?:LogoPlacement }) {
  const bodyGeo = useMemo(() => createHoodieGeometry(), []);
  const hoodGeo = useMemo(() => createHoodBumpGeometry(), []);
  const pocketGeo = useMemo(() => createPocketGeometry(), []);
  const cuffL = useMemo(() => createCuffGeometry('left'), []);
  const cuffR = useMemo(() => createCuffGeometry('right'), []);
  const dsL = useMemo(() => createDrawstringGeometry('left'), []);
  const dsR = useMemo(() => createDrawstringGeometry('right'), []);
  const bodyMat = useFabricMat(hex, 0.87);
  const darkC = useMemo(() => new THREE.MeshStandardMaterial({ color: new THREE.Color(hex).multiplyScalar(0.72), roughness: 0.92 }), [hex]);
  const midC  = useMemo(() => new THREE.MeshStandardMaterial({ color: new THREE.Color(hex).multiplyScalar(0.80), roughness: 0.88 }), [hex]);
  const lx = logoPlacement ? ((logoPlacement.x ?? 50) - 50) / 100 * 0.52 : 0;
  const ly = logoPlacement ? (50 - (logoPlacement.y ?? 33)) / 100 * 0.85 + 0.08 : 0.18;
  const lw = logoPlacement?.width ? (logoPlacement.width / 100) * 0.72 : 0.26;
  return (
    <group position={[0, -0.06, 0]}>
      <mesh geometry={bodyGeo} material={bodyMat} />
      <mesh geometry={hoodGeo} material={midC} />
      <mesh geometry={pocketGeo} material={darkC} />
      <mesh geometry={cuffL} material={darkC} />
      <mesh geometry={cuffR} material={darkC} />
      <mesh geometry={dsL}><meshStandardMaterial color="#0a0a0a" roughness={0.96} /></mesh>
      <mesh geometry={dsR}><meshStandardMaterial color="#0a0a0a" roughness={0.96} /></mesh>
      {([-0.068, 0.068] as const).map(ex => (
        <mesh key={ex} position={[ex, 0.868, 0.042]}>
          <torusGeometry args={[0.017, 0.007, 8, 20]} />
          <meshStandardMaterial color="#e0e0e0" metalness={0.75} roughness={0.25} />
        </mesh>
      ))}
      {logoUrl && logoPlacement && <LogoPlane url={logoUrl} x={lx} y={ly} w={lw} rot={logoPlacement.rotation ?? 0} />}
    </group>
  );
}

function ShirtModel({ hex, logoUrl, logoPlacement, isHoodie = false }: { hex:string; logoUrl?:string; logoPlacement?:LogoPlacement; isHoodie?:boolean }) {
  const geo = useMemo(() => createShirtShape(isHoodie), [isHoodie]);
  const mat = useFabricMat(hex);
  const lx = logoPlacement ? ((logoPlacement.x ?? 50) - 50) / 100 * 0.95 : 0;
  const ly = logoPlacement ? (50 - (logoPlacement.y ?? 32)) / 100 * 1.10 : 0.05;
  const lw = logoPlacement?.width ? (logoPlacement.width / 100) * 0.88 : 0.28;
  return (
    <group>
      <mesh geometry={geo} material={mat} />
      {logoUrl && logoPlacement && <LogoPlane url={logoUrl} x={lx} y={ly} w={lw} rot={logoPlacement.rotation ?? 0} />}
    </group>
  );
}

function CapModel({ hex, logoUrl }: { hex:string; logoUrl?:string }) {
  const parts = useMemo(() => createCapParts(), []);
  const mat  = useFabricMat(hex, 0.78);
  const trim = useMemo(() => new THREE.MeshStandardMaterial({ color: new THREE.Color(hex).lerp(new THREE.Color('#888'), 0.28), roughness:0.82 }), [hex]);
  return (
    <group rotation={[-0.1, 0, 0]}>
      <mesh geometry={parts.dome} material={mat} />
      <mesh geometry={parts.brim} material={trim} />
      <mesh geometry={parts.button} material={trim} />
      <mesh geometry={parts.sweatband}><meshStandardMaterial color="#111" roughness={0.9} /></mesh>
      {logoUrl && <LogoCurved url={logoUrl} z={0.93} />}
    </group>
  );
}

function BeanieModel({ hex, logoUrl }: { hex:string; logoUrl?:string }) {
  const parts = useMemo(() => createBeanieParts(), []);
  const mat  = useFabricMat(hex, 0.92);
  const cuff = useMemo(() => new THREE.MeshStandardMaterial({ color: new THREE.Color(hex).multiplyScalar(0.80), roughness:0.95 }), [hex]);
  return (
    <group>
      <mesh geometry={parts.body} material={mat} />
      <mesh geometry={parts.crown} material={mat} />
      <mesh geometry={parts.cuff} material={cuff} />
      <mesh geometry={parts.pompom}><meshStandardMaterial color={hex} roughness={1} /></mesh>
      {logoUrl && <LogoCurved url={logoUrl} z={0.75} />}
    </group>
  );
}

function Skeleton() {
  return <mesh><planeGeometry args={[1.65, 2.20]} /><meshBasicMaterial color="#E8E6E1" transparent opacity={0.45} /></mesh>;
}

export function ProductViewer3D({
  product, selectedColor, logoPlacement, activeView, onViewChange, compact = false,
}: {
  product: Product; selectedColor: ProductColor | null;
  logoPlacement: LogoPlacement | null;
  activeView: ProductView; onViewChange: (v: ProductView) => void;
  compact?: boolean;
}) {
  const { t } = useLang();
  const H = compact ? 240 : 340;
  const hex = selectedColor?.hex ?? '#1a1a1a';
  const logoUrl = logoPlacement?.previewUrl ?? logoPlacement?.processedUrl;

  // Thumbnail of OPPOSITE view (bottom-right)
  const thumbUrl = activeView === 'front'
    ? (selectedColor?.imageDos ?? product.imageDos)
    : (selectedColor?.imageDevant ?? product.imageDevant);
  const thumbLabel = activeView === 'front' ? t('dos') : t('devant');

  const camPos: [number,number,number] =
    product.category === 'cap'   ? [0, 0.5, 2.2] :
    product.category === 'toque' ? [0, 0.2, 2.4] : [0, 0.0, 3.0];

  return (
    <div className="relative flex flex-col rounded-2xl overflow-hidden bg-[#F4F3EF] border border-border">
      {/* 3D Canvas — static, no pointer interaction */}
      <div style={{ height: H }} className="relative pointer-events-none">
        <Canvas camera={{ position: camPos, fov: 36 }} gl={{ antialias:true, alpha:true }} style={{ background:'transparent' }}>
          <ambientLight intensity={1.4} />
          <directionalLight position={[2.5, 5, 4]} intensity={1.0} />
          <directionalLight position={[-2.5, 1.5, -2]} intensity={0.45} />
          <pointLight position={[0, -5, 3]} intensity={0.3} color="#f0ece4" />
          <Suspense fallback={<Skeleton />}>
            {product.category === 'hoodie'   && <HoodieModel hex={hex} logoUrl={logoUrl} logoPlacement={logoPlacement ?? undefined} />}
            {product.category === 'crewneck' && <ShirtModel  hex={hex} logoUrl={logoUrl} logoPlacement={logoPlacement ?? undefined} />}
            {product.category === 'tshirt'   && <ShirtModel  hex={hex} logoUrl={logoUrl} logoPlacement={logoPlacement ?? undefined} />}
            {product.category === 'longsleeve'&&<ShirtModel  hex={hex} logoUrl={logoUrl} logoPlacement={logoPlacement ?? undefined} />}
            {product.category === 'polo'     && <ShirtModel  hex={hex} logoUrl={logoUrl} logoPlacement={logoPlacement ?? undefined} />}
            {product.category === 'sport'    && <ShirtModel  hex={hex} logoUrl={logoUrl} logoPlacement={logoPlacement ?? undefined} />}
            {product.category === 'cap'      && <CapModel    hex={hex} logoUrl={logoUrl} />}
            {product.category === 'toque'    && <BeanieModel hex={hex} logoUrl={logoUrl} />}
          </Suspense>
        </Canvas>

        {/* Bottom-left: colour chip */}
        {selectedColor && (
          <div className="absolute bottom-3 left-3 pointer-events-auto flex items-center gap-2 bg-white/88 backdrop-blur-sm rounded-full px-2.5 py-1.5 border border-border shadow-sm">
            <div className="w-3.5 h-3.5 rounded-full ring-1 ring-black/10 flex-shrink-0" style={{ background: selectedColor.hex }} />
            <span className="text-[11px] font-semibold text-foreground">{selectedColor.name}</span>
          </div>
        )}

        {/* Bottom-right: thumbnail of OPPOSITE view */}
        <button
          onClick={() => onViewChange(activeView === 'front' ? 'back' : 'front')}
          className="absolute bottom-3 right-3 pointer-events-auto group"
          title={`Voir le ${thumbLabel}`}
        >
          <div className="relative w-14 h-14 rounded-xl overflow-hidden border-2 border-white shadow-lg bg-[#F4F3EF] group-hover:border-primary transition-all">
            <img src={thumbUrl} alt={thumbLabel} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-all flex items-end justify-center pb-1">
              <span className="text-white text-[9px] font-bold">{thumbLabel}</span>
            </div>
          </div>
        </button>

        {/* Logo placed badge */}
        <AnimatePresence>
          {logoPlacement?.previewUrl && (
            <motion.div initial={{ opacity:0, scale:0.85 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0 }}
              className="absolute top-3 right-3 pointer-events-none bg-green-700/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-full"
            >
              {t('logoPlace')}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Devant / Dos toggle */}
      <div className="flex border-t border-border">
        {(['front', 'back'] as const).map(v => (
          <button key={v} onClick={() => onViewChange(v)}
            className={`flex-1 py-2.5 text-xs font-bold transition-all ${
              activeView === v
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            {v === 'front' ? t('devant') : t('dos')}
          </button>
        ))}
      </div>
    </div>
  );
}
