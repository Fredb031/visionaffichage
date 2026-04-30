import { Clock, MessageCircle, ShieldCheck, Star } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type TrustBulletIcon = 'Clock' | 'ShieldCheck' | 'MessageCircle' | 'Star';

const ICON_MAP: Record<TrustBulletIcon, LucideIcon> = {
  Clock,
  ShieldCheck,
  MessageCircle,
  Star,
};

type Tone = 'dark' | 'light';

export type TrustBulletItem = {
  icon: TrustBulletIcon;
  label: string;
};

type Props = {
  items: TrustBulletItem[];
  tone?: Tone;
  className?: string;
};

const labelToneClass: Record<Tone, string> = {
  dark: 'text-canvas-050',
  light: 'text-ink-950',
};

const iconToneClass: Record<Tone, string> = {
  dark: 'text-sand-300',
  light: 'text-slate-700',
};

export function TrustBullets({ items, tone = 'dark', className = '' }: Props) {
  if (items.length === 0) return null;
  return (
    <ul
      className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${className}`.trim()}
    >
      {items.map((item, idx) => {
        const Icon = ICON_MAP[item.icon];
        return (
          <li
            key={idx}
            className={`flex items-start gap-3 text-body-sm ${labelToneClass[tone]}`}
          >
            <Icon
              aria-hidden
              className={`mt-0.5 h-4 w-4 shrink-0 ${iconToneClass[tone]}`}
              strokeWidth={1.6}
            />
            <span>{item.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
