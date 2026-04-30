import type { Metadata } from 'next';
import Link from 'next/link';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { Container } from '@/components/Container';
import { Section } from '@/components/Section';
import { Button } from '@/components/Button';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { HeroBlock } from '@/components/sections/HeroBlock';
import { ReviewGrid } from '@/components/sections/ReviewGrid';

import { reviews, getOverallAverage } from '@/lib/reviews';
import { industries } from '@/lib/industries';
import { getAlternates, getOgImageUrl } from '@/lib/seo';
import { siteConfig } from '@/lib/site';
import { routing, type Locale } from '@/i18n/routing';

function isLocale(value: string): value is Locale {
  return value === 'fr-ca' || value === 'en-ca';
}

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type RatingFilter = 'all' | 'five' | 'four' | 'threeUp' | 'twoUp';

const RATING_FILTERS: RatingFilter[] = ['all', 'five', 'four', 'threeUp', 'twoUp'];

function isRatingFilter(v: string | undefined): v is RatingFilter {
  return !!v && (RATING_FILTERS as string[]).includes(v);
}

function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const isFr = locale === 'fr-ca';
  const title = isFr
    ? 'Avis clients · Vision Affichage'
    : 'Customer reviews · Vision Affichage';
  const description = isFr
    ? 'Évaluations Google et témoignages clients de partout au Québec.'
    : 'Google ratings and customer testimonials from across Quebec.';

  const ogTitle = isFr ? 'Avis clients vérifiés' : 'Verified customer reviews';
  const ogSubtitle = isFr
    ? 'Témoignages Google · 500+ équipes québécoises servies depuis Blainville'
    : 'Google testimonials · 500+ Québec teams served from Blainville';
  const ogImage = getOgImageUrl(ogTitle, ogSubtitle);

  return {
    title,
    description,
    alternates: getAlternates('/avis', locale),
    openGraph: {
      type: 'website',
      locale: isFr ? 'fr_CA' : 'en_CA',
      title,
      description,
      siteName: siteConfig.name,
      url: `${siteConfig.url}/${locale}/avis`,
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

export default async function AvisPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const sp = await searchParams;
  const ratingParam = readParam(sp, 'rating');
  const industryParam = readParam(sp, 'industry');

  const rating: RatingFilter = isRatingFilter(ratingParam) ? ratingParam : 'all';
  const industry =
    industryParam && industryParam !== 'all' ? industryParam : 'all';

  const t = await getTranslations({ locale, namespace: 'reviews' });
  const tBc = await getTranslations({ locale, namespace: 'breadcrumbs' });

  const base = `/${locale}`;
  const overall = getOverallAverage();

  const filtered = reviews.filter((r) => {
    if (industry !== 'all' && r.industry !== industry) return false;
    switch (rating) {
      case 'five':
        return r.rating === 5;
      case 'four':
        return r.rating === 4;
      case 'threeUp':
        return r.rating >= 3;
      case 'twoUp':
        return r.rating >= 2;
      case 'all':
      default:
        return true;
    }
  });

  function buildHref(nextRating: RatingFilter, nextIndustry: string): string {
    const qp = new URLSearchParams();
    if (nextRating !== 'all') qp.set('rating', nextRating);
    if (nextIndustry !== 'all') qp.set('industry', nextIndustry);
    const qs = qp.toString();
    return qs ? `${base}/avis?${qs}` : `${base}/avis`;
  }

  const ratingLabels: Record<RatingFilter, string> = {
    all: t('filters.all'),
    five: t('ratings.five'),
    four: t('ratings.four'),
    threeUp: t('ratings.threeUp'),
    twoUp: t('ratings.twoUp'),
  };

  const chipBase =
    'inline-flex items-center rounded-full border px-4 h-9 text-body-sm transition-colors';
  const chipOn = 'bg-ink-950 text-canvas-000 border-ink-950';
  const chipOff =
    'bg-canvas-000 text-ink-950 border-sand-300 hover:bg-sand-100';

  const avgFormatted = overall.average.toLocaleString(
    locale === 'fr-ca' ? 'fr-CA' : 'en-CA',
    { minimumFractionDigits: 1, maximumFractionDigits: 1 },
  );

  return (
    <>
      <Section tone="default" className="py-8 md:py-10">
        <Container size="2xl">
          <Breadcrumbs
            locale={locale}
            items={[
              { label: tBc('home'), href: base },
              { label: t('breadcrumb.label') },
            ]}
          />
        </Container>
      </Section>

      <HeroBlock
        tone="warm"
        eyebrow={t('hero.eyebrow')}
        headline={t('hero.headline')}
        subhead={t('hero.subhead', {
          avg: avgFormatted,
          count: overall.count,
        })}
        primaryCta={{
          label: t('submitCta.button'),
          href: 'mailto:contact@visionaffichage.com?subject=Avis',
        }}
        secondaryCta={{
          label:
            locale === 'fr-ca' ? 'Demander une soumission' : 'Request a quote',
          href: `${base}/soumission`,
        }}
      />

      <Section tone="default" className="py-10 md:py-14">
        <Container size="2xl">
          <div className="space-y-6">
            <div>
              <p className="text-meta-xs uppercase tracking-wider text-stone-600">
                {t('filters.rating')}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {RATING_FILTERS.map((r) => {
                  const active = rating === r;
                  return (
                    <Link
                      key={r}
                      href={buildHref(r, industry)}
                      className={`${chipBase} ${active ? chipOn : chipOff}`}
                      aria-pressed={active}
                    >
                      {ratingLabels[r]}
                    </Link>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-meta-xs uppercase tracking-wider text-stone-600">
                {t('filters.industry')}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={buildHref(rating, 'all')}
                  className={`${chipBase} ${
                    industry === 'all' ? chipOn : chipOff
                  }`}
                  aria-pressed={industry === 'all'}
                >
                  {t('filters.all')}
                </Link>
                {industries.map((ind) => {
                  const active = industry === ind.slug;
                  const label = t(`industries.${ind.slug}`);
                  return (
                    <Link
                      key={ind.slug}
                      href={buildHref(rating, ind.slug)}
                      className={`${chipBase} ${active ? chipOn : chipOff}`}
                      aria-pressed={active}
                    >
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          {filtered.length > 0 ? (
            <ReviewGrid
              reviews={filtered}
              locale={locale}
              className="mt-10"
            />
          ) : (
            <p className="mt-10 rounded-lg bg-sand-100 p-6 text-body-md text-stone-600">
              {locale === 'fr-ca'
                ? 'Aucun avis ne correspond à ces filtres.'
                : 'No reviews match these filters.'}
            </p>
          )}
        </Container>
      </Section>

      <Section tone="sand">
        <Container size="2xl">
          <div className="grid gap-10 md:grid-cols-12 md:items-center">
            <div className="md:col-span-7">
              <h2 className="text-display-md text-ink-950 md:text-display-lg">
                {t('submitCta.title')}
              </h2>
              <p className="mt-4 max-w-xl text-body-lg text-stone-600">
                {t('submitCta.body')}
              </p>
            </div>
            <div className="md:col-span-5 md:flex md:justify-end">
              <Button
                href="mailto:contact@visionaffichage.com?subject=Avis"
                variant="primary"
                size="lg"
              >
                {t('submitCta.button')}
              </Button>
            </div>
          </div>
        </Container>
      </Section>

      <Section tone="default" className="py-12 md:py-16">
        <Container size="2xl">
          <h2 className="text-display-sm text-ink-950 md:text-display-md">
            {t('external.heading')}
          </h2>
          <ul className="mt-6 flex flex-wrap gap-3">
            <li>
              <a
                href="https://www.google.com/search?q=Vision+Affichage+Blainville"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full border border-sand-300 bg-canvas-000 px-4 h-10 text-body-sm text-ink-950 hover:bg-sand-100"
              >
                {t('external.google')}
              </a>
            </li>
            <li>
              <a
                href="https://www.linkedin.com/company/vision-affichage"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full border border-sand-300 bg-canvas-000 px-4 h-10 text-body-sm text-ink-950 hover:bg-sand-100"
              >
                {t('external.linkedin')}
              </a>
            </li>
            <li>
              <a
                href="https://www.instagram.com/visionaffichage"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full border border-sand-300 bg-canvas-000 px-4 h-10 text-body-sm text-ink-950 hover:bg-sand-100"
              >
                {t('external.instagram')}
              </a>
            </li>
          </ul>
        </Container>
      </Section>
    </>
  );
}
