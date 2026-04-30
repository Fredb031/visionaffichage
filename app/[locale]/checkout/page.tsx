import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';

import { Container } from '@/components/Container';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { CheckoutClient } from './CheckoutClient';
import { getAlternates } from '@/lib/seo';
import type { Locale } from '@/i18n/routing';

function isLocale(value: string): value is Locale {
  return value === 'fr-ca' || value === 'en-ca';
}

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'checkout' });
  return {
    title: t('metadata.title'),
    alternates: getAlternates('/checkout', locale),
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function CheckoutPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'checkout' });
  const tBreadcrumbs = await getTranslations({
    locale,
    namespace: 'breadcrumbs',
  });
  const tCart = await getTranslations({ locale, namespace: 'cart' });

  return (
    <div className="bg-canvas-000 py-12 md:py-16">
      <Container>
        <Breadcrumbs
          locale={locale}
          items={[
            { label: tBreadcrumbs('home'), href: `/${locale}` },
            { label: tCart('label'), href: `/${locale}/panier` },
            { label: t('heading') },
          ]}
          className="mb-6"
        />
        <CheckoutClient locale={locale} />
      </Container>
    </div>
  );
}
