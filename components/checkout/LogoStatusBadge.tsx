import { CheckCircle2, Clock, FileWarning } from 'lucide-react';
import type { Locale } from '@/lib/types';

export type LogoStatus = 'pending' | 'approved' | 'needs-action';

type Props = {
  status: LogoStatus;
  locale: Locale;
  className?: string;
};

const variantClass: Record<LogoStatus, string> = {
  pending: 'bg-warning-50 text-warning-700 border-warning-200',
  approved: 'bg-success-50 text-success-700 border-success-200',
  'needs-action': 'bg-error-50 text-error-700 border-error-200',
};

const labels: Record<LogoStatus, { 'fr-ca': string; 'en-ca': string }> = {
  pending: {
    'fr-ca': 'Logo en attente d\'approbation',
    'en-ca': 'Logo pending approval',
  },
  approved: {
    'fr-ca': 'Logo approuvé',
    'en-ca': 'Logo approved',
  },
  'needs-action': {
    'fr-ca': 'Action requise sur le logo',
    'en-ca': 'Logo action required',
  },
};

export function LogoStatusBadge({ status, locale, className = '' }: Props) {
  const Icon =
    status === 'approved'
      ? CheckCircle2
      : status === 'pending'
        ? Clock
        : FileWarning;
  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 text-meta-xs font-medium uppercase tracking-wider ${variantClass[status]} ${className}`.trim()}
    >
      <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={1.8} />
      {labels[status][locale]}
    </span>
  );
}
