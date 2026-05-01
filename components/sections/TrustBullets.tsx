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
  /**
   * Single-line legacy label. When `value` + `caption` are not set, this is
   * shown verbatim (back-compat). If the label contains a bullet separator
   * (" · " / " • "), it will be split into value + caption.
   */
  label: string;
  /** Optional terse value, e.g. "5 jours" or "5,0". */
  value?: string;
  /** Optional descriptor, e.g. "production" or "500+ equipes". */
  caption?: string;
};

type Props = {
  items: TrustBulletItem[];
  tone?: Tone;
  className?: string;
};

const valueToneClass: Record<Tone, string> = {
  dark: 'text-canvas-000',
  light: 'text-ink-950',
};

const captionToneClass: Record<Tone, string> = {
  dark: 'text-sand-100/70',
  light: 'text-stone-500',
};

const iconToneClass: Record<Tone, string> = {
  dark: 'text-sand-300',
  light: 'text-slate-700',
};

const dividerToneClass: Record<Tone, string> = {
  dark: 'divide-sand-300/15 sm:divide-sand-300/20',
  light: 'divide-slate-700/15 sm:divide-slate-700/20',
};

/**
 * Split a single-line `label` into a value + caption pair, accepting a
 * middle-dot/bullet/dash separator. Falls back to a single-line value.
 */
function splitLabel(label: string): { value: string; caption: string } {
  const trimmed = label.trim();
  const sepMatch = trimmed.match(
    /^(.{1,24}?)\s+[·•–—\-]\s+(.+)$/,
  );
  if (sepMatch && sepMatch[1] && sepMatch[2]) {
    return { value: sepMatch[1].trim(), caption: sepMatch[2].trim() };
  }
  const numWordMatch = trimmed.match(/^(\d+[ \s][^\s]+)\s+(.+)$/);
  if (numWordMatch && numWordMatch[1] && numWordMatch[2]) {
    return { value: numWordMatch[1], caption: numWordMatch[2] };
  }
  const ratingMatch = trimmed.match(/^(\d+[.,]\d+)\s+(.+)$/);
  if (ratingMatch && ratingMatch[1] && ratingMatch[2]) {
    return { value: ratingMatch[1], caption: ratingMatch[2] };
  }
  return { value: trimmed, caption: '' };
}

export function TrustBullets({ items, tone = 'dark', className = '' }: Props) {
  if (items.length === 0) return null;
  return (
    <dl
      className={`flex flex-col sm:flex-row sm:items-stretch divide-y sm:divide-y-0 sm:divide-x ${dividerToneClass[tone]} -mx-2 sm:mx-0 ${className}`.trim()}
    >
      {items.map((item, idx) => {
        const Icon = ICON_MAP[item.icon];
        const value = item.value ?? splitLabel(item.label).value;
        const caption = item.caption ?? splitLabel(item.label).caption;
        return (
          <div
            key={idx}
            className="flex gap-2.5 px-3 py-3 sm:flex-1 sm:flex-col sm:items-start sm:px-5 sm:py-1"
          >
            <Icon
              aria-hidden
              className={`mt-0.5 h-4 w-4 shrink-0 ${iconToneClass[tone]}`}
              strokeWidth={1.6}
            />
            <div className="min-w-0">
              <dt
                className={`text-body-md font-medium leading-tight ${valueToneClass[tone]}`}
              >
                {value}
              </dt>
              {caption ? (
                <dd
                  className={`mt-1 text-meta-xs leading-tight ${captionToneClass[tone]}`}
                >
                  {caption}
                </dd>
              ) : null}
            </div>
          </div>
        );
      })}
    </dl>
  );
}
