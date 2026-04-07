import { useCustomizerStore } from '@/store/customizerStore';
import { PRODUCTS } from '@/data/products';

export function PlacementSelector() {
  const { productId, logoPlacement, setLogoPlacement } = useCustomizerStore();
  const product = PRODUCTS.find((p) => p.id === productId);
  if (!product) return null;

  return (
    <div className="p-5">
      <h3 className="text-sm font-bold text-foreground mb-1">Zone d'impression</h3>
      <p className="text-xs text-muted-foreground mb-4">Sélectionne où placer ton logo</p>
      <div className="grid grid-cols-3 gap-2">
        {product.printZones.map((zone) => {
          const isActive = logoPlacement?.zoneId === zone.id;
          return (
            <button
              key={zone.id}
              onClick={() => setLogoPlacement({ zoneId: zone.id, mode: 'preset' })}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                isActive
                  ? 'border-navy bg-navy/5 text-navy'
                  : 'border-border text-muted-foreground hover:border-navy/30'
              }`}
            >
              <span className="text-[11px] font-bold">{zone.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
