import { Zap } from 'lucide-react';
import { useLang } from '@/lib/langContext';

interface DeliveryBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'gold' | 'navy' | 'inline';
  className?: string;
}

export function DeliveryBadge({ size = 'md', variant = 'gold', className = '' }: DeliveryBadgeProps) {
  const { lang } = useLang();
  const label = lang === 'en' ? '5 business days' : '5 jours ouvrables';

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
      aria-label={label}
    >
      <Zap size={iconSize} strokeWidth={2.5} className="flex-shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}
