import type { Locale, Review } from '@/lib/types';
import { StarRating } from '../product/StarRating';

type Props = {
  review: Review;
  locale: Locale;
  className?: string;
};

export function ReviewCard({ review, locale, className = '' }: Props) {
  const formattedDate = review.date
    ? new Intl.DateTimeFormat(locale === 'fr-ca' ? 'fr-CA' : 'en-CA', {
        year: 'numeric',
        month: 'long',
      }).format(new Date(review.date))
    : null;
  return (
    <article
      className={`flex h-full flex-col rounded-lg bg-sand-100 p-6 ${className}`.trim()}
    >
      <StarRating
        rating={review.rating}
        showCount={false}
        locale={locale}
        size="md"
      />
      <blockquote className="mt-4 flex-1 text-body-lg text-ink-950">
        “{review.quote[locale]}”
      </blockquote>
      <footer className="mt-5 border-t border-sand-300 pt-4 text-body-sm">
        <p className="font-semibold text-ink-950">{review.author}</p>
        <p className="text-stone-500">
          {review.role[locale]} · {review.company}
        </p>
        {formattedDate ? (
          <p className="mt-1 text-meta-xs uppercase tracking-wider text-stone-500">
            {formattedDate}
          </p>
        ) : null}
      </footer>
    </article>
  );
}
