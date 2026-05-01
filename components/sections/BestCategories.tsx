import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
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

/**
 * Bento grid placement classes for the 6-card homepage grid.
 *  - lg+: 4 cols × 3 rows. Card 0 (T-shirts) spans 2×2 hero feature.
 *    Cards 1, 2 stack to the right of feature (2 cols × 1 row each = 1×1 here).
 *    Cards 3, 4, 5 fill the bottom row (1×1 each).
 *  - md (tablet): 2 columns. Feature spans both cols.
 *  - mobile: 1 col, all stacked.
 */
const BENTO_LG_CLASSES = [
  'lg:col-span-2 lg:row-span-2', // 0 T-shirts (large feature)
  'lg:col-span-2 lg:row-span-1', // 1 Hoodies
  'lg:col-span-2 lg:row-span-1', // 2 Polos
  'lg:col-span-1 lg:row-span-1', // 3 Caps
  'lg:col-span-1 lg:row-span-1', // 4 Tuques
  'lg:col-span-2 lg:row-span-1', // 5 Workwear
];

const BENTO_MD_CLASSES = [
  'md:col-span-2', // T-shirts spans both tablet cols
  'md:col-span-1',
  'md:col-span-1',
  'md:col-span-1',
  'md:col-span-1',
  'md:col-span-2', // Workwear spans both
];

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
          <span className="text-meta-xs uppercase tracking-[0.25em] text-stone-500">
            {locale === 'fr-ca' ? 'Catalogue' : 'Catalog'}
          </span>
          <h2 className="mt-2 text-display-lg leading-[1.05] tracking-[-0.02em] text-ink-950">
            {heading}
          </h2>
          <p className="mt-4 text-body-lg leading-relaxed text-stone-500">
            {subhead}
          </p>
        </div>
        <ul className="grid auto-rows-[minmax(0,1fr)] grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-4 lg:gap-6">
          {categories.map((cat, i) => {
            const href = `${base}/produits?category=${encodeURIComponent(cat.filterValue)}`;
            const priceFormatted = formatCAD(cat.priceFromCents, locale);
            const isFeature = i === 0;
            const numLabel = `${String(i + 1).padStart(2, '0')} / ${cat.name[locale]}`;
            const lgClass = BENTO_LG_CLASSES[i] ?? 'lg:col-span-1';
            const mdClass = BENTO_MD_CLASSES[i] ?? 'md:col-span-1';
            return (
              <li
                key={cat.slug}
                className={`flex ${mdClass} ${lgClass}`.trim()}
              >
                <Link
                  href={href}
                  className="bg-hairlines group relative flex w-full flex-col overflow-hidden rounded-md border border-sand-300 bg-canvas-050 transition motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-md motion-safe:duration-base motion-safe:ease-standard hover:border-slate-700 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
                >
                  <div
                    className={`relative w-full overflow-hidden bg-canvas-000 ${isFeature ? 'aspect-[5/4] lg:flex-[3]' : 'aspect-[4/3]'}`}
                  >
                    <Image
                      src={`/placeholders/categories/${cat.imageSlug}.svg`}
                      alt={cat.name[locale]}
                      fill
                      sizes={
                        isFeature
                          ? '(min-width: 1024px) 50vw, (min-width: 768px) 100vw, 100vw'
                          : '(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw'
                      }
                      className="object-contain p-4 transition-transform duration-base ease-standard group-hover:scale-[1.02]"
                    />
                  </div>
                  <div
                    className={`relative flex flex-1 flex-col gap-1.5 p-5 lg:p-6 ${isFeature ? 'lg:flex-[2]' : ''}`}
                  >
                    <span className="text-meta-xs uppercase tracking-[0.2em] text-stone-500">
                      {numLabel}
                    </span>
                    <h3
                      className={`font-semibold tracking-[-0.01em] text-ink-950 ${isFeature ? 'text-title-xl' : 'text-title-lg'}`}
                    >
                      {cat.name[locale]}
                    </h3>
                    <p className="line-clamp-2 text-body-sm leading-relaxed text-stone-500">
                      {cat.description[locale]}
                    </p>
                    <div className="mt-auto flex items-end justify-between gap-2 pt-3">
                      <span className="inline-flex items-center gap-1 text-body-sm font-medium text-ink-950 transition-transform duration-base ease-standard group-hover:translate-x-0.5">
                        {viewLabel}
                        <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                      </span>
                      <span className="inline-flex items-center rounded-pill bg-sand-100 px-2 py-0.5 text-meta-xs font-medium text-ink-800">
                        {priceFromLabel(priceFormatted)}
                      </span>
                    </div>
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
