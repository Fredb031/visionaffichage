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
    ? 'Contact · Vision Affichage'
    : 'Contact · Vision Affichage';
  const description = isFr
    ? 'Téléphone, courriel et atelier de Vision Affichage.'
    : 'Phone, email, and shop details for Vision Affichage.';

  return {
    title,
    description,
    alternates: getAlternates('/contact'),
    openGraph: {
      type: 'website',
      locale: isFr ? 'fr_CA' : 'en_CA',
      title,
      description,
      siteName: siteConfig.name,
      url: `${siteConfig.url}/${locale}/contact`,
    },
    robots: { index: false, follow: true },
  };
}

export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  return (
    <>
      <Hreflang pathWithoutLocale="/contact" />
      <PhaseTwoStub locale={locale} pageKey="contact" />
    </>
  );
}
