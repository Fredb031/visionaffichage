import { Clock } from 'lucide-react';
import type { Locale } from '@/lib/types';
import { getDeliveryEstimate } from '@/lib/delivery';
import { formatLeadTime } from '@/lib/format';

type Props = {
  leadTimeDays: { min: number; max: number };
  locale: Locale;
  className?: string;
};

export function LeadTimeEstimator({ leadTimeDays, locale, className = '' }: Props) {
  const { formatted } = getDeliveryEstimate(leadTimeDays, locale);
  return (
    <div
      className={`flex items-start gap-3 rounded-sm border border-sand-300 bg-canvas-050 p-3 ${className}`.trim()}
    >
      <Clock
        aria-hidden
        className="mt-0.5 h-5 w-5 shrink-0 text-slate-700"
        strokeWidth={1.6}
      />
      <div>
        <p className="text-body-sm font-medium text-ink-950">{formatted}</p>
        <p className="text-meta-xs uppercase tracking-wider text-stone-500">
          {formatLeadTime(leadTimeDays, locale)}
        </p>
      </div>
    </div>
  );
}
