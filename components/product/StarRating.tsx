import { Star } from 'lucide-react';
import type { Locale } from '@/lib/types';

type Props = {
  rating: number;
  count?: number;
  showCount?: boolean;
  locale?: Locale;
  size?: 'sm' | 'md';
  className?: string;
};

export function StarRating({
  rating,
  count,
  showCount = true,
  locale = 'fr-ca',
  size = 'sm',
  className = '',
}: Props) {
  const rounded = Math.round(rating * 2) / 2;
  const stars = [1, 2, 3, 4, 5];
  const dim = size === 'md' ? 18 : 14;
  const reviewWord =
    locale === 'fr-ca'
      ? count === 1
        ? 'avis'
        : 'avis'
      : count === 1
        ? 'review'
        : 'reviews';
  const ariaText =
    locale === 'fr-ca'
      ? `${rating} étoiles sur 5${typeof count === 'number' ? `, ${count} ${reviewWord}` : ''}`
      : `${rating} stars out of 5${typeof count === 'number' ? `, ${count} ${reviewWord}` : ''}`;

  return (
    <span
      className={`inline-flex items-center gap-1 text-body-sm ${className}`.trim()}
      aria-label={ariaText}
      role="img"
    >
      <span className="inline-flex items-center" aria-hidden>
        {stars.map((s) => {
          const filled = rounded >= s;
          const half = !filled && rounded >= s - 0.5;
          return (
            <Star
              key={s}
              width={dim}
              height={dim}
              className={
                filled
                  ? 'fill-ink-950 stroke-ink-950'
                  : half
                    ? 'fill-ink-950/40 stroke-ink-950'
                    : 'fill-transparent stroke-stone-500'
              }
            />
          );
        })}
      </span>
      <span className="font-medium text-ink-950">{rating.toFixed(1)}</span>
      {showCount && typeof count === 'number' ? (
        <span className="text-stone-500">({count})</span>
      ) : null}
    </span>
  );
}
