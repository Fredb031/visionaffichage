import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ShopifyProduct } from '@/lib/shopify';
import { ProductCustomizer } from '@/components/customizer/ProductCustomizer';
import { findProductByHandle, matchProductByTitle } from '@/data/products';
import { useLang } from '@/lib/langContext';

// SKUs marked as popular — shown with badge on product card
const POPULAR_SKUS = new Set(['ATCF2500', 'ATC1000', 'ATC6606', 'ATCF2400']);

interface ProductCardProps { product: ShopifyProduct; }

export function ProductCard({ product }: ProductCardProps) {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const { node } = product;
  const [customizerOpen, setCustomizerOpen] = useState(false);

  const image = node.images.edges[0]?.node;
  const backImage = node.images.edges[1]?.node;
  const price = node.priceRange.minVariantPrice;

  const local = findProductByHandle(node.handle) ?? matchProductByTitle(node.title);
  const isPopular = local ? POPULAR_SKUS.has(local.sku) : false;

  const handleCardClick = () => navigate(`/product/${node.handle}`);
  const handleCustomize = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (local) setCustomizerOpen(true);
    else navigate(`/product/${node.handle}`);
  };

  return (
    <>
      <div
        onClick={handleCardClick}
        className="group border border-border rounded-[18px] overflow-hidden bg-card cursor-pointer transition-all duration-300 hover:border-primary/30 hover:shadow-[0_16px_40px_rgba(27,58,107,0.14)] hover:-translate-y-1"
      >
        {/* Image */}
        <div className="relative overflow-hidden bg-secondary" style={{ aspectRatio: '1' }}>
          {image ? (
            <>
              <img
                src={image.url}
                alt={image.altText || node.title}
                className={`w-full h-full object-cover transition-all duration-500 ${backImage ? 'group-hover:opacity-0' : 'group-hover:scale-105'}`}
                loading="lazy"
              />
              {backImage && (
                <img
                  src={backImage.url}
                  alt="Dos"
                  className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500 scale-105"
                  loading="lazy"
                />
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">{lang === 'en' ? 'No image' : "Pas d'image"}</div>
          )}

          {/* Popular badge */}
          {isPopular && (
            <div className="absolute top-2.5 left-2.5 z-[5] text-[10px] font-extrabold text-primary-foreground gradient-navy-dark px-2.5 py-[3px] rounded-full shadow-sm">
              {lang === 'en' ? '⭐ Popular' : '⭐ Populaire'}
            </div>
          )}

          {/* Logo placeholder */}
          <div className="absolute left-1/2 top-[33%] -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[2] transition-opacity duration-300 group-hover:opacity-0">
            <svg width="62" height="32" viewBox="0 0 62 32" fill="none">
              <rect x="0.5" y="0.5" width="61" height="31" rx="5.5" fill="white" fillOpacity="0.72" stroke="rgba(27,58,107,0.28)" strokeDasharray="3 2.5"/>
              <text x="31" y="19.5" textAnchor="middle" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="8" fontWeight="700" fill="rgba(27,58,107,0.42)" letterSpacing="0.5">VOTRE LOGO</text>
            </svg>
          </div>

          {/* Customize CTA on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4 z-[3]">
            <button
              onClick={handleCustomize}
              className="text-[11px] font-extrabold px-4 py-2 rounded-full bg-white/95 text-primary shadow-lg border border-primary/15 translate-y-3 group-hover:translate-y-0 transition-transform duration-300"
            >
              {t('personnaliserProduit')} →
            </button>
          </div>

          {/* Colour dots */}
          {local && local.colors.length > 0 && (
            <div className="absolute bottom-2 left-2 flex gap-1 z-[4]">
              {local.colors.slice(0, 8).map(c => (
                <div key={c.id} className="w-3.5 h-3.5 rounded-full ring-1 ring-white/70 shadow-sm flex-shrink-0" style={{ background: c.hex }} title={c.name} />
              ))}
              {local.colors.length > 8 && (
                <div className="w-3.5 h-3.5 rounded-full bg-white/85 ring-1 ring-white/50 flex items-center justify-center text-[7px] font-black text-foreground">
                  +{local.colors.length - 8}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-3.5 pb-4">
          <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[1.5px] mb-0.5">{local?.sku ?? node.productType ?? ''}</p>
          <div className="text-[13px] font-bold text-foreground leading-tight mb-1">{node.title}</div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[14px] font-extrabold text-primary">
              {parseFloat(price.amount) < 5 ? `Dès ${parseFloat(price.amount).toFixed(2)} $` : `${parseFloat(price.amount).toFixed(2)} $`}
            </span>
            <span className="text-[10px] font-bold text-muted-foreground border border-border px-2 py-0.5 rounded-full group-hover:border-primary/50 group-hover:text-primary transition-colors">
              {lang === 'en' ? 'Customize' : 'Personnaliser'}
            </span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {customizerOpen && local && (
          <ProductCustomizer productId={local.id} onClose={() => setCustomizerOpen(false)} />
        )}
      </AnimatePresence>
    </>
  );
}

