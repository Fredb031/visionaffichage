/**
 * ColorPicker — shows real Shopify colors with swatch + product image preview.
 * Loads from Storefront API via useProductColors hook.
 * Clicking a color → shows front/back images of that color in 3D.
 */
import { useState } from 'react';
import { Loader2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ShopifyVariantColor } from '@/lib/shopify';

interface ColorPickerProps {
  colors: ShopifyVariantColor[];
  loading: boolean;
  selectedColorName: string | null;
  onSelect: (color: ShopifyVariantColor) => void;
  compact?: boolean;
}

export function ColorPicker({ colors, loading, selectedColorName, onSelect, compact = false }: ColorPickerProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <Loader2 className="animate-spin text-muted-foreground" size={14} />
        <span className="text-xs text-muted-foreground">Chargement des couleurs...</span>
      </div>
    );
  }

  if (!colors.length) return null;

  const hoveredColor = colors.find(c => c.colorName === hovered);
  const selectedColor = colors.find(c => c.colorName === selectedColorName);

  return (
    <div className="space-y-2.5">
      {/* Swatches grid */}
      <div className="flex flex-wrap gap-2">
        {colors.map((color) => {
          const isSelected = color.colorName === selectedColorName;
          const isHovered = color.colorName === hovered;
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
                    className={
                      isLightColor(color.hex) ? 'text-foreground/70' : 'text-white/90'
                    }
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

      {/* Colour name + image preview on hover/select */}
      <AnimatePresence mode="wait">
        {(hoveredColor ?? selectedColor) && (
          <motion.div
            key={(hoveredColor ?? selectedColor)!.colorName}
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className="flex items-center gap-3"
          >
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full ring-1 ring-border flex-shrink-0"
                style={{ background: (hoveredColor ?? selectedColor)!.hex }}
              />
              <span className="text-xs font-semibold text-foreground">
                {(hoveredColor ?? selectedColor)!.colorName}
              </span>
              {!(hoveredColor ?? selectedColor)!.availableForSale && (
                <span className="text-[10px] text-destructive font-bold">· Épuisé</span>
              )}
            </div>

            {/* Thumbnail front/back */}
            {!compact && (
              <div className="flex gap-1.5 ml-auto">
                {[(hoveredColor ?? selectedColor)!.imageDevant, (hoveredColor ?? selectedColor)!.imageDos]
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((url, i) => (
                    <img
                      key={i}
                      src={url!}
                      alt={i === 0 ? 'Devant' : 'Dos'}
                      className="w-8 h-8 rounded-md object-cover border border-border"
                    />
                  ))}
              </div>
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
