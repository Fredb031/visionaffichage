/**
 * ColorPicker — colour swatch grid with selection state.
 * Pure swatches — no CDN thumbnail images (those had VOTRE LOGO).
 *
 * 2026-04-20 revamp: swatches bumped from 40px to 64px with rounded
 * squares + gold/navy selection rings and each swatch labels the colour
 * directly below so a first-time buyer never has to hover to know what
 * they're picking. The `compact` prop (used nowhere today but kept for
 * call-site compat) still renders the old tight circle layout.
 */
import { useState } from 'react';
import { Loader2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ShopifyVariantColor } from '@/lib/shopify';
import { useLang } from '@/lib/langContext';

interface ColorPickerProps {
  colors: ShopifyVariantColor[];
  loading: boolean;
  selectedColorName: string | null;
  onSelect: (color: ShopifyVariantColor) => void;
  compact?: boolean;
}

/** Bilingual colour-name lookup. The Shopify API returns a single
 * `colorName` string — usually French ("Noir", "Bleu marine") — so a
 * unilingual EN customer either sees untranslated French or a raw hex.
 * This map covers the curated catalog. Falls back to the original name
 * when we don't have a translation. Kept tiny on purpose: every entry
 * matches one of the colours we stock and photograph for.
 *
 * IMPORTANT: lookup keys are normalized (lowercase + accents stripped)
 * before reading this map, so the map keys must be in that same
 * normalized form. Previously entries like `'gris foncé'` and `'crème'`
 * carried diacritics and never matched — "Gris Foncé" silently fell
 * through to the raw French name for EN shoppers. */
const COLOR_NAME_EN: Record<string, string> = {
  noir: 'Black',
  blanc: 'White',
  gris: 'Grey',
  'gris chine': 'Heather grey',
  'gris pale': 'Light grey',
  'gris fonce': 'Dark grey',
  'bleu marine': 'Navy',
  'bleu royal': 'Royal blue',
  'bleu pale': 'Light blue',
  'bleu ciel': 'Sky blue',
  bleu: 'Blue',
  rouge: 'Red',
  bourgogne: 'Burgundy',
  vert: 'Green',
  'vert foret': 'Forest green',
  'vert kaki': 'Khaki',
  kaki: 'Khaki',
  jaune: 'Yellow',
  orange: 'Orange',
  rose: 'Pink',
  mauve: 'Purple',
  sable: 'Sand',
  beige: 'Beige',
  creme: 'Cream',
  marron: 'Brown',
  brun: 'Brown',
  turquoise: 'Turquoise',
  menthe: 'Mint',
};

const normName = (s: string) =>
  s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function translateColor(name: string, lang: 'fr' | 'en'): string {
  if (lang === 'fr') return name;
  // Try exact, then with-accents normalized, then first-word only
  // ("Bleu marine foncé" → "bleu marine" → "bleu").
  const n = normName(name);
  if (COLOR_NAME_EN[n]) return COLOR_NAME_EN[n];
  const parts = n.split(/\s+/);
  for (let cut = parts.length; cut > 0; cut--) {
    const key = parts.slice(0, cut).join(' ');
    if (COLOR_NAME_EN[key]) return COLOR_NAME_EN[key];
  }
  return name;
}

export function ColorPicker({ colors, loading, selectedColorName, onSelect, compact = false }: ColorPickerProps) {
  const { lang } = useLang();
  const [hovered, setHovered] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2" role="status" aria-live="polite">
        <Loader2 className="animate-spin text-muted-foreground" size={14} aria-hidden="true" />
        <span className="text-xs text-muted-foreground">
          {lang === 'en' ? 'Loading colors...' : 'Chargement des couleurs...'}
        </span>
      </div>
    );
  }

  if (!colors.length) return null;

  const hoveredColor = colors.find(c => c.colorName === hovered);
  const selectedColor = colors.find(c => c.colorName === selectedColorName);
  const displayColor = hoveredColor ?? selectedColor;

  // Compact mode keeps the original tight circle grid — preserved as a
  // fallback so anywhere that might still render the picker in a tight
  // sidebar doesn't blow up to the new 64px tile layout.
  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={lang === 'en' ? 'Colors' : 'Couleurs'}>
          {colors.map((color) => {
            const isSelected = color.colorName === selectedColorName;
            const unavailable = !color.availableForSale;
            return (
              <button
                key={color.variantId}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={`${color.colorName}${unavailable ? (lang === 'en' ? ' — sold out' : ' — épuisé') : ''}`}
                disabled={unavailable}
                onClick={() => onSelect(color)}
                onMouseEnter={() => setHovered(color.colorName)}
                onMouseLeave={() => setHovered(null)}
                title={color.colorName}
                className={`relative flex-shrink-0 w-9 h-9 rounded-full transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                  isSelected
                    ? 'ring-2 ring-offset-2 ring-primary scale-110'
                    : 'ring-1 ring-border hover:scale-105 hover:ring-primary/50'
                } ${unavailable ? 'opacity-60 cursor-not-allowed' : ''}`}
                style={{ background: color.hex }}
              >
                {isSelected && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <Check
                      size={10}
                      className={isLightColor(color.hex) ? 'text-foreground/70' : 'text-white/90'}
                      strokeWidth={3}
                      aria-hidden="true"
                    />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <AnimatePresence mode="wait">
          {displayColor && (
            <motion.div
              key={displayColor.colorName}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              className="flex items-center gap-2"
            >
              <div className="w-3.5 h-3.5 rounded-full ring-1 ring-border flex-shrink-0" style={{ background: displayColor.hex }} />
              <span className="text-xs font-semibold text-foreground">{displayColor.colorName}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Full layout — 64px rounded-square tiles with a bilingual name under
  // each. Gold-on-navy selection ring (brand colours). The grid uses a
  // responsive repeat so small screens show 4 per row and desktop shows
  // as many as fit without stretching individual tiles.
  return (
    <div
      className="grid gap-2.5"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(68px, 1fr))' }}
      role="radiogroup"
      aria-label={lang === 'en' ? 'Colors' : 'Couleurs'}
    >
      {colors.map((color) => {
        const isSelected = color.colorName === selectedColorName;
        const unavailable = !color.availableForSale;
        const labelFr = color.colorName;
        const labelEn = translateColor(color.colorName, 'en');
        const primaryLabel = lang === 'en' ? labelEn : labelFr;
        const subLabel = lang === 'en' ? labelFr : labelEn;
        // Only show the sub-label when it actually differs — for colours
        // we don't have a translation for the two lines would read the
        // same and look like a typo.
        const showSub = normName(primaryLabel) !== normName(subLabel);
        return (
          <button
            key={color.variantId}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={`${primaryLabel}${showSub ? ` (${subLabel})` : ''}${unavailable ? (lang === 'en' ? ' — sold out' : ' — épuisé') : ''}`}
            disabled={unavailable}
            onClick={() => onSelect(color)}
            onMouseEnter={() => setHovered(color.colorName)}
            onMouseLeave={() => setHovered(null)}
            title={primaryLabel}
            className={`group relative flex flex-col items-center gap-1.5 p-1 rounded-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
              unavailable ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <span
              className={`relative block w-16 h-16 rounded-xl transition-all ${
                isSelected
                  // Brand gold outer ring + navy inner ring so the pick
                  // reads as premium against both light and dark tiles.
                  ? 'shadow-[0_0_0_2px_#E8A838,0_0_0_4px_#1B3A6B,0_6px_14px_rgba(27,58,107,0.22)] scale-[1.04]'
                  : 'ring-1 ring-border group-hover:ring-primary/60 group-hover:scale-[1.03] group-hover:shadow-md'
              }`}
              style={{ background: color.hex }}
              aria-hidden="true"
            >
              {isSelected && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <Check
                    size={22}
                    className={isLightColor(color.hex) ? 'text-[#1B3A6B]' : 'text-white'}
                    strokeWidth={3}
                    aria-hidden="true"
                  />
                </span>
              )}
              {unavailable && (
                <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                  <div className="w-[140%] h-0.5 bg-white/70 rotate-45 rounded-full" />
                </span>
              )}
            </span>
            <span className={`text-[11px] leading-tight text-center font-bold line-clamp-1 transition-colors ${
              isSelected ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
            }`}>
              {primaryLabel}
            </span>
            {showSub && (
              <span className="text-[9px] leading-tight text-center text-muted-foreground/70 -mt-1 line-clamp-1">
                {subLabel}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function isLightColor(hex: string): boolean {
  // Normalize: strip '#', expand shorthand (#fff -> #ffffff). Without
  // expansion, '#fff'.slice(3,5) yields 'f' and slice(5,7) yields ''
  // which parseInt turns into NaN — the luminance math then short-circuits
  // to false and a white swatch gets a white check mark (invisible).
  // Shopify-sourced variant hexes aren't guaranteed to be 6-digit and
  // some curated color data uses shorthand, so harden this at the edge.
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  const full = h.length === 3
    ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
    : h;
  if (full.length < 6) return true; // Safe default: assume light -> dark check
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return true;
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}
