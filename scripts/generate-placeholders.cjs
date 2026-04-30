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
//
// Studio-style SVG mockups. Per-category anatomical silhouettes with
// radial gradient background, subtle ground shadow, soft shoulder
// highlight, seam stitching, and category-appropriate details (placket
// buttons, kangaroo pocket, structured cap brim, knit texture, etc.).
//
// Front / back / detail views differentiated. Style code shown
// subtle in bottom-right corner. SVG dimensions: 800 × 900.

const products = [
  { code: 'ATC1000', slug: 'atc1000-tshirt-essentiel', category: 'tshirt', color: '#101114' },
  { code: 'ATC1015', slug: 'atc1015-tshirt-pre-retreci', category: 'tshirt', color: '#101114' },
  { code: 'ATCF2400', slug: 'atcf2400-chandail-ouate-capuchon', category: 'hoodie', color: '#101114' },
  { code: 'ATCF2500', slug: 'atcf2500-cardigan-zippe', category: 'crewneck', color: '#101114' },
  { code: 'L445', slug: 'l445-polo-femme', category: 'polo', color: '#1B2B4B' },
  { code: 'S445LS', slug: 's445ls-chemise-manches-longues', category: 'longsleeve', color: '#FFFFFF' },
  { code: 'ATC6606', slug: 'atc6606-veste-coquille-souple', category: 'workwear', color: '#101114' },
  { code: 'C105', slug: 'c105-casquette-non-structuree', category: 'cap', color: '#101114' },
  { code: 'WERK250', slug: 'werk250-chandail-travail', category: 'longsleeve', color: '#7A7368' },
  { code: 'ATC1000Y', slug: 'atc1000y-tshirt-jeunesse', category: 'youth-tshirt', color: '#101114' },
];

const VIEWS = [
  { suffix: '', label: 'avant' },
  { suffix: '-back', label: 'arriere' },
  { suffix: '-detail', label: 'detail' },
];

// Tokens (subset of the design system used elsewhere on the site).
const TOK = {
  canvas050: '#F8F7F3',
  canvas100: '#F4F1EA',
  sand100: '#F0ECE4',
  sand200: '#E4DDCD',
  sand300: '#D2C7B0',
  slate700: '#5C636B',
  slate900: '#1D2127',
  ink800: '#2A2D33',
};

function isLightColor(hex) {
  const c = hex.toUpperCase();
  return c === '#FFFFFF' || c === '#F8F7F3' || c === '#F0ECE4' || c === '#F4F1EA';
}

// ---- per-category geometry ------------------------------------------------
//
// Each generator returns a fragment of SVG (paths, lines, circles) describing
// the garment + its category-specific accents. They share a common bbox of
// roughly x:120-680, y:160-780 inside the 800x900 canvas so the studio
// shadow + gradient bg compose consistently.

function tshirtBody(c, opts = {}) {
  const { back = false, scale = 1, dy = 0 } = opts;
  // Scale around the centre (400) and shift vertically by dy.
  const sx = (x) => 400 + (x - 400) * scale;
  const sy = (y) => y * scale + dy;
  // Crew-neck T: shoulders, set-in sleeves, gentle waist taper, rounded hem.
  const path = [
    `M ${sx(260)} ${sy(220)}`, // left shoulder seam top
    `Q ${sx(330)} ${sy(190)} ${sx(360)} ${sy(205)}`, // collar curve left
    back
      ? `Q ${sx(400)} ${sy(220)} ${sx(440)} ${sy(205)}` // back: higher collar
      : `Q ${sx(400)} ${sy(245)} ${sx(440)} ${sy(205)}`, // front: lower scoop
    `Q ${sx(470)} ${sy(190)} ${sx(540)} ${sy(220)}`, // right shoulder
    `L ${sx(640)} ${sy(280)}`, // right sleeve outer
    `Q ${sx(660)} ${sy(310)} ${sx(635)} ${sy(345)}`, // sleeve curve
    `L ${sx(560)} ${sy(330)}`, // armpit right
    `L ${sx(555)} ${sy(740)}`, // right side seam
    `Q ${sx(540)} ${sy(770)} ${sx(490)} ${sy(775)}`, // hem right curve
    `Q ${sx(400)} ${sy(785)} ${sx(310)} ${sy(775)}`, // hem
    `Q ${sx(260)} ${sy(770)} ${sx(245)} ${sy(740)}`, // hem left curve
    `L ${sx(240)} ${sy(330)}`, // left side seam
    `L ${sx(165)} ${sy(345)}`, // armpit left
    `Q ${sx(140)} ${sy(310)} ${sx(160)} ${sy(280)}`, // sleeve curve left
    `Z`,
  ].join(' ');
  return path;
}

function longsleeveBody(opts = {}) {
  const { back = false } = opts;
  // T-shirt with sleeves extended to wrist + cuff.
  const collar = back
    ? `Q 400 220 440 205`
    : `Q 400 245 440 205`;
  return [
    `M 260 220`,
    `Q 330 190 360 205`,
    collar,
    `Q 470 190 540 220`,
    `L 660 290`,
    `L 700 660`, // right wrist
    `Q 705 685 685 692`,
    `L 615 670`, // cuff inner
    `Q 590 540 580 380`,
    `L 555 365`,
    `L 555 745`,
    `Q 540 770 490 775`,
    `Q 400 785 310 775`,
    `Q 260 770 245 745`,
    `L 245 365`,
    `L 220 380`,
    `Q 210 540 185 670`,
    `L 115 692`,
    `Q 95 685 100 660`,
    `L 140 290`,
    `Z`,
  ].join(' ');
}

function hoodieBody(opts = {}) {
  // Heavy weight: thicker silhouette, hood drape behind shoulders.
  return [
    // Hood (drawn behind)
    `M 290 220`,
    `Q 320 130 400 120`,
    `Q 480 130 510 220`,
    // Shoulder line
    `L 560 240`,
    `L 670 300`,
    `Q 685 325 660 350`,
    `L 575 335`,
    `L 565 760`,
    `Q 545 780 480 782`,
    `Q 400 788 320 782`,
    `Q 255 780 235 760`,
    `L 225 335`,
    `L 140 350`,
    `Q 115 325 130 300`,
    `L 240 240`,
    `Z`,
  ].join(' ');
}

function crewneckBody(opts = {}) {
  const { back = false } = opts;
  // Like hoodie but no hood, wide ribbed collar.
  const neck = back
    ? `Q 350 220 400 218 Q 450 220 470 235`
    : `Q 350 250 400 252 Q 450 250 470 235`;
  return [
    `M 270 235`,
    neck,
    `L 560 240`,
    `L 670 300`,
    `Q 685 325 660 350`,
    `L 575 335`,
    `L 565 760`,
    `Q 545 780 480 782`,
    `Q 400 788 320 782`,
    `Q 255 780 235 760`,
    `L 225 335`,
    `L 140 350`,
    `Q 115 325 130 300`,
    `L 240 240`,
    `Z`,
  ].join(' ');
}

function poloBody(opts = {}) {
  const { back = false, longSleeve = false } = opts;
  // Polo: short collar with placket. Sleeves go to mid-bicep (or wrist).
  const collarFront = back
    ? `M 350 215 Q 400 200 450 215`
    : `M 350 220 L 380 280 L 400 270 L 420 280 L 450 220`; // V opening (placket)
  const sleeveR = longSleeve
    ? `L 700 670 Q 705 690 685 695 L 615 675 Q 590 540 580 380 L 555 365`
    : `L 645 320 Q 660 350 635 370 L 560 350 L 555 745`;
  const sleeveL = longSleeve
    ? `L 220 380 Q 210 540 185 675 L 115 695 Q 95 690 100 670 L 140 290`
    : `L 245 350 L 165 370 Q 140 350 155 320 L 260 240`;
  return [
    `M 260 240`,
    `Q 320 200 350 215`,
    back
      ? `Q 400 195 450 215`
      : `Q 400 210 450 215`,
    `Q 480 200 540 240`,
    sleeveR,
    longSleeve ? `` : `L 555 745`,
    `Q 540 770 490 775`,
    `Q 400 785 310 775`,
    `Q 260 770 245 745`,
    longSleeve ? `L 245 365` : `L 245 350`,
    sleeveL,
    `Z`,
    // Placket overlay drawn separately
  ].filter(Boolean).join(' ');
}

function workwearBody(opts = {}) {
  // Heavy jacket: square shoulders, structured silhouette, longer hem.
  return [
    `M 240 230`,
    `L 320 200`,
    `L 400 215`,
    `L 480 200`,
    `L 560 230`,
    `L 670 290`,
    `Q 685 320 655 345`,
    `L 575 325`,
    `L 575 770`,
    `L 400 780`,
    `L 225 770`,
    `L 225 325`,
    `L 145 345`,
    `Q 115 320 130 290`,
    `Z`,
  ].join(' ');
}

function capBody() {
  // Structured front panel + curved bill + crown.
  return {
    crown: `M 200 480 Q 220 300 400 280 Q 580 300 600 480 L 600 540 L 200 540 Z`,
    bill: `M 170 540 Q 400 590 630 540 L 640 595 Q 400 640 160 595 Z`,
    button: `M 400 295 m -10 0 a 10 10 0 1 0 20 0 a 10 10 0 1 0 -20 0`,
  };
}

function tuqueBody() {
  // Beanie with cuffed brim, slight peak.
  return {
    body: `M 260 280 Q 280 200 400 190 Q 520 200 540 280 L 540 480 L 260 480 Z`,
    cuff: `M 250 470 L 550 470 L 560 560 L 240 560 Z`,
  };
}

// ---- accessory primitives ------------------------------------------------

function stitchLine(x1, y1, x2, y2) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${TOK.slate700}" stroke-width="1" stroke-opacity="0.25" stroke-dasharray="3 3"/>`;
}

function categoryDetails(category, view, color) {
  const back = view === '-back';
  const detail = view === '-detail';
  const light = isLightColor(color);
  // Stitching colour: contrast based on garment fill.
  const stitchStroke = light ? TOK.slate700 : '#FFFFFF';
  const stitchOp = light ? '0.25' : '0.18';

  const parts = [];

  // Common: hem stitch + side seams + shoulder stitches.
  function commonSeams(yHem, ySideTop, xL, xR, xSL, xSR) {
    parts.push(
      `<line x1="${xL}" y1="${yHem}" x2="${xR}" y2="${yHem}" stroke="${stitchStroke}" stroke-width="1" stroke-opacity="${stitchOp}" stroke-dasharray="3 3"/>`,
    );
    parts.push(
      `<line x1="${xSL}" y1="${ySideTop}" x2="${xSL}" y2="${yHem - 12}" stroke="${stitchStroke}" stroke-width="1" stroke-opacity="${stitchOp * 0.8}" stroke-dasharray="2 4"/>`,
    );
    parts.push(
      `<line x1="${xSR}" y1="${ySideTop}" x2="${xSR}" y2="${yHem - 12}" stroke="${stitchStroke}" stroke-width="1" stroke-opacity="${stitchOp * 0.8}" stroke-dasharray="2 4"/>`,
    );
  }

  if (category === 'tshirt' || category === 'youth-tshirt') {
    commonSeams(770, 335, 270, 530, 245, 555);
    // Shoulder seam stitches
    parts.push(`<path d="M 280 230 Q 330 210 360 215" fill="none" stroke="${stitchStroke}" stroke-opacity="${stitchOp}" stroke-width="1" stroke-dasharray="2 3"/>`);
    parts.push(`<path d="M 440 215 Q 470 210 520 230" fill="none" stroke="${stitchStroke}" stroke-opacity="${stitchOp}" stroke-width="1" stroke-dasharray="2 3"/>`);
    // Sleeve cuff hint
    parts.push(`<path d="M 165 340 Q 180 350 235 335" fill="none" stroke="${stitchStroke}" stroke-opacity="${stitchOp}" stroke-width="1" stroke-dasharray="2 3"/>`);
    parts.push(`<path d="M 565 335 Q 620 350 635 340" fill="none" stroke="${stitchStroke}" stroke-opacity="${stitchOp}" stroke-width="1" stroke-dasharray="2 3"/>`);
    if (back) {
      // Neck label suggestion
      parts.push(`<rect x="385" y="225" width="30" height="14" rx="2" fill="${light ? TOK.sand200 : '#FFFFFF'}" fill-opacity="0.4"/>`);
    }
  } else if (category === 'longsleeve') {
    commonSeams(770, 335, 270, 530, 245, 555);
    // Cuff seam lines
    parts.push(`<line x1="120" y1="685" x2="190" y2="668" stroke="${stitchStroke}" stroke-opacity="${stitchOp}" stroke-width="1" stroke-dasharray="2 3"/>`);
    parts.push(`<line x1="610" y1="668" x2="680" y2="685" stroke="${stitchStroke}" stroke-opacity="${stitchOp}" stroke-width="1" stroke-dasharray="2 3"/>`);
    if (back) {
      parts.push(`<rect x="385" y="225" width="30" height="14" rx="2" fill="${light ? TOK.sand200 : '#FFFFFF'}" fill-opacity="0.4"/>`);
    }
  } else if (category === 'hoodie') {
    commonSeams(778, 350, 260, 540, 235, 565);
    // Drawstring loops
    parts.push(`<line x1="370" y1="225" x2="368" y2="320" stroke="${stitchStroke}" stroke-opacity="0.55" stroke-width="2"/>`);
    parts.push(`<line x1="430" y1="225" x2="432" y2="320" stroke="${stitchStroke}" stroke-opacity="0.55" stroke-width="2"/>`);
    parts.push(`<circle cx="368" cy="324" r="4" fill="${stitchStroke}" fill-opacity="0.5"/>`);
    parts.push(`<circle cx="432" cy="324" r="4" fill="${stitchStroke}" fill-opacity="0.5"/>`);
    if (!back) {
      // Kangaroo pocket suggestion: inverted U.
      parts.push(`<path d="M 290 520 Q 290 470 340 460 L 460 460 Q 510 470 510 520" fill="none" stroke="${stitchStroke}" stroke-opacity="${stitchOp * 1.2}" stroke-width="1.5" stroke-dasharray="3 3"/>`);
      parts.push(`<line x1="290" y1="520" x2="510" y2="520" stroke="${stitchStroke}" stroke-opacity="${stitchOp * 1.2}" stroke-width="1.5" stroke-dasharray="3 3"/>`);
    }
    // Hood seam
    parts.push(`<path d="M 290 230 Q 400 245 510 230" fill="none" stroke="${stitchStroke}" stroke-opacity="${stitchOp * 1.4}" stroke-width="1.2" stroke-dasharray="2 3"/>`);
    // Thickness lines (heavier weight)
    parts.push(`<line x1="248" y1="345" x2="248" y2="755" stroke="${stitchStroke}" stroke-opacity="0.08" stroke-width="3"/>`);
    parts.push(`<line x1="552" y1="345" x2="552" y2="755" stroke="${stitchStroke}" stroke-opacity="0.08" stroke-width="3"/>`);
  } else if (category === 'crewneck') {
    commonSeams(778, 350, 260, 540, 235, 565);
    // Wide ribbed neck
    parts.push(`<path d="M 280 245 Q 400 270 520 245" fill="none" stroke="${stitchStroke}" stroke-opacity="${stitchOp * 1.4}" stroke-width="2"/>`);
    parts.push(`<path d="M 285 255 Q 400 285 515 255" fill="none" stroke="${stitchStroke}" stroke-opacity="${stitchOp}" stroke-width="1"/>`);
    // Cuff & hem ribbing
    parts.push(`<line x1="248" y1="755" x2="552" y2="755" stroke="${stitchStroke}" stroke-opacity="${stitchOp * 1.4}" stroke-width="1.5"/>`);
  } else if (category === 'polo') {
    // Side seams etc.
    commonSeams(770, 360, 270, 530, 245, 555);
    if (!back) {
      // Placket: vertical line + 3 buttons.
      parts.push(`<line x1="400" y1="245" x2="400" y2="335" stroke="${stitchStroke}" stroke-opacity="0.6" stroke-width="1.2"/>`);
      parts.push(`<line x1="385" y1="245" x2="385" y2="335" stroke="${stitchStroke}" stroke-opacity="${stitchOp}" stroke-width="0.8" stroke-dasharray="2 3"/>`);
      parts.push(`<line x1="415" y1="245" x2="415" y2="335" stroke="${stitchStroke}" stroke-opacity="${stitchOp}" stroke-width="0.8" stroke-dasharray="2 3"/>`);
      parts.push(`<circle cx="400" cy="262" r="3.5" fill="${stitchStroke}" fill-opacity="0.6"/>`);
      parts.push(`<circle cx="400" cy="290" r="3.5" fill="${stitchStroke}" fill-opacity="0.6"/>`);
      parts.push(`<circle cx="400" cy="318" r="3.5" fill="${stitchStroke}" fill-opacity="0.6"/>`);
      // Collar fold
      parts.push(`<path d="M 340 220 L 395 250 L 405 250 L 460 220" fill="none" stroke="${stitchStroke}" stroke-opacity="${stitchOp * 1.6}" stroke-width="1.2"/>`);
    } else {
      parts.push(`<rect x="385" y="225" width="30" height="14" rx="2" fill="${light ? TOK.sand200 : '#FFFFFF'}" fill-opacity="0.4"/>`);
    }
  } else if (category === 'workwear') {
    commonSeams(775, 340, 260, 540, 225, 575);
    // Center zipper line down full length.
    parts.push(`<line x1="400" y1="218" x2="400" y2="775" stroke="${stitchStroke}" stroke-opacity="0.55" stroke-width="1.2"/>`);
    // Zipper teeth dashes
    parts.push(`<line x1="400" y1="218" x2="400" y2="775" stroke="${stitchStroke}" stroke-opacity="0.45" stroke-width="2.5" stroke-dasharray="2 4"/>`);
    if (!back) {
      // Two chest pockets: rectangles with flap line.
      parts.push(`<rect x="270" y="370" width="110" height="90" fill="none" stroke="${stitchStroke}" stroke-opacity="0.45" stroke-width="1.2" stroke-dasharray="3 3"/>`);
      parts.push(`<line x1="270" y1="395" x2="380" y2="395" stroke="${stitchStroke}" stroke-opacity="0.45" stroke-width="1"/>`);
      parts.push(`<rect x="420" y="370" width="110" height="90" fill="none" stroke="${stitchStroke}" stroke-opacity="0.45" stroke-width="1.2" stroke-dasharray="3 3"/>`);
      parts.push(`<line x1="420" y1="395" x2="530" y2="395" stroke="${stitchStroke}" stroke-opacity="0.45" stroke-width="1"/>`);
    }
    // Collar fold (stand collar)
    parts.push(`<path d="M 320 200 L 480 200" fill="none" stroke="${stitchStroke}" stroke-opacity="${stitchOp * 1.4}" stroke-width="1.5"/>`);
  } else if (category === 'cap') {
    // Crown panel seam
    parts.push(`<path d="M 400 295 L 400 540" fill="none" stroke="${stitchStroke}" stroke-opacity="${stitchOp * 1.4}" stroke-width="1" stroke-dasharray="2 3"/>`);
    // Side panel curves
    parts.push(`<path d="M 300 320 Q 305 460 310 540" fill="none" stroke="${stitchStroke}" stroke-opacity="${stitchOp}" stroke-width="1" stroke-dasharray="2 3"/>`);
    parts.push(`<path d="M 500 320 Q 495 460 490 540" fill="none" stroke="${stitchStroke}" stroke-opacity="${stitchOp}" stroke-width="1" stroke-dasharray="2 3"/>`);
    // Brim stitch
    parts.push(`<path d="M 180 555 Q 400 605 620 555" fill="none" stroke="${stitchStroke}" stroke-opacity="${stitchOp * 1.4}" stroke-width="1" stroke-dasharray="3 3"/>`);
    if (back) {
      // Back strap (snapback)
      parts.push(`<rect x="320" y="400" width="160" height="50" rx="4" fill="${TOK.sand100}" fill-opacity="0.15" stroke="${stitchStroke}" stroke-opacity="0.4" stroke-width="1.2"/>`);
      parts.push(`<line x1="400" y1="400" x2="400" y2="450" stroke="${stitchStroke}" stroke-opacity="0.5" stroke-width="1"/>`);
    }
  } else if (category === 'tuque') {
    // Knit zigzag pattern at low opacity over body.
    let zigzag = '';
    for (let y = 290; y < 470; y += 18) {
      let d = `M 270 ${y}`;
      for (let x = 270; x <= 530; x += 20) {
        d += ` L ${x + 10} ${y + 8} L ${x + 20} ${y}`;
      }
      zigzag += `<path d="${d}" fill="none" stroke="${stitchStroke}" stroke-opacity="0.12" stroke-width="1"/>`;
    }
    parts.push(zigzag);
    // Cuff fold line
    parts.push(`<line x1="255" y1="478" x2="545" y2="478" stroke="${stitchStroke}" stroke-opacity="${stitchOp * 1.4}" stroke-width="1.5"/>`);
    parts.push(`<line x1="248" y1="520" x2="552" y2="520" stroke="${stitchStroke}" stroke-opacity="${stitchOp}" stroke-width="1" stroke-dasharray="3 3"/>`);
  }

  return parts.join('\n    ');
}

function garmentBody(category, view, color) {
  const back = view === '-back';
  const light = isLightColor(color);
  const stroke = light ? TOK.slate700 : 'none';
  const strokeWidth = light ? '1.5' : '0';

  if (category === 'tshirt') {
    return `<path d="${tshirtBody(color, { back })}" fill="${color}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>`;
  }
  if (category === 'youth-tshirt') {
    // Slightly smaller scale, shifted down for visual differentiation.
    return `<path d="${tshirtBody(color, { back, scale: 0.85, dy: 35 })}" fill="${color}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>`;
  }
  if (category === 'longsleeve') {
    return `<path d="${longsleeveBody({ back })}" fill="${color}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>`;
  }
  if (category === 'hoodie') {
    return `<path d="${hoodieBody({ back })}" fill="${color}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>`;
  }
  if (category === 'crewneck') {
    return `<path d="${crewneckBody({ back })}" fill="${color}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>`;
  }
  if (category === 'polo') {
    return `<path d="${poloBody({ back })}" fill="${color}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>`;
  }
  if (category === 'polo-ls') {
    return `<path d="${poloBody({ back, longSleeve: true })}" fill="${color}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>`;
  }
  if (category === 'workwear' || category === 'jacket') {
    return `<path d="${workwearBody({ back })}" fill="${color}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>`;
  }
  if (category === 'cap') {
    const c = capBody();
    return [
      `<path d="${c.bill}" fill="${color}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>`,
      `<path d="${c.crown}" fill="${color}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>`,
      `<path d="${c.button}" fill="${light ? TOK.slate700 : '#FFFFFF'}" fill-opacity="0.55"/>`,
    ].join('\n    ');
  }
  if (category === 'tuque') {
    const t = tuqueBody();
    return [
      `<path d="${t.body}" fill="${color}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>`,
      `<path d="${t.cuff}" fill="${color}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>`,
    ].join('\n    ');
  }
  // Fallback box.
  return `<rect x="220" y="220" width="360" height="500" fill="${color}"/>`;
}

// Bbox of garment for highlight/shadow placement (rough, per category).
function garmentBBox(category) {
  switch (category) {
    case 'cap':
      return { cx: 400, cy: 460, w: 460, h: 360, top: 280, bottom: 640 };
    case 'tuque':
      return { cx: 400, cy: 380, w: 320, h: 380, top: 190, bottom: 570 };
    case 'youth-tshirt':
      return { cx: 400, cy: 510, w: 420, h: 470, top: 245, bottom: 770 };
    default:
      return { cx: 400, cy: 490, w: 540, h: 600, top: 200, bottom: 790 };
  }
}

function productSvg({ code, color, category }, view) {
  const bbox = garmentBBox(category);
  const isCap = category === 'cap' || category === 'tuque';
  const detail = view.suffix === '-detail';
  const back = view.suffix === '-back';

  // Detail view: zoomed-in chest crop with logo zone.
  if (detail) {
    // Show a chest crop. Use tshirt-like geometry as the canvas.
    const stitchStroke = isLightColor(color) ? TOK.slate700 : '#FFFFFF';
    const stitchOp = isLightColor(color) ? '0.25' : '0.18';
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 900" width="800" height="900" role="img" aria-label="${code} detail">
  <defs>
    <radialGradient id="bg-${code}-d" cx="50%" cy="40%" r="75%">
      <stop offset="0%" stop-color="${TOK.canvas050}"/>
      <stop offset="100%" stop-color="${TOK.sand100}"/>
    </radialGradient>
    <radialGradient id="hl-${code}-d" cx="50%" cy="35%" r="55%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.18"/>
      <stop offset="70%" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="sh-${code}-d" cx="50%" cy="80%" r="60%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="800" height="900" fill="url(#bg-${code}-d)"/>
  <!-- Garment slab (zoomed chest area) -->
  <path d="M 80 120 Q 200 80 400 80 Q 600 80 720 120 L 720 820 Q 600 860 400 860 Q 200 860 80 820 Z" fill="${color}" stroke="${isLightColor(color) ? TOK.slate700 : 'none'}" stroke-width="${isLightColor(color) ? 1.5 : 0}"/>
  <rect x="80" y="80" width="640" height="780" fill="url(#hl-${code}-d)"/>
  <rect x="80" y="80" width="640" height="780" fill="url(#sh-${code}-d)"/>
  <!-- Stitching hint (shoulder seam top) -->
  <line x1="120" y1="170" x2="680" y2="170" stroke="${stitchStroke}" stroke-opacity="${stitchOp}" stroke-width="1" stroke-dasharray="3 3"/>
  <!-- Logo placement zone -->
  <rect x="280" y="350" width="240" height="160" rx="6" fill="none" stroke="${TOK.sand300}" stroke-width="2.5" stroke-dasharray="8 6"/>
  <text x="400" y="430" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="22" font-weight="600" fill="${TOK.sand300}" letter-spacing="2">LOGO HERE</text>
  <text x="400" y="460" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="13" font-weight="400" fill="${TOK.sand300}" letter-spacing="1" opacity="0.75">Zone d'impression</text>
  <!-- Style code corner -->
  <text x="760" y="868" text-anchor="end" font-family="Inter,system-ui,sans-serif" font-size="12" font-weight="500" fill="${TOK.ink800}" fill-opacity="0.4" letter-spacing="1">${code}</text>
</svg>
`;
  }

  // Front / back view.
  const body = garmentBody(category, view.suffix, color);
  const accents = categoryDetails(category, view.suffix, color);

  // Highlight ellipse: shoulders / upper torso (small for caps).
  const hlCy = isCap ? bbox.top + 60 : bbox.top + 70;
  const hlRx = isCap ? bbox.w * 0.45 : bbox.w * 0.42;
  const hlRy = isCap ? 60 : 110;

  // Lower-torso shadow (skip for caps).
  const sh = isCap
    ? ''
    : `<ellipse cx="${bbox.cx}" cy="${bbox.bottom - 90}" rx="${bbox.w * 0.38}" ry="100" fill="url(#sh-${code}-${view.suffix || 'f'})"/>`;

  // Ground shadow (under garment), 3-stop ellipse.
  const groundCy = isCap ? bbox.bottom + 30 : bbox.bottom + 30;
  const groundRx = bbox.w * 0.42;
  const groundRy = isCap ? 18 : 28;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 900" width="800" height="900" role="img" aria-label="${code} ${view.label}">
  <defs>
    <radialGradient id="bg-${code}-${view.suffix || 'f'}" cx="50%" cy="42%" r="75%">
      <stop offset="0%" stop-color="${TOK.canvas050}"/>
      <stop offset="100%" stop-color="${TOK.sand100}"/>
    </radialGradient>
    <radialGradient id="hl-${code}-${view.suffix || 'f'}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.22"/>
      <stop offset="60%" stop-color="#FFFFFF" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="sh-${code}-${view.suffix || 'f'}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="gnd-${code}-${view.suffix || 'f'}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.18"/>
      <stop offset="60%" stop-color="#000000" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="800" height="900" fill="url(#bg-${code}-${view.suffix || 'f'})"/>
  <!-- ground shadow -->
  <ellipse cx="${bbox.cx}" cy="${groundCy}" rx="${groundRx}" ry="${groundRy}" fill="url(#gnd-${code}-${view.suffix || 'f'})"/>
  <!-- garment body -->
  <g>
    ${body}
    <!-- shoulder highlight (clipped visually by being subtle) -->
    <ellipse cx="${bbox.cx}" cy="${hlCy}" rx="${hlRx}" ry="${hlRy}" fill="url(#hl-${code}-${view.suffix || 'f'})"/>
    ${sh}
    <!-- category-specific accents + stitching -->
    ${accents}
  </g>
  <!-- style code corner -->
  <text x="760" y="868" text-anchor="end" font-family="Inter,system-ui,sans-serif" font-size="12" font-weight="500" fill="${TOK.ink800}" fill-opacity="0.4" letter-spacing="1">${code}${back ? ' · dos' : ''}</text>
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
