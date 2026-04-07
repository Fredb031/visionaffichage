import * as THREE from 'three';

// ── Procedural 3D Garment Geometries ────────────────────────────────────────
// Creates realistic-looking fabric shapes using Three.js procedural geometry.
// Each shape has UV mapping so textures (product images) apply correctly.

/** Fabric wave displacement — makes the plane look like draped fabric */
function applyFabricWave(geo: THREE.BufferGeometry, intensity = 0.04) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    // Subtle wave to simulate fabric draping
    const z = Math.sin(x * 3.5 + 0.5) * intensity * 0.4
            + Math.sin(y * 2.8 - 0.3) * intensity * 0.6
            + Math.cos(x * 1.2 + y * 1.8) * intensity * 0.3;
    pos.setZ(i, z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

/** T-Shirt / Hoodie — fabric plane with shirt proportions */
export function createShirtGeometry(): THREE.BufferGeometry {
  // High-subdivision plane for smooth fabric simulation
  const geo = new THREE.PlaneGeometry(1.8, 2.4, 48, 64);
  applyFabricWave(geo, 0.035);
  return geo;
}

/** Cap — dome hemisphere + flat brim */
export function createCapGeometry(): {
  dome: THREE.BufferGeometry;
  brim: THREE.BufferGeometry;
} {
  // Dome — flattened sphere top half
  const dome = new THREE.SphereGeometry(0.85, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2);
  // Brim — flat ring
  const brim = new THREE.RingGeometry(0.85, 1.35, 48);
  brim.rotateX(-Math.PI / 2);
  brim.translate(0, -0.01, 0);
  return { dome, brim };
}

/** Beanie/Toque — cylinder with rounded top */
export function createBeanieGeometry(): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(0.75, 0.68, 1.4, 64, 24, false);
  // Round the top with vertex displacement
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const x = pos.getX(i);
    const z = pos.getZ(i);
    if (y > 0.5) {
      const r = Math.sqrt(x * x + z * z);
      const factor = 1 - Math.pow((y - 0.5) / 0.7, 2) * 0.4;
      pos.setX(i, x * factor);
      pos.setZ(i, z * factor);
      pos.setY(i, y + Math.sin(r * 2) * 0.02);
    }
    // Add subtle fabric texture variation
    pos.setX(i, x + Math.sin(y * 8 + z * 3) * 0.006);
    pos.setZ(i, z + Math.cos(y * 7 + x * 2.5) * 0.006);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** Create a fabric shader material that handles color correctly */
export function createFabricMaterial(
  texture: THREE.Texture,
  colorHex: string,
  opacity = 1.0
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: opacity < 1,
    opacity,
    side: THREE.DoubleSide,
    roughness: 0.85,
    metalness: 0.0,
  });

  // For colored variants: blend color with neutral white so texture stays visible
  if (colorHex && colorHex !== '#f5f5f0' && colorHex !== '#ffffff') {
    // Light tint — keeps texture detail, shifts hue toward color
    mat.color = new THREE.Color(colorHex).lerp(new THREE.Color('#ffffff'), 0.7);
  } else {
    mat.color = new THREE.Color('#ffffff');
  }

  return mat;
}

/** Logo overlay material — fully transparent background */
export function createLogoMaterial(logoTexture: THREE.Texture): THREE.MeshBasicMaterial {
  logoTexture.colorSpace = THREE.SRGBColorSpace;
  logoTexture.premultiplyAlpha = false;
  return new THREE.MeshBasicMaterial({
    map: logoTexture,
    transparent: true,
    alphaTest: 0.01,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}
