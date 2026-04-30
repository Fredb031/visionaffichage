import type { Locale, Review } from '@/lib/types';
import { ReviewCard } from './ReviewCard';

type Props = {
  reviews: Review[];
  locale: Locale;
  className?: string;
};

export function ReviewGrid({ reviews, locale, className = '' }: Props) {
  if (reviews.length === 0) return null;
  return (
    <ul className={`grid grid-cols-1 gap-6 md:grid-cols-3 ${className}`.trim()}>
      {reviews.map((r) => (
        <li key={r.id} className="flex">
          <ReviewCard review={r} locale={locale} className="w-full" />
        </li>
      ))}
    </ul>
  );
}
