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
//
// 1600x900 SVG per industry. Brand-token palette only:
//   ink-950 #101114, slate-700 #35556D, sand-100 #F0ECE4,
//   canvas-050 #F8F7F3, stone-500 #7A7368.
//
// Each composes an abstract scene appropriate to the industry — purely
// SVG primitives, no real photography. Industry name positioned bottom-left
// (80px padding) in 44px Inter weight 700. Common diagonal-line pattern at
// 5% opacity + radial vignette darkening corners at 8% opacity.

const BRAND = {
  ink950: '#101114',
  ink800: '#1D2127',
  slate700: '#35556D',
  sand100: '#F0ECE4',
  sand300: '#D2C7B0',
  canvas050: '#F8F7F3',
  stone500: '#7A7368',
};

const industries = [
  { slug: 'construction', label: { fr: 'Construction', en: 'Construction' }, dark: true },
  { slug: 'paysagement', label: { fr: 'Paysagement', en: 'Landscaping' }, dark: false },
  { slug: 'restauration', label: { fr: 'Restauration', en: 'Restaurants' }, dark: false },
  { slug: 'demenagement', label: { fr: 'Déménagement', en: 'Moving' }, dark: false },
  { slug: 'metiers', label: { fr: 'Métiers spécialisés', en: 'Skilled trades' }, dark: true },
  { slug: 'bureau', label: { fr: 'Bureau et corporatif', en: 'Office' }, dark: false },
];

// Common overlays: subtle diagonal hatching + corner vignette.
function industryOverlay(slug, dark) {
  const lineColor = dark ? '#FFFFFF' : BRAND.ink950;
  return `
    <pattern id="p-${slug}" patternUnits="userSpaceOnUse" width="40" height="40" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="40" stroke="${lineColor}" stroke-opacity="0.05" stroke-width="1.5"/>
    </pattern>
    <radialGradient id="vg-${slug}" cx="50%" cy="50%" r="75%">
      <stop offset="60%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.08"/>
    </radialGradient>`;
}

// Each scene fragment occupies the full 1600x900 viewport behind the label.

function sceneConstruction() {
  // Dark diagonal gradient + 3 angled steel beams + hard-hat silhouette + safety-tape stripe.
  return `
    <linearGradient id="bg-construction" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${BRAND.ink800}"/>
      <stop offset="100%" stop-color="${BRAND.slate700}"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#bg-construction)"/>
  <!-- 3 angled steel-beam rectangles, rotated -15deg around viewport center -->
  <g transform="rotate(-15 800 450)" opacity="0.72">
    <rect x="180" y="200" width="1280" height="60" fill="${BRAND.slate700}" stroke="${BRAND.ink950}" stroke-width="3"/>
    <rect x="180" y="200" width="1280" height="6" fill="${BRAND.ink950}" opacity="0.6"/>
    <rect x="180" y="254" width="1280" height="6" fill="${BRAND.ink950}" opacity="0.6"/>
    <rect x="120" y="430" width="1380" height="72" fill="${BRAND.slate700}" stroke="${BRAND.ink950}" stroke-width="3"/>
    <rect x="120" y="430" width="1380" height="7" fill="${BRAND.ink950}" opacity="0.6"/>
    <rect x="120" y="495" width="1380" height="7" fill="${BRAND.ink950}" opacity="0.6"/>
    <rect x="80" y="680" width="1440" height="60" fill="${BRAND.slate700}" stroke="${BRAND.ink950}" stroke-width="3"/>
    <rect x="80" y="680" width="1440" height="6" fill="${BRAND.ink950}" opacity="0.6"/>
    <rect x="80" y="734" width="1440" height="6" fill="${BRAND.ink950}" opacity="0.6"/>
  </g>
  <!-- yellow safety-tape stripe across mid-frame, 40% opacity -->
  <g opacity="0.4">
    <rect x="-50" y="540" width="1700" height="50" fill="#F2C94C" transform="rotate(-3 800 565)"/>
    <g transform="rotate(-3 800 565)" opacity="0.55">
      <rect x="0" y="545" width="40" height="40" fill="${BRAND.ink950}"/>
      <rect x="120" y="545" width="40" height="40" fill="${BRAND.ink950}"/>
      <rect x="240" y="545" width="40" height="40" fill="${BRAND.ink950}"/>
      <rect x="360" y="545" width="40" height="40" fill="${BRAND.ink950}"/>
      <rect x="480" y="545" width="40" height="40" fill="${BRAND.ink950}"/>
      <rect x="600" y="545" width="40" height="40" fill="${BRAND.ink950}"/>
      <rect x="720" y="545" width="40" height="40" fill="${BRAND.ink950}"/>
      <rect x="840" y="545" width="40" height="40" fill="${BRAND.ink950}"/>
      <rect x="960" y="545" width="40" height="40" fill="${BRAND.ink950}"/>
      <rect x="1080" y="545" width="40" height="40" fill="${BRAND.ink950}"/>
      <rect x="1200" y="545" width="40" height="40" fill="${BRAND.ink950}"/>
      <rect x="1320" y="545" width="40" height="40" fill="${BRAND.ink950}"/>
      <rect x="1440" y="545" width="40" height="40" fill="${BRAND.ink950}"/>
      <rect x="1560" y="545" width="40" height="40" fill="${BRAND.ink950}"/>
    </g>
  </g>
  <!-- hard-hat silhouette outline (bottom-right) -->
  <g transform="translate(1200 720)" fill="none" stroke="${BRAND.stone500}" stroke-width="3" opacity="0.55">
    <path d="M -120 0 Q -120 -110 0 -120 Q 120 -110 120 0 Z"/>
    <line x1="-145" y1="0" x2="145" y2="0"/>
    <rect x="-150" y="0" width="300" height="14" rx="3"/>
    <line x1="-50" y1="-115" x2="-50" y2="0"/>
    <line x1="50" y1="-115" x2="50" y2="0"/>
  </g>`;
}

function scenePaysagement() {
  // Warm gradient + 3 abstract leaf forms + horizon + sun + hatched ground.
  return `
    <linearGradient id="bg-paysagement" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${BRAND.sand100}"/>
      <stop offset="100%" stop-color="${BRAND.canvas050}"/>
    </linearGradient>
    <pattern id="hatch-paysagement" patternUnits="userSpaceOnUse" width="14" height="14" patternTransform="rotate(60)">
      <line x1="0" y1="0" x2="0" y2="14" stroke="${BRAND.slate700}" stroke-opacity="0.05" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="1600" height="900" fill="url(#bg-paysagement)"/>
  <!-- faint horizon line -->
  <line x1="0" y1="640" x2="1600" y2="640" stroke="${BRAND.stone500}" stroke-opacity="0.18" stroke-width="1.5"/>
  <!-- low-opacity sun -->
  <circle cx="1280" cy="320" r="180" fill="${BRAND.sand300}" opacity="0.35"/>
  <circle cx="1280" cy="320" r="120" fill="${BRAND.sand300}" opacity="0.25"/>
  <!-- 3 abstract leaf forms (asymmetric ellipses), slate-700 outline -->
  <g fill="none" stroke="${BRAND.slate700}" stroke-width="3" opacity="0.65">
    <g transform="translate(380 420) rotate(-25)">
      <path d="M -180 0 Q -90 -100 0 -110 Q 90 -100 180 0 Q 90 100 0 110 Q -90 100 -180 0 Z"/>
      <line x1="-180" y1="0" x2="180" y2="0"/>
    </g>
    <g transform="translate(820 360) rotate(15)">
      <path d="M -160 0 Q -80 -110 0 -120 Q 80 -110 160 0 Q 80 100 0 110 Q -80 100 -160 0 Z"/>
      <line x1="-160" y1="0" x2="160" y2="0"/>
    </g>
    <g transform="translate(1180 500) rotate(-10)">
      <path d="M -140 0 Q -70 -90 0 -100 Q 70 -90 140 0 Q 70 90 0 100 Q -70 90 -140 0 Z"/>
      <line x1="-140" y1="0" x2="140" y2="0"/>
    </g>
  </g>
  <!-- hatched ground texture, bottom 20% (y 720-900) -->
  <rect x="0" y="720" width="1600" height="180" fill="url(#hatch-paysagement)"/>`;
}

function sceneRestauration() {
  // Warm canvas-050 with subtle radial gradient + place-setting silhouette + chef-hat suggestion.
  return `
    <radialGradient id="bg-restauration" cx="50%" cy="55%" r="70%">
      <stop offset="0%" stop-color="${BRAND.canvas050}"/>
      <stop offset="100%" stop-color="${BRAND.sand100}"/>
    </radialGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#bg-restauration)"/>
  <!-- place-setting silhouette: plate (circle) + utensils flanking, stone-500 outline -->
  <g fill="none" stroke="${BRAND.stone500}" stroke-width="3.5" opacity="0.65">
    <circle cx="800" cy="450" r="210"/>
    <circle cx="800" cy="450" r="170"/>
    <!-- left utensil (fork-like vertical) -->
    <line x1="540" y1="280" x2="540" y2="620"/>
    <line x1="540" y1="280" x2="540" y2="360"/>
    <line x1="528" y1="290" x2="528" y2="350"/>
    <line x1="552" y1="290" x2="552" y2="350"/>
    <!-- right utensil (knife-like vertical) -->
    <line x1="1060" y1="280" x2="1060" y2="620"/>
    <path d="M 1060 280 Q 1085 320 1080 410 L 1060 410 Z" stroke-linejoin="round"/>
  </g>
  <!-- chef-hat suggestion top-right (stacked rounded rectangles) -->
  <g fill="none" stroke="${BRAND.stone500}" stroke-width="3" opacity="0.55">
    <rect x="1280" y="200" width="200" height="50" rx="25"/>
    <rect x="1260" y="150" width="240" height="60" rx="30"/>
    <rect x="1240" y="100" width="280" height="60" rx="30"/>
    <rect x="1300" y="240" width="160" height="40" rx="6"/>
  </g>`;
}

function sceneDemenagement() {
  // Cool gradient + 3 stacked box silhouettes + diagonal arrow.
  return `
    <linearGradient id="bg-demenagement" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${BRAND.sand100}"/>
      <stop offset="100%" stop-color="${BRAND.canvas050}"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#bg-demenagement)"/>
  <!-- 3 stacked boxes (rectangles + cross-strap outlines), slate-700 -->
  <g fill="none" stroke="${BRAND.slate700}" stroke-width="3.5" opacity="0.7" stroke-linejoin="round">
    <!-- bottom box (largest) -->
    <rect x="540" y="560" width="380" height="220"/>
    <line x1="540" y1="670" x2="920" y2="670"/>
    <line x1="730" y1="560" x2="730" y2="780"/>
    <!-- middle box -->
    <rect x="600" y="380" width="320" height="180"/>
    <line x1="600" y1="470" x2="920" y2="470"/>
    <line x1="760" y1="380" x2="760" y2="560"/>
    <!-- top box (smallest) -->
    <rect x="660" y="240" width="240" height="140"/>
    <line x1="660" y1="310" x2="900" y2="310"/>
    <line x1="780" y1="240" x2="780" y2="380"/>
  </g>
  <!-- diagonal arrow up-right, stone-500 -->
  <g fill="none" stroke="${BRAND.stone500}" stroke-width="6" opacity="0.55" stroke-linecap="round" stroke-linejoin="round">
    <line x1="1080" y1="640" x2="1380" y2="340"/>
    <polyline points="1280,330 1380,340 1370,440"/>
  </g>`;
}

function sceneMetiers() {
  // Dark gradient + crossed wrench + screwdriver + bottom mechanical pattern.
  return `
    <linearGradient id="bg-metiers" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${BRAND.ink800}"/>
      <stop offset="100%" stop-color="${BRAND.slate700}"/>
    </linearGradient>
    <pattern id="mech-metiers" patternUnits="userSpaceOnUse" width="80" height="80">
      <circle cx="40" cy="40" r="14" fill="none" stroke="#FFFFFF" stroke-opacity="0.05" stroke-width="1.5"/>
      <line x1="0" y1="40" x2="80" y2="40" stroke="#FFFFFF" stroke-opacity="0.05" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="1600" height="900" fill="url(#bg-metiers)"/>
  <!-- crossed wrench + screwdriver, slate-700 silhouettes (lighter version on dark) -->
  <g opacity="0.78" stroke="${BRAND.ink950}" stroke-width="3" stroke-linejoin="round">
    <!-- wrench: rotated -45 -->
    <g transform="rotate(-45 800 450)" fill="${BRAND.slate700}">
      <rect x="500" y="430" width="600" height="40" rx="8"/>
      <path d="M 480 410 Q 460 450 480 490 L 540 490 L 560 470 L 540 450 L 540 430 Z"/>
      <path d="M 1120 410 Q 1140 450 1120 490 L 1060 490 L 1040 470 L 1060 450 L 1060 430 Z"/>
    </g>
    <!-- screwdriver: rotated +45 -->
    <g transform="rotate(45 800 450)" fill="${BRAND.slate700}">
      <rect x="900" y="430" width="280" height="40" rx="6"/>
      <rect x="880" y="420" width="30" height="60" rx="4" fill="${BRAND.stone500}"/>
      <rect x="540" y="438" width="360" height="24" fill="${BRAND.canvas050}" opacity="0.85"/>
      <polygon points="540,438 540,462 480,450" fill="${BRAND.canvas050}" opacity="0.85"/>
    </g>
  </g>
  <!-- mechanical pattern bottom band -->
  <rect x="0" y="720" width="1600" height="180" fill="url(#mech-metiers)"/>`;
}

function sceneBureau() {
  // Clean canvas-050 + minimalist desk silhouette + window grid pattern at top.
  return `
    <linearGradient id="bg-bureau" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${BRAND.canvas050}"/>
      <stop offset="100%" stop-color="${BRAND.sand100}"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#bg-bureau)"/>
  <!-- subtle window grid (3x2 rectangles) very low opacity, top region -->
  <g fill="none" stroke="${BRAND.slate700}" stroke-width="2" opacity="0.10">
    <rect x="1080" y="80" width="120" height="160"/>
    <rect x="1220" y="80" width="120" height="160"/>
    <rect x="1360" y="80" width="120" height="160"/>
    <rect x="1080" y="260" width="120" height="160"/>
    <rect x="1220" y="260" width="120" height="160"/>
    <rect x="1360" y="260" width="120" height="160"/>
  </g>
  <!-- minimalist desk silhouette: horizontal line for desk + monitor rectangle -->
  <g fill="none" stroke="${BRAND.slate700}" stroke-width="3.5" opacity="0.72" stroke-linejoin="round">
    <!-- monitor screen -->
    <rect x="640" y="280" width="420" height="260" rx="6"/>
    <line x1="640" y1="320" x2="1060" y2="320"/>
    <!-- monitor stand -->
    <line x1="850" y1="540" x2="850" y2="600"/>
    <rect x="780" y="600" width="140" height="14" rx="3"/>
    <!-- desk surface -->
    <line x1="160" y1="630" x2="1440" y2="630" stroke-width="5"/>
    <line x1="160" y1="640" x2="1440" y2="640" stroke-width="2" opacity="0.5"/>
    <!-- desk legs hint -->
    <line x1="280" y1="640" x2="280" y2="800"/>
    <line x1="1320" y1="640" x2="1320" y2="800"/>
  </g>`;
}

const SCENES = {
  construction: sceneConstruction,
  paysagement: scenePaysagement,
  restauration: sceneRestauration,
  demenagement: sceneDemenagement,
  metiers: sceneMetiers,
  bureau: sceneBureau,
};

function industrySvg({ slug, label, dark }) {
  const scene = SCENES[slug]();
  const overlay = industryOverlay(slug, dark);
  // 44px display-lg, Inter weight 700, bottom-left at 80px padding.
  const labelFill = dark ? BRAND.canvas050 : BRAND.ink950;
  const subFill = dark ? BRAND.sand100 : BRAND.stone500;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900" role="img" aria-label="${label.fr}">
  <defs>${overlay}${scene}
  <!-- texture + vignette overlays -->
  <rect width="1600" height="900" fill="url(#p-${slug})"/>
  <rect width="1600" height="900" fill="url(#vg-${slug})"/>
  <!-- industry name: display-lg, Inter 700, bottom-left, 80px padding -->
  <text x="80" y="800" font-family="Inter,system-ui,sans-serif" font-size="44" font-weight="700" fill="${labelFill}" letter-spacing="-1">${label.fr}</text>
  <text x="80" y="838" font-family="Inter,system-ui,sans-serif" font-size="18" font-weight="400" fill="${subFill}" letter-spacing="2" opacity="0.85">${label.en.toUpperCase()}</text>
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

// ---------- home hero collage (4 panels, 400x400) ----------
//
// Each panel reuses the garment silhouette logic from product SVGs but at a
// smaller, square viewport (400x400). Light shadow, transparent-canvas
// background. Used inside the new HeroSplit 2x2 collage on the homepage.

// ---------- Hero editorial panels ----------
//
// Four crafted panels: 1 large feature flat-lay (3 stacked tees) + 3 detail
// macros (logo close-up, fabric weave, QC badge). Premium catalog feel: warm
// canvas background, subtle radial gradients, multi-stop drop shadows, tiny
// metadata at the edges to imply real photography (style codes, ruler ticks).

function heroFeatureFlatlaySvg() {
  // 4:5 portrait flat-lay of three stacked tees, slightly off-axis.
  // Top: slate-700, middle: sand-100, bottom: ink-800. Each gets its own
  // multi-stop shadow blur underneath.
  const W = 800;
  const H = 1000;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="hero-feature">
  <defs>
    <radialGradient id="hero-feat-bg" cx="48%" cy="42%" r="78%">
      <stop offset="0%" stop-color="${TOK.canvas050}"/>
      <stop offset="60%" stop-color="${TOK.sand100}"/>
      <stop offset="100%" stop-color="${TOK.sand200}"/>
    </radialGradient>
    <filter id="hero-feat-shadow" x="-25%" y="-15%" width="150%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="14"/>
      <feOffset dx="0" dy="14"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.18"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="hero-feat-shadow-soft" x="-25%" y="-15%" width="150%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="22"/>
      <feOffset dx="0" dy="22"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.10"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#hero-feat-bg)"/>

  <!-- ruler tick marks at right edge for "real photo" feel -->
  <g stroke="${TOK.slate700}" stroke-opacity="0.18" stroke-width="1">
    <line x1="${W - 22}" y1="60" x2="${W - 12}" y2="60"/>
    <line x1="${W - 16}" y1="120" x2="${W - 12}" y2="120"/>
    <line x1="${W - 16}" y1="180" x2="${W - 12}" y2="180"/>
    <line x1="${W - 22}" y1="240" x2="${W - 12}" y2="240"/>
    <line x1="${W - 16}" y1="300" x2="${W - 12}" y2="300"/>
    <line x1="${W - 16}" y1="360" x2="${W - 12}" y2="360"/>
    <line x1="${W - 22}" y1="420" x2="${W - 12}" y2="420"/>
  </g>

  <!-- BOTTOM tee: ink-800, rotated +6deg, larger shadow -->
  <g transform="translate(80,140) rotate(6 320 380)" filter="url(#hero-feat-shadow-soft)">
    <path d="${tshirtBody(BRAND.ink800, { back: false })}" fill="${BRAND.ink800}" transform="translate(-80,40) scale(0.86)"/>
  </g>
  <text x="450" y="780" font-family="Inter, system-ui" font-size="14" fill="${TOK.sand300}" font-weight="500" letter-spacing="1.2">ATC1015 · INK</text>

  <!-- MIDDLE tee: sand-100, rotated -3deg -->
  <g transform="translate(120,90) rotate(-3 320 360)" filter="url(#hero-feat-shadow)">
    <path d="${tshirtBody(BRAND.sand100, { back: false })}" fill="${BRAND.sand100}" stroke="${TOK.sand300}" stroke-width="1.5" transform="translate(-60,30) scale(0.84)"/>
  </g>
  <text x="500" y="540" font-family="Inter, system-ui" font-size="14" fill="${TOK.stone500}" font-weight="500" letter-spacing="1.2">ATC1015 · SAND</text>

  <!-- TOP tee: slate-700, slight rotation +1deg, smallest shadow -->
  <g transform="translate(160,40) rotate(1 320 340)" filter="url(#hero-feat-shadow)">
    <path d="${tshirtBody(BRAND.slate700, { back: false })}" fill="${BRAND.slate700}" transform="translate(-40,20) scale(0.82)"/>
  </g>
  <text x="540" y="320" font-family="Inter, system-ui" font-size="14" fill="${TOK.stone500}" font-weight="500" letter-spacing="1.2">ATC1015 · SLATE</text>

  <!-- micro caption bottom-left: studio-flat reference -->
  <text x="40" y="${H - 32}" font-family="Inter, system-ui" font-size="12" fill="${TOK.stone500}" font-weight="500" letter-spacing="2">FLAT-LAY · 3 / 24 colorways</text>
  <line x1="40" y1="${H - 22}" x2="160" y2="${H - 22}" stroke="${TOK.slate700}" stroke-opacity="0.25" stroke-width="1"/>
</svg>
`;
}

function heroDetailLogoSvg() {
  // Close-up: a small geometric mark stitched/printed on fabric weave.
  const W = 600;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W}" width="${W}" height="${W}" role="img" aria-label="hero-detail-logo">
  <defs>
    <radialGradient id="logo-bg" cx="50%" cy="40%" r="80%">
      <stop offset="0%" stop-color="${TOK.canvas050}"/>
      <stop offset="100%" stop-color="${TOK.sand100}"/>
    </radialGradient>
    <pattern id="logo-weave" patternUnits="userSpaceOnUse" width="6" height="6">
      <line x1="0" y1="6" x2="6" y2="0" stroke="${TOK.slate700}" stroke-opacity="0.06" stroke-width="0.8"/>
    </pattern>
    <filter id="logo-shadow">
      <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
      <feOffset dx="0" dy="3"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.35"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="${W}" height="${W}" fill="url(#logo-bg)"/>
  <rect width="${W}" height="${W}" fill="url(#logo-weave)"/>

  <!-- Stitched logo mark: 3 abstract strokes forming a "V" + bar -->
  <g filter="url(#logo-shadow)" stroke="${BRAND.ink950}" stroke-width="14" stroke-linecap="round" fill="none">
    <line x1="220" y1="220" x2="300" y2="380"/>
    <line x1="380" y1="220" x2="300" y2="380"/>
    <line x1="240" y1="430" x2="360" y2="430" stroke-width="10"/>
  </g>

  <!-- stitch-dash overlay on the strokes to imply embroidery -->
  <g stroke="${TOK.canvas050}" stroke-width="2" stroke-linecap="round" stroke-dasharray="3 6" fill="none" opacity="0.5">
    <line x1="220" y1="220" x2="300" y2="380"/>
    <line x1="380" y1="220" x2="300" y2="380"/>
  </g>

  <!-- tiny caption: stitch density -->
  <text x="36" y="${W - 28}" font-family="Inter, system-ui" font-size="11" fill="${TOK.stone500}" font-weight="500" letter-spacing="1.6">LOGO · BRODERIE 12K POINTS</text>
</svg>
`;
}

function heroDetailFabricSvg() {
  // Fabric weave detail: diagonal lines at varying opacity over warm canvas.
  const W = 600;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W}" width="${W}" height="${W}" role="img" aria-label="hero-detail-fabric">
  <defs>
    <linearGradient id="fab-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BRAND.slate700}"/>
      <stop offset="100%" stop-color="${BRAND.ink800}"/>
    </linearGradient>
    <pattern id="weave-warp" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="8" stroke="#FFFFFF" stroke-opacity="0.06" stroke-width="2"/>
    </pattern>
    <pattern id="weave-weft" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(-45)">
      <line x1="0" y1="0" x2="0" y2="8" stroke="#000000" stroke-opacity="0.10" stroke-width="2"/>
    </pattern>
    <radialGradient id="fab-vignette" cx="50%" cy="50%" r="70%">
      <stop offset="60%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.25"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${W}" fill="url(#fab-bg)"/>
  <rect width="${W}" height="${W}" fill="url(#weave-warp)"/>
  <rect width="${W}" height="${W}" fill="url(#weave-weft)"/>
  <rect width="${W}" height="${W}" fill="url(#fab-vignette)"/>

  <!-- single highlight thread crossing -->
  <line x1="0" y1="${W * 0.62}" x2="${W}" y2="${W * 0.38}" stroke="${TOK.sand100}" stroke-opacity="0.18" stroke-width="2"/>

  <text x="36" y="${W - 28}" font-family="Inter, system-ui" font-size="11" fill="${TOK.sand100}" fill-opacity="0.55" font-weight="500" letter-spacing="1.6">TISSU · 6.1 OZ COTON</text>
</svg>
`;
}

function heroDetailQcBadgeSvg() {
  // Embossed circular QC badge: "Made in Québec" wordmark.
  const W = 600;
  const cx = W / 2;
  const cy = W / 2;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W}" width="${W}" height="${W}" role="img" aria-label="hero-detail-qc">
  <defs>
    <radialGradient id="qc-bg" cx="50%" cy="40%" r="80%">
      <stop offset="0%" stop-color="${TOK.canvas050}"/>
      <stop offset="100%" stop-color="${TOK.sand100}"/>
    </radialGradient>
    <radialGradient id="qc-emboss" cx="50%" cy="42%" r="55%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.55"/>
      <stop offset="60%" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <filter id="qc-shadow">
      <feGaussianBlur in="SourceAlpha" stdDeviation="6"/>
      <feOffset dx="0" dy="5"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.22"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="${W}" height="${W}" fill="url(#qc-bg)"/>

  <g filter="url(#qc-shadow)">
    <!-- outer ring -->
    <circle cx="${cx}" cy="${cy}" r="200" fill="${BRAND.ink950}"/>
    <circle cx="${cx}" cy="${cy}" r="200" fill="url(#qc-emboss)"/>
    <!-- inner ring -->
    <circle cx="${cx}" cy="${cy}" r="172" fill="none" stroke="${TOK.sand100}" stroke-opacity="0.35" stroke-width="1.5"/>
    <circle cx="${cx}" cy="${cy}" r="156" fill="none" stroke="${TOK.sand100}" stroke-opacity="0.18" stroke-width="1"/>
    <!-- fleur de lys (abstract) -->
    <g fill="${TOK.sand100}" transform="translate(${cx} ${cy - 36})">
      <path d="M0 -28 L8 -10 L20 -8 L10 4 L14 22 L0 14 L-14 22 L-10 4 L-20 -8 L-8 -10 Z"/>
    </g>
    <!-- wordmark -->
    <text x="${cx}" y="${cy + 18}" font-family="Inter, system-ui" font-size="22" font-weight="700" fill="${TOK.sand100}" text-anchor="middle" letter-spacing="3">FAIT AU</text>
    <text x="${cx}" y="${cy + 50}" font-family="Inter, system-ui" font-size="22" font-weight="700" fill="${TOK.sand100}" text-anchor="middle" letter-spacing="3">QUÉBEC</text>
    <!-- top arc tick marks -->
    <g stroke="${TOK.sand100}" stroke-opacity="0.45" stroke-width="1.4" fill="none">
      <line x1="${cx - 80}" y1="${cy + 90}" x2="${cx - 60}" y2="${cy + 90}"/>
      <line x1="${cx + 60}" y1="${cy + 90}" x2="${cx + 80}" y2="${cy + 90}"/>
    </g>
    <text x="${cx}" y="${cy + 96}" font-family="Inter, system-ui" font-size="10" font-weight="500" fill="${TOK.sand100}" fill-opacity="0.55" text-anchor="middle" letter-spacing="2">QC · ATELIER</text>
  </g>

  <text x="36" y="${W - 28}" font-family="Inter, system-ui" font-size="11" fill="${TOK.stone500}" font-weight="500" letter-spacing="1.6">QC BADGE · ATELIER #03</text>
</svg>
`;
}

const HERO_PANELS = [
  // 1 = large feature flat-lay (3 stacked tees)
  { id: '1', kind: 'feature' },
  // 2 = logo detail
  { id: '2', kind: 'logo' },
  // 3 = fabric weave
  { id: '3', kind: 'fabric' },
  // 4 = QC badge
  { id: '4', kind: 'qc' },
];

function heroPanelSvg(panel) {
  if (panel.kind === 'feature') return heroFeatureFlatlaySvg();
  if (panel.kind === 'logo') return heroDetailLogoSvg();
  if (panel.kind === 'fabric') return heroDetailFabricSvg();
  if (panel.kind === 'qc') return heroDetailQcBadgeSvg();
  return '';
}

// ---------- home category cards (6 panels, 600x600) ----------
//
// Each card reuses the garment silhouette but framed in a 600x600 viewport
// with the existing 800x900 source coordinates scaled down. Background
// canvas-050, garment in slate-700 (or specific color) with subtle shadow.

function categoryCardSvg({ slug, category, color, code }) {
  const isCap = category === 'cap' || category === 'tuque';
  const bbox = garmentBBox(category);
  let bodyFragment;
  if (category === 'tshirt') {
    bodyFragment = `<path d="${tshirtBody(color, { back: false })}" fill="${color}" stroke="${isLightColor(color) ? TOK.slate700 : 'none'}" stroke-width="${isLightColor(color) ? 1.5 : 0}" stroke-linejoin="round"/>`;
  } else if (category === 'hoodie') {
    bodyFragment = `<path d="${hoodieBody({ back: false })}" fill="${color}" stroke="${isLightColor(color) ? TOK.slate700 : 'none'}" stroke-width="${isLightColor(color) ? 1.5 : 0}" stroke-linejoin="round"/>`;
  } else if (category === 'polo') {
    bodyFragment = `<path d="${poloBody({ back: false })}" fill="${color}" stroke="${isLightColor(color) ? TOK.slate700 : 'none'}" stroke-width="${isLightColor(color) ? 1.5 : 0}" stroke-linejoin="round"/>`;
  } else if (category === 'cap') {
    const c = capBody();
    bodyFragment = [
      `<path d="${c.bill}" fill="${color}" stroke="${isLightColor(color) ? TOK.slate700 : 'none'}" stroke-width="${isLightColor(color) ? 1.5 : 0}" stroke-linejoin="round"/>`,
      `<path d="${c.crown}" fill="${color}" stroke="${isLightColor(color) ? TOK.slate700 : 'none'}" stroke-width="${isLightColor(color) ? 1.5 : 0}" stroke-linejoin="round"/>`,
      `<path d="${c.button}" fill="${isLightColor(color) ? TOK.slate700 : '#FFFFFF'}" fill-opacity="0.55"/>`,
    ].join('\n    ');
  } else if (category === 'tuque') {
    const t = tuqueBody();
    bodyFragment = [
      `<path d="${t.body}" fill="${color}" stroke="${isLightColor(color) ? TOK.slate700 : 'none'}" stroke-width="${isLightColor(color) ? 1.5 : 0}" stroke-linejoin="round"/>`,
      `<path d="${t.cuff}" fill="${color}" stroke="${isLightColor(color) ? TOK.slate700 : 'none'}" stroke-width="${isLightColor(color) ? 1.5 : 0}" stroke-linejoin="round"/>`,
    ].join('\n    ');
  } else if (category === 'workwear') {
    bodyFragment = `<path d="${workwearBody({ back: false })}" fill="${color}" stroke="${isLightColor(color) ? TOK.slate700 : 'none'}" stroke-width="${isLightColor(color) ? 1.5 : 0}" stroke-linejoin="round"/>`;
  } else {
    bodyFragment = `<rect x="220" y="220" width="360" height="500" fill="${color}"/>`;
  }

  const accents = categoryDetails(category, '', color);
  const groundCy = isCap ? bbox.bottom + 30 : bbox.bottom + 30;
  const groundRx = bbox.w * 0.42;
  const groundRy = isCap ? 18 : 28;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 900" width="600" height="600" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${slug}">
  <defs>
    <linearGradient id="bg-cat-${slug}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="${TOK.canvas050}"/>
    </linearGradient>
    <radialGradient id="hl-cat-${slug}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.22"/>
      <stop offset="60%" stop-color="#FFFFFF" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <filter id="cat-shadow-${slug}" x="-20%" y="-10%" width="140%" height="130%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="10"/>
      <feOffset dx="0" dy="14"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.16"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="800" height="900" fill="url(#bg-cat-${slug})"/>
  <g filter="url(#cat-shadow-${slug})">
    ${bodyFragment}
    <ellipse cx="${bbox.cx}" cy="${isCap ? bbox.top + 60 : bbox.top + 70}" rx="${bbox.w * (isCap ? 0.45 : 0.42)}" ry="${isCap ? 60 : 110}" fill="url(#hl-cat-${slug})"/>
    ${accents}
  </g>
  <text x="730" y="850" font-family="Inter, system-ui" font-size="22" font-weight="600" fill="${TOK.stone500}" fill-opacity="0.55" text-anchor="end" letter-spacing="3">${code || ''}</text>
  <line x1="60" y1="850" x2="120" y2="850" stroke="${TOK.slate700}" stroke-opacity="0.25" stroke-width="1"/>
</svg>
`;
}

const HOME_CATEGORIES = [
  { slug: 'tshirt', category: 'tshirt', color: BRAND.slate700, code: 'TS' },
  { slug: 'hoodie', category: 'hoodie', color: BRAND.ink800, code: 'HD' },
  { slug: 'polo', category: 'polo', color: BRAND.slate700, code: 'PL' },
  { slug: 'cap', category: 'cap', color: BRAND.slate700, code: 'CP' },
  { slug: 'tuque', category: 'tuque', color: BRAND.slate700, code: 'TQ' },
  { slug: 'workwear', category: 'workwear', color: BRAND.ink800, code: 'WW' },
];

// ---------- run ----------

function main() {
  mkdir(OUT_DIR);
  mkdir(path.join(OUT_DIR, 'products'));
  mkdir(path.join(OUT_DIR, 'industries'));
  mkdir(path.join(OUT_DIR, 'clients'));
  mkdir(path.join(OUT_DIR, 'hero'));
  mkdir(path.join(OUT_DIR, 'categories'));

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

  console.log('Generating home hero editorial panels…');
  for (const p of HERO_PANELS) {
    write(
      path.join(OUT_DIR, 'hero', `${p.id}.svg`),
      heroPanelSvg(p),
    );
  }

  console.log('Generating home category cards…');
  for (const c of HOME_CATEGORIES) {
    write(
      path.join(OUT_DIR, 'categories', `${c.slug}.svg`),
      categoryCardSvg(c),
    );
  }

  console.log('\nDone.');
}

main();
