import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing, localeToHtmlLang, type Locale } from '@/i18n/routing';

function isLocale(value: string): value is Locale {
  return value === 'fr-ca' || value === 'en-ca';
}
import { siteConfig } from '@/lib/site';
import { BASE_URL } from '@/lib/seo';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { SkipLink } from '@/components/SkipLink';
import { OrganizationJsonLd } from '@/components/seo/OrganizationJsonLd';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) {
    return {};
  }
  const t = await getTranslations({ locale, namespace: 'metadata' });

  return {
    metadataBase: new URL(siteConfig.url),
    title: {
      default: t('title'),
      template: `%s — ${siteConfig.name}`,
    },
    description: t('description'),
    alternates: {
      canonical: `/${locale}`,
      languages: {
        'fr-CA': `/fr-ca`,
        'en-CA': `/en-ca`,
        'x-default': `/${routing.defaultLocale}`,
      },
    },
    openGraph: {
      type: 'website',
      locale: locale === 'fr-ca' ? 'fr_CA' : 'en_CA',
      title: t('ogTitle'),
      description: t('ogDescription'),
      siteName: siteConfig.name,
      url: `${siteConfig.url}/${locale}`,
      images: [
        {
          url: `${BASE_URL}/api/og?title=${encodeURIComponent(t('ogTitle'))}&subtitle=${encodeURIComponent(t('ogDescription'))}`,
          width: 1200,
          height: 630,
          alt: t('ogTitle'),
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('ogTitle'),
      description: t('ogDescription'),
      images: [
        `${BASE_URL}/api/og?title=${encodeURIComponent(t('ogTitle'))}&subtitle=${encodeURIComponent(t('ogDescription'))}`,
      ],
    },
    icons: {
      icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={localeToHtmlLang[locale as Locale]} className={inter.variable}>
      <head>
        <OrganizationJsonLd />
      </head>
      <body className="font-sans antialiased bg-canvas-000 text-ink-950">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <SkipLink />
          <Header />
          <main id="main-content">{children}</main>
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
