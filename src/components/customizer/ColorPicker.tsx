/**
 * ColorPicker — colour swatch grid with selection state.
 * Pure swatches — no CDN thumbnail images (those had VOTRE LOGO).
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

export function ColorPicker({ colors, loading, selectedColorName, onSelect, compact = false }: ColorPickerProps) {
  const { lang } = useLang();
  const [hovered, setHovered] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <Loader2 className="animate-spin text-muted-foreground" size={14} />
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

  return (
    <div className="space-y-2">
      {/* Swatches grid */}
      <div className="flex flex-wrap gap-2">
        {colors.map((color) => {
          const isSelected = color.colorName === selectedColorName;
          return (
            <button
              key={color.variantId}
              onClick={() => onSelect(color)}
              onMouseEnter={() => setHovered(color.colorName)}
              onMouseLeave={() => setHovered(null)}
              title={color.colorName}
              className={`relative flex-shrink-0 transition-all duration-200 ${
                compact ? 'w-7 h-7' : 'w-8 h-8'
              } rounded-full ${
                isSelected
                  ? 'ring-2 ring-offset-2 ring-primary scale-110'
                  : 'ring-1 ring-border hover:scale-105 hover:ring-primary/50'
              }`}
              style={{ background: color.hex }}
            >
              {isSelected && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <Check
                    size={10}
                    className={isLightColor(color.hex) ? 'text-foreground/70' : 'text-white/90'}
                    strokeWidth={3}
                  />
                </span>
              )}
              {!color.availableForSale && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <div className="w-full h-px bg-white/60 rotate-45" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Colour name label (no CDN thumbnail images) */}
      <AnimatePresence mode="wait">
        {displayColor && (
          <motion.div
            key={displayColor.colorName}
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className="flex items-center gap-2"
          >
            <div
              className="w-3.5 h-3.5 rounded-full ring-1 ring-border flex-shrink-0"
              style={{ background: displayColor.hex }}
            />
            <span className="text-xs font-semibold text-foreground">
              {displayColor.colorName}
            </span>
            {!displayColor.availableForSale && (
              <span className="text-[10px] text-destructive font-bold">
                · {lang === 'en' ? 'Sold out' : 'Épuisé'}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}
