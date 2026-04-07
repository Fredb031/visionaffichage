import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { useCustomizerStore } from '@/store/customizerStore';

function ProductMesh() {
  const { selectedColorHex } = useCustomizerStore();

  // Placeholder geometry — will be replaced with real .glb models
  return (
    <group>
      {/* Body */}
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[0.6, 0.8, 0.25]} />
        <meshStandardMaterial color={selectedColorHex} roughness={0.8} />
      </mesh>
      {/* Sleeves */}
      <mesh position={[-0.42, 0.35, 0]} rotation={[0, 0, 0.3]}>
        <boxGeometry args={[0.3, 0.2, 0.2]} />
        <meshStandardMaterial color={selectedColorHex} roughness={0.8} />
      </mesh>
      <mesh position={[0.42, 0.35, 0]} rotation={[0, 0, -0.3]}>
        <boxGeometry args={[0.3, 0.2, 0.2]} />
        <meshStandardMaterial color={selectedColorHex} roughness={0.8} />
      </mesh>
    </group>
  );
}

export function ProductViewer3D() {
  return (
    <div className="w-full h-full min-h-[360px] bg-secondary rounded-none">
      <Canvas camera={{ position: [0, 0.3, 1.5], fov: 35 }}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 5, 5]} intensity={0.8} />
          <ProductMesh />
          <ContactShadows position={[0, -0.2, 0]} opacity={0.3} blur={2} />
          <Environment preset="studio" />
          <OrbitControls
            enablePan={false}
            enableZoom={false}
            minPolarAngle={Math.PI / 4}
            maxPolarAngle={Math.PI / 1.8}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
