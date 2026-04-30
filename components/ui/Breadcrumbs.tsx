import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { Locale } from '@/lib/types';

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type Props = {
  items: BreadcrumbItem[];
  locale: Locale;
  className?: string;
};

export function Breadcrumbs({ items, locale, className = '' }: Props) {
  if (items.length === 0) return null;
  const navLabel = locale === 'fr-ca' ? "Fil d'Ariane" : 'Breadcrumb';
  return (
    <nav aria-label={navLabel} className={className}>
      <ol className="flex flex-wrap items-center gap-1.5 text-body-sm text-stone-600">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={`${item.label}-${idx}`} className="inline-flex items-center gap-1.5">
              {idx > 0 ? (
                <ChevronRight aria-hidden className="h-3.5 w-3.5" />
              ) : null}
              {isLast || !item.href ? (
                <span aria-current={isLast ? 'page' : undefined} className="text-ink-950">
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="hover:text-ink-950 hover:underline underline-offset-2"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
