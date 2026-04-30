import { Clock, MessageCircle, ShieldCheck, Star } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Locale } from '@/lib/types';
import { Container } from '../Container';

type Variant = 'warm' | 'ink';

type Props = {
  locale: Locale;
  variant?: Variant;
  className?: string;
};

const variantClass: Record<Variant, string> = {
  warm: 'bg-canvas-050 text-ink-950',
  ink: 'bg-ink-950 text-canvas-050',
};

const iconClass: Record<Variant, string> = {
  warm: 'text-slate-700',
  ink: 'text-sand-100',
};

const dividerClass: Record<Variant, string> = {
  warm: 'bg-sand-300',
  ink: 'bg-ink-800',
};

export function TrustStrip({ locale, variant = 'warm', className = '' }: Props) {
  const items: { icon: LucideIcon; text: string }[] =
    locale === 'fr-ca'
      ? [
          { icon: Clock, text: 'Production 5 jours ouvrables' },
          { icon: MessageCircle, text: 'Service en français' },
          { icon: ShieldCheck, text: 'Logo approuvé avant impression' },
          { icon: Star, text: '5,0 sur Google' },
        ]
      : [
          { icon: Clock, text: '5 business-day production' },
          { icon: MessageCircle, text: 'Service in French' },
          { icon: ShieldCheck, text: 'Logo approved before printing' },
          { icon: Star, text: '5.0 on Google' },
        ];

  return (
    <section
      className={`${variantClass[variant]} border-y border-sand-300 ${className}`.trim()}
    >
      <Container size="2xl">
        <ul className="flex flex-col items-stretch divide-y divide-sand-300 py-3 md:flex-row md:items-center md:divide-x md:divide-y-0 md:py-0">
          {items.map((item, idx) => {
            const Icon = item.icon;
            return (
              <li
                key={idx}
                className={`flex flex-1 items-center gap-3 px-4 py-3 md:justify-center md:py-5 ${
                  idx > 0 ? `md:${dividerClass[variant]}` : ''
                }`}
              >
                <Icon
                  aria-hidden
                  className={`h-5 w-5 shrink-0 ${iconClass[variant]}`}
                  strokeWidth={1.6}
                />
                <span className="text-body-sm">{item.text}</span>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
