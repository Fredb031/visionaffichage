import type { Locale, Product } from '@/lib/types';
import { BASE_URL } from '@/lib/seo';
import { siteConfig } from '@/lib/site';
import { getAverageRating } from '@/lib/reviews';

type Props = {
  product: Product;
  locale: Locale;
};

export function ProductJsonLd({ product, locale }: Props) {
  const rating = getAverageRating(product.styleCode);
  const url = `${BASE_URL}/${locale}/produits/${product.slug}`;
  const image = `${BASE_URL}/placeholders/products/${product.slug}.svg`;
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title[locale],
    image,
    description: product.description[locale],
    sku: product.styleCode,
    brand: {
      '@type': 'Brand',
      name: product.brand,
    },
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'CAD',
      price: (product.priceFromCents / 100).toFixed(2),
      availability: 'https://schema.org/InStock',
      seller: {
        '@type': 'Organization',
        name: siteConfig.name,
      },
    },
  };
  if (rating) {
    data.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: rating.average,
      reviewCount: rating.count,
    };
  }
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
