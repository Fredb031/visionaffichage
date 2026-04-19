import { memo } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  delta?: number;
  deltaLabel?: string;
  icon?: LucideIcon;
  accent?: 'blue' | 'gold' | 'green' | 'red';
}

// Wrapped in React.memo so that dashboard parent re-renders (sidebar
// toggles, nav clicks) don't recompute 5+ identical cards. The prop
// shapes are primitive so the default shallow compare works fine.
function StatCardInner({ label, value, delta, deltaLabel, icon: Icon, accent = 'blue' }: StatCardProps) {
  const accentMap = {
    blue: 'from-[#0052CC]/10 to-[#0052CC]/5 text-[#0052CC]',
    gold: 'from-[#E8A838]/15 to-[#E8A838]/5 text-[#B37D10]',
    green: 'from-emerald-500/10 to-emerald-500/5 text-emerald-700',
    red: 'from-rose-500/10 to-rose-500/5 text-rose-700',
  }[accent];

  const isPositive = (delta ?? 0) >= 0;

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-5 hover:shadow-[0_8px_32px_rgba(0,0,0,0.04)] transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] font-semibold text-zinc-500 tracking-wider uppercase">{label}</div>
        {Icon && (
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${accentMap} flex items-center justify-center`}>
            <Icon size={18} strokeWidth={2} aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="text-3xl font-extrabold text-zinc-900 tracking-tight">{value}</div>
      {delta !== undefined && (
        <div className="flex items-center gap-1 mt-2">
          <span
            className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${
              isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}
            aria-label={`${isPositive ? 'en hausse' : 'en baisse'} de ${Math.abs(delta)}%`}
          >
            {isPositive ? <ArrowUpRight size={12} aria-hidden="true" /> : <ArrowDownRight size={12} aria-hidden="true" />}
            {Math.abs(delta)}%
          </span>
          {deltaLabel && <span className="text-[11px] text-zinc-500">{deltaLabel}</span>}
        </div>
      )}
    </div>
  );
}

export const StatCard = memo(StatCardInner);
