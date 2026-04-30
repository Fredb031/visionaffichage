type Size = 'sm' | 'md';

type Props = {
  name: string;
  hex: string;
  available?: boolean;
  selected?: boolean;
  size?: Size;
  className?: string;
  ariaLabel?: string;
};

const sizeClass: Record<Size, string> = {
  sm: 'h-4 w-4',
  md: 'h-7 w-7',
};

function isLightColor(hex: string): boolean {
  const h = hex.replace('#', '');
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Perceived luminance.
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.85;
}

export function ColorSwatch({
  name,
  hex,
  available = true,
  selected = false,
  size = 'md',
  className = '',
  ariaLabel,
}: Props) {
  const light = isLightColor(hex);
  const ring = selected
    ? 'ring-2 ring-ink-950 ring-offset-2 ring-offset-canvas-000'
    : '';
  const border = light ? 'border border-sand-300' : 'border border-ink-950/10';
  const disabled = !available
    ? 'opacity-50 [background-image:linear-gradient(45deg,transparent_45%,rgba(180,35,24,0.6)_45%,rgba(180,35,24,0.6)_55%,transparent_55%)]'
    : '';
  return (
    <span
      role="img"
      aria-label={ariaLabel ?? name}
      title={name}
      style={{ backgroundColor: hex }}
      className={`inline-block rounded-pill ${sizeClass[size]} ${border} ${ring} ${disabled} ${className}`.trim()}
    />
  );
}
