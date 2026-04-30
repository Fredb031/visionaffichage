'use client';

import { ChevronDown } from 'lucide-react';
import type { Locale } from '@/lib/types';

export type FaqEntry = {
  q: string;
  a: string;
};

type Props = {
  items: FaqEntry[];
  locale?: Locale;
  className?: string;
};

export function FaqAccordion({ items, locale: _locale = 'fr-ca', className = '' }: Props) {
  if (items.length === 0) return null;
  return (
    <div className={`divide-y divide-sand-300 ${className}`.trim()}>
      {items.map((item, idx) => (
        <details
          key={idx}
          className="group py-5 [&>summary]:list-none [&_summary::-webkit-details-marker]:hidden"
        >
          <summary className="flex cursor-pointer items-start justify-between gap-4 text-title-md text-ink-950 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700">
            <span>{item.q}</span>
            <ChevronDown
              aria-hidden
              className="mt-1 h-5 w-5 shrink-0 text-stone-500 transition-transform duration-base ease-standard group-open:rotate-180"
            />
          </summary>
          <p className="mt-3 text-body-md text-stone-500">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
