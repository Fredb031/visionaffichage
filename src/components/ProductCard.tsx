import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ShopifyProduct } from '@/lib/shopify';
import { ProductCustomizer } from '@/components/customizer/ProductCustomizer';
import { PRODUCTS } from '@/data/products';

interface ProductCardProps {
  product: ShopifyProduct;
}

// Match Shopify handle → local product id
function getLocalProductId(handle: string): string {
  const lower = handle.toLowerCase();
  if (lower.includes('zip')) return 'atcf2600';
  if (lower.includes('hoodie')) return 'atcf2500';
  if (lower.includes('t-shirt') || lower.includes('tshirt')) return 'atc1000';
  if (lower.includes('casquette') || lower.includes('cap')) return 'atc6606';
  if (lower.includes('tuque') || lower.includes('toque') || lower.includes('beanie')) return 'c105';
  return 'atcf2500';
}

export function ProductCard({ product }: ProductCardProps) {
  const { node } = product;
  const image = node.images.edges[0]?.node;
  const price = node.priceRange.minVariantPrice;
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const localId = getLocalProductId(node.handle);
  const localProduct = PRODUCTS.find(p => p.id === localId);

  return (
    <>
      <div
        className="group border border-border rounded-[18px] overflow-hidden bg-card cursor-pointer transition-all duration-250 hover:border-primary/25 hover:shadow-[0_10px_30px_rgba(27,58,107,0.1)] hover:-translate-y-0.5"
        onClick={() => setCustomizerOpen(true)}
      >
        <div className="h-[190px] bg-secondary overflow-hidden relative">
          {image ? (
            <img
              src={image.url}
              alt={image.altText || node.title}
              className="w-full h-full object-cover transition-transform duration-400 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">Pas d'image</div>
          )}
          {/* Color swatches */}
          {localProduct && (
            <div className="absolute bottom-2 left-2 flex gap-1">
              {localProduct.colors.slice(0, 6).map(c => (
                <div key={c.id} className="w-3.5 h-3.5 rounded-full ring-1 ring-white/50" style={{ background: c.hex }} title={c.name} />
              ))}
              {localProduct.colors.length > 6 && (
                <div className="w-3.5 h-3.5 rounded-full bg-muted ring-1 ring-white/50 flex items-center justify-center text-[7px] text-muted-foreground font-bold">
                  +{localProduct.colors.length - 6}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="p-3.5 pb-[18px]">
          <div className="text-[13px] font-bold text-foreground truncate">{node.title}</div>
          <div className="text-[12px] text-muted-foreground mt-[3px]">
            Dès {parseFloat(price.amount).toFixed(2)} $
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] font-bold px-[13px] py-1.5 rounded-full bg-secondary border border-border text-muted-foreground transition-all group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary">
              Personnaliser →
            </span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {customizerOpen && (
          <ProductCustomizer
            productId={localId}
            onClose={() => setCustomizerOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
