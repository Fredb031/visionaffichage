import { useCustomizerStore } from '@/store/customizerStore';
import { PRODUCTS } from '@/data/products';

export function ColorSelector() {
  const { productId, colorId, setColor } = useCustomizerStore();
  const product = PRODUCTS.find((p) => p.id === productId);
  if (!product) return null;

  const selected = product.colors.find((c) => c.id === colorId);

  return (
    <div className="p-5">
      <h3 className="text-sm font-bold text-foreground mb-1">Couleur</h3>
      <p className="text-xs text-muted-foreground mb-4">{selected?.name ?? 'Sélectionne une couleur'}</p>
      <div className="flex gap-3 flex-wrap">
        {product.colors.map((c) => (
          <button
            key={c.id}
            onClick={() => setColor(c.id)}
            className={`w-8 h-8 rounded-full transition-all ${
              c.id === colorId ? 'ring-2 ring-navy ring-offset-2' : 'hover:scale-110'
            }`}
            style={{ backgroundColor: c.hex }}
            title={c.name}
          />
        ))}
      </div>
    </div>
  );
}
