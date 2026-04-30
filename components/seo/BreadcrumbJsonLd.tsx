import { BASE_URL } from '@/lib/seo';

type Item = {
  name: string;
  url?: string;
};

type Props = {
  items: Item[];
};

export function BreadcrumbJsonLd({ items }: Props) {
  if (items.length === 0) return null;
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => {
      const full = item.url
        ? item.url.startsWith('http')
          ? item.url
          : `${BASE_URL}${item.url.startsWith('/') ? '' : '/'}${item.url}`
        : undefined;
      return {
        '@type': 'ListItem',
        position: idx + 1,
        name: item.name,
        ...(full ? { item: full } : {}),
      };
    }),
  };
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
