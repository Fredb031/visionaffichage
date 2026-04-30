import type { Bilingual, Locale } from '@/lib/types';
import { ColorSwatch } from './ColorSwatch';

type Color = { name: Bilingual; hex: string; available?: boolean };

type Props = {
  colors: Color[];
  locale: Locale;
  max?: number;
  size?: 'sm' | 'md';
  selectedHex?: string;
  className?: string;
};

export function ColorSwatchRow({
  colors,
  locale,
  max,
  size = 'sm',
  selectedHex,
  className = '',
}: Props) {
  const visible = typeof max === 'number' ? colors.slice(0, max) : colors;
  const remaining =
    typeof max === 'number' && colors.length > max ? colors.length - max : 0;
  return (
    <div className={`flex items-center gap-1.5 ${className}`.trim()}>
      {visible.map((c) => (
        <ColorSwatch
          key={c.hex}
          name={c.name[locale]}
          hex={c.hex}
          available={c.available !== false}
          selected={selectedHex === c.hex}
          size={size}
        />
      ))}
      {remaining > 0 ? (
        <span className="text-meta-xs text-stone-500" aria-label={`+${remaining}`}>
          +{remaining}
        </span>
      ) : null}
    </div>
  );
}
