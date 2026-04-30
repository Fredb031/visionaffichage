'use client';

import type { Locale } from '@/lib/types';

export type SortKey =
  | 'recommended'
  | 'price-asc'
  | 'price-desc'
  | 'lead-time';

type Props = {
  value: SortKey;
  onChange: (value: SortKey) => void;
  locale?: Locale;
  id?: string;
  className?: string;
};

export function SortSelect({
  value,
  onChange,
  locale = 'fr-ca',
  id = 'sort-select',
  className = '',
}: Props) {
  const options: { value: SortKey; label: string }[] =
    locale === 'fr-ca'
      ? [
          { value: 'recommended', label: 'Recommandés' },
          { value: 'price-asc', label: 'Prix croissant' },
          { value: 'price-desc', label: 'Prix décroissant' },
          { value: 'lead-time', label: 'Délai de production' },
        ]
      : [
          { value: 'recommended', label: 'Recommended' },
          { value: 'price-asc', label: 'Price: low to high' },
          { value: 'price-desc', label: 'Price: high to low' },
          { value: 'lead-time', label: 'Lead time' },
        ];
  const labelText = locale === 'fr-ca' ? 'Trier par' : 'Sort by';

  return (
    <div className={`flex items-center gap-2 ${className}`.trim()}>
      <label htmlFor={id} className="text-body-sm text-stone-600">
        {labelText}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as SortKey)}
        className="h-10 rounded-sm border border-sand-300 bg-canvas-000 px-3 pr-8 text-body-sm text-ink-950 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
