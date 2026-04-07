import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ShopifyProduct } from '@/lib/shopify';
import { ProductCustomizer } from '@/components/customizer/ProductCustomizer';
import { PRODUCTS } from '@/data/products';
import { useLang } from '@/lib/langContext';

interface ProductCardProps { product: ShopifyProduct; }

function getLocalProductId(handle: string): string {
  const l = handle.toLowerCase();
  if (l.includes('zip')) return 'atcf2600';
  if (l.includes('hoodie')) return 'atcf2500';
  if (l.includes('t-shirt') || l.includes('tshirt')) return 'atc1000';
  if (l.includes('casquette') || l.includes('cap')) return 'atc6606';
  if (l.includes('tuque') || l.includes('toque') || l.includes('beanie')) return 'c105';
  return 'atcf2500';
}

export function ProductCard({ product }: ProductCardProps) {
  const { t } = useLang();
  const { node } = product;
  const image = node.images.edges[0]?.node;
  const price = node.priceRange.minVariantPrice;
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const localId = getLocalProductId(node.handle);
  const localProduct = PRODUCTS.find(p => p.id === localId);

  return (
    <>
      <div
        onClick={() => setCustomizerOpen(true)}
        className="group border border-border rounded-[18px] overflow-hidden bg-card cursor-pointer transition-all duration-250 hover:border-primary/25 hover:shadow-[0_12px_32px_rgba(27,58,107,0.12)] hover:-translate-y-0.5"
      >
        {/* Image + ghost logo overlay */}
        <div className="relative overflow-hidden bg-secondary" style={{ aspectRatio: '1' }}>
          {image ? (
            <img
              src={image.url}
              alt={image.altText || node.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm bg-secondary">Pas d'image</div>
          )}

          {/* "Votre logo" dashed ghost — always visible */}
          <div className="absolute left-1/2 top-[34%] -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[2] transition-opacity duration-300 group-hover:opacity-0">
            <svg width="60" height="32" viewBox="0 0 60 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="0.5" y="0.5" width="59" height="31" rx="5.5" fill="white" fillOpacity="0.75" stroke="rgba(27,58,107,0.3)" strokeDasharray="3 2.5"/>
              <text x="30" y="19.5" textAnchor="middle" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="8" fontWeight="700" fill="rgba(27,58,107,0.45)" letterSpacing="0.5">VOTRE LOGO</text>
            </svg>
          </div>

          {/* Hover CTA overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4 z-[3]">
            <span className="text-[11px] font-extrabold px-4 py-2 rounded-full bg-white/95 text-primary shadow-lg border border-primary/15 translate-y-2 group-hover:translate-y-0 transition-transform duration-200">
              {t('personnaliserProduit')} →
            </span>
          </div>

          {/* Color swatches */}
          {localProduct && (
            <div className="absolute bottom-2 left-2 flex gap-1 z-[4]">
              {localProduct.colors.slice(0, 6).map(c => (
                <div key={c.id} className="w-3.5 h-3.5 rounded-full ring-1 ring-white/60 shadow-sm" style={{ background: c.hex }} title={c.name} />
              ))}
              {localProduct.colors.length > 6 && (
                <div className="w-3.5 h-3.5 rounded-full bg-white/80 ring-1 ring-white/50 flex items-center justify-center text-[7px] font-bold text-foreground">
                  +{localProduct.colors.length - 6}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Card body */}
        <div className="p-3.5 pb-4">
          <div className="text-[13px] font-bold text-foreground truncate">{node.title}</div>
          {localProduct?.description && (
            <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{localProduct.description.split('.')[0]}.</div>
          )}
          <div className="flex items-center justify-between mt-2">
            <span className="text-[12px] font-bold text-primary">Dès {parseFloat(price.amount).toFixed(2)} $</span>
            <span className="text-[10px] font-bold text-muted-foreground border border-border px-2 py-0.5 rounded-full group-hover:border-primary group-hover:text-primary transition-colors">
              Personnaliser
            </span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {customizerOpen && (
          <ProductCustomizer productId={localId} onClose={() => setCustomizerOpen(false)} />
        )}
      </AnimatePresence>
    </>
  );
}
