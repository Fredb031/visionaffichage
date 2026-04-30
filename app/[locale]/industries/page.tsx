import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { Container } from '@/components/Container';
import { Section } from '@/components/Section';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { HeroBlock } from '@/components/sections/HeroBlock';
import { TrustStrip } from '@/components/sections/TrustStrip';
import { IndustryGrid } from '@/components/sections/IndustryGrid';
import { Hreflang } from '@/components/Hreflang';

import { industries } from '@/lib/industries';
import { getAlternates } from '@/lib/seo';
import { siteConfig } from '@/lib/site';
import { routing, type Locale } from '@/i18n/routing';

function isLocale(value: string): value is Locale {
  return value === 'fr-ca' || value === 'en-ca';
}

type Props = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const isFr = locale === 'fr-ca';
  const title = isFr
    ? 'Industries · Vision Affichage'
    : 'Industries · Vision Affichage';
  const description = isFr
    ? 'Vêtements brodés et imprimés pour la construction, le paysagement, la restauration, le déménagement, les métiers spécialisés et les bureaux. Production en cinq jours ouvrables.'
    : 'Embroidered and printed apparel for construction, landscaping, restaurants, moving, skilled trades, and offices. Five business-day production.';

  return {
    title,
    description,
    alternates: getAlternates('/industries'),
    openGraph: {
      type: 'website',
      locale: isFr ? 'fr_CA' : 'en_CA',
      title,
      description,
      siteName: siteConfig.name,
      url: `${siteConfig.url}/${locale}/industries`,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function IndustriesIndexPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'industry' });
  const tBc = await getTranslations({ locale, namespace: 'breadcrumbs' });

  const base = `/${locale}`;

  return (
    <>
      <Hreflang pathWithoutLocale="/industries" />

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
              {t('indexHeading')}
            </h1>
            <p className="mt-6 text-body-lg text-stone-500">
              {t('indexSubhead')}
            </p>
          </div>
          <IndustryGrid
            industries={industries}
            locale={locale}
            className="mt-12"
          />
        </Container>
      </Section>

      <TrustStrip locale={locale} variant="warm" />

      <HeroBlock
        tone="sand"
        eyebrow={t('breadcrumb')}
        headline={t('indexFallbackHeading')}
        subhead={t('indexFallbackBody')}
        primaryCta={{
          label: t('indexFallbackCta'),
          href: `${base}/soumission`,
        }}
        secondaryCta={{
          label: locale === 'fr-ca' ? 'Voir les produits' : 'View products',
          href: `${base}/produits`,
        }}
      />
    </>
  );
}
