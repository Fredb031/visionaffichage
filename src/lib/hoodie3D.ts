/**
 * hoodie3D.ts — ATCF2500 Hoodie 3D geometry
 *
 * Pixel-traced directly from the SanMar ATCF2500 ghost-mannequin
 * reference image (1500×1710px).
 *
 * All coordinates in Three.js world-space (Y-up, centered at origin).
 * Width at widest ≈ 1.62 units, height ≈ 2.2 units.
 */
import * as THREE from 'three';

// ────────────────────────────────────────────────────────────────────────────
// Main hoodie body + hood — single ShapeGeometry
// ────────────────────────────────────────────────────────────────────────────
export function createHoodieGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape();

  // ── Bottom hem (start bottom-left, go right) ──────────────────────────────
  s.moveTo(-0.800, -0.900);
  s.bezierCurveTo(-0.805, -0.870, -0.808, -0.855, -0.805, -0.840);

  // ── Left sleeve — outer edge going UP ────────────────────────────────────
  s.lineTo(-0.803, -0.750);
  s.lineTo(-0.796, -0.650);
  s.lineTo(-0.787, -0.550);
  s.lineTo(-0.776, -0.450);
  s.lineTo(-0.763, -0.350);
  s.lineTo(-0.748, -0.250);
  s.lineTo(-0.730, -0.150);
  s.lineTo(-0.710, -0.050);
  s.lineTo(-0.688,  0.050);
  s.lineTo(-0.663,  0.150);
  s.lineTo(-0.635,  0.250);
  s.lineTo(-0.602,  0.350);

  // ── Left shoulder / armhole transition ───────────────────────────────────
  s.bezierCurveTo(-0.570, 0.440, -0.520, 0.510, -0.460, 0.560);
  s.bezierCurveTo(-0.400, 0.610, -0.340, 0.635, -0.290, 0.650);

  // ── Left hood edge ────────────────────────────────────────────────────────
  s.lineTo(-0.290, 0.690);
  s.lineTo(-0.295, 0.730);
  s.lineTo(-0.298, 0.780);
  s.lineTo(-0.293, 0.840);
  s.lineTo(-0.280, 0.900);
  s.lineTo(-0.255, 0.945);

  // ── Hood top arc ──────────────────────────────────────────────────────────
  s.bezierCurveTo(-0.180, 1.020, -0.090, 1.060, 0.000, 1.060);
  s.bezierCurveTo( 0.090, 1.060,  0.180, 1.020, 0.255, 0.945);

  // ── Right hood edge ───────────────────────────────────────────────────────
  s.lineTo( 0.280, 0.900);
  s.lineTo( 0.293, 0.840);
  s.lineTo( 0.298, 0.780);
  s.lineTo( 0.295, 0.730);
  s.lineTo( 0.290, 0.690);
  s.lineTo( 0.290, 0.650);

  // ── Right shoulder ────────────────────────────────────────────────────────
  s.bezierCurveTo( 0.340, 0.635,  0.400, 0.610,  0.460, 0.560);
  s.bezierCurveTo( 0.520, 0.510,  0.570, 0.440,  0.602, 0.350);

  // ── Right sleeve — outer edge going DOWN ──────────────────────────────────
  s.lineTo( 0.635,  0.250);
  s.lineTo( 0.663,  0.150);
  s.lineTo( 0.688,  0.050);
  s.lineTo( 0.710, -0.050);
  s.lineTo( 0.730, -0.150);
  s.lineTo( 0.748, -0.250);
  s.lineTo( 0.763, -0.350);
  s.lineTo( 0.776, -0.450);
  s.lineTo( 0.787, -0.550);
  s.lineTo( 0.796, -0.650);
  s.lineTo( 0.803, -0.750);
  s.lineTo( 0.805, -0.840);

  // ── Bottom hem right to left ──────────────────────────────────────────────
  s.bezierCurveTo( 0.808, -0.855,  0.805, -0.870,  0.800, -0.900);
  s.lineTo(-0.800, -0.900);

  // ── Build ShapeGeometry with UV ───────────────────────────────────────────
  const geo = new THREE.ShapeGeometry(s, 96);

  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const bW = bb.max.x - bb.min.x;
  const bH = bb.max.y - bb.min.y;
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uvs[i * 2    ] = (pos.getX(i) - bb.min.x) / bW;
    uvs[i * 2 + 1] = (pos.getY(i) - bb.min.y) / bH;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

  // ── Fabric wave displacement (Z-axis) ─────────────────────────────────────
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    // Multi-frequency wave for realistic fabric draping
    const z = Math.sin(x * 4.8 + 0.3) * 0.020
            + Math.sin(y * 3.5 - 0.5) * 0.026
            + Math.cos(x * 2.2 + y * 1.6) * 0.011
            + Math.sin(x * 8.0) * 0.005;  // high-freq micro detail
    pos.setZ(i, z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  return geo;
}

// ────────────────────────────────────────────────────────────────────────────
// Hood bump — hemisphere for depth/shadow
// ────────────────────────────────────────────────────────────────────────────
export function createHoodBumpGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(0.30, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  // Flatten into a dome-like protrusion
  geo.scale(1.05, 0.62, 0.55);
  geo.translate(0, 0.88, -0.04);
  return geo;
}

// ────────────────────────────────────────────────────────────────────────────
// Kangaroo pocket — flat quad
// ────────────────────────────────────────────────────────────────────────────
export function createPocketGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.300, -0.260);
  // Top corners rounded
  shape.bezierCurveTo(-0.300, -0.240, -0.280, -0.225, -0.255, -0.225);
  shape.lineTo( 0.255, -0.225);
  shape.bezierCurveTo( 0.280, -0.225,  0.300, -0.240,  0.300, -0.260);
  // Bottom
  shape.lineTo( 0.300, -0.560);
  shape.bezierCurveTo( 0.300, -0.590,  0.280, -0.605,  0.255, -0.605);
  shape.lineTo(-0.255, -0.605);
  shape.bezierCurveTo(-0.280, -0.605, -0.300, -0.590, -0.300, -0.560);
  shape.lineTo(-0.300, -0.260);

  const geo = new THREE.ShapeGeometry(shape, 6);
  geo.translate(0, 0, 0.022);
  return geo;
}

// ────────────────────────────────────────────────────────────────────────────
// Sleeve cuffs — short ribbed cylinders at sleeve ends
// ────────────────────────────────────────────────────────────────────────────
export function createCuffGeometry(side: 'left' | 'right'): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(0.092, 0.086, 0.065, 28, 6);
  // Add ribbing
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const angle = Math.atan2(pos.getZ(i), pos.getX(i));
    const rib = Math.sin(angle * 12) * 0.008;
    const r = Math.sqrt(pos.getX(i) ** 2 + pos.getZ(i) ** 2) + rib;
    pos.setX(i, Math.cos(angle) * r);
    pos.setZ(i, Math.sin(angle) * r);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  // Position: sleeve ends at ±0.80x, -0.88y
  const sx = side === 'left' ? -0.803 : 0.803;
  const sy = -0.877;
  const angle = side === 'left' ? 0.28 : -0.28; // sleeve tilt
  geo.rotateZ(angle);
  geo.translate(sx, sy, 0.015);
  return geo;
}

// ────────────────────────────────────────────────────────────────────────────
// Drawstring pair
// ────────────────────────────────────────────────────────────────────────────
export function createDrawstringGeometry(side: 'left' | 'right'): THREE.BufferGeometry {
  const sx = side === 'left' ? -0.044 : 0.044;
  // Curved path: from eyelet down to bottom
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(sx, 0.875, 0.038),
    new THREE.Vector3(sx * 1.2, 0.700, 0.042),
    new THREE.Vector3(sx * 0.8, 0.500, 0.038),
    new THREE.Vector3(sx * 0.6, 0.320, 0.035),
  ]);
  const geo = new THREE.TubeGeometry(curve, 20, 0.0055, 6, false);
  return geo;
}
