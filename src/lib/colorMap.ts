/**
 * colorMap.ts — Section 2.3 of the Customizer Blueprint.
 *
 * Maps ATC / Shopify variant colour names (FR + EN) onto sRGB hex values.
 * The catalogue uses ~80 distinct variant names today; whenever Shopify
 * adds a new colour we extend COLOR_MAP first, then fall back gracefully
 * via colorNameToHex's deterministic hash so an unmapped name never
 * shows the dreaded #888 blob.
 */

/**
 * Strip diacritics + lowercase. Mirrors the `normaliseIndexText()` helper
 * in searchIndex.ts (2a831fb) and the `normalise()` in search.ts so the
 * three modules share one character-space contract: a query typed as
 * "vert foret" / "bleu pale" / "creme" / "cafe" lands on the same key
 * the customizer rendered with "Vert forêt" / "Bleu pâle" / "Crème" /
 * "Café". Without this, Tier 2's case-insensitive compare alone leaves
 * every accented FR colour name (≈12 of the ~80 catalogue entries:
 * Crème, Noir chiné, Gris pâle, Gris foncé, Gris chiné, Bleu pâle,
 * Bleu pétrole, Vert forêt, Vert armée, Orange brûlé, Bourgogne, Café)
 * silently falling through to the Tier 4 hash — producing a muted hue
 * instead of the actual swatch on every customizer render.
 */
function normaliseColorName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export const COLOR_MAP: Record<string, string> = {
  // ── Blacks / charcoals ────────────────────────────────────────────────
  'Noir': '#0A0A0A',
  'Black': '#0A0A0A',
  'Black Heather': '#1A1A1A',
  'Noir chiné': '#1A1A1A',
  'Charbon': '#36454F',
  'Charcoal': '#36454F',
  'Charcoal Heather': '#3F4347',
  'Anthracite': '#2D2F33',

  // ── Whites / creams ───────────────────────────────────────────────────
  'Blanc': '#FFFFFF',
  'White': '#FFFFFF',
  'Crème': '#F5F5DC',
  'Cream': '#F5F5DC',
  'Ivoire': '#FFFFF0',
  'Ivory': '#FFFFF0',
  'Naturel': '#F3E9D2',
  'Natural': '#F3E9D2',

  // ── Greys ─────────────────────────────────────────────────────────────
  'Gris': '#9CA3AF',
  'Grey': '#9CA3AF',
  'Gray': '#9CA3AF',
  'Gris pâle': '#D1D5DB',
  'Light Grey': '#D1D5DB',
  'Gris foncé': '#4B5563',
  'Dark Grey': '#4B5563',
  'Gris chiné': '#A8A8A8',
  'Heather Grey': '#A8A8A8',
  'Athletic Heather': '#B5B5B5',
  'Sport Grey': '#A8A8A8',
  'Acier': '#71797E',
  'Steel': '#71797E',

  // ── Blues ─────────────────────────────────────────────────────────────
  'Bleu marine': '#1E2A44',
  'Navy': '#1E2A44',
  'Navy Heather': '#283248',
  'Bleu royal': '#0052CC',
  'Royal Blue': '#0052CC',
  'Royal': '#0052CC',
  'Bleu ciel': '#87CEEB',
  'Sky Blue': '#87CEEB',
  'Bleu pâle': '#B6D7E8',
  'Light Blue': '#B6D7E8',
  'Bleu poudre': '#B0C4DE',
  'Powder Blue': '#B0C4DE',
  'Bleu sarcelle': '#008080',
  'Teal': '#008080',
  'Bleu pétrole': '#005F73',
  'Petrol': '#005F73',
  'Bleu cobalt': '#0047AB',
  'Cobalt': '#0047AB',
  'Bleu denim': '#1560BD',
  'Denim': '#1560BD',
  'Aqua': '#00C2D1',
  'Turquoise': '#40E0D0',

  // ── Reds / pinks ──────────────────────────────────────────────────────
  'Rouge': '#DC2626',
  'Red': '#DC2626',
  'Rouge vif': '#EF1C2A',
  'True Red': '#EF1C2A',
  'Bourgogne': '#7B1F2B',
  'Burgundy': '#7B1F2B',
  'Vin': '#722F37',
  'Wine': '#722F37',
  'Cardinal': '#C41E3A',
  'Rose': '#F8BBD0',
  'Pink': '#F8BBD0',
  'Rose vif': '#EC4899',
  'Hot Pink': '#EC4899',
  'Magenta': '#D81B60',
  'Corail': '#FF6F61',
  'Coral': '#FF6F61',

  // ── Greens ────────────────────────────────────────────────────────────
  'Vert': '#16A34A',
  'Green': '#16A34A',
  'Vert forêt': '#1B4332',
  'Forest Green': '#1B4332',
  'Vert chasseur': '#355E3B',
  'Hunter Green': '#355E3B',
  'Vert kelly': '#4CBB17',
  'Kelly Green': '#4CBB17',
  'Vert lime': '#A3E635',
  'Lime': '#A3E635',
  'Vert olive': '#708238',
  'Olive': '#708238',
  'Vert armée': '#4B5320',
  'Army Green': '#4B5320',
  'Vert menthe': '#98FF98',
  'Mint': '#98FF98',
  'Vert sauge': '#9CAF88',
  'Sage': '#9CAF88',

  // ── Oranges / yellows ─────────────────────────────────────────────────
  'Orange': '#F97316',
  'Orange brûlé': '#CC5500',
  'Burnt Orange': '#CC5500',
  'Orange sécurité': '#FF6700',
  'Safety Orange': '#FF6700',
  'Jaune': '#FACC15',
  'Yellow': '#FACC15',
  'Jaune sécurité': '#EED202',
  'Safety Yellow': '#EED202',
  'Or': '#D4AF37',
  'Gold': '#D4AF37',
  'Moutarde': '#C9A227',
  'Mustard': '#C9A227',

  // ── Purples ───────────────────────────────────────────────────────────
  'Violet': '#7C3AED',
  'Purple': '#7C3AED',
  'Violet foncé': '#4C1D95',
  'Dark Purple': '#4C1D95',
  'Lavande': '#B497D6',
  'Lavender': '#B497D6',
  'Mauve': '#9F8AA0',
  'Lilas': '#C8A2C8',
  'Lilac': '#C8A2C8',

  // ── Browns / earth tones ──────────────────────────────────────────────
  'Brun': '#8B4513',
  'Brown': '#8B4513',
  'Chocolat': '#5D3A1A',
  'Chocolate': '#5D3A1A',
  'Beige': '#D2B48C',
  'Tan': '#D2B48C',
  'Sable': '#C2B280',
  'Sand': '#C2B280',
  'Khaki': '#A89A6B',
  'Kaki': '#A89A6B',
  'Camel': '#C19A6B',
  'Café': '#6F4E37',
  'Coffee': '#6F4E37',
};

/**
 * Pre-built diacritic-stripped lookup. Building this once at module load
 * (a) makes Tier 2 O(1) instead of an Object.keys() scan per call, and
 * (b) gives Tier 3 a normalised-key set so the longest-match scan also
 * matches accent-free input. Insertion order = COLOR_MAP order, so when
 * an FR/EN pair shares the same hex (e.g. 'Khaki' / 'Kaki'), the first
 * key wins on collision — which is fine since the values are identical.
 */
const NORMALISED_COLOR_MAP: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  for (const [key, hex] of Object.entries(COLOR_MAP)) {
    const norm = normaliseColorName(key);
    if (norm && !m.has(norm)) m.set(norm, hex);
  }
  return m;
})();

/** Muted neutral returned for empty / non-string inputs. */
const FALLBACK_EMPTY_HSL = 'hsl(0, 0%, 70%)';

/**
 * Resolve a Shopify variant colour name to an sRGB hex string.
 *
 * Match order (Section 2.3):
 *   1. Direct exact-key lookup against COLOR_MAP.
 *   2. Diacritic-insensitive lookup against NORMALISED_COLOR_MAP. The
 *      normalisation contract (NFD-strip + lowercase) mirrors
 *      searchIndex.ts 2a831fb and search.ts so a query "vert foret"
 *      lands on "Vert forêt" instead of falling to Tier 4.
 *   3. Partial match on the normalised forms — any normalised key
 *      contained in the input or vice versa, longest match wins (so
 *      "Bleu marine foncé" still snaps to Bleu marine instead of Bleu).
 *   4. Deterministic hash → hsl(hue, 30%, 55%) — never returns #888.
 *      Same input always yields the same colour, so swatches stay stable
 *      across renders even for unmapped names.
 */
export function colorNameToHex(name: string): string {
  if (!name) return FALLBACK_EMPTY_HSL;

  // Tier 1: exact match (preserves any consumer that already passes a
  // canonical map key — fastest path, no normalisation overhead).
  const direct = COLOR_MAP[name];
  if (direct) return direct;

  // Tier 2: diacritic + case-insensitive exact match.
  const trimmed = name.trim();
  if (!trimmed) return FALLBACK_EMPTY_HSL;
  const norm = normaliseColorName(trimmed);
  if (!norm) return FALLBACK_EMPTY_HSL;
  const normHit = NORMALISED_COLOR_MAP.get(norm);
  if (normHit) return normHit;

  // Tier 3: partial match on normalised keys (longest key wins so we
  // don't snap "Bleu marine" to the shorter "Bleu" entry by accident).
  // Using the normalised forms means "vert foret armee" still finds
  // "vert armee" without the accents.
  let bestKey = '';
  for (const key of NORMALISED_COLOR_MAP.keys()) {
    if ((norm.includes(key) || key.includes(norm)) && key.length > bestKey.length) {
      bestKey = key;
    }
  }
  if (bestKey) return NORMALISED_COLOR_MAP.get(bestKey)!;

  // Tier 4: deterministic hash → hue. djb2-style accumulator over chars
  // of the normalised form — so "Café" and "cafe" hash to the same hue.
  let hash = 0;
  for (let i = 0; i < norm.length; i++) {
    hash = (hash * 31 + norm.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 30%, 55%)`;
}
