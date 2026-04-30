import Image from 'next/image';
import Link from 'next/link';
import type { Locale, Product } from '@/lib/types';
import {
  formatCAD,
  formatMinQty,
  formatProductionMicrocopy,
} from '@/lib/format';
import { getAverageRating } from '@/lib/reviews';
import { BadgeRow } from './BadgeRow';
import { ColorSwatchRow } from './ColorSwatchRow';
import { StarRating } from './StarRating';

type Props = {
  product: Product;
  locale: Locale;
  className?: string;
};

export function ProductCard({ product, locale, className = '' }: Props) {
  const rating = getAverageRating(product.styleCode);
  const imgSrc = `/placeholders/products/${product.slug}.svg`;
  const productHref = `/${locale}/produits/${product.slug}`;
  return (
    <article
      className={`group flex flex-col overflow-hidden rounded-md bg-canvas-000 shadow-xs transition-shadow duration-base ease-standard hover:shadow-md ${className}`.trim()}
    >
      <Link
        href={productHref}
        className="block focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
      >
        <div className="relative aspect-square w-full overflow-hidden bg-sand-100">
          <Image
            src={imgSrc}
            alt={product.title[locale]}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-contain p-6 transition-transform duration-base ease-standard group-hover:scale-[1.02]"
          />
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        {product.badgeKeys && product.badgeKeys.length > 0 ? (
          <BadgeRow badges={product.badgeKeys} locale={locale} max={3} />
        ) : null}

        <h3 className="text-title-md leading-tight">
          <Link
            href={productHref}
            className="text-ink-950 transition-colors duration-base ease-standard hover:text-slate-700"
          >
            {product.title[locale]}
          </Link>
        </h3>

        <p className="text-body-sm text-stone-500">
          {locale === 'fr-ca' ? 'À partir de ' : 'From '}
          <span className="font-semibold text-ink-950">
            {formatCAD(product.priceFromCents, locale)}
          </span>
          {product.minQuantity > 1 ? (
            <span className="ml-2 text-stone-500">
              · {formatMinQty(product.minQuantity, locale)}
            </span>
          ) : null}
        </p>

        <p className="text-body-sm text-stone-500">
          {formatProductionMicrocopy(product.leadTimeDays, locale)}
        </p>

        <div className="flex items-center justify-between gap-3 pt-1">
          {rating ? (
            <StarRating
              rating={rating.average}
              count={rating.count}
              locale={locale}
              size="sm"
            />
          ) : (
            <span className="text-body-sm text-stone-500">
              {locale === 'fr-ca' ? 'Nouveau' : 'New'}
            </span>
          )}

          <ColorSwatchRow colors={product.colors} locale={locale} max={3} size="sm" />
        </div>
      </div>
    </article>
  );
}
