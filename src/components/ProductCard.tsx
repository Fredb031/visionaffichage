import { Link } from 'react-router-dom';
import { ShopifyProduct } from '@/lib/shopify';

interface ProductCardProps {
  product: ShopifyProduct;
}

export function ProductCard({ product }: ProductCardProps) {
  const { node } = product;
  const image = node.images.edges[0]?.node;
  const price = node.priceRange.minVariantPrice;

  return (
    <Link to={`/product/${node.handle}`} className="group block">
      <div className="border border-border rounded-[18px] overflow-hidden bg-card cursor-pointer transition-all duration-250 hover:border-primary/20 hover:shadow-[0_10px_30px_rgba(27,58,107,0.1)] hover:-translate-y-0.5">
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
        </div>
        <div className="p-3.5 pb-[18px]">
          <div className="text-[13px] font-bold text-foreground truncate">{node.title}</div>
          <div className="text-[12px] text-muted-foreground mt-[3px]">
            Dès {parseFloat(price.amount).toFixed(2)} $
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] font-bold px-[13px] py-1.5 rounded-full bg-secondary border border-border text-muted-foreground transition-all group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary">
              Personnaliser
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}