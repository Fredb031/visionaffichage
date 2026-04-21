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
    if (!showDate) return lang === 'en' ? '5 business days' : '5 jours ouvrables';
    // Honor the 3pm production cutoff so the badge matches the
    // Checkout ship-by promise and the homepage hero — without this,
    // a shopper late in the day saw an earlier date on the badge
    // than the one Checkout quoted them. The cutoff only applies on
    // business days; on Sat/Sun production is closed regardless of the
    // hour, so ignoring it there (previously a Sat 10am buyer saw
    // Friday while a Sat 4pm buyer saw the following Monday — same
    // weekend, contradictory promises).
    const now = new Date();
    const dow = now.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const cutoff = new Date(now);
    cutoff.setHours(15, 0, 0, 0);
    const days = !isWeekend && now > cutoff ? 6 : 5;
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
    ? 'Standard shipping — estimated delivery within 5 business days from order. Orders placed after 3pm ship the next business day.'
    : 'Expédition standard — livraison estimée sous 5 jours ouvrables à partir de la commande. Les commandes passées après 15h sont expédiées le jour ouvrable suivant.';

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
