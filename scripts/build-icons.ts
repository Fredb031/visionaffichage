#!/usr/bin/env node
/**
 * build-icons.ts — generates the favicon + PWA icon set under public/icons/.
 *
 * Run via `npm run icons` (or `node --experimental-strip-types scripts/build-icons.ts`).
 *
 * Renders a brand-blue square with a white "VA" wordmark at every required size.
 * Uses pure Node (zlib + Buffer) so the build has zero extra dependencies — works
 * even when sharp / ImageMagick / canvas / tsx aren't installed.
 *
 * Outputs:
 *   public/icons/favicon-16.png
 *   public/icons/favicon-32.png
 *   public/icons/apple-touch-icon.png   (180x180, opaque)
 *   public/icons/icon-192.png
 *   public/icons/icon-512.png
 *   public/icons/icon-maskable-512.png  (logo at 60% → 20% safe-zone padding each side)
 */

import { createHash } from "node:crypto";
import { deflateSync, crc32 } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ---------- Config ----------

const BRAND_BLUE = { r: 0x00, g: 0x52, b: 0xcc }; // #0052CC
const WHITE = { r: 0xff, g: 0xff, b: 0xff };

type Color = { r: number; g: number; b: number };

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = resolve(__dirname, "..", "public", "icons");

// ---------- Pixel canvas ----------

function makeCanvas(size: number, bg: Color): Uint8Array {
  // RGB packed (no alpha) — favicon/PWA icons are opaque on iOS anyway.
  const buf = new Uint8Array(size * size * 3);
  for (let i = 0; i < size * size; i++) {
    buf[i * 3 + 0] = bg.r;
    buf[i * 3 + 1] = bg.g;
    buf[i * 3 + 2] = bg.b;
  }
  return buf;
}

function setPx(buf: Uint8Array, size: number, x: number, y: number, c: Color) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const i = (y * size + x) * 3;
  buf[i + 0] = c.r;
  buf[i + 1] = c.g;
  buf[i + 2] = c.b;
}

function fillRect(
  buf: Uint8Array,
  size: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  c: Color,
) {
  const ax = Math.min(x0, x1);
  const bx = Math.max(x0, x1);
  const ay = Math.min(y0, y1);
  const by = Math.max(y0, y1);
  for (let y = ay; y <= by; y++) {
    for (let x = ax; x <= bx; x++) {
      setPx(buf, size, x, y, c);
    }
  }
}

// Bresenham line with integer thickness (drawn as a square brush).
function drawLine(
  buf: Uint8Array,
  size: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  thick: number,
  c: Color,
) {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  const half = Math.floor(thick / 2);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    fillRect(buf, size, x - half, y - half, x - half + thick - 1, y - half + thick - 1, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

// ---------- "VA" wordmark ----------

/**
 * Renders a stylised "VA" wordmark inside the box [bx, by, bx+bw, by+bh].
 * Built from line strokes — readable down to ~24px, recognisable at 16px.
 */
function drawVA(
  buf: Uint8Array,
  size: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  fg: Color,
) {
  // Stroke thickness scales with box height. Min 1px so 16x16 still shows something.
  const thick = Math.max(1, Math.round(bh * 0.18));

  // Split the box in half horizontally — V on the left, A on the right, with a
  // small gap so the strokes don't merge.
  const gap = Math.max(1, Math.round(bw * 0.04));
  const halfW = Math.floor((bw - gap) / 2);

  // ---- V (left half) ----
  const vx0 = bx;
  const vy0 = by;
  const vMidX = vx0 + Math.floor(halfW / 2);
  const vBottomY = by + bh - 1;
  const vRightX = vx0 + halfW - 1;

  drawLine(buf, size, vx0, vy0, vMidX, vBottomY, thick, fg);
  drawLine(buf, size, vRightX, vy0, vMidX, vBottomY, thick, fg);

  // ---- A (right half) ----
  const ax0 = bx + halfW + gap;
  const aMidX = ax0 + Math.floor(halfW / 2);
  const aTopY = by;
  const aBottomY = by + bh - 1;
  const aRightX = ax0 + halfW - 1;

  drawLine(buf, size, aMidX, aTopY, ax0, aBottomY, thick, fg);
  drawLine(buf, size, aMidX, aTopY, aRightX, aBottomY, thick, fg);

  // Crossbar at ~62% down
  const crossY = by + Math.round(bh * 0.62);
  // Inset the crossbar so it sits between the legs.
  const crossInset = Math.round(halfW * 0.18);
  drawLine(
    buf,
    size,
    ax0 + crossInset,
    crossY,
    aRightX - crossInset,
    crossY,
    Math.max(1, Math.round(thick * 0.8)),
    fg,
  );
}

// ---------- PNG encoder (RGB, no alpha, zlib-deflate IDAT) ----------

function be32(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0, 0);
  return b;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = be32(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = be32(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(rgb: Uint8Array, width: number, height: number): Buffer {
  // PNG signature
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdr = Buffer.concat([
    be32(width),
    be32(height),
    Buffer.from([
      8, // bit depth
      2, // color type 2 = RGB
      0, // compression
      0, // filter
      0, // interlace
    ]),
  ]);

  // Raw scanlines with filter byte 0 prefixed per row.
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: None
    Buffer.from(rgb.buffer, rgb.byteOffset + y * stride, stride).copy(
      raw,
      y * (stride + 1) + 1,
    );
  }
  const idat = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- Icon variants ----------

function renderIcon(size: number, opts: { maskableSafeZone?: boolean } = {}): Buffer {
  const buf = makeCanvas(size, BRAND_BLUE);

  // Maskable: logo lives in the inner 60% so Android can crop edges freely.
  // Standard:  logo lives in the inner 70% with comfortable optical padding.
  const innerRatio = opts.maskableSafeZone ? 0.6 : 0.7;
  const inner = Math.round(size * innerRatio);
  const offset = Math.round((size - inner) / 2);

  drawVA(buf, size, offset, offset, inner, inner, WHITE);

  return encodePng(buf, size, size);
}

// ---------- Main ----------

const targets: Array<{ name: string; size: number; maskable?: boolean }> = [
  { name: "favicon-16.png", size: 16 },
  { name: "favicon-32.png", size: 32 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "icon-maskable-512.png", size: 512, maskable: true },
];

mkdirSync(ICONS_DIR, { recursive: true });

const summary: string[] = [];
for (const t of targets) {
  const png = renderIcon(t.size, { maskableSafeZone: t.maskable });
  const out = resolve(ICONS_DIR, t.name);
  writeFileSync(out, png);
  const sha = createHash("sha256").update(png).digest("hex").slice(0, 12);
  summary.push(`${t.name.padEnd(28)} ${String(png.length).padStart(6)}B  sha=${sha}`);
}

console.log("Wrote icons to " + ICONS_DIR);
for (const line of summary) console.log("  " + line);
