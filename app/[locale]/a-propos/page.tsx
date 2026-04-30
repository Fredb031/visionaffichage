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
    ? 'À propos · Vision Affichage'
    : 'About · Vision Affichage';
  const description = isFr
    ? 'Atelier de broderie et sérigraphie à Blainville depuis 2021.'
    : 'Embroidery and screen-print shop in Blainville since 2021.';

  return {
    title,
    description,
    alternates: getAlternates('/a-propos'),
    openGraph: {
      type: 'website',
      locale: isFr ? 'fr_CA' : 'en_CA',
      title,
      description,
      siteName: siteConfig.name,
      url: `${siteConfig.url}/${locale}/a-propos`,
    },
    robots: { index: false, follow: true },
  };
}

export default async function AProposPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  return (
    <>
      <Hreflang pathWithoutLocale="/a-propos" />
      <PhaseTwoStub locale={locale} pageKey="a-propos" />
    </>
  );
}
