/**
 * Compare — Volume II §15.1.
 *
 * Renders the side-by-side comparison table for the SKUs flagged via
 * compareStore. The brief's COMPARE_FIELDS:
 *   Image / Nom / Prix / Matière / Poids / Couleurs / Tailles /
 *   Idéal pour / Coupe / Lavage / Garantie / CTA
 *
 * data/products.ts only exposes a subset directly (image, name,
 * price, colors, sizes, description, features). Material / weight /
 * fit / care / warranty aren't first-class fields — we extract what
 * we can from `description` + `features` strings, falling back to
 * "—" gracefully so the row is still readable.
 *
 * Lazy-loaded from App.tsx; the customizer's fabric.js dependency
 * never enters the bundle for users who only want to compare specs.
 */
import { useNavigate } from 'react-router-dom';
import { lazy, Suspense, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Trash2, Check } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { SiteFooter } from '@/components/SiteFooter';
import { useCompareStore } from '@/lib/compareStore';
import { PRODUCTS, PRINT_PRICE, type Product } from '@/data/products';
import { useLang } from '@/lib/langContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { categoryLabel } from '@/lib/productLabels';
import { fmtMoney } from '@/lib/format';
import { filterRealColors } from '@/lib/colorFilter';

// Customizer pulls in fabric.js (~310kB). Same lazy strategy as
// ProductCard — only fetch the chunk if the user actually clicks
// "Personnaliser" from a row.
const ProductCustomizer = lazy(() =>
  import('@/components/customizer/ProductCustomizer').then(m => ({ default: m.ProductCustomizer })),
);

const DASH = '—';

/** Best-effort weight extractor — looks for "9.1 oz", "13 oz",
 * "250 g/m²" patterns in either description or features text.
 * Returns DASH when nothing matches so the table cell stays aligned. */
function extractWeight(p: Product): string {
  const haystack = `${p.description} ${p.features.join(' ')}`;
  const oz = haystack.match(/(\d+(?:[,.]\d+)?)\s*oz/i);
  if (oz) return `${oz[1].replace(',', '.')} oz`;
  const gsm = haystack.match(/(\d{2,4})\s*g\/m[²2]?/i);
  if (gsm) return `${gsm[1]} g/m²`;
  return DASH;
}

/** Material extractor — pulls "100% coton", "polyester", "ringspun"-
 * style clues out of description. Falls back to DASH. */
function extractMaterial(p: Product, lang: 'fr' | 'en'): string {
  const haystack = `${p.description} ${p.features.join(' ')}`;
  const ringspun = /ringspun|ring spun/i.test(haystack);
  const cotton = /\bcoton\b|\bcotton\b/i.test(haystack);
  const poly = /polyester/i.test(haystack);
  const tech = /technique|performance|évacuation|wicking/i.test(haystack);
  const french = /french terry|molleton/i.test(haystack);
  const parts: string[] = [];
  if (cotton) parts.push(lang === 'en' ? 'Cotton' : 'Coton');
  if (ringspun) parts.push(lang === 'en' ? 'ringspun' : 'ringspun');
  if (poly) parts.push(lang === 'en' ? 'Polyester' : 'Polyester');
  if (tech) parts.push(lang === 'en' ? 'Technical' : 'Technique');
  if (french) parts.push(lang === 'en' ? 'French Terry' : 'French Terry');
  if (parts.length === 0) return DASH;
  return parts.join(', ');
}

/** Care label — shared default across the catalogue. Shopify product
 * imports don't carry per-SKU laundry codes, so the merchandise sheet
 * locks the "Lavage à froid, séchage à basse température" baseline. */
function careLabel(lang: 'fr' | 'en'): string {
  return lang === 'en'
    ? 'Cold wash, tumble low'
    : 'Lavage à froid, séchage basse';
}

/** Warranty — every Vision Affichage product ships with the same
 * "Satisfaction garantie 30 jours" promise per Volume II §10. */
function warrantyLabel(lang: 'fr' | 'en'): string {
  return lang === 'en' ? '30-day satisfaction' : 'Satisfaction 30 jours';
}

/** Ideal-for inference from category. Mirrors the "idéal pour" copy
 * in product descriptions where present, otherwise infers a sensible
 * use case from the category alone. */
function idealForLabel(p: Product, lang: 'fr' | 'en'): string {
  const m = p.description.match(/Id[éeè]al pour ([^.]+)\./i);
  if (m) return m[1].trim();
  const en = p.description.match(/Ideal for ([^.]+)\./i);
  if (en) return en[1].trim();
  // Per-category fallback — short, scannable.
  switch (p.category) {
    case 'tshirt':     return lang === 'en' ? 'Teams, events, uniforms' : 'Équipes, événements, uniformes';
    case 'hoodie':     return lang === 'en' ? 'Worksites, cool weather' : 'Chantiers, temps frais';
    case 'crewneck':   return lang === 'en' ? 'Layering, casual teams' : 'Superposition, équipes';
    case 'polo':       return lang === 'en' ? 'Corporate, reception' : 'Corporatif, réception';
    case 'longsleeve': return lang === 'en' ? 'Outdoor, autumn-winter' : 'Extérieur, automne-hiver';
    case 'sport':      return lang === 'en' ? 'Sports teams, racing' : 'Équipes sportives, courses';
    case 'cap':        return lang === 'en' ? 'Outdoor, branded swag' : 'Extérieur, articles promotionnels';
    case 'toque':      return lang === 'en' ? 'Winter, outdoor crews' : 'Hiver, équipes extérieures';
    default:           return DASH;
  }
}

/** Fit / coupe — pulls the word from description when present
 * ("coupe ajustée", "coupe classique", "coupe athlétique"). */
function fitLabel(p: Product, lang: 'fr' | 'en'): string {
  const m = p.description.match(/coupe (\w+(?:e?s?))/i);
  if (m) {
    const word = m[1].toLowerCase();
    if (lang === 'en') {
      if (word.startsWith('ajust')) return 'Fitted';
      if (word.startsWith('classi')) return 'Classic';
      if (word.startsWith('athl'))  return 'Athletic';
      if (word.startsWith('struct')) return 'Structured';
      // Unknown French fit word — fall back to the neutral EN default
      // rather than leaking "Coupe <french>" into the English table.
      return 'Regular';
    }
    return `Coupe ${word}`;
  }
  return lang === 'en' ? 'Regular' : 'Régulière';
}

export default function Compare() {
  const { lang } = useLang();
  const navigate = useNavigate();
  const items = useCompareStore(s => s.items);
  const remove = useCompareStore(s => s.remove);
  const clear = useCompareStore(s => s.clear);
  const [customizerProductId, setCustomizerProductId] = useState<string | null>(null);

  useDocumentTitle(
    lang === 'en' ? 'Compare — Vision Affichage' : 'Comparer — Vision Affichage',
    lang === 'en'
      ? 'Compare Vision Affichage products side by side — material, weight, colors, sizes, fit, care, warranty.'
      : 'Comparez les produits Vision Affichage côte à côte — matière, poids, couleurs, tailles, coupe, lavage, garantie.',
  );

  const products = items
    .map(sku => PRODUCTS.find(p => p.sku === sku))
    .filter((p): p is Product => Boolean(p));

  if (products.length === 0) {
    return (
      <>
        <Navbar />
        <main className="min-h-[60vh] max-w-3xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl md:text-3xl font-extrabold text-foreground mb-4">
            {lang === 'en' ? 'Nothing to compare yet' : 'Rien à comparer pour l\u2019instant'}
          </h1>
          <p className="text-muted-foreground mb-8">
            {lang === 'en'
              ? 'Add up to 3 products from the catalogue using the check icon on each card.'
              : 'Ajoutez jusqu\u2019à 3 produits depuis le catalogue en utilisant l\u2019icône de coche sur chaque fiche.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('/products')}
            className="px-6 py-3 rounded-full bg-primary text-primary-foreground font-extrabold hover:opacity-90 transition-opacity"
          >
            {lang === 'en' ? 'Browse products' : 'Voir les produits'}
          </button>
        </main>
        <SiteFooter />
      </>
    );
  }

  const headerLabel = (key: string): string => {
    const labels: Record<string, { fr: string; en: string }> = {
      image:    { fr: 'Image',       en: 'Image' },
      name:     { fr: 'Nom',         en: 'Name' },
      price:    { fr: 'Prix',        en: 'Price' },
      material: { fr: 'Matière',     en: 'Material' },
      weight:   { fr: 'Poids',       en: 'Weight' },
      colors:   { fr: 'Couleurs',    en: 'Colors' },
      sizes:    { fr: 'Tailles',     en: 'Sizes' },
      ideal:    { fr: 'Idéal pour',  en: 'Ideal for' },
      fit:      { fr: 'Coupe',       en: 'Fit' },
      care:     { fr: 'Lavage',      en: 'Care' },
      warranty: { fr: 'Garantie',    en: 'Warranty' },
      cta:      { fr: 'Action',      en: 'Action' },
    };
    return labels[key]?.[lang] ?? key;
  };

  return (
    <>
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-10 pb-32">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground">
            {lang === 'en' ? 'Compare products' : 'Comparer les produits'}
          </h1>
          <button
            type="button"
            onClick={clear}
            className="text-[12px] font-bold text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Trash2 size={14} aria-hidden="true" />
            {lang === 'en' ? 'Clear all' : 'Tout effacer'}
          </button>
        </div>

        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full border-collapse min-w-[640px]">
            <thead>
              <tr>
                <th className="text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground py-3 pr-4 w-[140px]" scope="col">
                  <span className="sr-only">{lang === 'en' ? 'Field' : 'Champ'}</span>
                </th>
                {products.map(p => (
                  <th
                    key={p.sku}
                    scope="col"
                    className="text-left p-3 align-top border-b border-border"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-[2px]">
                        {p.sku}
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(p.sku)}
                        aria-label={lang === 'en'
                          ? `Remove ${p.shortName} from compare`
                          : `Retirer ${p.shortName} de la comparaison`}
                        className="text-muted-foreground hover:text-foreground p-1 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Image */}
              <tr className="border-b border-border">
                <th scope="row" className="text-left text-[12px] font-bold text-muted-foreground py-3 pr-4 align-top">
                  {headerLabel('image')}
                </th>
                {products.map(p => (
                  <td key={p.sku} className="p-3 align-top">
                    <div className="aspect-square w-full bg-secondary rounded-[12px] overflow-hidden">
                      <img
                        src={p.imageDevant}
                        alt={p.shortName}
                        width={300}
                        height={300}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                        onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                      />
                    </div>
                  </td>
                ))}
              </tr>

              {/* Nom */}
              <tr className="border-b border-border">
                <th scope="row" className="text-left text-[12px] font-bold text-muted-foreground py-3 pr-4 align-top">
                  {headerLabel('name')}
                </th>
                {products.map(p => (
                  <td key={p.sku} className="p-3 align-top">
                    <div className="text-[14px] font-extrabold text-foreground">
                      {categoryLabel(p.category, lang)}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {p.shortName}
                    </div>
                  </td>
                ))}
              </tr>

              {/* Prix */}
              <tr className="border-b border-border">
                <th scope="row" className="text-left text-[12px] font-bold text-muted-foreground py-3 pr-4 align-top">
                  {headerLabel('price')}
                </th>
                {products.map(p => {
                  const unit = p.basePrice + PRINT_PRICE;
                  return (
                    <td key={p.sku} className="p-3 align-top">
                      <div className="text-[16px] font-extrabold text-primary">
                        {fmtMoney(unit, lang)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        / {lang === 'en' ? 'unit, print included' : 'unité, impression incluse'}
                      </div>
                    </td>
                  );
                })}
              </tr>

              {/* Matière */}
              <tr className="border-b border-border">
                <th scope="row" className="text-left text-[12px] font-bold text-muted-foreground py-3 pr-4 align-top">
                  {headerLabel('material')}
                </th>
                {products.map(p => (
                  <td key={p.sku} className="p-3 align-top text-[13px] text-foreground">
                    {extractMaterial(p, lang)}
                  </td>
                ))}
              </tr>

              {/* Poids */}
              <tr className="border-b border-border">
                <th scope="row" className="text-left text-[12px] font-bold text-muted-foreground py-3 pr-4 align-top">
                  {headerLabel('weight')}
                </th>
                {products.map(p => (
                  <td key={p.sku} className="p-3 align-top text-[13px] text-foreground">
                    {extractWeight(p)}
                  </td>
                ))}
              </tr>

              {/* Couleurs */}
              <tr className="border-b border-border">
                <th scope="row" className="text-left text-[12px] font-bold text-muted-foreground py-3 pr-4 align-top">
                  {headerLabel('colors')}
                </th>
                {products.map(p => {
                  const real = filterRealColors(p.sku, p.colors);
                  if (real.length === 0) {
                    return <td key={p.sku} className="p-3 align-top text-muted-foreground">{DASH}</td>;
                  }
                  return (
                    <td key={p.sku} className="p-3 align-top">
                      <div className="flex flex-wrap gap-1.5 mb-1">
                        {real.slice(0, 6).map(c => (
                          <span
                            key={c.id}
                            title={lang === 'en' ? (c.nameEn || c.name) : c.name}
                            className="w-4 h-4 rounded-full ring-1 ring-border"
                            style={{ background: c.hex }}
                          />
                        ))}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {real.length} {lang === 'en'
                          ? (real.length === 1 ? 'color' : 'colors')
                          : (real.length === 1 ? 'couleur' : 'couleurs')}
                      </div>
                    </td>
                  );
                })}
              </tr>

              {/* Tailles */}
              <tr className="border-b border-border">
                <th scope="row" className="text-left text-[12px] font-bold text-muted-foreground py-3 pr-4 align-top">
                  {headerLabel('sizes')}
                </th>
                {products.map(p => (
                  <td key={p.sku} className="p-3 align-top">
                    <div className="flex flex-wrap gap-1">
                      {p.sizes.length === 0
                        ? <span className="text-muted-foreground">{DASH}</span>
                        : p.sizes.map(s => (
                            <span key={s} className="text-[10px] font-bold px-2 py-0.5 rounded border border-border text-foreground">
                              {s}
                            </span>
                          ))}
                    </div>
                  </td>
                ))}
              </tr>

              {/* Idéal pour */}
              <tr className="border-b border-border">
                <th scope="row" className="text-left text-[12px] font-bold text-muted-foreground py-3 pr-4 align-top">
                  {headerLabel('ideal')}
                </th>
                {products.map(p => (
                  <td key={p.sku} className="p-3 align-top text-[13px] text-foreground">
                    {idealForLabel(p, lang)}
                  </td>
                ))}
              </tr>

              {/* Coupe */}
              <tr className="border-b border-border">
                <th scope="row" className="text-left text-[12px] font-bold text-muted-foreground py-3 pr-4 align-top">
                  {headerLabel('fit')}
                </th>
                {products.map(p => (
                  <td key={p.sku} className="p-3 align-top text-[13px] text-foreground">
                    {fitLabel(p, lang)}
                  </td>
                ))}
              </tr>

              {/* Lavage */}
              <tr className="border-b border-border">
                <th scope="row" className="text-left text-[12px] font-bold text-muted-foreground py-3 pr-4 align-top">
                  {headerLabel('care')}
                </th>
                {products.map(p => (
                  <td key={p.sku} className="p-3 align-top text-[13px] text-foreground">
                    {careLabel(lang)}
                  </td>
                ))}
              </tr>

              {/* Garantie */}
              <tr className="border-b border-border">
                <th scope="row" className="text-left text-[12px] font-bold text-muted-foreground py-3 pr-4 align-top">
                  {headerLabel('warranty')}
                </th>
                {products.map(p => (
                  <td key={p.sku} className="p-3 align-top text-[13px] text-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Check size={14} className="text-primary" aria-hidden="true" />
                      {warrantyLabel(lang)}
                    </span>
                  </td>
                ))}
              </tr>

              {/* CTA */}
              <tr>
                <th scope="row" className="text-left text-[12px] font-bold text-muted-foreground py-3 pr-4 align-top">
                  {headerLabel('cta')}
                </th>
                {products.map(p => (
                  <td key={p.sku} className="p-3 align-top">
                    <button
                      type="button"
                      onClick={() => setCustomizerProductId(p.id)}
                      className="w-full text-[12px] font-extrabold px-4 py-2.5 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                      {lang === 'en' ? 'Customize' : 'Personnaliser'} →
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/product/${p.shopifyHandle}`)}
                      className="w-full mt-2 text-[11px] font-bold text-muted-foreground hover:text-foreground"
                    >
                      {lang === 'en' ? 'View details' : 'Voir le détail'} →
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </main>

      <AnimatePresence>
        {customizerProductId && (
          <Suspense fallback={null}>
            <ProductCustomizer
              productId={customizerProductId}
              onClose={() => setCustomizerProductId(null)}
            />
          </Suspense>
        )}
      </AnimatePresence>

      <SiteFooter />
    </>
  );
}
