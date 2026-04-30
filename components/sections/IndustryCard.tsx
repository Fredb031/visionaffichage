import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { Industry, Locale } from '@/lib/types';

type Props = {
  industry: Industry;
  locale: Locale;
  className?: string;
};

export function IndustryCard({ industry, locale, className = '' }: Props) {
  const href = `/${locale}/industries/${industry.slug}`;
  const name = industry.name[locale];
  const hookLine =
    industry.hookLine?.[locale] ?? industry.shortDescription[locale];
  return (
    <Link
      href={href}
      className={`group flex flex-col overflow-hidden rounded-lg bg-canvas-000 shadow-xs transition-shadow duration-base ease-standard hover:shadow-md focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 ${className}`.trim()}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-sand-100">
        <Image
          src={`/placeholders/industries/${industry.slug}.svg`}
          alt=""
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-base ease-standard group-hover:scale-[1.02]"
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="text-title-md text-ink-950">{name}</h3>
        <p className="text-body-md text-stone-500">{hookLine}</p>
        <span className="mt-auto inline-flex items-center gap-1 pt-3 text-body-md font-medium text-ink-950 transition-transform duration-base ease-standard group-hover:translate-x-0.5">
          {locale === 'fr-ca' ? 'Voir les uniformes' : 'See uniforms'}
          <ArrowRight aria-hidden className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}
