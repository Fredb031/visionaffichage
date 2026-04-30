import type { Locale, Product } from '@/lib/types';
import { ProductCard } from './ProductCard';

type Columns = 2 | 3 | 4;

type Props = {
  products: Product[];
  locale: Locale;
  columns?: Columns;
  className?: string;
};

const colsClass: Record<Columns, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
};

export function ProductGrid({
  products,
  locale,
  columns = 4,
  className = '',
}: Props) {
  if (products.length === 0) return null;
  return (
    <ul
      className={`grid grid-cols-1 gap-6 ${colsClass[columns]} ${className}`.trim()}
    >
      {products.map((p) => (
        <li key={p.slug} className="flex">
          <ProductCard product={p} locale={locale} className="w-full" />
        </li>
      ))}
    </ul>
  );
}
