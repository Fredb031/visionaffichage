import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Container } from '@/components/Container';
import { Section } from '@/components/Section';
import { getAlternates } from '@/lib/seo';
import { siteConfig } from '@/lib/site';
import { routing, type Locale } from '@/i18n/routing';
import { ReviewSubmitClient } from './ReviewSubmitClient';

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
    ? 'Soumettre un avis · Vision Affichage'
    : 'Submit a review · Vision Affichage';
  const description = isFr
    ? "Partage ton expérience avec Vision Affichage. On publie après vérification."
    : 'Share your experience with Vision Affichage. Published after verification.';

  return {
    title,
    description,
    alternates: getAlternates('/avis/soumettre', locale),
    openGraph: {
      type: 'website',
      locale: isFr ? 'fr_CA' : 'en_CA',
      title,
      description,
      siteName: siteConfig.name,
      url: `${siteConfig.url}/${locale}/avis/soumettre`,
    },
  };
}

export default async function ReviewSubmitPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const tBreadcrumbs = await getTranslations({
    locale,
    namespace: 'breadcrumbs',
  });
  const tReviews = await getTranslations({ locale, namespace: 'reviews' });
  const t = await getTranslations({ locale, namespace: 'reviewSubmit' });

  const breadcrumbItems = [
    { label: tBreadcrumbs('home'), href: `/${locale}` },
    { label: tReviews('breadcrumb.label'), href: `/${locale}/avis` },
    { label: t('breadcrumb') },
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
          <div className="mx-auto max-w-3xl space-y-10">
            <header className="space-y-2">
              <h1 className="text-display-md font-semibold text-ink-950">
                {t('heading')}
              </h1>
              <p className="text-body-md text-stone-600">{t('subhead')}</p>
            </header>
            <ReviewSubmitClient locale={locale} />
          </div>
        </Container>
      </Section>
    </>
  );
}
