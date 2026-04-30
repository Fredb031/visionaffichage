import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { Container } from '@/components/Container';
import { Section } from '@/components/Section';
import { HeroSplit } from '@/components/sections/HeroSplit';
import { IndustryPills } from '@/components/sections/IndustryPills';
import { IndustryRouteCards } from '@/components/sections/IndustryRouteCards';
import { BestCategories } from '@/components/sections/BestCategories';
import { HowItWorks } from '@/components/sections/HowItWorks';
import { ClientLogoMarquee } from '@/components/sections/ClientLogoMarquee';
import { ReviewGrid } from '@/components/sections/ReviewGrid';
import { DiscoveryKitTeaser } from '@/components/sections/DiscoveryKitTeaser';
import { FaqAccordion } from '@/components/sections/FaqAccordion';
import { HeroBlock } from '@/components/sections/HeroBlock';
import { FaqJsonLd } from '@/components/seo/FaqJsonLd';

import { industries } from '@/lib/industries';
import { homeCategories } from '@/lib/categories';
import { reviews, getOverallAverage } from '@/lib/reviews';
import { clientLogos } from '@/lib/clients';
import { getAlternates, getOgImageUrl } from '@/lib/seo';
import { siteConfig } from '@/lib/site';
import type { Locale } from '@/i18n/routing';
import type { TrustBulletItem } from '@/components/sections/TrustBullets';
import type { HeroSplitCollagePanel } from '@/components/sections/HeroSplit';

function isLocale(value: string): value is Locale {
  return value === 'fr-ca' || value === 'en-ca';
}

type Props = {
  params: Promise<{ locale: string }>;
};

const FAQ_KEYS = ['1', '2', '3', '4', '5'] as const;
const HERO_TRUST_KEYS = ['1', '2', '3', '4'] as const;
const HERO_COLLAGE_IDS = ['1', '2', '3', '4'] as const;

const HERO_TRUST_ICONS: Record<
  (typeof HERO_TRUST_KEYS)[number],
  TrustBulletItem['icon']
> = {
  '1': 'Clock',
  '2': 'ShieldCheck',
  '3': 'MessageCircle',
  '4': 'Star',
};

const HERO_COLLAGE_ROTATIONS: Record<
  (typeof HERO_COLLAGE_IDS)[number],
  number
> = {
  '1': -3,
  '2': 5,
  '3': 2,
  '4': -4,
};

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

  const ogTitle = isFr
    ? "Vêtements d'entreprise au Québec"
    : 'Company apparel in Québec';
  const ogSubtitle = isFr
    ? 'Broderie + sérigraphie · 5 jours ouvrables · 500+ équipes québécoises'
    : 'Embroidery + screen print · 5 business days · 500+ Québec teams';
  const ogImage = getOgImageUrl(ogTitle, ogSubtitle);

  return {
    title,
    description,
    alternates: getAlternates('/', locale),
    openGraph: {
      type: 'website',
      locale: isFr ? 'fr_CA' : 'en_CA',
      title,
      description,
      siteName: siteConfig.name,
      url: `${siteConfig.url}/${locale}`,
      images: [{ url: ogImage, width: 1200, height: 630, alt: ogTitle }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'home' });

  const base = `/${locale}`;
  const featuredReviews = reviews.slice(0, 3);
  const overall = getOverallAverage();
  const overallAvgFormatted =
    locale === 'fr-ca'
      ? overall.average.toString().replace('.', ',')
      : overall.average.toString();

  const faqItems = FAQ_KEYS.map((key) => ({
    q: t(`faq.items.${key}.q`),
    a: t(`faq.items.${key}.a`),
  }));

  const faqJsonLdItems = faqItems.map((item) => ({
    question: item.q,
    answer: item.a,
  }));

  const heroTrustItems: TrustBulletItem[] = HERO_TRUST_KEYS.map((key) => ({
    icon: HERO_TRUST_ICONS[key],
    label: t(`hero.trust.items.${key}`),
  }));

  const heroCollage: HeroSplitCollagePanel[] = HERO_COLLAGE_IDS.map((id) => ({
    id,
    imageSrc: `/placeholders/hero/${id}.svg`,
    alt: t(`hero.collage.alt.${id}`),
    rotation: HERO_COLLAGE_ROTATIONS[id],
  }));

  const priceFromLabel = (formatted: string): string =>
    t('categories.priceFromLabel', { price: formatted });

  return (
    <>
      <FaqJsonLd items={faqJsonLdItems} />

      {/* 1. Hero split (ink) */}
      <HeroSplit
        eyebrow={t('hero.eyebrow')}
        headline={t('hero.headline')}
        subhead={t('hero.subhead')}
        primaryCta={{
          label: t('hero.ctaPrimary'),
          href: `${base}/produits`,
        }}
        secondaryCta={{
          label: t('hero.ctaSecondary'),
          href: `${base}/soumission`,
        }}
        trustItems={heroTrustItems}
        collagePanels={heroCollage}
      />

      {/* 2. Industry pills (canvas-050) */}
      <IndustryPills
        industries={industries}
        locale={locale}
        heading={t('industries.pillsHeading')}
      />

      {/* 3. 3 strategic CTA route cards (sand-100) */}
      <IndustryRouteCards locale={locale} />

      {/* 4. Best categories (canvas-000) */}
      <BestCategories
        categories={homeCategories}
        locale={locale}
        heading={t('categories.heading')}
        subhead={t('categories.subhead')}
        viewLabel={t('categories.viewLabel')}
        viewAllLabel={t('categories.viewAllLabel')}
        priceFromLabel={priceFromLabel}
      />

      {/* 5. How it works (warm) */}
      <HowItWorks locale={locale} />

      {/* 6. Client logo marquee (default) */}
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

      {/* 7. Reviews (warm) */}
      <Section tone="warm">
        <Container size="2xl">
          <div className="md:max-w-2xl">
            <h2 className="text-title-xl text-ink-950">
              {t('reviews.heading')}
            </h2>
            <p className="mt-3 text-body-lg text-stone-600">
              {t('reviews.subhead', {
                avg: overallAvgFormatted,
                count: overall.count,
              })}
            </p>
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

      {/* 8. Discovery kit teaser (sand-100) */}
      <DiscoveryKitTeaser locale={locale} />

      {/* 9. FAQ (default) — 5 items */}
      <Section tone="default">
        <Container size="xl">
          <h2 className="text-title-xl text-ink-950">{t('faq.heading')}</h2>
          <FaqAccordion items={faqItems} locale={locale} className="mt-8" />
        </Container>
      </Section>

      {/* 10. Final CTA (ink) */}
      <HeroBlock
        tone="ink"
        headline={t('finalCta.heading')}
        subhead={t('finalCta.subhead')}
        primaryCta={{
          label: t('finalCta.ctaPrimary'),
          href: `${base}/produits`,
        }}
        secondaryCta={{
          label: t('finalCta.ctaSecondary'),
          href: `${base}/soumission`,
        }}
      />
    </>
  );
}
