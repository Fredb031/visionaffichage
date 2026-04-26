/**
 * designTemplates.ts — Volume II Section 16.1 starter placements.
 *
 * Six pre-made canvas placements that let a first-time buyer skip the
 * blank-canvas anxiety: they pick a template, the customizer drops their
 * (already-uploaded OR placeholder) artwork at the matching x/y/width/
 * rotation in the matching zone. The TemplateGallery component reads
 * this list, shows a 4-up grid, and forwards the selected entry to the
 * customizer via an `onApply` callback.
 *
 * Shape notes:
 *   • `zone` is a coarse semantic key (front | back | left-sleeve | …),
 *     NOT a Shopify printZone.id — the consumer is expected to map the
 *     zone to whichever printZone is closest on the active product. We
 *     deliberately keep the catalogue product-agnostic so the same six
 *     templates work across t-shirts, hoodies, polos, etc.
 *   • `x`, `y`, `width`, `rotation` are in canvas % (same units as
 *     LogoPlacement). The canvas already drives off these so applying a
 *     template is one setCurrentPlacement call.
 *   • `style` and `industries` are descriptive metadata. They power
 *     future filtering ("show me bold templates for restaurants") and
 *     the screen-reader description on each tile.
 *   • `thumbnail` points at /templates/{id}.svg under /public. The
 *     gallery falls back via onError if the SVG isn't deployed yet —
 *     operator follow-up to drop real preview vectors.
 */

export type DesignTemplateZone =
  | 'front'
  | 'back'
  | 'left-sleeve'
  | 'right-sleeve';

export type DesignTemplateStyle =
  | 'minimal'
  | 'bold'
  | 'badge'
  | 'statement';

export interface DesignTemplate {
  /** Stable slug — also the thumbnail filename and a11y key. */
  id: string;
  /** French-first display name shown beneath the tile. */
  name: string;
  /** English mirror for the bilingual UI. */
  nameEn: string;
  /** Coarse zone — consumer maps to the active product's printZone. */
  zone: DesignTemplateZone;
  /** Canvas % — top-left x of the placement. */
  x: number;
  /** Canvas % — top-left y of the placement. */
  y: number;
  /** Canvas % — width of the placement. Height follows the artwork's
   *  natural aspect ratio at apply-time. */
  width: number;
  /** Degrees of rotation. 0 for almost everything; we keep the field
   *  on every entry so the consumer can spread `...template` straight
   *  into a LogoPlacement without conditional defaults. */
  rotation: number;
  /** Descriptive style for filtering + a11y. */
  style: DesignTemplateStyle;
  /** Industries this layout reads well for — used for future filtering
   *  and to show a hint on hover ("popular for restaurants"). */
  industries: string[];
  /** /public path. Consumer handles 404 via onError fallback. */
  thumbnail: string;
}

/** Section 16.1 catalogue — six entries: four front-zone defaults plus
 *  one back and one sleeve variant for users who want to start outside
 *  the chest. */
export const TEMPLATES: DesignTemplate[] = [
  {
    id: 'center-chest-sm',
    name: 'Centre poitrine — petit',
    nameEn: 'Center chest — small',
    zone: 'front',
    x: 40,
    y: 26,
    width: 20,
    rotation: 0,
    style: 'minimal',
    industries: ['restaurant', 'corporate', 'tech'],
    thumbnail: '/templates/center-chest-sm.svg',
  },
  {
    id: 'center-chest-lg',
    name: 'Centre poitrine — grand',
    nameEn: 'Center chest — large',
    zone: 'front',
    x: 30,
    y: 22,
    width: 40,
    rotation: 0,
    style: 'bold',
    industries: ['construction', 'sport', 'événementiel'],
    thumbnail: '/templates/center-chest-lg.svg',
  },
  {
    id: 'top-left-badge',
    name: 'Écusson cœur gauche',
    nameEn: 'Top-left badge',
    zone: 'front',
    x: 18,
    y: 22,
    width: 14,
    rotation: 0,
    style: 'badge',
    industries: ['corporate', 'restaurant', 'santé'],
    thumbnail: '/templates/top-left-badge.svg',
  },
  {
    id: 'full-chest',
    name: 'Pleine poitrine',
    nameEn: 'Full chest',
    zone: 'front',
    x: 22,
    y: 20,
    width: 56,
    rotation: 0,
    style: 'statement',
    industries: ['sport', 'événementiel', 'mode'],
    thumbnail: '/templates/full-chest.svg',
  },
  {
    id: 'back-large',
    name: 'Dos — grand format',
    nameEn: 'Back — large',
    zone: 'back',
    x: 50,
    y: 30,
    width: 60,
    rotation: 0,
    style: 'statement',
    industries: ['construction', 'événementiel', 'équipe'],
    thumbnail: '/templates/back-large.svg',
  },
  {
    id: 'left-sleeve-small',
    name: 'Manche gauche — petit',
    nameEn: 'Left sleeve — small',
    zone: 'left-sleeve',
    x: 50,
    y: 30,
    width: 40,
    rotation: 0,
    style: 'minimal',
    industries: ['corporate', 'tech', 'sport'],
    thumbnail: '/templates/left-sleeve-small.svg',
  },
];

/** Convenience: which zones count as "front" for the default gallery
 *  filter. The TemplateGallery toggles between FRONT-only and the full
 *  catalogue (back + sleeve). */
export const FRONT_ZONES: DesignTemplateZone[] = ['front'];

/** Lookup helper for the consumer when applying a template by id. */
export const getTemplateById = (id: string): DesignTemplate | undefined =>
  TEMPLATES.find(t => t.id === id);
