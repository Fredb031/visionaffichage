import { Zap } from 'lucide-react';
import { useLang } from '@/lib/langContext';

interface DeliveryBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'gold' | 'navy' | 'inline';
  className?: string;
  /** When true, show the actual arrival date instead of the generic
   * "5 business days" string. Useful on product cards / PDPs where the
   * commitment is more persuasive than the count. */
  showDate?: boolean;
}

const STANDARD_BUSINESS_DAYS = 5;
const PRODUCTION_CUTOFF_HOUR = 15;

/** Compute today + N business days (skip Sat/Sun). Pure function so
 * it's cheap to call in any render. */
function addBusinessDays(from: Date, days: number): Date {
  const out = new Date(from);
  let added = 0;
  while (added < days) {
    out.setDate(out.getDate() + 1);
    const d = out.getDay();
    if (d !== 0 && d !== 6) added++;
  }
  return out;
}

export function DeliveryBadge({ size = 'md', variant = 'gold', className = '', showDate = false }: DeliveryBadgeProps) {
  const { lang } = useLang();
  const label = (() => {
    if (!showDate) return lang === 'en' ? `${STANDARD_BUSINESS_DAYS} business days` : `${STANDARD_BUSINESS_DAYS} jours ouvrables`;
    // Honor the 3pm production cutoff so the badge matches the
    // Checkout ship-by promise and the homepage hero — without this,
    // a shopper late in the day saw an earlier date on the badge
    // than the one Checkout quoted them. On Sat/Sun production is
    // closed for the entire day, so the order will not start moving
    // until Monday — same effect as a weekday after-cutoff order.
    // Treating weekends as "past cutoff" (rather than ignoring the
    // cutoff) keeps the Fri-4pm and Sat-anytime buyers on the same
    // ETA, which is what Checkout would quote them on Monday.
    const now = new Date();
    const dow = now.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const cutoff = new Date(now);
    cutoff.setHours(PRODUCTION_CUTOFF_HOUR, 0, 0, 0);
    const pastCutoff = isWeekend || now > cutoff;
    const days = pastCutoff ? STANDARD_BUSINESS_DAYS + 1 : STANDARD_BUSINESS_DAYS;
    const eta = addBusinessDays(now, days);
    const dateStr = eta.toLocaleDateString(lang === 'en' ? 'en-CA' : 'fr-CA', {
      weekday: 'short', day: 'numeric', month: 'short',
    });
    // Capitalize first letter — both locales return lowercase weekdays.
    const cap = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
    return lang === 'en' ? `Arrives ${cap}` : `Arrivée ${cap}`;
  })();

  // Tooltip elaboration — expands the short label into a full SLA
  // sentence so shoppers hovering the badge understand the promise
  // (production + shipping window) without having to click through.
  // Keyboard users also get this via aria-label on focus.
  const tooltip = lang === 'en'
    ? `Standard shipping — estimated delivery within ${STANDARD_BUSINESS_DAYS} business days from order. Orders placed after ${PRODUCTION_CUTOFF_HOUR % 12 || 12}pm ship the next business day.`
    : `Expédition standard — livraison estimée sous ${STANDARD_BUSINESS_DAYS} jours ouvrables à partir de la commande. Les commandes passées après ${PRODUCTION_CUTOFF_HOUR}h sont expédiées le jour ouvrable suivant.`;

  const sizeCls = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-[11px] px-2.5 py-1 gap-1.5',
    lg: 'text-[13px] px-4 py-2 gap-2',
  }[size];

  const iconSize = { sm: 10, md: 12, lg: 14 }[size];

  const variantCls = {
    gold: 'bg-[hsla(40,82%,55%,0.12)] text-[hsl(40,82%,40%)] border border-[hsla(40,82%,55%,0.3)]',
    navy: 'bg-[#1B3A6B] text-white',
    inline: 'text-[#0052CC] bg-[#0052CC]/5',
  }[variant];

  return (
    <span
      className={`inline-flex items-center font-bold uppercase tracking-wider rounded-full ${sizeCls} ${variantCls} ${className}`}
      title={tooltip}
      aria-label={`${label} — ${tooltip}`}
    >
      <Zap size={iconSize} strokeWidth={2.5} className="flex-shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}
