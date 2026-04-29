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
import { useId, useMemo } from 'react';
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
    ? 'border-va-blue bg-va-blue-tint text-va-blue ring-2 ring-va-blue/30'
    : 'border-va-line bg-white text-va-dim hover:border-va-blue/40 hover:text-va-dim';
  // Compose a screen-reader label so the button announces the placement
  // name AND any surcharge in one breath (default aria-label fallback
  // would only read the button's text content, omitting state).
  const srLabel = preset.surcharge > 0
    ? `${preset.label}, supplément +${preset.surcharge}$ par pièce`
    : preset.label;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={srLabel}
      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-1 ${stateClass}`}
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

  // Stable ids so each chip group is programmatically labelled by its
  // visible "Devant"/"Dos" heading (and the back-zone surcharge badge).
  // Without this, screen-reader users navigating the chips never hear the
  // group context — including the "+X$/pce" upcharge that applies to
  // every back tile.
  const frontLabelId = useId();
  const backLabelId = useId();

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-brand-grey text-xs uppercase tracking-widest font-semibold">
        Position du logo
      </h3>

      {front.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div id={frontLabelId} className="text-[11px] font-semibold text-va-dim">Devant</div>
          <div role="group" aria-labelledby={frontLabelId} className="grid grid-cols-2 gap-2">
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
          <div id={backLabelId} className="text-[11px] font-semibold text-va-dim flex items-center gap-1.5">
            <span>Dos</span>
            {backSurcharge > 0 ? (
              <span className="text-[10px] font-bold text-va-blue bg-va-blue-tint px-1.5 py-0.5 rounded-full">
                +{backSurcharge}$/pce
              </span>
            ) : null}
          </div>
          <div role="group" aria-labelledby={backLabelId} className="grid grid-cols-2 gap-2">
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

      <p className="text-brand-grey/60 text-[10px] text-center border-t border-va-line pt-2">
        Tu peux aussi glisser le logo directement sur l'image
      </p>
    </div>
  );
}

export default PlacementButtons;
