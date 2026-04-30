import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { Container } from '@/components/Container';
import { Section } from '@/components/Section';
import { getAlternates, getOgImageUrl } from '@/lib/seo';
import { siteConfig } from '@/lib/site';
import { routing, type Locale } from '@/i18n/routing';
import { SoumissionClient } from './SoumissionClient';

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
    ? 'Demander une soumission · Vision Affichage'
    : 'Request a quote · Vision Affichage';
  const description = isFr
    ? 'Soumission pour commandes de 50 unités et plus. Réponse sous un jour ouvrable.'
    : 'Quote requests for 50-unit orders and up. Response within one business day.';

  const ogTitle = isFr ? 'Demander une soumission' : 'Request a quote';
  const ogSubtitle = isFr
    ? 'Réponse sous 24h · Volumes 50+ · Québec et Ontario'
    : 'Reply within 24h · Volumes 50+ · Quebec and Ontario';
  const ogImage = getOgImageUrl(ogTitle, ogSubtitle);

  return {
    title,
    description,
    alternates: getAlternates('/soumission', locale),
    openGraph: {
      type: 'website',
      locale: isFr ? 'fr_CA' : 'en_CA',
      title,
      description,
      siteName: siteConfig.name,
      url: `${siteConfig.url}/${locale}/soumission`,
      images: [{ url: ogImage, width: 1200, height: 630, alt: ogTitle }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    robots: { index: false, follow: true },
  };
}

export default async function SoumissionPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  return (
    <Section tone="warm">
      <Container size="lg">
        <SoumissionClient locale={locale} />
      </Container>
    </Section>
  );
}
