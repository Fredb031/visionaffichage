import { useCustomizerStore } from '@/store/customizerStore';

export function ColorSelector() {
  const { product, selectedVariantId, setColor } = useCustomizerStore();
  if (!product) return null;

  const selectedVariant = product.variants.find((v) => v.id === selectedVariantId);

  return (
    <div className="p-5">
      <h3 className="text-sm font-bold text-foreground mb-1">Couleur</h3>
      <p className="text-xs text-muted-foreground mb-4">{selectedVariant?.color ?? 'Sélectionne une couleur'}</p>
      <div className="flex gap-3 flex-wrap">
        {product.variants.map((v) => (
          <button
            key={v.id}
            onClick={() => setColor(v.id, v.color, v.colorHex)}
            className={`w-8 h-8 rounded-full transition-all ${
              v.id === selectedVariantId ? 'ring-2 ring-navy ring-offset-2' : 'hover:scale-110'
            }`}
            style={{ backgroundColor: v.colorHex }}
            title={v.color}
          />
        ))}
      </div>
    </div>
  );
}
