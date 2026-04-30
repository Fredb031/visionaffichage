import type { ReactNode } from 'react';

type Props = {
  id: string;
  label: string;
  error?: string;
  helper?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
};

export function FormField({
  id,
  label,
  error,
  helper,
  required,
  children,
  className = '',
}: Props) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`.trim()}>
      <label htmlFor={id} className="text-body-sm font-medium text-ink-950">
        {label}
        {required ? (
          <span aria-hidden className="ml-0.5 text-error-700">
            *
          </span>
        ) : null}
      </label>
      {children}
      {helper && !error ? (
        <p id={`${id}-helper`} className="text-meta-xs text-stone-600">
          {helper}
        </p>
      ) : null}
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-meta-xs font-medium text-error-700"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
