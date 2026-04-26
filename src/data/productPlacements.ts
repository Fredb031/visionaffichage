/**
 * productPlacements.ts — single source of truth for per-SKU logo placement
 * presets used by the customizer (Section 3.3 of the Customizer Blueprint).
 *
 * Each PlacementPreset describes:
 *   - A canvas-relative coordinate (xPct, yPct, maxWidthPct) — so the same
 *     preset adapts whether the visible canvas is 600px or 1200px wide.
 *   - A zone ('front' | 'back' | 'sleeve' | 'cap-front' | 'cap-side') so the
 *     UI can group buttons and switch the canvas view automatically.
 *   - A surcharge in dollars per piece, applied on top of the base unit
 *     price when this placement is selected.
 *
 * SKU_TO_PLACEMENT_TYPE maps every Shopify SKU we sell to one of the
 * placement families in PLACEMENTS. Adding a new product = adding a row
 * here + (if needed) a new family in PLACEMENTS — no other file changes.
 */

export interface PlacementPreset {
  /** Stable identifier — used as React key and in saved orders. */
  id: string;
  /** Full label shown under each tile (e.g. "Centre poitrine"). */
  label: string;
  /** Compact label shown in dense UI (e.g. cart summary). */
  labelShort: string;
  /** lucide-react icon name (PlacementButtons resolves it from a string map). */
  icon: string;
  /** Horizontal anchor, percent of canvas width (0 = left, 100 = right). */
  xPct: number;
  /** Vertical anchor, percent of canvas height (0 = top, 100 = bottom). */
  yPct: number;
  /** Maximum logo width as percent of canvas width when this preset applies. */
  maxWidthPct: number;
  /** Which canvas view this placement lives on. */
  zone: 'front' | 'back' | 'sleeve' | 'cap-front' | 'cap-side';
  /** Per-piece surcharge in CAD applied on top of base price. */
  surcharge: number;
}

/**
 * Placement families keyed by garment category. Front placements are
 * listed before back so the UI's "Devant"/"Dos" sections render in the
 * intuitive order without re-sorting.
 */
export const PLACEMENTS: Record<string, PlacementPreset[]> = {
  // ── T-shirts (ATC1000, ATC1015, S445LS, etc.) ──────────────────────────
  tshirt: [
    {
      id: 'tshirt-chest-center',
      label: 'Centre poitrine',
      labelShort: 'Poitrine',
      icon: 'AlignCenter',
      xPct: 50,
      yPct: 32,
      maxWidthPct: 30,
      zone: 'front',
      surcharge: 0,
    },
    {
      id: 'tshirt-chest-left',
      label: 'Coeur (gauche)',
      labelShort: 'Coeur',
      icon: 'Heart',
      xPct: 33,
      yPct: 28,
      maxWidthPct: 12,
      zone: 'front',
      surcharge: 0,
    },
    {
      id: 'tshirt-chest-right',
      label: 'Poitrine droite',
      labelShort: 'Droite',
      icon: 'AlignRight',
      xPct: 67,
      yPct: 28,
      maxWidthPct: 12,
      zone: 'front',
      surcharge: 0,
    },
    {
      id: 'tshirt-back-full',
      label: 'Dos complet',
      labelShort: 'Dos',
      icon: 'RotateCcw',
      xPct: 50,
      yPct: 35,
      maxWidthPct: 50,
      zone: 'back',
      surcharge: 3,
    },
    {
      id: 'tshirt-back-yoke',
      label: 'Haut du dos',
      labelShort: 'Haut dos',
      icon: 'ArrowUp',
      xPct: 50,
      yPct: 18,
      maxWidthPct: 25,
      zone: 'back',
      surcharge: 3,
    },
  ],

  // ── Hoodies (ATCF2500) — same anchors as tshirt minus pocket area ─────
  hoodie: [
    {
      id: 'hoodie-chest-center',
      label: 'Centre poitrine',
      labelShort: 'Poitrine',
      icon: 'AlignCenter',
      xPct: 50,
      yPct: 30,
      maxWidthPct: 28,
      zone: 'front',
      surcharge: 0,
    },
    {
      id: 'hoodie-chest-left',
      label: 'Coeur (gauche)',
      labelShort: 'Coeur',
      icon: 'Heart',
      xPct: 33,
      yPct: 26,
      maxWidthPct: 12,
      zone: 'front',
      surcharge: 0,
    },
    {
      id: 'hoodie-back-full',
      label: 'Dos complet',
      labelShort: 'Dos',
      icon: 'RotateCcw',
      xPct: 50,
      yPct: 35,
      maxWidthPct: 50,
      zone: 'back',
      surcharge: 3,
    },
    {
      id: 'hoodie-back-yoke',
      label: 'Haut du dos',
      labelShort: 'Haut dos',
      icon: 'ArrowUp',
      xPct: 50,
      yPct: 18,
      maxWidthPct: 25,
      zone: 'back',
      surcharge: 3,
    },
  ],

  // ── Polos (L445) — slightly higher chest, no large back option ────────
  polo: [
    {
      id: 'polo-chest-left',
      label: 'Coeur (gauche)',
      labelShort: 'Coeur',
      icon: 'Heart',
      xPct: 33,
      yPct: 26,
      maxWidthPct: 11,
      zone: 'front',
      surcharge: 0,
    },
    {
      id: 'polo-chest-center',
      label: 'Centre poitrine',
      labelShort: 'Poitrine',
      icon: 'AlignCenter',
      xPct: 50,
      yPct: 28,
      maxWidthPct: 22,
      zone: 'front',
      surcharge: 0,
    },
    {
      id: 'polo-chest-right',
      label: 'Poitrine droite',
      labelShort: 'Droite',
      icon: 'AlignRight',
      xPct: 67,
      yPct: 26,
      maxWidthPct: 11,
      zone: 'front',
      surcharge: 0,
    },
  ],

  // ── Vests (ATC6606) — chest only, no back ─────────────────────────────
  vest: [
    {
      id: 'vest-chest-left',
      label: 'Coeur (gauche)',
      labelShort: 'Coeur',
      icon: 'Heart',
      xPct: 33,
      yPct: 28,
      maxWidthPct: 12,
      zone: 'front',
      surcharge: 0,
    },
    {
      id: 'vest-chest-right',
      label: 'Poitrine droite',
      labelShort: 'Droite',
      icon: 'AlignRight',
      xPct: 67,
      yPct: 28,
      maxWidthPct: 12,
      zone: 'front',
      surcharge: 0,
    },
    {
      id: 'vest-back-full',
      label: 'Dos complet',
      labelShort: 'Dos',
      icon: 'RotateCcw',
      xPct: 50,
      yPct: 35,
      maxWidthPct: 45,
      zone: 'back',
      surcharge: 3,
    },
  ],

  // ── Caps (C100) — front, side, or back panel ──────────────────────────
  cap: [
    {
      id: 'cap-front-center',
      label: 'Devant centré',
      labelShort: 'Devant',
      icon: 'AlignCenter',
      xPct: 50,
      yPct: 50,
      maxWidthPct: 35,
      zone: 'cap-front',
      surcharge: 0,
    },
    {
      id: 'cap-side-left',
      label: 'Côté gauche',
      labelShort: 'Côté G',
      icon: 'AlignLeft',
      xPct: 30,
      yPct: 50,
      maxWidthPct: 18,
      zone: 'cap-side',
      surcharge: 2,
    },
    {
      id: 'cap-side-right',
      label: 'Côté droit',
      labelShort: 'Côté D',
      icon: 'AlignRight',
      xPct: 70,
      yPct: 50,
      maxWidthPct: 18,
      zone: 'cap-side',
      surcharge: 2,
    },
    {
      id: 'cap-back',
      label: 'Arrière',
      labelShort: 'Dos',
      icon: 'RotateCcw',
      xPct: 50,
      yPct: 50,
      maxWidthPct: 22,
      zone: 'back',
      surcharge: 2,
    },
  ],

  // ── Tuques (C105) — single cuff placement front-and-centre ────────────
  tuque: [
    {
      id: 'tuque-cuff-center',
      label: 'Revers (centré)',
      labelShort: 'Revers',
      icon: 'AlignCenter',
      xPct: 50,
      yPct: 70,
      maxWidthPct: 30,
      zone: 'front',
      surcharge: 0,
    },
    {
      id: 'tuque-cuff-left',
      label: 'Revers gauche',
      labelShort: 'Revers G',
      icon: 'AlignLeft',
      xPct: 35,
      yPct: 70,
      maxWidthPct: 18,
      zone: 'front',
      surcharge: 0,
    },
  ],
};

/**
 * Direct SKU → placement family lookup. Codes match Shopify variant SKUs
 * (case-sensitive). Update this map when adding new garments — falling
 * back to a sensible default on miss is the customizer's responsibility.
 */
export const SKU_TO_PLACEMENT_TYPE: Record<string, keyof typeof PLACEMENTS> = {
  // T-shirts
  ATC1000: 'tshirt',
  ATC1015: 'tshirt',
  S445LS: 'tshirt',
  // Hoodies
  ATCF2500: 'hoodie',
  // Polos
  L445: 'polo',
  // Vests
  ATC6606: 'vest',
  // Caps
  C100: 'cap',
  // Tuques
  C105: 'tuque',
};
