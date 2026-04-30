import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { Container } from '@/components/Container';
import { Section } from '@/components/Section';
import { HeroBlock } from '@/components/sections/HeroBlock';
import { TrustStrip } from '@/components/sections/TrustStrip';
import { IndustryRouteCards } from '@/components/sections/IndustryRouteCards';
import { IndustryGrid } from '@/components/sections/IndustryGrid';
import { HowItWorks } from '@/components/sections/HowItWorks';
import { ClientLogoMarquee } from '@/components/sections/ClientLogoMarquee';
import { ReviewGrid } from '@/components/sections/ReviewGrid';
import { DiscoveryKitTeaser } from '@/components/sections/DiscoveryKitTeaser';
import { FaqAccordion } from '@/components/sections/FaqAccordion';
import { ProductGrid } from '@/components/product/ProductGrid';
import { FaqJsonLd } from '@/components/seo/FaqJsonLd';

import { products } from '@/lib/products';
import { industries } from '@/lib/industries';
import { reviews, getOverallAverage } from '@/lib/reviews';
import { clientLogos } from '@/lib/clients';
import { getAlternates } from '@/lib/seo';
import { siteConfig } from '@/lib/site';
import type { Locale } from '@/i18n/routing';
import type { Product } from '@/lib/types';

function isLocale(value: string): value is Locale {
  return value === 'fr-ca' || value === 'en-ca';
}

type Props = {
  params: Promise<{ locale: string }>;
};

const FEATURED_STYLE_CODES = [
  'ATC1000',
  'ATC1015',
  'ATCF2400',
  'ATCF2500',
  'L445',
  'ATC6606',
] as const;

function getFeaturedProducts(): Product[] {
  const out: Product[] = [];
  for (const code of FEATURED_STYLE_CODES) {
    const found = products.find((p) => p.styleCode === code);
    if (found) out.push(found);
  }
  return out;
}

const FAQ_KEYS = ['1', '2', '3', '4', '5', '6'] as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const isFr = locale === 'fr-ca';
  const title = isFr
    ? "Vision Affichage · Vêtements d'entreprise au Québec"
    : 'Vision Affichage · Company apparel in Québec';
  const description = isFr
    ? "Broderie et sérigraphie pour t-shirts, polos, ouates et casquettes. Production en 5 jours ouvrables. Service en français au Québec."
    : 'Embroidery and screen printing for tees, polos, hoodies, and caps. 5-business-day production. French service across Québec.';

  return {
    title,
    description,
    alternates: getAlternates('/'),
    openGraph: {
      type: 'website',
      locale: isFr ? 'fr_CA' : 'en_CA',
      title,
      description,
      siteName: siteConfig.name,
      url: `${siteConfig.url}/${locale}`,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'home' });

  const base = `/${locale}`;
  const featured = getFeaturedProducts();
  const featuredReviews = reviews.slice(0, 3);
  const overall = getOverallAverage();

  const faqItems = FAQ_KEYS.map((key) => ({
    q: t(`faq.items.${key}.q`),
    a: t(`faq.items.${key}.a`),
  }));

  const faqJsonLdItems = faqItems.map((item) => ({
    question: item.q,
    answer: item.a,
  }));

  const reviewSubhead =
    locale === 'fr-ca'
      ? `${overall.average.toString().replace('.', ',')} sur 5 — ${overall.count} avis vérifiés`
      : `${overall.average} out of 5 — ${overall.count} verified reviews`;

  return (
    <>
      <FaqJsonLd items={faqJsonLdItems} />

      {/* 1. Hero */}
      <HeroBlock
        tone="ink"
        eyebrow={t('hero.eyebrow')}
        headline={t('hero.headline')}
        subhead={t('hero.subhead')}
        primaryCta={{ label: t('hero.cta.primary'), href: `${base}/produits` }}
        secondaryCta={{
          label: t('hero.cta.secondary'),
          href: `${base}/soumission`,
        }}
      />

      {/* 2. Trust strip */}
      <TrustStrip locale={locale} variant="warm" />

      {/* 3. Strategic CTA route cards */}
      <IndustryRouteCards locale={locale} />

      {/* 4. Featured products */}
      <Section tone="default">
        <Container size="2xl">
          <div className="grid gap-6 md:grid-cols-12 md:items-end">
            <div className="md:col-span-8">
              <h2 className="text-title-xl text-ink-950">
                {t('featured.heading')}
              </h2>
              <p className="mt-3 max-w-2xl text-body-lg text-stone-500">
                {t('featured.subhead')}
              </p>
            </div>
          </div>
          <ProductGrid
            products={featured}
            locale={locale}
            columns={3}
            className="mt-10"
          />
          <div className="mt-10 flex justify-end">
            <Link
              href={`${base}/produits`}
              className="inline-flex items-center gap-1 text-body-md font-medium text-ink-950 hover:underline focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
            >
              {t('featured.viewAll')}
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
          </div>
        </Container>
      </Section>

      {/* 5. Industry grid */}
      <Section tone="warm">
        <Container size="2xl">
          <h2 className="text-title-xl text-ink-950">
            {t('industries.heading')}
          </h2>
          <IndustryGrid
            industries={industries}
            locale={locale}
            className="mt-10"
          />
        </Container>
      </Section>

      {/* 6. How it works */}
      <HowItWorks locale={locale} />

      {/* 7. Client logo marquee */}
      <Section tone="default">
        <Container size="2xl">
          <h2 className="text-center text-title-lg text-ink-950">
            {t('clients.heading')}
          </h2>
          <ClientLogoMarquee
            logos={clientLogos}
            locale={locale}
            className="mt-10"
          />
        </Container>
      </Section>

      {/* 8. Reviews */}
      <Section tone="warm">
        <Container size="2xl">
          <div className="md:max-w-2xl">
            <h2 className="text-title-xl text-ink-950">
              {t('reviews.heading')}
            </h2>
            <p className="mt-3 text-body-lg text-stone-500">{reviewSubhead}</p>
          </div>
          <ReviewGrid
            reviews={featuredReviews}
            locale={locale}
            className="mt-10"
          />
          <div className="mt-10 flex justify-end">
            <Link
              href={`${base}/avis`}
              className="inline-flex items-center gap-1 text-body-md font-medium text-ink-950 hover:underline focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
            >
              {t('reviews.viewAll')}
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
          </div>
        </Container>
      </Section>

      {/* 9. Discovery kit teaser */}
      <DiscoveryKitTeaser locale={locale} />

      {/* 10. FAQ */}
      <Section tone="default">
        <Container size="xl">
          <h2 className="text-title-xl text-ink-950">{t('faq.heading')}</h2>
          <FaqAccordion
            items={faqItems}
            locale={locale}
            className="mt-8"
          />
        </Container>
      </Section>

      {/* 11. Final CTA */}
      <HeroBlock
        tone="ink"
        headline={t('finalCta.heading')}
        primaryCta={{ label: t('finalCta.cta.1'), href: `${base}/produits` }}
        secondaryCta={{
          label: t('finalCta.cta.2'),
          href: `${base}/soumission`,
        }}
      />
    </>
  );
}
