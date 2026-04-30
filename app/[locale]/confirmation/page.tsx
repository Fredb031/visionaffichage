import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';

import { Container } from '@/components/Container';
import { ConfirmationClient } from './ConfirmationClient';
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
  const t = await getTranslations({ locale, namespace: 'confirmation' });
  return {
    title: t('metadata.title'),
    alternates: getAlternates('/confirmation', locale),
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function ConfirmationPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  return (
    <div className="bg-canvas-000 py-12 md:py-16">
      <Container>
        <Suspense
          fallback={
            <div className="space-y-4">
              <div className="h-12 w-72 animate-pulse rounded bg-sand-100" />
              <div className="h-48 animate-pulse rounded-lg bg-sand-100" />
            </div>
          }
        >
          <ConfirmationClient locale={locale} />
        </Suspense>
      </Container>
    </div>
  );
}
