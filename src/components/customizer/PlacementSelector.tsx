import { useCustomizerStore } from '@/store/customizerStore';
import type { PrintZone } from '@/types/product';

// SVG icons for placement zones
const ZONE_ICONS: Record<string, JSX.Element> = {
  front: (
    <svg viewBox="0 0 24 24" className="w-5 h-5 stroke-current" fill="none" strokeWidth={1.5} strokeLinecap="round">
      <rect x="6" y="4" width="12" height="16" rx="2" />
      <line x1="12" y1="8" x2="12" y2="12" />
    </svg>
  ),
  back: (
    <svg viewBox="0 0 24 24" className="w-5 h-5 stroke-current" fill="none" strokeWidth={1.5} strokeLinecap="round">
      <rect x="6" y="4" width="12" height="16" rx="2" />
      <line x1="9" y1="10" x2="15" y2="10" />
    </svg>
  ),
  'sleeve-l': (
    <svg viewBox="0 0 24 24" className="w-5 h-5 stroke-current" fill="none" strokeWidth={1.5} strokeLinecap="round">
      <path d="M4 8 L8 4 L10 12 L6 16 Z" />
    </svg>
  ),
};

export function PlacementSelector() {
  const { product, logos } = useCustomizerStore();
  if (!product) return null;

  const activeZones = logos.map((l) => l.zoneId);

  return (
    <div className="p-5">
      <h3 className="text-sm font-bold text-foreground mb-1">Zone d'impression</h3>
      <p className="text-xs text-muted-foreground mb-4">Sélectionne où placer ton logo</p>
      <div className="grid grid-cols-3 gap-2">
        {product.printZones.map((zone: PrintZone) => {
          const isActive = activeZones.includes(zone.id);
          return (
            <div
              key={zone.id}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                isActive
                  ? 'border-navy bg-navy/5 text-navy'
                  : 'border-border text-muted-foreground hover:border-navy/30'
              }`}
            >
              {ZONE_ICONS[zone.id] ?? ZONE_ICONS['front']}
              <span className="text-[11px] font-bold">{zone.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
