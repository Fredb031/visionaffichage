import Link from 'next/link';
import {
  Briefcase,
  Hammer,
  Sprout,
  Truck,
  Utensils,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Industry, Locale } from '@/lib/types';
import { Container } from '../Container';

type Props = {
  industries: Industry[];
  locale: Locale;
  heading: string;
};

const ICON_BY_SLUG: Record<string, LucideIcon> = {
  construction: Hammer,
  paysagement: Sprout,
  restauration: Utensils,
  demenagement: Truck,
  metiers: Wrench,
  bureau: Briefcase,
};

export function IndustryPills({ industries, locale, heading }: Props) {
  if (industries.length === 0) return null;
  const base = `/${locale}`;

  return (
    <section className="border-b border-sand-300 bg-canvas-050 py-12 md:py-16">
      <Container size="2xl">
        <h2 className="mb-6 text-title-md font-semibold text-ink-800">
          {heading}
        </h2>
        <div className="-mx-4 flex flex-wrap gap-2 overflow-x-auto px-4 md:mx-0 md:flex-nowrap md:gap-3 md:overflow-x-auto md:px-0">
          {industries.map((ind) => {
            const Icon = ICON_BY_SLUG[ind.slug] ?? Briefcase;
            return (
              <Link
                key={ind.slug}
                href={`${base}/industries/${ind.slug}`}
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-pill border border-sand-300 bg-canvas-000 px-4 py-2 text-body-sm font-medium text-ink-800 transition-colors duration-base ease-standard hover:border-slate-700 hover:bg-canvas-050 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
              >
                <Icon
                  aria-hidden
                  className="h-4 w-4 text-slate-700"
                  strokeWidth={1.6}
                />
                {ind.name[locale]}
              </Link>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
