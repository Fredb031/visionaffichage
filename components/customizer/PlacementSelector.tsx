'use client';

import { useId } from 'react';

import type { Placement } from '@/lib/customizer';

type PlacementOption = {
  id: Placement;
  label: string;
  description: string;
};

type Props = {
  value: Placement;
  onChange: (next: Placement) => void;
  options: PlacementOption[];
  legend: string;
};

export function PlacementSelector({ value, onChange, options, legend }: Props) {
  const groupId = useId();
  return (
    <fieldset className="rounded-md border border-sand-300 bg-canvas-000 p-5 shadow-xs">
      <legend className="px-1 text-body-sm font-semibold text-ink-950">{legend}</legend>
      <div role="radiogroup" aria-labelledby={groupId} className="mt-2 grid gap-2 sm:grid-cols-3">
        {options.map((option) => {
          const checked = option.id === value;
          return (
            <label
              key={option.id}
              className={[
                'flex cursor-pointer flex-col gap-1 rounded-sm border-2 px-4 py-3 transition-colors duration-base ease-standard',
                checked
                  ? 'border-ink-950 bg-sand-100'
                  : 'border-sand-300 hover:border-slate-700',
              ].join(' ')}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`placement-${groupId}`}
                  value={option.id}
                  checked={checked}
                  onChange={() => onChange(option.id)}
                  className="h-4 w-4 accent-ink-950"
                />
                <span className="text-body-md font-medium text-ink-950">{option.label}</span>
              </span>
              <span className="pl-6 text-body-sm text-stone-600">{option.description}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
