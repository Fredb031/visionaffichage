import type { BadgeKey, Locale } from '@/lib/types';
import { BadgeChip } from './BadgeChip';

type Props = {
  badges: BadgeKey[];
  locale: Locale;
  max?: number;
  className?: string;
};

export function BadgeRow({ badges, locale, max = 3, className = '' }: Props) {
  if (!badges.length) return null;
  const visible = badges.slice(0, max);
  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`.trim()}>
      {visible.map((b) => (
        <li key={b}>
          <BadgeChip badgeKey={b} locale={locale} />
        </li>
      ))}
    </ul>
  );
}
