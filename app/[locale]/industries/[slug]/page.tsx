import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';

import { Container } from '@/components/Container';
import { Section } from '@/components/Section';
import { Button } from '@/components/Button';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { TrustStrip } from '@/components/sections/TrustStrip';
import { FaqAccordion } from '@/components/sections/FaqAccordion';
import { ProductGrid } from '@/components/product/ProductGrid';
import { FaqJsonLd } from '@/components/seo/FaqJsonLd';
import { Hreflang } from '@/components/Hreflang';

import { industries } from '@/lib/industries';
import { getProductByStyleCode } from '@/lib/products';
import { getAlternates } from '@/lib/seo';
import { siteConfig } from '@/lib/site';
import { routing, type Locale } from '@/i18n/routing';
import type { Industry, Product } from '@/lib/types';

function isLocale(value: string): value is Locale {
  return value === 'fr-ca' || value === 'en-ca';
}

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export function generateStaticParams() {
  const out: { locale: Locale; slug: string }[] = [];
  for (const locale of routing.locales) {
    for (const ind of industries) {
      out.push({ locale, slug: ind.slug });
    }
  }
  return out;
}

const FAQ_KEYS = ['1', '2', '3', '4'] as const;

function recommendedProducts(industry: Industry): Product[] {
  const out: Product[] = [];
  for (const code of industry.keyProducts) {
    const found = getProductByStyleCode(code);
    if (found) out.push(found);
  }
  return out.slice(0, 5);
}

const caseStudies: Record<
  string,
  { quote: { 'fr-ca': string; 'en-ca': string }; attribution: { 'fr-ca': string; 'en-ca': string } }
> = {
  construction: {
    quote: {
      'fr-ca':
        "Cinq hivers, deux générations de gars, le logo de Vision Affichage tient encore. On a arrêté de chercher ailleurs.",
      'en-ca':
        'Five winters, two generations of crew, and the Vision Affichage logo still holds. We stopped looking elsewhere.',
    },
    attribution: {
      'fr-ca': 'Surintendant, entreprise de coffrage, Laval',
      'en-ca': 'Superintendent, formwork contractor, Laval',
    },
  },
  paysagement: {
    quote: {
      'fr-ca':
        "L'équipe est reconnaissable de la rue. Le client appelle pour demander si on est bien là — ça nous fait gagner du temps.",
      'en-ca':
        "The crew is recognizable from the street. Customers call to confirm we're there — it saves us time.",
    },
    attribution: {
      'fr-ca': 'Propriétaire, paysagiste, Rive-Sud',
      'en-ca': 'Owner, landscaper, South Shore',
    },
  },
  restauration: {
    quote: {
      'fr-ca':
        "Cuisine, salle, bar : trois pièces différentes, une seule identité. Mes clients sentent que c'est bien orchestré.",
      'en-ca':
        'Kitchen, dining room, bar: three different pieces, one identity. Customers feel the polish.',
    },
    attribution: {
      'fr-ca': 'Restaurateur, bistro de quartier, Montréal',
      'en-ca': 'Restaurateur, neighborhood bistro, Montréal',
    },
  },
  demenagement: {
    quote: {
      'fr-ca':
        "Mes camions sont mes affiches publicitaires. Mes gars aussi. La broderie sur l'épaule, c'est ce qui ferme la vente.",
      'en-ca':
        'My trucks are my billboards. So are my movers. Embroidery on the shoulder is what closes the sale.',
    },
    attribution: {
      'fr-ca': 'Directeur, compagnie de déménagement, Québec',
      'en-ca': 'Director, moving company, Québec City',
    },
  },
  metiers: {
    quote: {
      'fr-ca':
        "Quand je sors de la van, le client voit un pro avant que je dise un mot. Ça change le ton de la conversation.",
      'en-ca':
        'When I step out of the van, the customer sees a pro before I say a word. It changes the conversation.',
    },
    attribution: {
      'fr-ca': 'Maître plombier, Laurentides',
      'en-ca': 'Master plumber, Laurentides',
    },
  },
  bureau: {
    quote: {
      'fr-ca':
        "On a habillé toute l'équipe pour le salon. Quatre couleurs, deux logos, une seule commande. Tout est arrivé à temps.",
      'en-ca':
        'We outfitted the whole team for the trade show. Four colors, two logos, one order. Everything arrived on time.',
    },
    attribution: {
      'fr-ca': 'Directrice marketing, PME industrielle, Laval',
      'en-ca': 'Marketing director, industrial SMB, Laval',
    },
  },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const industry = industries.find((i) => i.slug === slug);
  if (!industry) return {};

  const t = await getTranslations({ locale, namespace: 'industry' });
  const isFr = locale === 'fr-ca';
  const titleName = industry.name[locale];
  const title = `${t('metaTitlePrefix')} ${titleName.toLowerCase()} · ${siteConfig.name}`;
  const hookLine =
    industry.hookLine?.[locale] ?? industry.shortDescription[locale];
  const description = `${hookLine} ${t('metaDescriptionSuffix')}`;

  return {
    title,
    description,
    alternates: getAlternates(`/industries/${industry.slug}`),
    openGraph: {
      type: 'website',
      locale: isFr ? 'fr_CA' : 'en_CA',
      title,
      description,
      siteName: siteConfig.name,
      url: `${siteConfig.url}/${locale}/industries/${industry.slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function IndustryPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const industry = industries.find((i) => i.slug === slug);
  if (!industry) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'industry' });
  const tBc = await getTranslations({ locale, namespace: 'breadcrumbs' });

  const base = `/${locale}`;
  const titleName = industry.name[locale];
  const hookLine =
    industry.hookLine?.[locale] ?? industry.shortDescription[locale];
  const recommended = recommendedProducts(industry);
  const caseStudy = caseStudies[industry.slug];

  const faqItems = FAQ_KEYS.map((key) => ({
    q: t(`faq.${key}.q`),
    a: t(`faq.${key}.a`),
  }));
  const faqJsonLdItems = faqItems.map((item) => ({
    question: item.q,
    answer: item.a,
  }));

  const otherIndustries = industries.filter((i) => i.slug !== industry.slug);

  return (
    <>
      <Hreflang pathWithoutLocale={`/industries/${industry.slug}`} />
      <FaqJsonLd items={faqJsonLdItems} />

      <Section tone="default" className="py-8 md:py-10">
        <Container size="2xl">
          <Breadcrumbs
            locale={locale}
            items={[
              { label: tBc('home'), href: base },
              { label: t('breadcrumb'), href: `${base}/industries` },
              { label: titleName },
            ]}
          />
        </Container>
      </Section>

      {/* Industry hero */}
      <section className="bg-canvas-050 text-ink-950">
        <Container size="2xl">
          <div className="grid items-center gap-10 py-16 md:grid-cols-12 md:py-24 lg:py-28">
            <div className="md:col-span-7 lg:col-span-6">
              <p className="text-meta-xs uppercase tracking-wider text-stone-500">
                {t('breadcrumb')}
              </p>
              <h1 className="mt-6 text-display-lg text-ink-950 md:text-display-xl">
                {titleName}
              </h1>
              <p className="mt-6 max-w-xl text-body-lg text-stone-500">
                {hookLine}
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <Button href="#recommended" variant="primary" size="lg">
                  {t('ctaPrimary')}
                </Button>
                <Button href={`${base}/soumission`} variant="secondary" size="lg">
                  {t('ctaSecondary')}
                </Button>
              </div>
            </div>
            <div className="hidden md:col-span-5 md:block lg:col-span-6">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-sand-100">
                <Image
                  src={`/placeholders/industries/${industry.slug}.svg`}
                  alt=""
                  fill
                  priority
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Industry description */}
      <Section tone="default">
        <Container size="2xl">
          <div className="max-w-[68ch] space-y-6">
            <p className="text-body-lg text-stone-500">
              {industry.pitch[locale]}
            </p>
            <p className="text-body-lg text-stone-500">
              {industry.shortDescription[locale]}
            </p>
          </div>
        </Container>
      </Section>

      {/* Recommended products */}
      <Section id="recommended" tone="warm">
        <Container size="2xl">
          <div className="md:max-w-2xl">
            <h2 className="text-title-xl text-ink-950">
              {t('recommendedFor', { title: titleName })}
            </h2>
            <p className="mt-3 text-body-lg text-stone-500">
              {t('recommendedSubhead')}
            </p>
          </div>
          {recommended.length > 0 ? (
            <ProductGrid
              products={recommended}
              locale={locale}
              columns={3}
              className="mt-10"
            />
          ) : null}
          <div className="mt-10 flex justify-end">
            <Link
              href={`${base}/produits`}
              className="inline-flex items-center gap-1 text-body-md font-medium text-ink-950 hover:underline focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
            >
              {locale === 'fr-ca'
                ? 'Voir tous les produits'
                : 'View all products'}
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
          </div>
        </Container>
      </Section>

      {/* Case study */}
      {caseStudy ? (
        <Section tone="sand">
          <Container size="xl">
            <h2 className="text-title-lg text-ink-950">
              {t('caseStudyHeading')}
            </h2>
            <blockquote className="mt-6 border-l-4 border-ink-950 pl-6 italic">
              <p className="text-body-lg text-ink-950">
                « {caseStudy.quote[locale]} »
              </p>
              <footer className="mt-4 not-italic text-body-sm text-stone-500">
                — {caseStudy.attribution[locale]}
              </footer>
            </blockquote>
          </Container>
        </Section>
      ) : null}

      <TrustStrip locale={locale} variant="warm" />

      {/* Industry FAQ */}
      <Section tone="default">
        <Container size="xl">
          <h2 className="text-title-xl text-ink-950">
            {locale === 'fr-ca'
              ? 'Questions fréquentes'
              : 'Frequently asked questions'}
          </h2>
          <FaqAccordion items={faqItems} locale={locale} className="mt-8" />
        </Container>
      </Section>

      {/* Cross-industry CTA */}
      <Section tone="warm">
        <Container size="2xl">
          <div className="md:max-w-2xl">
            <h2 className="text-title-xl text-ink-950">{t('viewOthers')}</h2>
            <p className="mt-3 text-body-lg text-stone-500">
              {t('viewOthersBody')}
            </p>
          </div>
          <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {otherIndustries.map((other) => (
              <li key={other.slug}>
                <Link
                  href={`${base}/industries/${other.slug}`}
                  className="block rounded-md border border-sand-300 bg-canvas-000 px-4 py-3 text-body-md text-ink-950 hover:bg-sand-100 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
                >
                  {other.name[locale]}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-10">
            <Button href={`${base}/soumission`} variant="primary" size="lg">
              {t('fallbackCta')}
            </Button>
          </div>
        </Container>
      </Section>
    </>
  );
}
