import Image from 'next/image';
import Link from 'next/link';
import type { Locale } from '@/lib/types';
import type { HomeCategory } from '@/lib/categories';
import { formatCAD } from '@/lib/format';
import { Button } from '../Button';
import { Container } from '../Container';

type Props = {
  categories: HomeCategory[];
  locale: Locale;
  heading: string;
  subhead: string;
  viewLabel: string;
  viewAllLabel: string;
  priceFromLabel: (formatted: string) => string;
};

export function BestCategories({
  categories,
  locale,
  heading,
  subhead,
  viewLabel,
  viewAllLabel,
  priceFromLabel,
}: Props) {
  if (categories.length === 0) return null;
  const base = `/${locale}`;

  return (
    <section className="bg-canvas-000 py-20 md:py-28">
      <Container size="2xl">
        <div className="mb-12 max-w-2xl md:mb-16">
          <h2 className="text-display-lg leading-tight text-ink-950">
            {heading}
          </h2>
          <p className="mt-4 text-body-lg text-stone-500">{subhead}</p>
        </div>
        <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
          {categories.map((cat) => {
            const href = `${base}/produits?category=${encodeURIComponent(cat.filterValue)}`;
            const priceFormatted = formatCAD(cat.priceFromCents, locale);
            return (
              <li key={cat.slug} className="flex">
                <Link
                  href={href}
                  className="group flex w-full flex-col overflow-hidden rounded-lg border border-sand-300 bg-canvas-050 transition-shadow duration-base ease-standard hover:border-slate-700 hover:shadow-md focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-canvas-050">
                    <Image
                      src={`/placeholders/categories/${cat.imageSlug}.svg`}
                      alt={cat.name[locale]}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                      className="object-cover transition-transform duration-base ease-standard group-hover:scale-[1.02]"
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-6">
                    <h3 className="text-title-lg font-semibold text-ink-800">
                      {cat.name[locale]}
                    </h3>
                    <p className="text-body-md text-stone-500">
                      {cat.description[locale]}
                    </p>
                    <p className="text-body-sm font-medium text-slate-700">
                      {priceFromLabel(priceFormatted)}
                    </p>
                    <p className="pt-2 text-body-sm font-medium text-ink-950">
                      {viewLabel} →
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-12 text-center">
          <Button
            href={`${base}/produits`}
            variant="secondary"
            size="lg"
          >
            {viewAllLabel}
          </Button>
        </div>
      </Container>
    </section>
  );
}
