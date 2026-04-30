'use client';

import { X } from 'lucide-react';
import type { Locale } from '@/lib/types';

export type AppliedFilter = {
  key: string;
  label: string;
};

type Props = {
  filters: AppliedFilter[];
  onRemove: (key: string) => void;
  onClearAll: () => void;
  locale?: Locale;
  className?: string;
};

export function AppliedFilters({
  filters,
  onRemove,
  onClearAll,
  locale = 'fr-ca',
  className = '',
}: Props) {
  if (filters.length === 0) return null;
  const clearLabel = locale === 'fr-ca' ? 'Effacer tout' : 'Clear all';
  const removeLabel = locale === 'fr-ca' ? 'Retirer' : 'Remove';

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`.trim()}>
      {filters.map((f) => (
        <button
          key={f.key}
          type="button"
          onClick={() => onRemove(f.key)}
          aria-label={`${removeLabel} ${f.label}`}
          className="inline-flex items-center gap-1.5 rounded-pill border border-sand-300 bg-canvas-000 px-3 py-1 text-meta-xs uppercase tracking-wider text-ink-950 hover:bg-sand-100 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
        >
          {f.label}
          <X aria-hidden className="h-3.5 w-3.5" />
        </button>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="text-body-sm text-stone-600 underline-offset-2 hover:text-ink-950 hover:underline focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
      >
        {clearLabel}
      </button>
    </div>
  );
}
