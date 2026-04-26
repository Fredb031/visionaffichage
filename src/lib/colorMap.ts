/**
 * colorMap.ts — Section 2.3 of the Customizer Blueprint.
 *
 * Maps ATC / Shopify variant colour names (FR + EN) onto sRGB hex values.
 * The catalogue uses ~80 distinct variant names today; whenever Shopify
 * adds a new colour we extend COLOR_MAP first, then fall back gracefully
 * via colorNameToHex's deterministic hash so an unmapped name never
 * shows the dreaded #888 blob.
 */

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
 * Resolve a Shopify variant colour name to an sRGB hex string.
 *
 * Match order (Section 2.3):
 *   1. Direct exact-key lookup against COLOR_MAP.
 *   2. Case-insensitive lookup (normalises trailing whitespace).
 *   3. Partial match — any COLOR_MAP key contained in the input or vice
 *      versa, longest match wins (so "Bleu marine foncé" still snaps to
 *      Bleu marine instead of Bleu).
 *   4. Deterministic hash → hsl(hue, 30%, 55%) — never returns #888.
 *      Same input always yields the same colour, so swatches stay stable
 *      across renders even for unmapped names.
 */
export function colorNameToHex(name: string): string {
  if (!name) return 'hsl(0, 0%, 70%)';

  // Tier 1: exact match.
  const direct = COLOR_MAP[name];
  if (direct) return direct;

  // Tier 2: case-insensitive match.
  const trimmed = name.trim();
  if (!trimmed) return 'hsl(0, 0%, 70%)';
  const lower = trimmed.toLowerCase();
  for (const key of Object.keys(COLOR_MAP)) {
    if (key.toLowerCase() === lower) return COLOR_MAP[key];
  }

  // Tier 3: partial match (longest key wins so we don't snap "Bleu marine"
  // to the shorter "Bleu" entry by accident).
  let bestKey = '';
  for (const key of Object.keys(COLOR_MAP)) {
    const k = key.toLowerCase();
    if ((lower.includes(k) || k.includes(lower)) && k.length > bestKey.length) {
      bestKey = key;
    }
  }
  if (bestKey) return COLOR_MAP[bestKey];

  // Tier 4: deterministic hash → hue. djb2-style accumulator over chars.
  let hash = 0;
  for (let i = 0; i < lower.length; i++) {
    hash = (hash * 31 + lower.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 30%, 55%)`;
}
