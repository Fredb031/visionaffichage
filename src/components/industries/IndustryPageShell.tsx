import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, MapPin, Zap, Check, Star as StarIcon, Package } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { SiteFooter } from '@/components/SiteFooter';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useInView } from '@/hooks/useInView';
import { CountUp } from '@/components/CountUp';
import { PRODUCTS, PRINT_PRICE, type Product } from '@/data/products';
import { CASE_STUDIES, type CaseStudy } from '@/data/caseStudies';
import { fmtMoney } from '@/lib/format';
import { useLang } from '@/lib/langContext';
import { toWebp } from '@/lib/toWebp';

/**
 * Mega Blueprint §08.3 + Vol III §04 — shared shell for the five
 * industry SEO landing pages (/industries/<slug>). Each industry page is
 * a thin wrapper that passes its tailored copy in; the shell owns the
 * dark Vol III §04 hero (image strip + trust bar), industry stats row,
 * recommended-product grid, case-study teaser, FAQ accordion, and the
 * JSON-LD injection (FAQPage + Service). One visual tweak to the
 * industry surface lands in a single edit.
 */

export type IndustryFaqItem = { q: string; a: string };

/** Per-industry stats row — three numbers, label-pair format. */
export type IndustryStat = {
  /** Numeric value used for CountUp animation. */
  value: number;
  /** Optional suffix appended after the count-up (e.g. "+", "k+"). */
  suffix?: string;
  /** Optional override when the stat isn't numeric (e.g. "5 jours"). */
  display?: string;
  /** Short label under the number, lowercase Vol II tone. */
  label: string;
};

export interface IndustryPageShellProps {
  /** SKUs from data/products.ts to surface as recommended cards (3-4). */
  productSkus: string[];
  /** H1 + document title — same string per the brief's "exact title" rule. */
  title: string;
  /** Per-industry meta description, used for <meta name="description">. */
  metaDescription: string;
  /** Eyebrow strap above the H1 (industry name in caps). */
  eyebrow: string;
  /** Lede paragraph under the H1. */
  heroLede: string;
  /** Bullet points for the hero "what's included" strip (3-5 short items). */
  heroBullets: string[];
  /** CTA label, e.g. "Voir les produits". */
  ctaLabel: string;
  /** Optional hero image path served from /public — falls back gracefully
   *  if the asset 404s, so the page never ships a broken <img>. */
  heroImage?: string;
  /** Industry slug used to filter CASE_STUDIES for the teaser. Must match
   *  one of the keywords used inside CaseStudy.industry strings. */
  industrySlug: 'construction' | 'corporate' | 'municipalites' | 'paysagement' | 'plomberie-electricite';
  /** 3-tile stats row — specific numbers per industry (Vol II §04 spec). */
  stats: readonly [IndustryStat, IndustryStat, IndustryStat];
  /** Section heading above the recommended-product grid. */
  productsHeading: string;
  /** Sub-copy under the products heading. */
  productsSubcopy: string;
  /** Section heading above the FAQ accordion. */
  faqHeading: string;
  /** 3-4 Q&A pairs surfaced as a native <details> accordion + FAQPage JSON-LD. */
  faq: IndustryFaqItem[];
  /** Service schema serviceType — industry name in French. */
  serviceType: string;
  /** Stable dataset marker for FAQPage <script>. */
  faqLdMarker: string;
  /** Stable dataset marker for Service <script>. */
  serviceLdMarker: string;
  /** Optional override for the hero CTA href. Defaults to /devis legacy
   *  callers; new Master Prompt copy points to /boutique. */
  ctaHref?: string;
  /** Optional Tailwind override for the hero + footer CTA pill. */
  ctaClassName?: string;
  /** Optional override for the final cream-callout section heading. */
  finalHeading?: string;
  /** Optional override for the final cream-callout section sub-copy. */
  finalSubcopy?: string;
}

// Slug -> case-study industry-string keyword(s). The CASE_STUDIES dataset
// is frozen at 7df2683 (free-text industry labels); this map lets us
// match without mutating the dataset. A page with no match hides the
// teaser section entirely.
const SLUG_TO_INDUSTRY_KEYWORDS: Record<IndustryPageShellProps['industrySlug'], readonly string[]> = {
  'construction': ['construction'],
  'corporate': ['corporat', 'conseil'],
  'municipalites': ['municipal'],
  'paysagement': ['paysag'],
  'plomberie-electricite': ['plomberie', 'électricité', 'electricite'],
};

const findCaseStudyForSlug = (slug: IndustryPageShellProps['industrySlug']): CaseStudy | undefined => {
  const keywords = SLUG_TO_INDUSTRY_KEYWORDS[slug] ?? [];
  return CASE_STUDIES.find(cs => {
    const haystack = cs.industry.toLowerCase();
    return keywords.some(k => haystack.includes(k.toLowerCase()));
  });
};

// Resolve an SKU to a Product. SKUs in the catalogue are uppercase
// (S445, ATC1000); we normalize before matching so callers can write
// either case. Returns undefined for unknown SKUs — the consuming map
// filters those out so a typo doesn't render an empty card.
const findProductBySku = (sku: string): Product | undefined =>
  PRODUCTS.find(p => p.sku.toUpperCase() === sku.toUpperCase());

export function IndustryPageShell({
  productSkus,
  title,
  metaDescription,
  eyebrow,
  heroLede,
  heroBullets,
  ctaLabel,
  heroImage,
  industrySlug,
  stats,
  productsHeading,
  productsSubcopy,
  faqHeading,
  faq,
  serviceType,
  faqLdMarker,
  serviceLdMarker,
  ctaHref = '/devis',
  ctaClassName = 'bg-va-blue hover:bg-va-blue-hover text-white',
  finalHeading,
  finalSubcopy,
}: IndustryPageShellProps) {
  const { lang } = useLang();
  useDocumentTitle(title, metaDescription, {});

  // Hero image graceful fallback — if the asset 404s (industry hero
  // assets aren't yet checked into /public/industries/), hide the right
  // column entirely so the dark hero still renders cleanly without a
  // broken <img>. Mirrors the onError pattern used on product cards.
  const [heroImageOk, setHeroImageOk] = useState<boolean>(Boolean(heroImage));

  // Stats row trigger — gate CountUp on first intersection so the
  // numbers tick up in view rather than burning the animation off-screen.
  const statsRef = useRef<HTMLDivElement | null>(null);
  const statsInView = useInView(statsRef, { threshold: 0.25 });

  // Resolve SKUs once. Filter out misses so the grid never renders a
  // hollow card when a brief lists a SKU that doesn't exist locally.
  const products = useMemo(
    () =>
      productSkus
        .map(findProductBySku)
        .filter((p): p is Product => Boolean(p)),
    [productSkus],
  );

  // Case-study teaser — pick the first matching case study for this
  // industry slug. If zero matches (e.g. plomberie-electricite has no
  // dedicated study yet) the teaser section is suppressed.
  const caseStudy = useMemo(() => findCaseStudyForSlug(industrySlug), [industrySlug]);

  // FAQ accordion — same one-at-a-time native <details> dance Index.tsx
  // uses. Keyboard + screen-reader semantics come for free; the effect
  // just enforces mutual exclusion so opening one card auto-closes
  // siblings in the same group.
  const faqGroupRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = faqGroupRef.current;
    if (!root) return;
    const items = Array.from(
      root.querySelectorAll<HTMLDetailsElement>('details[data-industry-faq]'),
    );
    const onToggle = (e: Event) => {
      const target = e.target as HTMLDetailsElement;
      if (!target.open) return;
      items.forEach(d => {
        if (d !== target && d.open) d.open = false;
      });
    };
    items.forEach(d => d.addEventListener('toggle', onToggle));
    return () => items.forEach(d => d.removeEventListener('toggle', onToggle));
  }, [faq]);

  // FAQPage JSON-LD — same injection pattern Index.tsx uses for its
  // homepage FAQ. Dataset marker is per-page so two industry surfaces
  // mounted simultaneously (in tests) don't collide; cleanup removes
  // the tag on unmount so SPA nav doesn't leak schema to the next page.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const existing = document.head.querySelector(
      `script[${faqLdMarker}]`,
    );
    if (existing) return;
    const faqSchema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    };
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.setAttribute(faqLdMarker, 'true');
    el.text = JSON.stringify(faqSchema);
    document.head.appendChild(el);
    return () => {
      if (el.parentNode) document.head.removeChild(el);
    };
  }, [faq, faqLdMarker]);

  // Service JSON-LD — declares Vision Affichage as the provider of an
  // industry-scoped uniform service.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const existing = document.head.querySelector(
      `script[${serviceLdMarker}]`,
    );
    if (existing) return;
    const serviceSchema = {
      '@context': 'https://schema.org',
      '@type': 'Service',
      serviceType,
      name: title,
      description: metaDescription,
      provider: {
        '@type': 'Organization',
        name: 'Vision Affichage',
        url: 'https://visionaffichage.com',
      },
      areaServed: {
        '@type': 'AdministrativeArea',
        name: 'Québec',
      },
      ...(typeof window !== 'undefined'
        ? { url: window.location.origin + window.location.pathname }
        : {}),
    };
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.setAttribute(serviceLdMarker, 'true');
    el.text = JSON.stringify(serviceSchema);
    document.head.appendChild(el);
    return () => {
      if (el.parentNode) document.head.removeChild(el);
    };
  }, [serviceType, title, metaDescription, serviceLdMarker]);

  // Trust bar copy mirrored from the homepage hero (Index.tsx L520-538)
  // so the four micro-claims read identically across the SEO surface.
  const trustItems = [
    { Icon: Zap, label: lang === 'en' ? '5 business days' : '5 jours ouvrables' },
    { Icon: Check, label: lang === 'en' ? 'Starting at 1 piece' : "À partir d’1 pièce" },
    { Icon: StarIcon, label: lang === 'en' ? '1-year guarantee' : 'Garantie 1 an' },
    { Icon: Package, label: lang === 'en' ? 'Free shipping over $300' : 'Livraison gratuite dès 300$' },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <Navbar />
      <main id="main-content" className="flex-1">
        {/* Hero — Vol III §04 dark surface with right-side image strip. */}
        <section className="relative bg-va-ink overflow-hidden min-h-[60vh] flex items-center">
          {/* Right-side image, gradient mask blends into navy. Hidden on
              mobile — the lede needs the full width on small screens. */}
          {heroImage && heroImageOk && (
            <div
              className="absolute inset-y-0 right-0 w-[45%] hidden lg:block"
              aria-hidden="true"
            >
              <img
                src={heroImage}
                alt=""
                width={720}
                height={900}
                /* Desktop-only LCP element on each Industry page (`hidden
                 * lg:block` parent + 45% column width). Mirrors the
                 * Index hero pattern: eager + decoding=async +
                 * fetchpriority=high so Chrome treats it as the LCP
                 * candidate instead of waiting for the React mount tick.
                 * Spread `fetchpriority` lowercase to dodge React 18's
                 * camelCase warning. width/height reserve aspect-ratio
                 * to prevent CLS on slow paints. */
                loading="eager"
                decoding="async"
                {...({ fetchpriority: 'high' } as Record<string, string>)}
                className="w-full h-full object-cover opacity-50 mix-blend-luminosity"
                onError={() => setHeroImageOk(false)}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-va-ink via-va-ink/70 to-va-ink/20" />
            </div>
          )}

          <div className="relative z-10 max-w-[1160px] w-full mx-auto px-6 md:px-10 py-16 md:py-24">
            <div className="max-w-[600px]">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[2px] text-va-blue mb-4">
                <MapPin size={12} aria-hidden="true" className="-mt-px" />
                <span>{eyebrow}</span>
              </div>
              <h1 className="font-display font-black text-white text-4xl md:text-5xl xl:text-6xl leading-[1.05] tracking-[-0.03em] mb-5">
                {title}
              </h1>
              <p className="text-white/70 text-base md:text-lg leading-relaxed mb-7 max-w-[540px]">
                {heroLede}
              </p>
              {heroBullets.length > 0 && (
                <ul className="grid gap-2 sm:grid-cols-2 mb-8 max-w-[560px]">
                  {heroBullets.map((b, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-white/65"
                    >
                      <span
                        className="mt-1.5 inline-block w-1.5 h-1.5 rounded-full bg-va-blue flex-shrink-0"
                        aria-hidden="true"
                      />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap items-center gap-3 mb-8">
                <Link
                  to={ctaHref}
                  className={`inline-flex items-center gap-2 font-semibold text-[15px] px-7 py-3.5 rounded-xl shadow-[0_0_36px_rgba(0,71,204,0.32)] transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2 focus-visible:ring-offset-va-ink ${ctaClassName}`}
                >
                  {ctaLabel}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>

              {/* Trust bar — 4 micro-claims, mirrors homepage hero */}
              <div className="flex flex-wrap gap-x-7 gap-y-2">
                {trustItems.map(({ Icon, label }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2 text-white/30 text-sm"
                  >
                    <Icon className="w-4 h-4 text-va-blue" aria-hidden="true" />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Per-industry stats row — Vol II §04 spec. */}
        <section
          ref={statsRef}
          className="bg-va-ink py-12 md:py-14 border-t border-white/5"
          aria-labelledby="industry-stats"
        >
          <h2 id="industry-stats" className="sr-only">
            {lang === 'en' ? 'Industry numbers' : 'Chiffres du secteur'}
          </h2>
          <div className="max-w-[1160px] mx-auto px-6 md:px-10 grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            {stats.map((s, i) => (
              <div key={i}>
                <div className="font-mono font-bold text-4xl md:text-5xl text-va-blue tabular-nums">
                  {s.display ? (
                    s.display
                  ) : statsInView ? (
                    <CountUp to={s.value} suffix={s.suffix ?? ''} durationMs={1500} />
                  ) : (
                    <span>0{s.suffix ?? ''}</span>
                  )}
                </div>
                <div className="text-white/50 text-xs md:text-sm uppercase tracking-[2px] mt-3">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="max-w-[1100px] w-full mx-auto px-6 md:px-10 py-12 md:py-16">
          {/* Recommended products */}
          {products.length > 0 && (
            <section className="mb-14 md:mb-16" aria-labelledby="industry-products">
              <h2
                id="industry-products"
                className="text-2xl md:text-3xl font-extrabold text-va-ink tracking-[-0.5px] mb-2"
              >
                {productsHeading}
              </h2>
              <p className="text-sm md:text-base text-zinc-600 max-w-[680px] mb-6">
                {productsSubcopy}
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {products.map(p => {
                  const unit = p.basePrice + PRINT_PRICE;
                  return (
                    <Link
                      key={p.id}
                      to={`/product/${p.shopifyHandle}`}
                      className="group border border-border rounded-[18px] overflow-hidden bg-white transition-all duration-300 hover:border-primary/30 hover:shadow-[0_16px_40px_rgba(27,58,107,0.14)] hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2"
                    >
                      <div
                        className="relative overflow-hidden bg-secondary"
                        style={{ aspectRatio: '1' }}
                      >
                        {p.imageDevant ? (
                          <picture>
                            <source srcSet={toWebp(p.imageDevant)} type="image/webp" />
                            <img
                              src={p.imageDevant}
                              alt={p.shortName}
                              width={400}
                              height={400}
                              loading="lazy"
                              decoding="async"
                              className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                              onError={e => {
                                (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                              }}
                            />
                          </picture>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                            {lang === 'en' ? 'No image' : "Pas d'image"}
                          </div>
                        )}
                      </div>
                      <div className="p-3.5 pb-4">
                        <p className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-[2px] mb-0.5">
                          {p.sku}
                        </p>
                        <div className="text-[14px] font-extrabold text-foreground leading-tight mb-2">
                          {p.shortName}
                        </div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-[14px] font-extrabold text-primary">
                            {fmtMoney(unit, lang)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            / {lang === 'en' ? 'unit' : 'unité'}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* FAQ */}
          {faq.length > 0 && (
            <section className="mb-14 md:mb-16" aria-labelledby="industry-faq">
              <h2
                id="industry-faq"
                className="text-2xl md:text-3xl font-extrabold text-va-ink tracking-[-0.5px] mb-5"
              >
                {faqHeading}
              </h2>
              <div ref={faqGroupRef} className="flex flex-col gap-2 max-w-[820px]">
                {faq.map((item, i) => (
                  <details
                    key={i}
                    data-industry-faq
                    className="group rounded-lg bg-white border border-border transition-colors hover:bg-muted/20"
                  >
                    <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-5 py-4 rounded-lg text-[15px] md:text-[16px] font-medium text-va-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-1">
                      <span>{item.q}</span>
                      <ChevronDown
                        size={18}
                        strokeWidth={2}
                        className="flex-shrink-0 transition-transform duration-200 group-open:rotate-180"
                        aria-hidden="true"
                      />
                    </summary>
                    <div className="px-5 pb-4 pt-1 text-sm md:text-[15px] text-zinc-700 leading-relaxed">
                      {item.a}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Per-industry case-study teaser — only renders if a matching
            study exists in CASE_STUDIES. */}
        {caseStudy && (
          <section
            className="bg-va-bg-1 py-16 border-t border-va-line"
            aria-labelledby="industry-case-study"
          >
            <div className="max-w-[1100px] mx-auto px-6 md:px-10">
              <h2
                id="industry-case-study"
                className="text-2xl md:text-3xl font-extrabold text-va-ink tracking-[-0.5px] mb-2"
              >
                {lang === 'en'
                  ? `A team like yours :`
                  : `Une équipe de ${eyebrow.split('·')[0].trim().toLowerCase()} qui te ressemble :`}
              </h2>
              <p className="text-sm md:text-base text-va-muted mb-6 max-w-[680px]">
                {lang === 'en'
                  ? 'Real Quebec crews, real numbers, real outcomes.'
                  : 'Des équipes québécoises, des chiffres réels, des résultats concrets.'}
              </p>
              <Link
                to={`/histoires-de-succes/${caseStudy.slug}`}
                className="group flex flex-col md:flex-row gap-6 bg-white border border-va-line rounded-2xl overflow-hidden hover:shadow-[0_24px_60px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2"
              >
                <div className="md:w-[40%] aspect-[4/3] md:aspect-auto bg-va-bg-2 relative">
                  <img
                    src={caseStudy.heroImage}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={e => {
                      (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                    }}
                  />
                </div>
                <div className="flex-1 p-6 md:p-8 flex flex-col justify-center">
                  <span className="self-start bg-va-blue-l text-va-blue text-xs font-semibold rounded-full px-3 py-1">
                    {caseStudy.industry}
                  </span>
                  <h3 className="font-display font-bold text-xl md:text-2xl text-va-ink mt-3">
                    {caseStudy.companyName} — {caseStudy.location}
                  </h3>
                  <p className="text-sm md:text-base text-zinc-700 leading-relaxed mt-3 line-clamp-3">
                    {caseStudy.challenge}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-va-muted">
                    <span>
                      <strong className="text-va-ink">{caseStudy.orderSize}</strong>
                    </span>
                    <span>
                      <strong className="text-va-ink">{caseStudy.deliveryDays}</strong>{' '}
                      {lang === 'en' ? 'business days' : 'jours ouvrables'}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-va-blue text-sm font-semibold mt-5 group-hover:gap-2 transition-all">
                    {lang === 'en' ? 'Read the full story' : "Voir l'étude complète"}
                    <ArrowRight size={14} aria-hidden="true" />
                  </span>
                </div>
              </Link>
            </div>
          </section>
        )}

        {/* Final CTA — cream callout, mirrors About.tsx footer rhythm */}
        <section className="max-w-[1100px] w-full mx-auto px-6 md:px-10 py-12 md:py-16">
          <div
            className="bg-[#FFF8E7] border border-[#E8A838]/30 rounded-2xl p-8 md:p-10 text-center"
            aria-labelledby="industry-cta-final"
          >
            <h2
              id="industry-cta-final"
              className="text-xl md:text-2xl font-extrabold text-va-ink tracking-[-0.3px] mb-3"
            >
              {finalHeading ??
                (lang === 'en'
                  ? 'Ready to outfit your team?'
                  : 'Prêt à habiller votre équipe ?')}
            </h2>
            <p className="text-sm md:text-base text-zinc-700 max-w-[560px] mx-auto mb-5">
              {finalSubcopy ??
                (lang === 'en'
                  ? 'Free quotes within 24 business hours. Digital proof before any production run.'
                  : 'Soumissions gratuites en moins de 24h ouvrables. Preuve numérique avant toute production.')}
            </p>
            <Link
              to={ctaHref}
              className={`inline-flex items-center gap-2 font-extrabold text-sm md:text-base px-6 py-3 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2 ${ctaClassName}`}
            >
              {ctaLabel}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
