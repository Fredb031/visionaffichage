import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

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
    ? 'Comment ça marche · Vision Affichage'
    : 'How it works · Vision Affichage';
  const description = isFr
    ? 'De la sélection des vêtements à la livraison en cinq jours ouvrables.'
    : 'From apparel selection to delivery in five business days.';

  return {
    title,
    description,
    alternates: getAlternates('/comment-ca-marche', locale),
    openGraph: {
      type: 'website',
      locale: isFr ? 'fr_CA' : 'en_CA',
      title,
      description,
      siteName: siteConfig.name,
      url: `${siteConfig.url}/${locale}/comment-ca-marche`,
    },
    robots: { index: false, follow: true },
  };
}

export default async function CommentCaMarchePage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  return <PhaseTwoStub locale={locale} pageKey="comment-ca-marche" />;
}
