'use client';

import type { Locale } from '@/lib/types';

type Props = {
  sizes: string[];
  selectedSize: string | null;
  onSelect: (size: string) => void;
  unavailable?: string[];
  locale?: Locale;
  showSizeGuide?: boolean;
  label?: string;
  className?: string;
};

export function SizePicker({
  sizes,
  selectedSize,
  onSelect,
  unavailable = [],
  locale = 'fr-ca',
  showSizeGuide = true,
  label,
  className = '',
}: Props) {
  const groupLabel =
    label ?? (locale === 'fr-ca' ? 'Choisir une taille' : 'Choose a size');
  const guideLabel =
    locale === 'fr-ca' ? 'Guide des tailles' : 'Size guide';
  return (
    <div className={className}>
      <div
        role="radiogroup"
        aria-label={groupLabel}
        className="flex flex-wrap gap-2"
      >
        {sizes.map((size) => {
          const isSelected = selectedSize === size;
          const isUnavailable = unavailable.includes(size);
          return (
            <button
              key={size}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-disabled={isUnavailable}
              disabled={isUnavailable}
              onClick={() => !isUnavailable && onSelect(size)}
              className={[
                'inline-flex h-11 min-w-[44px] items-center justify-center rounded-sm border px-3 text-body-sm font-medium transition-colors duration-base ease-standard',
                isSelected
                  ? 'border-ink-950 bg-ink-950 text-canvas-000'
                  : 'border-sand-300 bg-canvas-000 text-ink-950 hover:bg-sand-100',
                isUnavailable
                  ? 'cursor-not-allowed opacity-50 line-through hover:bg-canvas-000'
                  : 'cursor-pointer',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {size}
            </button>
          );
        })}
      </div>
      {showSizeGuide ? (
        <details className="mt-3 text-body-sm text-stone-600">
          <summary className="cursor-pointer select-none text-ink-950 underline-offset-2 hover:underline">
            {guideLabel}
          </summary>
          <div className="mt-2 rounded-sm border border-sand-300 bg-canvas-050 p-3">
            <p>
              {locale === 'fr-ca'
                ? 'Les tailles suivent le standard nord-américain. Pour les coupes ajustées (ex. L445 femme), envisagez une taille au-dessus.'
                : 'Sizes follow the North American standard. For shaped fits (e.g. L445 women\'s), consider sizing up.'}
            </p>
          </div>
        </details>
      ) : null}
    </div>
  );
}
