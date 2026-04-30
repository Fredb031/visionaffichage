import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { ArrowRight, Check } from 'lucide-react';

import { Container } from '@/components/Container';
import { Section } from '@/components/Section';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { ProductGallery } from '@/components/pdp/ProductGallery';
import { BadgeRow } from '@/components/product/BadgeRow';
import { StarRating } from '@/components/product/StarRating';
import { ProductGrid } from '@/components/product/ProductGrid';
import { ReviewGrid } from '@/components/sections/ReviewGrid';
import { FaqAccordion } from '@/components/sections/FaqAccordion';
import { HeroBlock } from '@/components/sections/HeroBlock';
import { ProductJsonLd } from '@/components/seo/ProductJsonLd';
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd';
import { FaqJsonLd } from '@/components/seo/FaqJsonLd';

import { products, getProductBySlug } from '@/lib/products';
import { getReviewsForProduct, getAverageRating } from '@/lib/reviews';
import { getAlternates, BASE_URL } from '@/lib/seo';
import { siteConfig } from '@/lib/site';
import { formatCAD } from '@/lib/format';
import { routing, type Locale } from '@/i18n/routing';
import type { Product, ProductCategory } from '@/lib/types';

import { PdpClient } from './PdpClient';

function isLocale(value: string): value is Locale {
  return value === 'fr-ca' || value === 'en-ca';
}

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

const FAQ_KEYS = ['1', '2', '3', '4'] as const;

const FABRIC_WEIGHT: Record<ProductCategory, { 'fr-ca': string; 'en-ca': string }> = {
  tshirt: { 'fr-ca': '5,5 à 6 oz · coton filé', 'en-ca': '5.5 to 6 oz · ring-spun cotton' },
  polo: { 'fr-ca': '6 oz · polyester performance', 'en-ca': '6 oz · performance polyester' },
  longsleeve: { 'fr-ca': '5 à 7 oz · mélange coton-poly', 'en-ca': '5 to 7 oz · cotton-poly blend' },
  hoodie: { 'fr-ca': '8,5 oz · mélange 50/50', 'en-ca': '8.5 oz · 50/50 blend' },
  jacket: { 'fr-ca': 'Coquille souple 3 couches', 'en-ca': '3-layer softshell' },
  youth: { 'fr-ca': '5,5 oz · coton filé jeunesse', 'en-ca': '5.5 oz · youth ring-spun cotton' },
};

const FIT: Record<ProductCategory, { 'fr-ca': string; 'en-ca': string }> = {
  tshirt: { 'fr-ca': 'Coupe régulière unisexe', 'en-ca': 'Regular unisex fit' },
  polo: { 'fr-ca': 'Coupe galbée à la taille', 'en-ca': 'Shaped fit at the waist' },
  longsleeve: { 'fr-ca': 'Coupe régulière, manches ajustables', 'en-ca': 'Regular fit, adjustable cuffs' },
  hoodie: { 'fr-ca': 'Coupe ample', 'en-ca': 'Relaxed fit' },
  jacket: { 'fr-ca': 'Coupe athlétique', 'en-ca': 'Athletic fit' },
  youth: { 'fr-ca': 'Coupe ajustée jeunesse', 'en-ca': 'Youth tailored fit' },
};

const DECORATION_LABEL: Record<'embroidery' | 'screenprint' | 'dtg', { 'fr-ca': string; 'en-ca': string }> = {
  embroidery: { 'fr-ca': 'Broderie', 'en-ca': 'Embroidery' },
  screenprint: { 'fr-ca': 'Sérigraphie', 'en-ca': 'Screen print' },
  dtg: { 'fr-ca': 'Impression directe (DTG)', 'en-ca': 'DTG (direct-to-garment)' },
};

type SizeRow = { size: string; chest: string; length: string };

function buildSizeMatrix(p: Product): SizeRow[] {
  // Plausible chest/length placeholders for v1 PDP.
  const data: Record<string, [string, string]> = {
    XS: ['34"', '27"'],
    S: ['36"', '28"'],
    M: ['40"', '29"'],
    L: ['44"', '30"'],
    XL: ['48"', '31"'],
    '2XL': ['52"', '32"'],
    '3XL': ['56"', '33"'],
    '4XL': ['60"', '34"'],
    Unique: ['—', '—'],
    'XS-Y': ['28"', '20"'],
    'S-Y': ['30"', '22"'],
    'M-Y': ['32"', '23"'],
    'L-Y': ['34"', '24"'],
    'XL-Y': ['36"', '25"'],
  };
  return p.sizes.map((s) => {
    const tuple = data[s] ?? ['—', '—'];
    return { size: s, chest: tuple[0], length: tuple[1] };
  });
}

export function generateStaticParams() {
  const out: { locale: string; slug: string }[] = [];
  for (const locale of routing.locales) {
    for (const p of products) {
      out.push({ locale, slug: p.slug });
    }
  }
  return out;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const product = getProductBySlug(slug);
  if (!product) return {};

  const isFr = locale === 'fr-ca';
  const title = `${product.title[locale]} · ${siteConfig.name}`;
  const trail = isFr ? 'Production 5 jours ouvrables.' : '5-business-day production.';
  const description = `${product.identityHook[locale]} · ${trail}`.slice(0, 160);
  const path = `/produits/${product.slug}`;
  const image = `${BASE_URL}/placeholders/products/${product.gallery?.[0] ?? product.slug}.svg`;

  return {
    title,
    description,
    alternates: getAlternates(path, locale),
    openGraph: {
      type: 'website',
      locale: isFr ? 'fr_CA' : 'en_CA',
      title,
      description,
      siteName: siteConfig.name,
      url: `${siteConfig.url}/${locale}${path}`,
      images: [{ url: image, alt: product.title[locale] }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const product = getProductBySlug(slug);
  if (!product) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'pdp' });

  const base = `/${locale}`;
  const productPath = `/produits/${product.slug}`;
  const productUrl = `${base}${productPath}`;
  const rating = getAverageRating(product.styleCode);
  const productReviews = getReviewsForProduct(product.styleCode);
  const related = products
    .filter((p) => p.category === product.category && p.slug !== product.slug)
    .slice(0, 3);

  const categoryLabel = t(`category.${product.category}`);

  const breadcrumbItems = [
    { label: t('breadcrumb.home'), href: base },
    { label: t('breadcrumb.products'), href: `${base}/produits` },
    {
      label: categoryLabel,
      href: `${base}/produits?category=${product.category}`,
    },
    { label: product.title[locale] },
  ];

  const breadcrumbJsonLd = breadcrumbItems.map((item) => ({
    name: item.label,
    url: item.href ? `/${locale}${item.href.replace(`/${locale}`, '')}` : undefined,
  }));

  const faqItems = FAQ_KEYS.map((key) => ({
    q: t(`faq.${key}.q`),
    a: t(`faq.${key}.a`),
  }));

  const faqJsonLdItems = faqItems.map((item) => ({
    question: item.q,
    answer: item.a,
  }));

  const sizeMatrix = buildSizeMatrix(product);

  const fabricWeight = FABRIC_WEIGHT[product.category][locale];
  const fit = FIT[product.category][locale];
  const decorations = (product.decorationOptions ?? [])
    .map((d) => DECORATION_LABEL[d][locale])
    .join(' · ');

  const ratingsAnchor = '#reviews';

  const trustItems = [
    t('trust.logoApproved'),
    t('trust.production'),
    t('trust.frenchService'),
  ];

  return (
    <>
      <ProductJsonLd product={product} locale={locale} />
      <BreadcrumbJsonLd items={breadcrumbJsonLd} />
      <FaqJsonLd items={faqJsonLdItems} />

      {/* Two-column block (gallery + info ladder) */}
      <Container size="xl" className="py-8 md:py-12">
        <Breadcrumbs items={breadcrumbItems} locale={locale} className="mb-6" />

        <div className="grid grid-cols-1 gap-8 md:grid-cols-12 md:gap-12">
          {/* LEFT — gallery */}
          <div className="md:col-span-7">
            <ProductGallery
              slug={product.slug}
              title={product.title[locale]}
              gallery={product.gallery}
              locale={locale}
            />
          </div>

          {/* RIGHT — info ladder */}
          <div className="md:col-span-5">
            <div className="flex flex-col gap-6">
              {/* 1. Title */}
              <h1 className="text-display-lg text-ink-950">
                {product.title[locale]}
              </h1>

              {/* 2. SKU subtitle */}
              <p className="text-meta-xs uppercase tracking-wider text-stone-600">
                {locale === 'fr-ca' ? 'Réf. ' : 'Ref. '}
                {product.styleCode.toUpperCase()}
              </p>

              {/* 3. Identity hook */}
              <blockquote className="border-l-4 border-slate-700 bg-canvas-050 px-4 py-3">
                <p className="text-meta-xs uppercase tracking-wider text-stone-600">
                  {t('identityHookLabel')}
                </p>
                <p className="mt-1 text-body-lg italic text-ink-950">
                  {product.identityHook[locale]}
                </p>
              </blockquote>

              {/* 4. Star rating */}
              {rating ? (
                <Link
                  href={ratingsAnchor}
                  className="inline-flex items-center gap-2 text-body-sm focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 hover:underline"
                >
                  <StarRating
                    rating={rating.average}
                    count={rating.count}
                    locale={locale}
                    size="sm"
                  />
                  <span className="sr-only">— {t('ratingsLabel')}</span>
                </Link>
              ) : null}

              {/* 5. Badge row */}
              {product.badgeKeys && product.badgeKeys.length > 0 ? (
                <BadgeRow badges={product.badgeKeys} locale={locale} max={4} />
              ) : null}

              {/* 6. Price */}
              <div>
                <p className="text-title-lg text-ink-950">
                  {t('price.from', {
                    price: formatCAD(product.priceFromCents, locale),
                  })}
                </p>
                <p className="mt-1 text-body-sm text-stone-600">
                  {product.decorationDefault === 'embroidery'
                    ? t('price.embroidered')
                    : t('price.perUnit')}
                </p>
              </div>

              {/* 7. Min qty note */}
              <p
                className="text-body-sm text-slate-700"
                title={t('minQty.tooltip')}
              >
                {t('minQty.label', { qty: product.minQuantity })}
              </p>

              {/* 8-13: client-side picker / qty / CTA */}
              <PdpClient product={product} locale={locale} />

              {/* 14. Trust strip */}
              <ul className="grid grid-cols-1 gap-2 border-t border-sand-300 pt-4 sm:grid-cols-3">
                {trustItems.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-body-sm text-slate-700"
                  >
                    <Check
                      aria-hidden
                      className="mt-0.5 h-4 w-4 shrink-0 text-success-700"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Container>

      {/* 15. Tabs/accordions: description, specs, care, shipping */}
      <Section tone="warm">
        <Container size="xl">
          <div className="grid gap-10 md:grid-cols-12">
            <div className="md:col-span-4">
              <h2 className="text-title-xl text-ink-950">
                {t('tabs.description')}
              </h2>
            </div>
            <div className="md:col-span-8">
              <FaqAccordion
                items={[
                  { q: t('tabs.description'), a: product.description[locale] },
                  {
                    q: t('tabs.specs'),
                    a: `${t('specs.fabricWeight')} : ${fabricWeight}\n${t('specs.fit')} : ${fit}\n${t('specs.decorationOptions')} : ${decorations || '—'}`,
                  },
                  {
                    q: t('tabs.care'),
                    a:
                      product.careInstructions?.[locale] ??
                      (locale === 'fr-ca'
                        ? "Lavage à la machine à l'eau froide. Sécher à basse température."
                        : 'Machine wash cold. Tumble dry low.'),
                  },
                  {
                    q: t('tabs.shipping'),
                    a: `${t('shipping.leadTime')}\n\n${t('shipping.zones')}`,
                  },
                ]}
                locale={locale}
              />
            </div>
          </div>

          {/* 16. Size matrix */}
          <div className="mt-16">
            <h3 className="text-title-lg text-ink-950">
              {t('sizeMatrix.heading')}
            </h3>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border-collapse text-body-sm">
                <thead>
                  <tr className="border-b border-sand-300 text-left text-meta-xs uppercase tracking-wider text-stone-600">
                    <th scope="col" className="py-3 pr-4">
                      {t('sizeMatrix.size')}
                    </th>
                    <th scope="col" className="py-3 pr-4">
                      {t('sizeMatrix.chest')}
                    </th>
                    <th scope="col" className="py-3">
                      {t('sizeMatrix.length')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sizeMatrix.map((row) => (
                    <tr
                      key={row.size}
                      className="border-b border-sand-300/60 text-ink-950"
                    >
                      <td className="py-3 pr-4 font-medium">{row.size}</td>
                      <td className="py-3 pr-4">{row.chest}</td>
                      <td className="py-3">{row.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Container>
      </Section>

      {/* 17. Reviews */}
      <Section tone="default" id="reviews">
        <Container size="xl">
          <div className="md:max-w-2xl">
            <h2 className="text-title-xl text-ink-950">
              {t('reviews.heading')}
            </h2>
            {rating ? (
              <p className="mt-3 text-body-lg text-stone-600">
                <StarRating
                  rating={rating.average}
                  count={rating.count}
                  locale={locale}
                  size="md"
                />
              </p>
            ) : null}
          </div>
          {productReviews.length > 0 ? (
            <ReviewGrid
              reviews={productReviews}
              locale={locale}
              className="mt-10"
            />
          ) : (
            <p className="mt-10 rounded-md border border-sand-300 bg-canvas-050 p-6 text-body-md text-stone-600">
              {t('reviews.empty')}
            </p>
          )}
        </Container>
      </Section>

      {/* 18. Related products */}
      {related.length > 0 ? (
        <Section tone="warm">
          <Container size="xl">
            <h2 className="text-title-xl text-ink-950">
              {t('related.heading')}
            </h2>
            <ProductGrid
              products={related}
              locale={locale}
              columns={3}
              className="mt-10"
            />
            <div className="mt-10 flex justify-end">
              <Link
                href={`${base}/produits`}
                className="inline-flex items-center gap-1 text-body-md font-medium text-ink-950 hover:underline focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
              >
                {t('breadcrumb.products')}
                <ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
            </div>
          </Container>
        </Section>
      ) : null}

      {/* 19. Product FAQ */}
      <Section tone="default">
        <Container size="xl">
          <h2 className="text-title-xl text-ink-950">
            {locale === 'fr-ca' ? 'Questions fréquentes' : 'Frequently asked'}
          </h2>
          <FaqAccordion items={faqItems} locale={locale} className="mt-8" />
        </Container>
      </Section>

      {/* 20. Final CTA */}
      <HeroBlock
        tone="ink"
        headline={t('finalCta.heading')}
        subhead={t('finalCta.subhead')}
        primaryCta={{
          label: t('cta.addToCart'),
          href: productUrl,
        }}
        secondaryCta={{
          label: t('cta.quote.label'),
          href: `${base}/soumission`,
        }}
      />
    </>
  );
}
