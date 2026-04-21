/**
 * ColorPicker — colour swatch grid with selection state.
 * Pure swatches — no CDN thumbnail images (those had VOTRE LOGO).
 *
 * 2026-04-20 revamp: swatches bumped from 40px to 64px with rounded
 * squares + gold/navy selection rings and each swatch labels the colour
 * directly below so a first-time buyer never has to hover to know what
 * they're picking. The `compact` prop (used nowhere today but kept for
 * call-site compat) still renders the old tight circle layout.
 *
 * 2026-04-21 hunt112: adds a "Récents" row above the grid backed by
 * localStorage['va:customizer-recent-colors'] (up to 6 hexes, dedup
 * uppercase), a copy-hex button next to the active swatch summary,
 * and a WCAG-luminance amber contrast hint when the pick is at the
 * extreme light or dark ends of the spectrum.
 */
import { useEffect, useMemo, useState } from 'react';
import { Loader2, Check, Copy, AlertTriangle } from 'lucide-react';
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

const RECENT_STORAGE_KEY = 'va:customizer-recent-colors';
const RECENT_MAX = 6;

/** Normalize a hex string to #RRGGBB uppercase. Returns null when the
 * input can't be made into a 6-digit hex (defensive — Shopify variant
 * hexes aren't strictly validated). */
function normalizeHex(hex: string): string | null {
  if (!hex) return null;
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  const full = h.length === 3
    ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
    : h;
  if (full.length < 6) return null;
  const six = full.slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/.test(six)) return null;
  return `#${six.toUpperCase()}`;
}

function readRecent(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((v) => (typeof v === 'string' ? normalizeHex(v) : null))
      .filter((v): v is string => !!v)
      .slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

function writeRecent(list: string[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* localStorage can throw in private mode / quota full — fail silent */
  }
}

/** WCAG relative luminance, 0..1 on sRGB. */
const lum = (hex: string) => {
  const n = hex.replace('#', '');
  const rgb = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
};

export function ColorPicker({ colors, loading, selectedColorName, onSelect, compact = false }: ColorPickerProps) {
  const { lang } = useLang();
  const [hovered, setHovered] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>(() => readRecent());
  const [copied, setCopied] = useState(false);

  const selectedColor = useMemo(
    () => colors.find((c) => c.colorName === selectedColorName) ?? null,
    [colors, selectedColorName],
  );
  const selectedHex = selectedColor ? normalizeHex(selectedColor.hex) : null;

  // Record every new selection into the recent-colors list. Dedup on
  // normalized hex (uppercase #RRGGBB) so "#fff" and "#FFFFFF" collapse.
  useEffect(() => {
    if (!selectedHex) return;
    setRecent((prev) => {
      if (prev[0] === selectedHex) return prev;
      const next = [selectedHex, ...prev.filter((h) => h !== selectedHex)].slice(0, RECENT_MAX);
      writeRecent(next);
      return next;
    });
  }, [selectedHex]);

  // Reset the "Copied" confirm pill after 2s. Cleanup guards against a
  // fast second click leaving a stale timer attached to an unmounted pill.
  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(id);
  }, [copied]);

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
  const displayColor = hoveredColor ?? selectedColor;

  // Only surface recents that map to a currently-available variant —
  // picking a hex that no longer corresponds to a live variant would be
  // a no-op and confuse users. Preserves order of the stored list.
  const recentActionable = recent
    .map((hex) => {
      const match = colors.find((c) => normalizeHex(c.hex) === hex);
      return match ? { hex, color: match } : null;
    })
    .filter((e): e is { hex: string; color: ShopifyVariantColor } => !!e);

  const copyHex = async () => {
    if (!selectedHex) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(selectedHex);
      } else if (typeof document !== 'undefined') {
        // Legacy fallback — execCommand is deprecated but still works
        // in environments where Clipboard API is gated (http, iframes).
        const ta = document.createElement('textarea');
        ta.value = selectedHex;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
    } catch {
      /* clipboard can be blocked — just skip the confirm swap */
    }
  };

  // Luminance-based contrast hint. Our mockups composite the logo onto
  // both white and dark product backgrounds, so a swatch that is near
  // pure-white (>0.9) or near pure-black (<0.1) is the common failure
  // case where the logo disappears into the fabric. Mid-tones pass.
  const contrastWarning = (() => {
    if (!selectedHex) return null;
    const L = lum(selectedHex);
    if (L > 0.9) {
      return lang === 'en'
        ? 'Low contrast — your logo may be hard to read on this background.'
        : 'Contraste faible — le logo peut être difficile à lire sur ce fond.';
    }
    if (L < 0.1) {
      return lang === 'en'
        ? 'Low contrast — your logo may be hard to read on this background.'
        : 'Contraste faible — le logo peut être difficile à lire sur ce fond.';
    }
    return null;
  })();

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
    <div className="space-y-3">
      {recentActionable.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
            {lang === 'en' ? 'Recent' : 'Récents'}
          </div>
          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label={lang === 'en' ? 'Recent colors' : 'Couleurs récentes'}
          >
            {recentActionable.map(({ hex, color }) => {
              const isSelected = color.colorName === selectedColorName;
              const unavailable = !color.availableForSale;
              const primaryLabel = lang === 'en' ? translateColor(color.colorName, 'en') : color.colorName;
              return (
                <button
                  key={`recent-${hex}`}
                  type="button"
                  aria-label={`${lang === 'en' ? 'Recent: ' : 'Récent : '}${primaryLabel} (${hex})`}
                  aria-pressed={isSelected}
                  disabled={unavailable}
                  onClick={() => onSelect(color)}
                  title={`${primaryLabel} ${hex}`}
                  className={`relative w-7 h-7 rounded-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                    isSelected
                      ? 'ring-2 ring-primary ring-offset-1'
                      : 'ring-1 ring-border hover:ring-primary/60 hover:scale-105'
                  } ${unavailable ? 'opacity-50 cursor-not-allowed' : ''}`}
                  style={{ background: color.hex }}
                />
              );
            })}
          </div>
        </div>
      )}

      {selectedColor && selectedHex && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copyHex}
            aria-label={
              copied
                ? (lang === 'en' ? 'Hex copied' : 'Hex copié')
                : (lang === 'en' ? `Copy hex ${selectedHex}` : `Copier le hex ${selectedHex}`)
            }
            aria-live="polite"
            className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-mono font-semibold rounded-md border border-border bg-background hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          >
            <span
              className="w-3 h-3 rounded-sm ring-1 ring-border flex-shrink-0"
              style={{ background: selectedColor.hex }}
              aria-hidden="true"
            />
            <span>{copied ? (lang === 'en' ? 'Copied' : 'Copié') : selectedHex}</span>
            <Copy size={11} aria-hidden="true" className="text-muted-foreground" />
          </button>
          {contrastWarning && (
            <div
              role="status"
              className="inline-flex items-start gap-1.5 px-2 py-1 text-[11px] rounded-md bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900/50"
            >
              <AlertTriangle size={12} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
              <span>{contrastWarning}</span>
            </div>
          )}
        </div>
      )}

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
                className={`relative block w-16 h-16 rounded-xl transition-all duration-200 ease-out ${
                  isSelected
                    // Brand gold outer ring + navy inner ring so the pick
                    // reads as premium against both light and dark tiles.
                    // Selected also gets a stronger gold glow on hover so
                    // the already-picked swatch still signals interactivity.
                    ? 'shadow-[0_0_0_2px_#E8A838,0_0_0_4px_#1B3A6B,0_6px_14px_rgba(27,58,107,0.22)] scale-[1.04] motion-reduce:scale-100 group-hover:shadow-[0_0_0_2px_#E8A838,0_0_0_4px_#1B3A6B,0_0_0_8px_rgba(232,168,56,0.3),0_6px_14px_rgba(27,58,107,0.22)]'
                    : 'ring-1 ring-border group-hover:ring-primary/60 group-hover:scale-[1.03] motion-reduce:group-hover:scale-100 group-hover:shadow-[0_0_0_4px_rgba(232,168,56,0.15)]'
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
