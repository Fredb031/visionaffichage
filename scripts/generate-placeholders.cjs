#!/usr/bin/env node
/* eslint-disable */
'use strict';

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.resolve(__dirname, '..', 'public', 'placeholders');

function mkdir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function write(file, content) {
  fs.writeFileSync(file, content, 'utf8');
  console.log('  wrote', path.relative(process.cwd(), file));
}

// ---------- product silhouettes ----------

const products = [
  { code: 'ATC1000', slug: 'atc1000-tshirt-essentiel', category: 'tshirt', color: '#101114' },
  { code: 'ATC1015', slug: 'atc1015-tshirt-pre-retreci', category: 'tshirt', color: '#101114' },
  { code: 'ATCF2400', slug: 'atcf2400-chandail-ouate-capuchon', category: 'hoodie', color: '#101114' },
  { code: 'ATCF2500', slug: 'atcf2500-cardigan-zippe', category: 'hoodie', color: '#101114' },
  { code: 'L445', slug: 'l445-polo-femme', category: 'polo', color: '#1B2B4B' },
  { code: 'S445LS', slug: 's445ls-chemise-manches-longues', category: 'longsleeve', color: '#FFFFFF' },
  { code: 'ATC6606', slug: 'atc6606-veste-coquille-souple', category: 'jacket', color: '#101114' },
  { code: 'C105', slug: 'c105-casquette-non-structuree', category: 'cap', color: '#101114' },
  { code: 'WERK250', slug: 'werk250-chandail-travail', category: 'longsleeve', color: '#7A7368' },
  { code: 'ATC1000Y', slug: 'atc1000y-tshirt-jeunesse', category: 'tshirt', color: '#101114' },
];

const VIEWS = [
  { suffix: '', label: 'Vue avant', bg: '#F0ECE4', accent: null },
  { suffix: '-back', label: 'Vue arrière', bg: '#E9E2D4', accent: 'back' },
  { suffix: '-detail', label: 'Détail logo', bg: '#F8F7F3', accent: 'detail' },
];

function silhouettePath(category) {
  switch (category) {
    case 'tshirt':
      return 'M180 220 L320 160 Q400 220 480 160 L620 220 L580 320 L520 290 L520 740 Q400 760 280 740 L280 290 L220 320 Z';
    case 'polo':
      return 'M180 220 L320 160 L360 200 L400 230 L440 200 L480 160 L620 220 L580 320 L520 290 L520 740 Q400 760 280 740 L280 290 L220 320 Z M360 200 L360 320 L440 320 L440 200';
    case 'longsleeve':
      return 'M120 220 L320 160 Q400 220 480 160 L680 220 L660 420 L580 400 L580 740 Q400 760 220 740 L220 400 L140 420 Z';
    case 'hoodie':
      return 'M140 280 L320 180 Q360 140 400 140 Q440 140 480 180 L660 280 L620 420 L560 400 L560 760 Q400 780 240 760 L240 400 L180 420 Z M320 180 Q400 220 480 180 L460 260 Q400 280 340 260 Z';
    case 'jacket':
      return 'M140 220 L320 170 L400 220 L480 170 L660 220 L620 320 L560 300 L560 760 Q400 780 240 760 L240 300 L180 320 Z M400 220 L400 760';
    case 'cap':
      return 'M180 480 Q400 280 620 480 L640 540 L160 540 Z M180 540 L640 540 L640 600 L180 600 Z';
    default:
      return 'M200 200 L600 200 L600 700 L200 700 Z';
  }
}

function viewAccent(viewSuffix, category) {
  if (viewSuffix === '-back') {
    // A horizontal seam line.
    return '<line x1="220" y1="350" x2="580" y2="350" stroke="#FFFFFF" stroke-opacity="0.18" stroke-width="2"/>';
  }
  if (viewSuffix === '-detail') {
    // A small "logo" rectangle on chest area.
    return '<rect x="350" y="320" width="100" height="50" rx="4" ry="4" fill="#F8F7F3" stroke="#7A7368" stroke-width="2"/><text x="400" y="352" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="14" font-weight="600" fill="#101114">LOGO</text>';
  }
  return '';
}

function productSvg({ code, color, category }, view) {
  const fillIsLight = ['#FFFFFF', '#F8F7F3', '#F0ECE4'].includes(color.toUpperCase());
  const stroke = fillIsLight ? '#7A7368' : 'none';
  const accent = viewAccent(view.suffix, category);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 900" width="800" height="900" role="img" aria-label="${code} ${view.label}">
  <rect width="800" height="900" fill="${view.bg}"/>
  <g>
    <path d="${silhouettePath(category)}" fill="${color}" stroke="${stroke}" stroke-width="3"/>
    ${accent}
  </g>
  <text x="400" y="850" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="22" font-weight="500" fill="#7A7368" letter-spacing="2">${code} · ${view.label}</text>
</svg>
`;
}

// ---------- industry heroes ----------

const industries = [
  { slug: 'construction', label: { fr: 'Construction', en: 'Construction' }, gradient: ['#35556D', '#101114'] },
  { slug: 'paysagement', label: { fr: 'Paysagement', en: 'Landscaping' }, gradient: ['#7A7368', '#1D2127'] },
  { slug: 'restauration', label: { fr: 'Restauration', en: 'Restaurants' }, gradient: ['#B42318', '#101114'] },
  { slug: 'demenagement', label: { fr: 'Déménagement', en: 'Moving' }, gradient: ['#9A6700', '#101114'] },
  { slug: 'metiers', label: { fr: 'Métiers spécialisés', en: 'Skilled trades' }, gradient: ['#1B2B4B', '#101114'] },
  { slug: 'bureau', label: { fr: 'Bureau et corporatif', en: 'Office' }, gradient: ['#35556D', '#1D2127'] },
];

function industrySvg({ slug, label, gradient }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900" role="img" aria-label="${label.fr}">
  <defs>
    <linearGradient id="g-${slug}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${gradient[0]}"/>
      <stop offset="100%" stop-color="${gradient[1]}"/>
    </linearGradient>
    <pattern id="p-${slug}" patternUnits="userSpaceOnUse" width="80" height="80" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="80" stroke="#FFFFFF" stroke-opacity="0.05" stroke-width="2"/>
    </pattern>
  </defs>
  <rect width="1600" height="900" fill="url(#g-${slug})"/>
  <rect width="1600" height="900" fill="url(#p-${slug})"/>
  <text x="100" y="500" font-family="Inter,system-ui,sans-serif" font-size="92" font-weight="600" fill="#FFFFFF" letter-spacing="-2">${label.fr}</text>
  <text x="100" y="560" font-family="Inter,system-ui,sans-serif" font-size="28" font-weight="400" fill="#F0ECE4" letter-spacing="1">${label.en}</text>
</svg>
`;
}

// ---------- client logos ----------

const clients = [
  { id: 'bernier-fils', name: 'Bernier & Fils', style: 'serif' },
  { id: 'paysagement-verdure', name: 'Verdure', style: 'sans-condensed' },
  { id: 'mecanique-roy', name: 'Roy', style: 'block' },
  { id: 'bistro-la-voute', name: 'La Voûte', style: 'italic' },
  { id: 'demenagement-express', name: 'Express MTL', style: 'sans-bold' },
  { id: 'groupe-pelletier', name: 'Pelletier', style: 'serif-thin' },
  { id: 'cafe-dube', name: 'Café Dubé', style: 'mono' },
  { id: 'electrique-st-jerome', name: 'St-Jérôme Élec.', style: 'sans-bold' },
];

function clientSvg({ id, name, style }) {
  let fontFamily = 'Inter,system-ui,sans-serif';
  let fontWeight = 600;
  let fontStyle = 'normal';
  let letter = '0';
  let size = 26;
  switch (style) {
    case 'serif':
      fontFamily = 'Georgia,Times,serif';
      fontWeight = 700;
      letter = '0.5';
      break;
    case 'serif-thin':
      fontFamily = 'Georgia,Times,serif';
      fontWeight = 400;
      letter = '2';
      size = 22;
      break;
    case 'sans-condensed':
      fontFamily = 'Inter,system-ui,sans-serif';
      fontWeight = 800;
      letter = '4';
      size = 24;
      break;
    case 'sans-bold':
      fontFamily = 'Inter,system-ui,sans-serif';
      fontWeight = 800;
      letter = '0';
      break;
    case 'italic':
      fontFamily = 'Georgia,Times,serif';
      fontStyle = 'italic';
      fontWeight = 600;
      break;
    case 'block':
      fontFamily = 'Inter,system-ui,sans-serif';
      fontWeight = 900;
      letter = '8';
      size = 32;
      break;
    case 'mono':
      fontFamily = 'ui-monospace,SFMono-Regular,Menlo,monospace';
      fontWeight = 600;
      size = 22;
      break;
    default:
      break;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 80" width="240" height="80" role="img" aria-label="${name}">
  <rect width="240" height="80" fill="transparent"/>
  <text x="120" y="50" text-anchor="middle" font-family="${fontFamily}" font-style="${fontStyle}" font-weight="${fontWeight}" font-size="${size}" letter-spacing="${letter}" fill="#101114">${name}</text>
</svg>
`;
  void id;
}

// ---------- run ----------

function main() {
  mkdir(OUT_DIR);
  mkdir(path.join(OUT_DIR, 'products'));
  mkdir(path.join(OUT_DIR, 'industries'));
  mkdir(path.join(OUT_DIR, 'clients'));

  console.log('Generating product silhouettes (3 views each)…');
  for (const p of products) {
    for (const view of VIEWS) {
      const filename = `${p.slug}${view.suffix}.svg`;
      write(path.join(OUT_DIR, 'products', filename), productSvg(p, view));
    }
  }

  console.log('Generating industry heroes…');
  for (const i of industries) {
    write(path.join(OUT_DIR, 'industries', `${i.slug}.svg`), industrySvg(i));
  }

  console.log('Generating client logos…');
  for (const c of clients) {
    write(path.join(OUT_DIR, 'clients', `${c.id}.svg`), clientSvg(c));
  }

  console.log('\nDone.');
}

main();
