'use client';

import { AlertTriangle } from 'lucide-react';

type Props = {
  show: boolean;
  warningText: string;
  toggleLabel: string;
  inverted: boolean;
  onToggle: () => void;
  garmentHex: string;
  invertedHex: string;
};

export function ContrastGuide({
  show,
  warningText,
  toggleLabel,
  inverted,
  onToggle,
  garmentHex,
  invertedHex,
}: Props) {
  if (!show) return null;
  const activeHex = inverted ? invertedHex : garmentHex;
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col gap-3 rounded-md border border-warning-200 bg-warning-50 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-warning-700" />
        <p className="text-body-sm text-ink-950">{warningText}</p>
      </div>
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="h-7 w-7 rounded-full border border-ink-950"
          style={{ backgroundColor: activeHex }}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={inverted}
          className="inline-flex items-center rounded-sm border border-ink-950 bg-canvas-000 px-3 py-1.5 text-body-sm font-medium text-ink-950 transition-colors duration-base ease-standard hover:bg-sand-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
        >
          {toggleLabel}
        </button>
      </div>
    </div>
  );
}
