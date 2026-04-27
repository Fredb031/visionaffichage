import { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, MapPin } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { SiteFooter } from '@/components/SiteFooter';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { PRODUCTS, PRINT_PRICE, type Product } from '@/data/products';
import { fmtMoney } from '@/lib/format';
import { useLang } from '@/lib/langContext';

/**
 * Mega Blueprint §08.3 — shared shell for the five industry SEO landing
 * pages (/industries/construction, /industries/paysagement,
 * /industries/plomberie-electricite, /industries/corporate,
 * /industries/municipalites). Each industry page is a thin wrapper that
 * passes its tailored copy in; the shell owns layout, document head
 * (title + meta description + canonical), recommended-product grid,
 * FAQ accordion with one-at-a-time open semantics, and the JSON-LD
 * injection (FAQPage + Service). Keeping this in one component means a
 * future visual tweak to the industry surface lands in a single edit.
 *
 * Brand tokens mirror About.tsx / Contact.tsx — #0F2341 navy headings,
 * #E8A838 gold eyebrow + accent, cream #FFF8E7 callout. No new Tailwind
 * utilities or external deps; the shell composes the same primitives
 * other static pages already ship with.
 */

export type IndustryFaqItem = { q: string; a: string };

export interface IndustryPageShellProps {
  /** SKUs from data/products.ts to surface as recommended cards (3-4). */
  productSkus: string[];
  /** H1 + document title — same string per the brief's "exact title" rule. */
  title: string;
  /** Per-industry meta description, used for <meta name="description">,
   *  og:description, and twitter:description via useDocumentTitle. */
  metaDescription: string;
  /** Eyebrow strap above the H1 (industry name in caps, e.g. "Construction · Québec"). */
  eyebrow: string;
  /** Lede paragraph under the H1. */
  heroLede: string;
  /** Bullet points for the hero "what's included" strip (3-5 short items). */
  heroBullets: string[];
  /** CTA label, e.g. "Obtenir une soumission pour mon équipe construction". */
  ctaLabel: string;
  /** Section heading above the recommended-product grid. */
  productsHeading: string;
  /** Sub-copy under the products heading. */
  productsSubcopy: string;
  /** Section heading above the FAQ accordion. */
  faqHeading: string;
  /** 3-4 Q&A pairs surfaced as a native <details> accordion + FAQPage JSON-LD. */
  faq: IndustryFaqItem[];
  /** Service schema serviceType — industry name in French (e.g. "Construction"). */
  serviceType: string;
  /** Stable dataset marker for FAQPage <script>, e.g. "data-faq-construction-ld". */
  faqLdMarker: string;
  /** Stable dataset marker for Service <script>, e.g. "data-service-construction-ld". */
  serviceLdMarker: string;
}

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
  productsHeading,
  productsSubcopy,
  faqHeading,
  faq,
  serviceType,
  faqLdMarker,
  serviceLdMarker,
}: IndustryPageShellProps) {
  const { lang } = useLang();
  useDocumentTitle(title, metaDescription, {});

  // Resolve SKUs once. Filter out misses so the grid never renders a
  // hollow card when a brief lists a SKU that doesn't exist locally.
  // Memoized so the lang toggle (and any other parent re-render) doesn't
  // re-walk PRODUCTS for each SKU and doesn't churn the array reference,
  // which would defeat downstream memoization on the product cards.
  const products = useMemo(
    () =>
      productSkus
        .map(findProductBySku)
        .filter((p): p is Product => Boolean(p)),
    [productSkus],
  );

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
  // industry-scoped uniform service. provider points back at the
  // Organization graph emitted by Index.tsx so Google can de-dupe.
  // areaServed = QC (matches LocalBusiness on the homepage).
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
      // url should reflect the actual landing page; we read it at mount
      // so dev/prod hosts both work without per-env config.
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

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <Navbar />
      <main
        id="main-content"
        className="flex-1 max-w-[1100px] w-full mx-auto px-6 md:px-10 py-12 md:py-16"
      >
        {/* Hero */}
        <section className="mb-14 md:mb-16">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[2px] text-[#E8A838] mb-3">
            <MapPin size={12} aria-hidden="true" className="-mt-px" />
            <span>{eyebrow}</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-[#0F2341] tracking-[-0.8px] mb-4 max-w-[820px]">
            {title}
          </h1>
          <p className="text-base md:text-lg text-zinc-700 max-w-[720px] leading-relaxed mb-6">
            {heroLede}
          </p>
          {heroBullets.length > 0 && (
            <ul className="grid gap-2 md:grid-cols-2 max-w-[720px] mb-8">
              {heroBullets.map((b, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-zinc-700"
                >
                  <span
                    className="mt-1.5 inline-block w-1.5 h-1.5 rounded-full bg-[#E8A838] flex-shrink-0"
                    aria-hidden="true"
                  />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/devis"
            className="inline-flex items-center gap-2 bg-[#0F2341] hover:bg-[#1B3A6B] text-white font-extrabold text-sm md:text-base px-6 py-3.5 rounded-full shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838] focus-visible:ring-offset-2"
          >
            {ctaLabel}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </section>

        {/* Recommended products */}
        {products.length > 0 && (
          <section className="mb-14 md:mb-16" aria-labelledby="industry-products">
            <h2
              id="industry-products"
              className="text-2xl md:text-3xl font-extrabold text-[#0F2341] tracking-[-0.5px] mb-2"
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
                    className="group border border-border rounded-[18px] overflow-hidden bg-white transition-all duration-300 hover:border-primary/30 hover:shadow-[0_16px_40px_rgba(27,58,107,0.14)] hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F2341] focus-visible:ring-offset-2"
                  >
                    <div
                      className="relative overflow-hidden bg-secondary"
                      style={{ aspectRatio: '1' }}
                    >
                      {p.imageDevant ? (
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
              className="text-2xl md:text-3xl font-extrabold text-[#0F2341] tracking-[-0.5px] mb-5"
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
                  <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-5 py-4 rounded-lg text-[15px] md:text-[16px] font-medium text-[#1B3A6B] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838] focus-visible:ring-offset-1">
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

        {/* Final CTA — cream callout, mirrors About.tsx footer rhythm */}
        <section
          className="bg-[#FFF8E7] border border-[#E8A838]/30 rounded-2xl p-8 md:p-10 text-center"
          aria-labelledby="industry-cta-final"
        >
          <h2
            id="industry-cta-final"
            className="text-xl md:text-2xl font-extrabold text-[#0F2341] tracking-[-0.3px] mb-3"
          >
            {lang === 'en'
              ? 'Ready to outfit your team?'
              : 'Prêt à habiller votre équipe ?'}
          </h2>
          <p className="text-sm md:text-base text-zinc-700 max-w-[560px] mx-auto mb-5">
            {lang === 'en'
              ? 'Free quotes within 24 business hours. Digital proof before any production run.'
              : 'Soumissions gratuites en moins de 24h ouvrables. Preuve numérique avant toute production.'}
          </p>
          <Link
            to="/devis"
            className="inline-flex items-center gap-2 bg-[#0F2341] hover:bg-[#1B3A6B] text-white font-extrabold text-sm md:text-base px-6 py-3 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838] focus-visible:ring-offset-2"
          >
            {ctaLabel}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
