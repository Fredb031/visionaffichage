import Link from 'next/link';
import {
  Briefcase,
  Hammer,
  Sprout,
  Truck,
  Utensils,
  Wrench,
  ArrowRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Industry, Locale } from '@/lib/types';
import { Container } from '../Container';

type Props = {
  industries: Industry[];
  locale: Locale;
  heading: string;
  /** Eyebrow above the heading (e.g. "POUR TON INDUSTRIE"). Optional. */
  eyebrow?: string;
  /** Sub-stat caption (e.g. "6 secteurs · uniformes adaptés"). Optional. */
  caption?: string;
};

const ICON_BY_SLUG: Record<string, LucideIcon> = {
  construction: Hammer,
  paysagement: Sprout,
  restauration: Utensils,
  demenagement: Truck,
  metiers: Wrench,
  bureau: Briefcase,
};

export function IndustryPills({
  industries,
  locale,
  heading,
  eyebrow,
  caption,
}: Props) {
  if (industries.length === 0) return null;
  const base = `/${locale}`;

  return (
    <section className="relative isolate overflow-hidden border-b border-sand-300 bg-canvas-050 py-14 md:py-20">
      {/* Subtle Linear-style grid background */}
      <div
        aria-hidden
        className="bg-grid pointer-events-none absolute inset-0 opacity-70"
      />
      <Container size="2xl" className="relative">
        <div className="mb-8 flex flex-col gap-1 md:mb-10">
          {eyebrow ? (
            <span className="text-meta-xs uppercase tracking-[0.25em] text-stone-500">
              {eyebrow}
            </span>
          ) : null}
          <h2 className="text-title-lg font-semibold leading-tight text-ink-950 md:text-title-xl">
            {heading}
          </h2>
          {caption ? (
            <p className="mt-1 text-body-sm text-stone-500">{caption}</p>
          ) : null}
        </div>
        <div className="-mx-4 flex flex-wrap gap-2 overflow-x-auto px-4 md:mx-0 md:flex-nowrap md:gap-3 md:overflow-x-auto md:px-0">
          {industries.map((ind, i) => {
            const Icon = ICON_BY_SLUG[ind.slug] ?? Briefcase;
            return (
              <Link
                key={ind.slug}
                href={`${base}/industries/${ind.slug}`}
                style={{ animationDelay: `${i * 60}ms` }}
                className="motion-safe:animate-pill group inline-flex items-center gap-2 whitespace-nowrap rounded-pill border border-sand-300 bg-canvas-000 px-4 py-2 text-body-sm font-medium text-ink-800 transition-colors duration-base ease-standard hover:border-slate-700 hover:bg-canvas-050 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
              >
                <Icon
                  aria-hidden
                  className="h-4 w-4 text-slate-700 transition-transform duration-base ease-standard group-hover:translate-x-0.5"
                  strokeWidth={1.6}
                />
                {ind.name[locale]}
                <ArrowRight
                  aria-hidden
                  className="h-3.5 w-3.5 -translate-x-1 text-stone-500 opacity-0 transition-all duration-base ease-standard group-hover:translate-x-0 group-hover:opacity-100"
                  strokeWidth={1.6}
                />
              </Link>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
