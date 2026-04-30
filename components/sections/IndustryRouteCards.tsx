import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ShoppingBag, Package, FileText, ArrowRight } from 'lucide-react';
import type { Locale } from '@/lib/types';
import { Container } from '../Container';

type Card = {
  id: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  cta: string;
  href: string;
};

type Props = {
  locale: Locale;
};

export function IndustryRouteCards({ locale }: Props) {
  const base = `/${locale}`;
  const cards: Card[] =
    locale === 'fr-ca'
      ? [
          {
            id: 'shop',
            icon: ShoppingBag,
            title: 'Magasiner les uniformes',
            subtitle: 'Polos, t-shirts, ouates, vestes brodés.',
            cta: 'Aller',
            href: `${base}/produits`,
          },
          {
            id: 'kit',
            icon: Package,
            title: 'Commander un kit découverte',
            subtitle: 'Trois échantillons à toucher avant de commander.',
            cta: 'Aller',
            href: `${base}/kit`,
          },
          {
            id: 'quote',
            icon: FileText,
            title: 'Demander une soumission',
            subtitle: 'Réponse en moins d\'un jour ouvrable.',
            cta: 'Aller',
            href: `${base}/soumission`,
          },
        ]
      : [
          {
            id: 'shop',
            icon: ShoppingBag,
            title: 'Shop the uniforms',
            subtitle: 'Embroidered polos, tees, hoodies, jackets.',
            cta: 'Go',
            href: `${base}/produits`,
          },
          {
            id: 'kit',
            icon: Package,
            title: 'Order a discovery kit',
            subtitle: 'Three samples to touch before you commit.',
            cta: 'Go',
            href: `${base}/kit`,
          },
          {
            id: 'quote',
            icon: FileText,
            title: 'Request a quote',
            subtitle: 'Response in under one business day.',
            cta: 'Go',
            href: `${base}/soumission`,
          },
        ];

  return (
    <section className="bg-sand-100 py-16 md:py-20">
      <Container size="2xl">
        <ul className="grid gap-4 md:grid-cols-3 md:gap-6">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <li key={c.id} className="flex">
                <Link
                  href={c.href}
                  className="group flex w-full flex-col rounded-lg bg-canvas-000 p-6 shadow-xs transition-shadow duration-base ease-standard hover:shadow-md focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
                >
                  <Icon
                    aria-hidden
                    className="h-8 w-8 text-ink-950"
                    strokeWidth={1.6}
                  />
                  <h3 className="mt-6 text-title-md text-ink-950">{c.title}</h3>
                  <p className="mt-2 text-body-md text-stone-500">
                    {c.subtitle}
                  </p>
                  <span className="mt-6 inline-flex items-center gap-1 text-body-md font-medium text-ink-950 transition-transform duration-base ease-standard group-hover:translate-x-0.5">
                    {c.cta}
                    <ArrowRight aria-hidden className="h-4 w-4" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
