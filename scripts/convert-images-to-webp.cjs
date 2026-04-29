#!/usr/bin/env node
/* eslint-disable */
// scripts/convert-images-to-webp.cjs
// Phase 8 / OP-2: Convert oversized JPGs/PNGs to WebP for <picture> fallback usage.
// Walks public/products/, public/case-studies/, public/industries/ if they exist.
// Re-encodes any .jpg/.jpeg/.png > 80KB to .webp at quality 82, effort 4.
// Keeps originals (browser fallback for ~3% of users without WebP support).

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const TARGET_DIRS = ['public/products', 'public/case-studies', 'public/industries'];
const SIZE_THRESHOLD = 80 * 1024; // 80KB
const SKIP_NAMES = new Set(['hero-team.webp', 'placeholder.svg']);

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

(async () => {
  const results = [];
  let totalBefore = 0;
  let totalAfter = 0;
  let skippedExisting = 0;
  let skippedSmall = 0;
  let converted = 0;
  let errored = 0;

  for (const rel of TARGET_DIRS) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) {
      console.log(`(skip) ${rel} — not present`);
      continue;
    }
    const files = walk(abs);
    for (const file of files) {
      const base = path.basename(file);
      if (SKIP_NAMES.has(base)) continue;
      const ext = path.extname(file).toLowerCase();
      if (!['.jpg', '.jpeg', '.png'].includes(ext)) continue;
      // Skip favicons / icon-like files
      if (/favicon|icon-\d|apple-touch/i.test(base)) continue;

      const stat = fs.statSync(file);
      if (stat.size < SIZE_THRESHOLD) {
        skippedSmall++;
        continue;
      }

      const webpPath = file.replace(/\.(jpe?g|png)$/i, '.webp');

      // Skip if WebP exists and is newer than the source
      if (fs.existsSync(webpPath)) {
        const wstat = fs.statSync(webpPath);
        if (wstat.mtimeMs >= stat.mtimeMs) {
          skippedExisting++;
          totalBefore += stat.size;
          totalAfter += wstat.size;
          continue;
        }
      }

      try {
        await sharp(file)
          .webp({ quality: 82, effort: 4 })
          .toFile(webpPath);
        const newStat = fs.statSync(webpPath);
        results.push({
          file: path.relative(ROOT, file),
          before: stat.size,
          after: newStat.size,
          saved: stat.size - newStat.size,
          pct: ((1 - newStat.size / stat.size) * 100).toFixed(1),
        });
        totalBefore += stat.size;
        totalAfter += newStat.size;
        converted++;
      } catch (err) {
        console.error(`ERROR converting ${file}:`, err.message);
        errored++;
      }
    }
  }

  // Summary
  console.log('\n=== WebP Conversion Summary ===');
  console.log(`Converted        : ${converted}`);
  console.log(`Skipped (exists) : ${skippedExisting}`);
  console.log(`Skipped (<80KB)  : ${skippedSmall}`);
  console.log(`Errors           : ${errored}`);
  console.log(`Total before     : ${fmtBytes(totalBefore)}`);
  console.log(`Total after      : ${fmtBytes(totalAfter)}`);
  console.log(`Total saved      : ${fmtBytes(totalBefore - totalAfter)} (${(((totalBefore - totalAfter) / totalBefore) * 100).toFixed(1)}%)`);

  if (results.length) {
    // Top 15 savings
    const top = [...results].sort((a, b) => b.saved - a.saved).slice(0, 15);
    console.log('\nTop 15 savings:');
    console.log('  before     after      saved     %     file');
    for (const r of top) {
      console.log(`  ${fmtBytes(r.before).padEnd(9)}  ${fmtBytes(r.after).padEnd(9)}  ${fmtBytes(r.saved).padEnd(8)} ${r.pct.padStart(5)}%  ${r.file}`);
    }
  }
})();
