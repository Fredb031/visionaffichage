import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';

import { Container } from '@/components/Container';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { CartClient } from './CartClient';
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
  const t = await getTranslations({ locale, namespace: 'cart' });
  return {
    title: t('metadata.title'),
    alternates: getAlternates('/panier', locale),
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function CartPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'cart' });
  const tBreadcrumbs = await getTranslations({
    locale,
    namespace: 'breadcrumbs',
  });

  return (
    <div className="bg-canvas-000 py-12 md:py-16">
      <Container>
        <Breadcrumbs
          locale={locale}
          items={[
            { label: tBreadcrumbs('home'), href: `/${locale}` },
            { label: t('label') },
          ]}
          className="mb-6"
        />
        <CartClient locale={locale} />
      </Container>
    </div>
  );
}
