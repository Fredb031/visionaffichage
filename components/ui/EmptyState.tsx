import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type Props = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}: Props) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-sand-300 bg-canvas-050 px-6 py-16 text-center ${className}`.trim()}
    >
      {Icon ? (
        <Icon
          aria-hidden
          className="h-10 w-10 text-stone-500"
          strokeWidth={1.4}
        />
      ) : null}
      <h2 className="mt-4 text-title-md text-ink-950">{title}</h2>
      {description ? (
        <p className="mt-2 max-w-md text-body-md text-stone-500">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
