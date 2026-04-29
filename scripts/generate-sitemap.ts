#!/usr/bin/env node
/**
 * generate-sitemap.ts — builds public/sitemap.xml at build time.
 *
 * Run via `node --experimental-strip-types scripts/generate-sitemap.ts`
 * (Node 22.6+) or plain `node scripts/generate-sitemap.ts` on Node
 * 23.6+ where type-stripping is unflagged. The repo doesn't ship a
 * TS runtime (tsx / ts-node) in its devDependencies, and Task 8.7
 * explicitly says "DON'T install new npm packages unless truly
 * needed" — Node's built-in type-stripping covers us without
 * adding a dep.
 *
 * Source of truth:
 *   - src/data/products.ts  -> /product/:handle URLs (+ image:image entries)
 *   - src/App.tsx           -> static public routes (mirrored below)
 *
 * Image sitemap extension: per Google's protocol
 * (https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps),
 * each <url> for a /product/:handle page may carry up to 1000
 * <image:image> children. We emit the top-level imageDevant/imageDos
 * pair for every product, plus any per-color overrides defined on the
 * referenced ProductColor[] constant. Capped at 1000 per URL — we won't
 * hit it (max ~30 with current catalogue) but the cap is enforced so a
 * future explosion of per-color photos doesn't silently produce an
 * invalid sitemap.
 *
 * Admin / vendor / cart / checkout / account / track / quote-accept
 * URLs are intentionally omitted — they're either behind auth or
 * already `Disallow`d in robots.txt, so they don't belong in the
 * crawl index.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const BASE_URL = 'https://visionaffichage.com';
const IMAGE_CAP_PER_URL = 1000; // Google Image Sitemap protocol limit

// YYYY-MM-DD in UTC so lastmod doesn't flip by timezone and cause
// spurious diffs when the same build runs on CI vs a dev machine in
// a different TZ.
const today: string = new Date().toISOString().slice(0, 10);

type ChangeFreq = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
type StaticRoute = readonly [path: string, changefreq: ChangeFreq, priority: string];

// Static routes — keep in sync with src/App.tsx. Priorities follow
// the task spec: home 1.0 daily, products 0.9 weekly, conversion-
// driving content 0.7-0.8 weekly/monthly, legal 0.3 monthly, the rest
// 0.5 monthly. Cart / checkout / track / account / admin / vendor /
// quote-accept / merci / suivi are intentionally omitted — they're
// behind auth, transactional, or already `Disallow`d in robots.txt
// so they don't belong in the public crawl index.
const staticRoutes: readonly StaticRoute[] = [
  ['/',                                  'daily',   '1.0'],
  ['/products',                          'weekly',  '0.9'],
  ['/devis',                             'weekly',  '0.8'],
  ['/histoires-de-succes',               'weekly',  '0.7'],
  ['/industries',                        'weekly',  '0.7'],
  ['/industries/construction',           'monthly', '0.6'],
  ['/industries/paysagement',            'monthly', '0.6'],
  ['/industries/plomberie-electricite',  'monthly', '0.6'],
  ['/industries/corporate',              'monthly', '0.6'],
  ['/industries/municipalites',          'monthly', '0.6'],
  ['/comparer',                          'monthly', '0.5'],
  ['/compte-corporatif',                 'monthly', '0.5'],
  ['/about',                             'monthly', '0.5'],
  ['/contact',                           'monthly', '0.5'],
  ['/privacy',                           'monthly', '0.3'],
  ['/terms',                             'monthly', '0.3'],
  ['/returns',                           'monthly', '0.3'],
  ['/accessibility',                     'monthly', '0.3'],
];

// ──────────────────────────────────────────────────────────────────────
// products.ts parsing
//
// We can't `import` products.ts directly: Node's type-stripping has no
// loader for the '@/…' path alias, and pulling in tsx / ts-node just
// for build-time sitemap generation violates the "no new deps" rule.
// Instead we lex the source with a few targeted regex passes — same
// strategy the original handle-extraction used, just extended to
// also pick up per-color image overrides via an intermediate dict
// of named ProductColor[] constants.
// ──────────────────────────────────────────────────────────────────────
const productsSrc: string = readFileSync(resolve(ROOT, 'src/data/products.ts'), 'utf8');

const CDN = 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files';

/** Resolve a JS string-literal expression as it appears in products.ts.
 *  Handles single-quoted strings and the one template-literal form
 *  the catalogue uses today: `${CDN}/path?v=…`. Returns null for
 *  anything else so callers fall through gracefully. */
const resolveStringLiteral = (raw: string): string | null => {
  const trimmed = raw.trim();
  // Single-quoted: 'foo' (no escaped quotes appear in products.ts)
  const sq = trimmed.match(/^'([^']*)'$/);
  if (sq) return sq[1];
  // Template literal beginning with ${CDN}
  const tpl = trimmed.match(/^`\$\{CDN\}([^`]*)`$/);
  if (tpl) return CDN + tpl[1];
  return null;
};

/** Convert a (possibly relative) image path into an absolute URL on
 *  visionaffichage.com. Already-absolute URLs (https://...) pass
 *  through untouched. */
const toAbsoluteUrl = (path: string): string => {
  if (/^https?:\/\//.test(path)) return path;
  if (path.startsWith('/')) return BASE_URL + path;
  return `${BASE_URL}/${path}`;
};

type ColorImage = {
  colorName: string;     // French (e.g. "Noir")
  colorNameEn: string;   // English (e.g. "Black")
  imageDevant?: string;
  imageDos?: string;
};

/** Parse a `const FOO_COLORS: ProductColor[] = [ … ];` block into a
 *  list of colors, capturing only those with image overrides (the
 *  vast majority don't carry their own imageDevant / imageDos and
 *  fall back to the product-level photos). */
const parseColorBlock = (block: string): ColorImage[] => {
  const colors: ColorImage[] = [];
  // Match each `{ … }` color literal at the top level of the array.
  // Color literals never nest, so a non-greedy match between balanced
  // braces is sufficient.
  const colorRe = /\{([^}]*)\}/g;
  for (const m of block.matchAll(colorRe)) {
    const body = m[1];
    const nameM = body.match(/name:\s*'([^']*)'/);
    const nameEnM = body.match(/nameEn:\s*'([^']*)'/);
    if (!nameM || !nameEnM) continue;
    const devantM = body.match(/imageDevant:\s*('[^']*'|`[^`]*`)/);
    const dosM = body.match(/imageDos:\s*('[^']*'|`[^`]*`)/);
    const imageDevant = devantM ? resolveStringLiteral(devantM[1]) ?? undefined : undefined;
    const imageDos = dosM ? resolveStringLiteral(dosM[1]) ?? undefined : undefined;
    colors.push({
      colorName: nameM[1],
      colorNameEn: nameEnM[1],
      imageDevant,
      imageDos,
    });
  }
  return colors;
};

// Build a dict of named color arrays. Only the colors with image
// overrides actually contribute to the sitemap; the rest are kept
// empty-imaged for completeness (callers filter).
const colorBlockRe = /const\s+(\w+_COLORS)\s*:\s*ProductColor\[\]\s*=\s*\[([\s\S]*?)\];/g;
const colorDict: Record<string, ColorImage[]> = {};
for (const m of productsSrc.matchAll(colorBlockRe)) {
  colorDict[m[1]] = parseColorBlock(m[2]);
}

type ProductImageEntry = {
  handle: string;
  shortName: string;
  productName: string;
  images: { url: string; titleFr: string; titleEn: string }[];
};

/** Slice the source between the start of the `PRODUCTS` array literal
 *  and its closing `];`, then split on top-level product object
 *  boundaries. Each product literal starts on its own line with
 *  `  {` indent. We use a brace-depth scan instead of regex because
 *  product blocks contain nested arrays (printZones, sizes) and
 *  template literals, which a flat regex can't balance. */
const productsArrMarker = 'export const PRODUCTS: Product[] = [';
const productsArrStart = productsSrc.indexOf(productsArrMarker);
if (productsArrStart === -1) {
  throw new Error('generate-sitemap: could not find PRODUCTS array in products.ts');
}
// Skip past `Product[] = [` — point at the byte after the array's
// opening bracket (the marker ends with that bracket).
const arrBodyStart = productsArrStart + productsArrMarker.length;

const productBlocks: string[] = [];
{
  let depth = 0;
  let blockStart = -1;
  let inString: '`' | "'" | '"' | null = null;
  let escape = false;
  for (let i = arrBodyStart; i < productsSrc.length; i++) {
    const ch = productsSrc[i];
    if (inString) {
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '`' || ch === "'" || ch === '"') { inString = ch; continue; }
    if (ch === '/' && productsSrc[i + 1] === '/') {
      // line comment — skip to newline
      const nl = productsSrc.indexOf('\n', i);
      i = nl === -1 ? productsSrc.length : nl;
      continue;
    }
    if (ch === '{') {
      if (depth === 0) blockStart = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && blockStart !== -1) {
        productBlocks.push(productsSrc.slice(blockStart, i + 1));
        blockStart = -1;
      }
    } else if (ch === ']' && depth === 0) {
      break;
    }
  }
}

const productEntries: ProductImageEntry[] = [];
for (const block of productBlocks) {
  const handleM = block.match(/shopifyHandle:\s*'([^']+)'/);
  if (!handleM) continue;
  const handle = handleM[1];
  const shortNameM = block.match(/shortName:\s*'([^']*)'/);
  const nameM = block.match(/name:\s*'([^']*)'/);
  const skuM = block.match(/sku:\s*'([^']+)'/);
  const sku = skuM ? skuM[1] : '';
  const shortName = shortNameM ? shortNameM[1] : sku;
  const productName = nameM ? nameM[1] : shortName;

  // Top-level product images. The `imageDevant:` and `imageDos:` we
  // want here are the ones at depth-1 inside the product literal —
  // not those nested inside a colors array literal embedded by value
  // (which doesn't happen in this file: colors are always referenced
  // by name like ATC1000_COLORS). Restricting the search to lines
  // that begin with two-space indent is sufficient given the file's
  // formatting conventions.
  const topDevantM = block.match(/^\s{4}imageDevant:\s*('[^']*'|`[^`]*`)/m);
  const topDosM = block.match(/^\s{4}imageDos:\s*('[^']*'|`[^`]*`)/m);
  const topDevant = topDevantM ? resolveStringLiteral(topDevantM[1]) ?? undefined : undefined;
  const topDos = topDosM ? resolveStringLiteral(topDosM[1]) ?? undefined : undefined;

  const images: ProductImageEntry['images'] = [];
  if (topDevant) {
    images.push({
      url: toAbsoluteUrl(topDevant),
      titleFr: `${shortName} — face avant`,
      titleEn: `${shortName} — front view`,
    });
  }
  if (topDos) {
    images.push({
      url: toAbsoluteUrl(topDos),
      titleFr: `${shortName} — face arrière`,
      titleEn: `${shortName} — back view`,
    });
  }

  // Per-color overrides: products reference a named *_COLORS const.
  // We pull that name out of `colors: ATC1000_COLORS,` (or the slice
  // form `colors: ATC1000_COLORS.slice(0, 12),`) and look up the
  // already-parsed dict.
  const colorsRefM = block.match(/colors:\s*(\w+_COLORS)/);
  if (colorsRefM) {
    const colorList = colorDict[colorsRefM[1]] ?? [];
    for (const c of colorList) {
      if (c.imageDevant) {
        images.push({
          url: toAbsoluteUrl(c.imageDevant),
          titleFr: `${shortName} ${c.colorName} — face avant`,
          titleEn: `${shortName} ${c.colorNameEn} — front view`,
        });
      }
      if (c.imageDos) {
        images.push({
          url: toAbsoluteUrl(c.imageDos),
          titleFr: `${shortName} ${c.colorName} — face arrière`,
          titleEn: `${shortName} ${c.colorNameEn} — back view`,
        });
      }
    }
  }

  // De-duplicate by URL — the ATC1000 black variant carries the same
  // top-level imageDos as its product, no need to emit the same
  // <image:image> twice for one URL.
  const seen = new Set<string>();
  const dedup: typeof images = [];
  for (const img of images) {
    if (seen.has(img.url)) continue;
    seen.add(img.url);
    dedup.push(img);
    if (dedup.length >= IMAGE_CAP_PER_URL) break;
  }

  productEntries.push({ handle, shortName, productName, images: dedup });
}

if (productEntries.length === 0) {
  // A broken parser on a non-empty catalog would silently ship a
  // sitemap with zero product URLs. Fail loud instead.
  throw new Error('generate-sitemap: no product entries parsed from src/data/products.ts');
}

// Case study slugs — same regex-extraction strategy as the product
// handles above. /histoires-de-succes/:slug pages render real customer
// stories that deserve their own SERP entry (they target buyer-intent
// queries like "construction company uniforms quebec").
const caseStudiesSrc: string = readFileSync(resolve(ROOT, 'src/data/caseStudies.ts'), 'utf8');
const slugRe = /slug:\s*'([^']+)'/g;
const caseStudySlugs: string[] = [];
for (const m of caseStudiesSrc.matchAll(slugRe)) caseStudySlugs.push(m[1]);

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const urlEntry = (path: string, changefreq: ChangeFreq, priority: string): string =>
  `  <url>
    <loc>${esc(BASE_URL + path)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;

const productUrlEntry = (entry: ProductImageEntry): string => {
  const head = `  <url>
    <loc>${esc(`${BASE_URL}/product/${entry.handle}`)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>`;
  const imgBlocks = entry.images.map((img) => {
    // Bilingual title: French primary, English fallback after an em-dash.
    // Google reads the title as a single string; embedding both keeps
    // the FR-first signal while still rewarding EN searches.
    const title = `${img.titleFr} / ${img.titleEn}`;
    return `    <image:image>
      <image:loc>${esc(img.url)}</image:loc>
      <image:title>${esc(title)}</image:title>
    </image:image>`;
  });
  return [head, ...imgBlocks, '  </url>'].join('\n');
};

const totalImageEntries = productEntries.reduce((n, e) => n + e.images.length, 0);

const parts: string[] = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
  ...staticRoutes.map(([p, cf, pr]) => urlEntry(p, cf, pr)),
  ...productEntries.map(productUrlEntry),
  ...caseStudySlugs.map((s) => urlEntry(`/histoires-de-succes/${s}`, 'monthly', '0.6')),
  '</urlset>',
  '',
];

const outPath = resolve(ROOT, 'public/sitemap.xml');
writeFileSync(outPath, parts.join('\n'), 'utf8');

console.log(
  `generate-sitemap: wrote ${staticRoutes.length + productEntries.length + caseStudySlugs.length} URLs ` +
  `(${staticRoutes.length} static + ${productEntries.length} products + ${caseStudySlugs.length} case studies), ` +
  `${totalImageEntries} <image:image> entries -> public/sitemap.xml`,
);
