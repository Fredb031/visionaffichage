/**
 * PlacementButtons — Section 4.1 of the Customizer Blueprint.
 *
 * Grouped tile selector for logo placement presets. Splits the supplied
 * placements list into "Devant" (front) and "Dos" (back) sections, with
 * the back section only rendering when at least one back placement is
 * present. Selecting a back tile flips the canvas view to "back" before
 * the parent's onSelect fires (and vice-versa for front), so the user
 * sees the relevant garment side immediately.
 */
import { useMemo } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowUp,
  Heart,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react';
import type { PlacementPreset } from '@/data/productPlacements';

/** lucide-react icon resolver — keeps preset.icon a plain string in data. */
const ICON_MAP: Record<string, LucideIcon> = {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowUp,
  Heart,
  RotateCcw,
};

type CanvasView = 'front' | 'back';

export interface PlacementButtonsProps {
  /** Full list of placements available for the current product. */
  placements: PlacementPreset[];
  /** id of the currently-selected placement. */
  activeId: string | null;
  /** Fired when the user picks a placement tile. */
  onSelect: (preset: PlacementPreset) => void;
  /** Current canvas view ("front" or "back"). */
  currentView: CanvasView;
  /** Fired when a tile selection requires flipping the canvas view. */
  onViewChange: (view: CanvasView) => void;
}

interface PlacementButtonProps {
  preset: PlacementPreset;
  active: boolean;
  onClick: () => void;
}

function PlacementButton({ preset, active, onClick }: PlacementButtonProps) {
  const Icon = ICON_MAP[preset.icon] ?? AlignCenter;
  const stateClass = active
    ? 'border-[#0052CC] bg-[#EBF2FF] text-[#0052CC]'
    : 'border-[#E5E7EB] bg-white text-[#374151] hover:border-[#0052CC]/40';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-colors ${stateClass}`}
    >
      <Icon className="w-5 h-5" aria-hidden="true" />
      <span className="text-xs font-medium leading-tight text-center">{preset.label}</span>
      {preset.surcharge > 0 ? (
        <span className="text-[10px] opacity-70">+{preset.surcharge}$/pce</span>
      ) : null}
    </button>
  );
}

export function PlacementButtons({
  placements,
  activeId,
  onSelect,
  currentView,
  onViewChange,
}: PlacementButtonsProps) {
  const { front, back } = useMemo(() => {
    const f: PlacementPreset[] = [];
    const b: PlacementPreset[] = [];
    for (const p of placements) {
      // Cap-front + cap-side render alongside the front tiles (same canvas
      // view); only the back zone earns its own subsection.
      if (p.zone === 'back') b.push(p);
      else f.push(p);
    }
    return { front: f, back: b };
  }, [placements]);

  const handleSelect = (preset: PlacementPreset) => {
    const targetView: CanvasView = preset.zone === 'back' ? 'back' : 'front';
    if (targetView !== currentView) onViewChange(targetView);
    onSelect(preset);
  };

  // Determine surcharge label for the back section heading. We use the max
  // of the back-zone surcharges so the user sees a single representative
  // upcharge instead of a per-tile range.
  const backSurcharge = back.reduce((max, p) => Math.max(max, p.surcharge), 0);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-brand-grey text-xs uppercase tracking-widest font-semibold">
        Position du logo
      </h3>

      {front.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="text-[11px] font-semibold text-[#374151]">Devant</div>
          <div className="grid grid-cols-2 gap-2">
            {front.map(preset => (
              <PlacementButton
                key={preset.id}
                preset={preset}
                active={preset.id === activeId}
                onClick={() => handleSelect(preset)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {back.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="text-[11px] font-semibold text-[#374151]">
            Dos {backSurcharge > 0 ? `+${backSurcharge}$/pce` : null}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {back.map(preset => (
              <PlacementButton
                key={preset.id}
                preset={preset}
                active={preset.id === activeId}
                onClick={() => handleSelect(preset)}
              />
            ))}
          </div>
        </div>
      ) : null}

      <p className="text-brand-grey/60 text-[10px] text-center border-t border-[#E5E7EB] pt-2">
        Tu peux aussi glisser le logo directement sur l'image
      </p>
    </div>
  );
}

export default PlacementButtons;
