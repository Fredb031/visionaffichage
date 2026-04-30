'use client';

import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

import type { FileChecks as Checks } from '@/lib/customizer';

type Verdict = 'pass' | 'warn' | 'fail';

type ChipDef = {
  verdict: Verdict;
  label: string;
  recommendation: string;
};

type Labels = {
  vector: { pass: { label: string; recommendation: string } };
  dpi: {
    pass: { label: string; recommendation: string };
    warn: { label: string; recommendation: string };
    fail: { label: string; recommendation: string };
  };
  colorCount: {
    pass: { label: string; recommendation: string };
    warn: { label: string; recommendation: string };
  };
};

type Props = {
  checks: Checks | null;
  labels: Labels;
};

const DOT_CLASS: Record<Verdict, string> = {
  pass: 'bg-success-700',
  warn: 'bg-warning-700',
  fail: 'bg-error-700',
};

const ICON_CLASS: Record<Verdict, string> = {
  pass: 'text-success-700',
  warn: 'text-warning-700',
  fail: 'text-error-700',
};

const CHIP_BG: Record<Verdict, string> = {
  pass: 'bg-success-50 border-success-200',
  warn: 'bg-warning-50 border-warning-200',
  fail: 'bg-error-50 border-error-200',
};

function VerdictIcon({ verdict }: { verdict: Verdict }) {
  if (verdict === 'pass') return <CheckCircle2 aria-hidden className={`h-4 w-4 ${ICON_CLASS[verdict]}`} />;
  if (verdict === 'warn') return <AlertTriangle aria-hidden className={`h-4 w-4 ${ICON_CLASS[verdict]}`} />;
  return <XCircle aria-hidden className={`h-4 w-4 ${ICON_CLASS[verdict]}`} />;
}

export function FileChecks({ checks, labels }: Props) {
  if (!checks) return null;

  const chips: ChipDef[] = [];

  if (checks.kind === 'vector') {
    chips.push({
      verdict: 'pass',
      label: labels.vector.pass.label,
      recommendation: labels.vector.pass.recommendation,
    });
  }

  if (checks.kind === 'raster') {
    if (checks.dpiVerdict && typeof checks.dpi === 'number') {
      const v = checks.dpiVerdict;
      const dpiLabels = labels.dpi[v];
      chips.push({
        verdict: v,
        label: dpiLabels.label.replace('{dpi}', String(checks.dpi)),
        recommendation: dpiLabels.recommendation,
      });
    }

    if (checks.colorCountVerdict && typeof checks.colorCount === 'number') {
      const v = checks.colorCountVerdict;
      const ccLabels = labels.colorCount[v];
      chips.push({
        verdict: v,
        label: ccLabels.label.replace('{count}', String(checks.colorCount)),
        recommendation: ccLabels.recommendation,
      });
    }
  }

  if (chips.length === 0) return null;

  return (
    <ul className="grid gap-3 sm:grid-cols-2" role="list">
      {chips.map((chip, idx) => (
        <li
          key={idx}
          className={`flex items-start gap-3 rounded-sm border px-3 py-2.5 ${CHIP_BG[chip.verdict]}`}
        >
          <span className="mt-1 flex shrink-0 items-center gap-2">
            <span aria-hidden className={`h-2 w-2 rounded-full ${DOT_CLASS[chip.verdict]}`} />
            <VerdictIcon verdict={chip.verdict} />
          </span>
          <span className="min-w-0">
            <span className="block text-body-sm font-semibold text-ink-950">{chip.label}</span>
            <span className="mt-0.5 block text-body-sm text-stone-600">
              {chip.recommendation}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
