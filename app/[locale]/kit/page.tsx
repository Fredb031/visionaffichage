import type { Metadata } from 'next';
import Link from 'next/link';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';

import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Container } from '@/components/Container';
import { FaqAccordion } from '@/components/sections/FaqAccordion';
import { HeroBlock } from '@/components/sections/HeroBlock';
import { Section } from '@/components/Section';
import { getAlternates, getOgImageUrl } from '@/lib/seo';
import { siteConfig } from '@/lib/site';
import { routing, type Locale } from '@/i18n/routing';
import { KitClient } from './KitClient';

function isLocale(value: string): value is Locale {
  return value === 'fr-ca' || value === 'en-ca';
}

type Props = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const isFr = locale === 'fr-ca';
  const title = isFr
    ? 'Kit découverte · Vision Affichage'
    : 'Discovery kit · Vision Affichage';
  const description = isFr
    ? 'Trois échantillons à toucher avant de commander pour ton équipe.'
    : 'Three samples to feel before ordering for your team.';

  const ogTitle = isFr ? 'Kit découverte' : 'Discovery kit';
  const ogSubtitle = isFr
    ? '3 vêtements à toucher avant de commander pour ton équipe'
    : '3 garments to feel before ordering for your team';
  const ogImage = getOgImageUrl(ogTitle, ogSubtitle);

  return {
    title,
    description,
    alternates: getAlternates('/kit', locale),
    openGraph: {
      type: 'website',
      locale: isFr ? 'fr_CA' : 'en_CA',
      title,
      description,
      siteName: siteConfig.name,
      url: `${siteConfig.url}/${locale}/kit`,
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

const FAQ_KEYS = ['1', '2', '3', '4'] as const;

export default async function KitPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'kit' });
  const tBreadcrumbs = await getTranslations({
    locale,
    namespace: 'breadcrumbs',
  });

  const breadcrumbItems = [
    { label: tBreadcrumbs('home'), href: `/${locale}` },
    { label: t('breadcrumb.kit') },
  ];

  const faqItems = FAQ_KEYS.map((key) => ({
    q: t(`faq.items.${key}.q`),
    a: t(`faq.items.${key}.a`),
  }));

  return (
    <>
      <div className="bg-canvas-050">
        <Container size="2xl">
          <div className="pt-6">
            <Breadcrumbs items={breadcrumbItems} locale={locale} />
          </div>
        </Container>
      </div>

      <HeroBlock
        tone="warm"
        eyebrow={t('hero.eyebrow')}
        headline={t('hero.headline')}
        subhead={t('hero.subhead')}
        primaryCta={{
          label: t('kits.heading'),
          href: '#kit-cards',
        }}
        secondaryCta={{
          label: t('handoff.cta'),
          href: `/${locale}/soumission`,
        }}
      />

      <Section tone="default">
        <Container size="2xl">
          <KitClient locale={locale} />
        </Container>
      </Section>

      <Section tone="warm">
        <Container size="lg">
          <div className="space-y-6">
            <h2 className="text-display-md font-semibold text-ink-950">
              {t('faq.heading')}
            </h2>
            <FaqAccordion items={faqItems} locale={locale} />
          </div>
        </Container>
      </Section>

      <Section tone="sand">
        <Container size="lg">
          <div className="flex flex-col items-start gap-4 rounded-lg bg-canvas-000 p-6 md:flex-row md:items-center md:justify-between md:p-8">
            <div className="space-y-1">
              <h2 className="text-title-lg font-semibold text-ink-950">
                {t('handoff.title')}
              </h2>
              <p className="text-body-md text-stone-600">{t('handoff.body')}</p>
            </div>
            <Link
              href={`/${locale}/soumission`}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-ink-950 px-6 text-body-md font-medium text-canvas-000 transition-colors duration-base hover:bg-ink-800"
            >
              {t('handoff.cta')}
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
          </div>
        </Container>
      </Section>
    </>
  );
}
