import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';

import { Container } from '@/components/Container';
import { Section } from '@/components/Section';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { products } from '@/lib/products';
import { getAlternates } from '@/lib/seo';
import { siteConfig } from '@/lib/site';
import { routing, type Locale } from '@/i18n/routing';

import { CustomiserClient } from './CustomiserClient';

function isLocale(value: string): value is Locale {
  return value === 'fr-ca' || value === 'en-ca';
}

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const isFr = locale === 'fr-ca';
  const title = isFr
    ? 'Personnaliser · Vision Affichage'
    : 'Customize · Vision Affichage';
  const description = isFr
    ? 'Téléverse ton logo. On vérifie la qualité et on t\'envoie une maquette en 24 h.'
    : 'Upload your logo. We check quality and send you a proof within 24 hours.';

  return {
    title,
    description,
    alternates: getAlternates('/customiser', locale),
    openGraph: {
      type: 'website',
      locale: isFr ? 'fr_CA' : 'en_CA',
      title,
      description,
      siteName: siteConfig.name,
      url: `${siteConfig.url}/${locale}/customiser`,
    },
    robots: { index: false, follow: true },
  };
}

function pickFirst(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const DEFAULT_GARMENT_HEX = '#101114';

function resolveGarmentHex(productSlug: string | null, colorParam: string | null): string {
  if (colorParam) {
    // Either a literal hex or a color slug like "ink-950".
    if (/^#?[0-9a-fA-F]{6}$/.test(colorParam)) {
      return colorParam.startsWith('#') ? colorParam : `#${colorParam}`;
    }
    if (productSlug) {
      const product = products.find((p) => p.slug === productSlug);
      const match = product?.colors.find(
        (c) =>
          c.name['fr-ca'].toLowerCase() === colorParam.toLowerCase() ||
          c.name['en-ca'].toLowerCase() === colorParam.toLowerCase(),
      );
      if (match) return match.hex;
    }
    // Color tokens such as "ink-950" → just use ink-950 as default.
  }
  return DEFAULT_GARMENT_HEX;
}

function resolveMockupSrc(productSlug: string | null): string | null {
  if (!productSlug) return null;
  const product = products.find((p) => p.slug === productSlug);
  const front = product?.gallery?.[0];
  if (!front) return null;
  return `/placeholders/products/${front}.svg`;
}

export default async function CustomiserPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const sp = await searchParams;
  const productSlug = pickFirst(sp.product);
  const colorParam = pickFirst(sp.color);
  const sizeParam = pickFirst(sp.size);

  const product = productSlug ? products.find((p) => p.slug === productSlug) : null;
  const productLabel = product ? product.title[locale] : null;
  const garmentHex = resolveGarmentHex(productSlug, colorParam);
  const mockupSrc = resolveMockupSrc(productSlug);

  const t = await getTranslations({ locale, namespace: 'customizer' });

  const breadcrumbItems = [
    { label: t('breadcrumb.home'), href: `/${locale}` },
    { label: t('breadcrumb.products'), href: `/${locale}/produits` },
    { label: t('breadcrumb.current') },
  ];

  return (
    <main>
    <Section tone="warm">
      <Container size="xl">
        <Breadcrumbs items={breadcrumbItems} locale={locale} className="mb-6" />
        <header className="mb-10 max-w-3xl">
          <h1 className="text-title-xl text-ink-950 md:text-display-lg">{t('heading')}</h1>
          <p className="mt-3 text-body-lg text-stone-600">{t('subhead')}</p>
          {productLabel ? (
            <p className="mt-3 inline-flex items-center gap-2 rounded-pill border border-sand-300 bg-canvas-000 px-3 py-1 text-body-sm text-stone-600">
              <span className="font-semibold text-ink-950">{t('productLabel')}</span>
              <span>·</span>
              <span>{productLabel}</span>
              {sizeParam ? (
                <>
                  <span>·</span>
                  <span>{sizeParam}</span>
                </>
              ) : null}
            </p>
          ) : null}
        </header>

        <CustomiserClient
          locale={locale}
          productSlug={productSlug}
          productMockupSrc={mockupSrc}
          productLabel={productLabel}
          garmentHex={garmentHex}
          size={sizeParam}
        />
      </Container>
    </Section>
    </main>
  );
}
