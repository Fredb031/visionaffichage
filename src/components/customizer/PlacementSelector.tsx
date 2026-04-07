import type { Product } from '@/data/products';
import type { LogoPlacement } from '@/types/customization';
import { LogoCanvas } from './LogoCanvas';

export function PlacementSelector({
  product, selectedColor, logoPreviewUrl, currentPlacement, onPlacementChange,
}: {
  product: Product;
  selectedColor: { imageDevant?: string; imageDos?: string } | null;
  logoPreviewUrl: string;
  currentPlacement: LogoPlacement | null;
  onPlacementChange: (placement: LogoPlacement) => void;
}) {
  const imageUrl = selectedColor?.imageDevant ?? product.imageDevant;
  return (
    <LogoCanvas
      product={product}
      productImageUrl={imageUrl}
      logoUrl={logoPreviewUrl}
      currentPlacement={currentPlacement}
      onPlacementChange={onPlacementChange}
    />
  );
}
