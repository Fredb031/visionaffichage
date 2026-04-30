import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { Container } from '@/components/Container';
import { Section } from '@/components/Section';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';

import { products as allProducts } from '@/lib/products';
import {
  filterProducts,
  parseSearchParams,
  sortProducts,
} from '@/lib/filters';
import { getAlternates, getOgImageUrl } from '@/lib/seo';
import { siteConfig } from '@/lib/site';
import { routing, type Locale } from '@/i18n/routing';
import type { BadgeKey, ProductCategory } from '@/lib/types';

import { PlpClient } from './PlpClient';

function isLocale(value: string): value is Locale {
  return value === 'fr-ca' || value === 'en-ca';
}

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const isFr = locale === 'fr-ca';
  const title = isFr
    ? 'Tous les uniformes · Vision Affichage'
    : 'All uniforms · Vision Affichage';
  const description = isFr
    ? "Catalogue complet d'uniformes brodés et imprimés : polos, t-shirts, ouates, vestes, casquettes. Production cinq jours ouvrables après l'approbation du logo."
    : 'Complete catalog of embroidered and printed uniforms: polos, tees, hoodies, jackets, caps. Five business-day production after logo approval.';

  const ogTitle = isFr ? 'Tous les uniformes' : 'All uniforms';
  const ogSubtitle = isFr
    ? 'Polos · T-shirts · Ouates · Vestes · Casquettes — production 5 jours'
    : 'Polos · Tees · Hoodies · Jackets · Caps — 5-business-day production';
  const ogImage = getOgImageUrl(ogTitle, ogSubtitle);

  return {
    title,
    description,
    alternates: getAlternates('/produits', locale),
    openGraph: {
      type: 'website',
      locale: isFr ? 'fr_CA' : 'en_CA',
      title,
      description,
      siteName: siteConfig.name,
      url: `${siteConfig.url}/${locale}/produits`,
      images: [{ url: ogImage, width: 1200, height: 630, alt: ogTitle }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

function uniqueColors(): { hex: string; name: string }[] {
  const map = new Map<string, string>();
  for (const p of allProducts) {
    for (const c of p.colors) {
      const key = c.hex.toLowerCase();
      if (!map.has(key)) {
        map.set(key, c.name['fr-ca']);
      }
    }
  }
  return Array.from(map.entries()).map(([hex, name]) => ({ hex, name }));
}

function uniqueCategories(): ProductCategory[] {
  const set = new Set<ProductCategory>();
  for (const p of allProducts) set.add(p.category);
  return Array.from(set);
}

function uniqueBadges(): BadgeKey[] {
  const set = new Set<BadgeKey>();
  for (const p of allProducts) {
    for (const b of p.badgeKeys ?? []) set.add(b);
  }
  return Array.from(set);
}

export default async function ProduitsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const sp = await searchParams;
  const { filters, sort } = parseSearchParams(sp);

  const t = await getTranslations({ locale, namespace: 'plp' });
  const tBc = await getTranslations({ locale, namespace: 'breadcrumbs' });

  const base = `/${locale}`;
  const filtered = filterProducts(allProducts, filters);
  const sorted = sortProducts(filtered, sort);

  const initialFilters = {
    categories: filters.categories ?? [],
    badges: filters.badges ?? [],
    colors: filters.colors ?? [],
  };

  return (
    <>
      <Section tone="default" className="py-8 md:py-10">
        <Container size="2xl">
          <Breadcrumbs
            locale={locale}
            items={[
              { label: tBc('home'), href: base },
              { label: t('breadcrumb') },
            ]}
          />
        </Container>
      </Section>

      <Section tone="warm" className="pt-4 md:pt-6">
        <Container size="2xl">
          <div className="max-w-3xl">
            <h1 className="text-display-lg text-ink-950 md:text-display-xl">
              {t('heading')}
            </h1>
            <p className="mt-6 text-body-lg text-stone-600">{t('subhead')}</p>
          </div>
        </Container>
      </Section>

      <Section tone="default">
        <Container size="2xl">
          <PlpClient
            locale={locale}
            products={sorted}
            totalCount={allProducts.length}
            initialFilters={initialFilters}
            initialSort={sort}
            availableColors={uniqueColors()}
            availableCategories={uniqueCategories()}
            availableBadges={uniqueBadges()}
          />
        </Container>
      </Section>
    </>
  );
}
