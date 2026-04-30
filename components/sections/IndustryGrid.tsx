import type { Industry, Locale } from '@/lib/types';
import { IndustryCard } from './IndustryCard';

type Props = {
  industries: Industry[];
  locale: Locale;
  className?: string;
};

export function IndustryGrid({ industries, locale, className = '' }: Props) {
  if (industries.length === 0) return null;
  return (
    <ul
      className={`grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 ${className}`.trim()}
    >
      {industries.map((i) => (
        <li key={i.slug} className="flex">
          <IndustryCard industry={i} locale={locale} className="w-full" />
        </li>
      ))}
    </ul>
  );
}
