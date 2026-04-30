import type { BadgeKey, Locale } from '@/lib/types';

type Props = {
  badgeKey: BadgeKey;
  locale: Locale;
  className?: string;
};

const labels: Record<BadgeKey, { 'fr-ca': string; 'en-ca': string }> = {
  'quick-ship': {
    'fr-ca': 'Expédition rapide',
    'en-ca': 'Quick ship',
  },
  'best-embroidery': {
    'fr-ca': 'Meilleure broderie',
    'en-ca': 'Best for embroidery',
  },
  'best-screen-print': {
    'fr-ca': 'Meilleure sérigraphie',
    'en-ca': 'Best for screen print',
  },
  heavyweight: {
    'fr-ca': 'Tissu robuste',
    'en-ca': 'Heavyweight',
  },
  'kit-friendly': {
    'fr-ca': 'Idéal pour kit',
    'en-ca': 'Kit friendly',
  },
};

const variantClass: Record<BadgeKey, string> = {
  'quick-ship': 'bg-success-50 text-success-700 border-success-200',
  'best-embroidery': 'bg-sand-100 text-slate-700 border-sand-300',
  'best-screen-print': 'bg-sand-100 text-ink-950 border-sand-300',
  heavyweight: 'bg-canvas-050 text-ink-950 border-sand-300',
  'kit-friendly': 'bg-canvas-050 text-slate-700 border-sand-300',
};

export function BadgeChip({ badgeKey, locale, className = '' }: Props) {
  const label = labels[badgeKey][locale];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill border px-2.5 py-1 text-meta-xs font-medium uppercase tracking-wider ${variantClass[badgeKey]} ${className}`.trim()}
    >
      {label}
    </span>
  );
}

export const badgeLabels = labels;
