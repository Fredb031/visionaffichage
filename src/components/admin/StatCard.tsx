import { memo } from 'react';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  delta?: number;
  deltaLabel?: string;
  icon?: LucideIcon;
  accent?: 'blue' | 'gold' | 'green' | 'red';
  loading?: boolean;
  compact?: boolean;
}

// Wrapped in React.memo so that dashboard parent re-renders (sidebar
// toggles, nav clicks) don't recompute 5+ identical cards. The prop
// shapes are primitive so the default shallow compare works fine.
function StatCardInner({ label, value, delta, deltaLabel, icon: Icon, accent = 'blue', loading = false, compact = false }: StatCardProps) {
  const accentMap = {
    blue: 'from-[#0052CC]/10 to-[#0052CC]/5 text-[#0052CC]',
    gold: 'from-brand-blue/15 to-brand-blue/5 text-[#B37D10]',
    green: 'from-emerald-500/10 to-emerald-500/5 text-emerald-700',
    red: 'from-rose-500/10 to-rose-500/5 text-rose-700',
  }[accent];

  // Guard against NaN/Infinity (stat sources can divide by zero when a
  // period has no prior data) — rendering "NaN%" or "Infinity%" in the
  // delta pill looked broken. A non-finite delta is treated the same as
  // "no delta": the pill is hidden, only the optional deltaLabel shows.
  const hasFiniteDelta = delta !== undefined && Number.isFinite(delta);
  // Three-way direction so a flat period (delta === 0) gets a neutral
  // Minus icon + zinc colouring instead of a misleading green up-arrow.
  const direction: 'up' | 'down' | 'flat' = !hasFiniteDelta
    ? 'flat'
    : delta! > 0
      ? 'up'
      : delta! < 0
        ? 'down'
        : 'flat';
  const isPositive = direction === 'up';
  // Round to one decimal so 12.3456789% renders as 12.3% — keeps the
  // pill narrow and avoids the jittery width changes we saw when
  // delta values updated across periods.
  const formattedDelta = hasFiniteDelta
    ? (Math.round(Math.abs(delta!) * 10) / 10).toLocaleString('fr-CA')
    : '';

  // Compact mode trims paddings, value text-size and vertical gap so the
  // card fits sidebars or narrow grid columns without clipping. All the
  // visual language stays the same — just denser.
  const rootPadding = compact ? 'p-3' : 'p-5';
  const headerGap = compact ? 'mb-2' : 'mb-3';
  const valueSize = compact ? 'text-2xl' : 'text-3xl';
  const iconSize = compact ? 'w-7 h-7 rounded-lg' : 'w-9 h-9 rounded-xl';
  const deltaGap = compact ? 'mt-1' : 'mt-2';

  // Build a spoken-word aria-label that mentions both direction and the
  // comparison window so screen-reader users don't have to infer it from
  // the visual pill alone.
  const signedDelta = hasFiniteDelta ? `${isPositive ? '+' : direction === 'down' ? '-' : ''}${formattedDelta}%` : '';
  const deltaAriaLabel = hasFiniteDelta
    ? direction === 'flat'
      ? `${signedDelta} par rapport à la période précédente`
      : `${signedDelta} par rapport à la période précédente (${isPositive ? 'en hausse' : 'en baisse'})`
    : undefined;

  return (
    <div className={`bg-white border border-zinc-200 rounded-2xl ${rootPadding} hover:shadow-[0_8px_32px_rgba(0,0,0,0.04)] transition-shadow`}>
      <div className={`flex items-center justify-between ${headerGap}`}>
        <div className="text-[11px] font-semibold text-zinc-500 tracking-wider uppercase">{label}</div>
        {Icon && (
          <div className={`${iconSize} bg-gradient-to-br ${accentMap} flex items-center justify-center`}>
            <Icon size={compact ? 14 : 18} strokeWidth={2} aria-hidden="true" />
          </div>
        )}
      </div>
      {loading ? (
        <div
          className={`${valueSize} font-extrabold`}
          role="status"
          aria-live="polite"
          aria-label="Chargement de la valeur"
        >
          <span
            className={`inline-block h-[1em] w-24 rounded-md bg-zinc-200 animate-pulse align-middle`}
            aria-hidden="true"
          />
        </div>
      ) : (
        <div className={`${valueSize} font-extrabold text-zinc-900 tracking-tight`}>{value}</div>
      )}
      {!loading && (hasFiniteDelta || deltaLabel) && (
        <div className={`flex items-center gap-1 ${deltaGap}`}>
          {hasFiniteDelta && (
            <span
              className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${
                direction === 'up'
                  ? 'bg-emerald-50 text-emerald-700'
                  : direction === 'down'
                    ? 'bg-rose-50 text-rose-700'
                    : 'bg-zinc-100 text-zinc-600'
              }`}
              aria-label={deltaAriaLabel}
            >
              {direction === 'up' ? (
                <ArrowUp size={12} className="text-emerald-600" aria-hidden="true" />
              ) : direction === 'down' ? (
                <ArrowDown size={12} className="text-rose-600" aria-hidden="true" />
              ) : (
                <Minus size={12} className="text-zinc-500" aria-hidden="true" />
              )}
              {formattedDelta}%
            </span>
          )}
          {deltaLabel && <span className="text-[11px] text-zinc-500">{deltaLabel}</span>}
        </div>
      )}
    </div>
  );
}

export const StatCard = memo(StatCardInner);
