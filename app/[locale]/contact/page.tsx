import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Container } from '@/components/Container';
import { Section } from '@/components/Section';
import { getAlternates } from '@/lib/seo';
import { siteConfig } from '@/lib/site';
import { routing, type Locale } from '@/i18n/routing';
import { ContactClient } from './ContactClient';

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
    alternates: getAlternates('/contact', locale),
    openGraph: {
      type: 'website',
      locale: isFr ? 'fr_CA' : 'en_CA',
      title,
      description,
      siteName: siteConfig.name,
      url: `${siteConfig.url}/${locale}/contact`,
    },
  };
}

export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const tBreadcrumbs = await getTranslations({
    locale,
    namespace: 'breadcrumbs',
  });
  const t = await getTranslations({ locale, namespace: 'contact' });

  const breadcrumbItems = [
    { label: tBreadcrumbs('home'), href: `/${locale}` },
    { label: t('heading') },
  ];

  return (
    <>
      <div className="bg-canvas-050">
        <Container size="2xl">
          <div className="pt-6">
            <Breadcrumbs items={breadcrumbItems} locale={locale} />
          </div>
        </Container>
      </div>
      <Section tone="default">
        <Container size="2xl">
          <ContactClient locale={locale} />
        </Container>
      </Section>
    </>
  );
}
