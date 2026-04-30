import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { Hreflang } from '@/components/Hreflang';
import { PhaseTwoStub } from '@/components/ui/PhaseTwoStub';
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

  return {
    title,
    description,
    alternates: getAlternates('/soumission'),
    openGraph: {
      type: 'website',
      locale: isFr ? 'fr_CA' : 'en_CA',
      title,
      description,
      siteName: siteConfig.name,
      url: `${siteConfig.url}/${locale}/soumission`,
    },
    robots: { index: false, follow: true },
  };
}

export default async function SoumissionPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  return (
    <>
      <Hreflang pathWithoutLocale="/soumission" />
      <PhaseTwoStub locale={locale} pageKey="soumission" />
    </>
  );
}
