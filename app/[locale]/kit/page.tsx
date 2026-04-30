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
    ? 'Kit découverte · Vision Affichage'
    : 'Discovery kit · Vision Affichage';
  const description = isFr
    ? 'Trois échantillons à toucher avant de commander pour ton équipe.'
    : 'Three samples to feel before ordering for your team.';

  return {
    title,
    description,
    alternates: getAlternates('/kit'),
    openGraph: {
      type: 'website',
      locale: isFr ? 'fr_CA' : 'en_CA',
      title,
      description,
      siteName: siteConfig.name,
      url: `${siteConfig.url}/${locale}/kit`,
    },
    robots: { index: false, follow: true },
  };
}

export default async function KitPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  return (
    <>
      <Hreflang pathWithoutLocale="/kit" />
      <PhaseTwoStub locale={locale} pageKey="kit" />
    </>
  );
}
