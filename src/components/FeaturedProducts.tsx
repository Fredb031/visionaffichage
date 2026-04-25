import { Link } from 'react-router-dom';
import { ArrowRight, Star } from 'lucide-react';
import { useLang } from '@/lib/langContext';
import { PRODUCTS, FEATURED_SKUS } from '@/data/products';
import { categoryLabel } from '@/lib/productLabels';

export function FeaturedProducts() {
  const { lang } = useLang();
  const featured = FEATURED_SKUS
    .map(sku => PRODUCTS.find(p => p.sku === sku))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  // Data drift guard: if every FEATURED_SKU has been renamed/retired in
  // PRODUCTS (e.g. catalogue refresh removes a hero SKU before this
  // constant is updated), the section would otherwise render its
  // bilingual heading and 'See all N products' CTA above an empty grid
  // — a layout that looks broken on the homepage. Hide the whole
  // section instead so the page flows straight from the previous
  // block to the next, matching how Index.tsx already conditionally
  // composes other promo sections.
  if (featured.length === 0) return null;

  return (
    <section className="py-20 px-6 md:px-10 bg-background" aria-label={lang === 'en' ? 'Featured products' : 'Produits populaires'}>
      <div className="max-w-[1200px] mx-auto">
        <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[2px] uppercase text-[#0052CC] mb-2">
              <Star size={12} className="fill-[#E8A838] text-[#E8A838]" aria-hidden="true" />
              {lang === 'en' ? 'Most ordered' : 'Les plus commandés'}
            </div>
            <h2 className="text-[clamp(28px,4vw,42px)] font-extrabold tracking-[-1px] text-foreground leading-tight">
              {lang === 'en' ? 'Start with what works.' : 'Commence avec ce qui marche.'}
            </h2>
          </div>
          <Link
            to="/products"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0052CC] hover:gap-3 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2 rounded"
          >
            {/* Pluralise the CTA so a future catalogue trim that leaves a
                single SKU doesn't render 'See all 1 products' / 'Voir le
                1 produits'. English picks 'product' vs 'products';
                French swaps the article ('le' vs 'les') alongside the
                noun so the determiner agrees with the count too. */}
            {lang === 'en'
              ? `See all ${PRODUCTS.length} ${PRODUCTS.length === 1 ? 'product' : 'products'}`
              : `Voir ${PRODUCTS.length === 1 ? 'le' : 'les'} ${PRODUCTS.length} ${PRODUCTS.length === 1 ? 'produit' : 'produits'}`}
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {featured.map((p, i) => {
            // Use fr-CA / en-CA locale formatting so French users see
            // '27,54 $' with a comma separator (matches cart totals,
            // quote rows, admin dashboards, CartRecommendations). .toFixed(2)
            // alone always emits a '.' which looks out of place in the
            // French build next to every other price on the page.
            const priceFmt = p.basePrice.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
            return (
            <Link
              key={p.sku}
              to={`/product/${p.shopifyHandle}`}
              className="group block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <div className="relative aspect-square overflow-hidden rounded-2xl bg-secondary border border-border transition-all hover:border-[#0052CC]/30 hover:shadow-[0_16px_40px_rgba(27,58,107,0.1)] hover:-translate-y-1">
                <img
                  src={p.imageDevant}
                  alt={`${categoryLabel(p.category, lang)} ${p.sku}`}
                  width={400}
                  height={400}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  /* First 2 cards above-the-fold on mobile → eager + high priority for faster LCP */
                  loading={i < 2 ? 'eager' : 'lazy'}
                  fetchPriority={i === 0 ? 'high' : 'auto'}
                  decoding="async"
                  onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                />
                <div className="absolute top-2.5 left-2.5 bg-white/95 backdrop-blur-sm text-[#1B3A6B] text-[10px] font-extrabold px-2 py-1 rounded-full shadow-sm flex items-center gap-1">
                  <Star size={9} className="fill-[#E8A838] text-[#E8A838]" aria-hidden="true" />
                  {lang === 'en' ? 'Top' : 'Top'}
                </div>
              </div>
              <div className="px-1 pt-3">
                <div className="text-[9px] font-mono uppercase tracking-[2px] text-muted-foreground/60">
                  {p.sku}
                </div>
                <div className="text-sm font-extrabold text-foreground mt-0.5">
                  {categoryLabel(p.category, lang)}
                </div>
                <div className="text-xs text-[#0052CC] font-bold mt-1">
                  {lang === 'en' ? 'From' : 'À partir de'} {priceFmt} $
                </div>
              </div>
            </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
