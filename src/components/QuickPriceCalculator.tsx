import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useLang } from '@/lib/langContext';

/**
 * QuickPriceCalculator — hero-side glassmorphism widget.
 *
 * Lets the visitor pick one of 5 flagship SKUs, drag a quantity slider
 * (1..200, default 12), and see live unit price, subtotal, and shipping.
 * Free shipping when subtotal >= $300 CAD; otherwise flat $12.
 *
 * Pricing tiers come straight from the master prompt (Phase 1.3). Tiers
 * are inclusive lower bounds: the unit price for a quantity Q is the
 * highest tier whose minQty <= Q.
 */

type SkuId = 'ATC1000' | 'ATCF2500' | 'ATC1015' | 'L445' | 'ATC6606';

interface Tier {
  minQty: number;
  price: number;
}

interface Product {
  sku: SkuId;
  labelFr: string;
  labelEn: string;
  emoji: string;
  tiers: Tier[];
}

// TIERS table — verbatim from master prompt. Keep in sync.
const PRODUCTS: Product[] = [
  {
    sku: 'ATC1000',
    labelFr: 'T-Shirt',
    labelEn: 'T-Shirt',
    emoji: '\u{1F455}', // 👕
    tiers: [
      { minQty: 1, price: 24.99 },
      { minQty: 12, price: 19.99 },
      { minQty: 25, price: 17.99 },
      { minQty: 50, price: 15.99 },
      { minQty: 100, price: 13.99 },
    ],
  },
  {
    sku: 'ATCF2500',
    labelFr: 'Hoodie',
    labelEn: 'Hoodie',
    emoji: '\u{1F9E5}', // 🧥
    tiers: [
      { minQty: 1, price: 54.99 },
      { minQty: 12, price: 44.99 },
      { minQty: 25, price: 39.99 },
      { minQty: 50, price: 34.99 },
      { minQty: 100, price: 29.99 },
    ],
  },
  {
    sku: 'ATC1015',
    labelFr: 'Polo',
    labelEn: 'Polo',
    emoji: '\u{1F454}', // 👔
    tiers: [
      { minQty: 1, price: 39.99 },
      { minQty: 12, price: 32.99 },
      { minQty: 25, price: 28.99 },
      { minQty: 50, price: 25.99 },
      { minQty: 100, price: 22.99 },
    ],
  },
  {
    sku: 'L445',
    labelFr: 'Veste',
    labelEn: 'Jacket',
    emoji: '\u{1F9E5}', // 🧥
    tiers: [
      { minQty: 1, price: 79.99 },
      { minQty: 12, price: 64.99 },
      { minQty: 25, price: 57.99 },
      { minQty: 50, price: 51.99 },
      { minQty: 100, price: 45.99 },
    ],
  },
  {
    sku: 'ATC6606',
    labelFr: 'Casquette',
    labelEn: 'Cap',
    emoji: '\u{1F9E2}', // 🧢
    tiers: [
      { minQty: 1, price: 22.99 },
      { minQty: 12, price: 18.99 },
      { minQty: 25, price: 16.99 },
      { minQty: 50, price: 14.99 },
      { minQty: 100, price: 12.99 },
    ],
  },
];

const FREE_SHIPPING_THRESHOLD = 300;
const FLAT_SHIPPING = 12;

function unitPriceFor(product: Product, qty: number): number {
  // Walk tiers in ascending order; last tier whose minQty <= qty wins.
  let price = product.tiers[0].price;
  for (const tier of product.tiers) {
    if (qty >= tier.minQty) price = tier.price;
  }
  return price;
}

function fmtCAD(amount: number, lang: 'fr' | 'en'): string {
  return new Intl.NumberFormat(lang === 'en' ? 'en-CA' : 'fr-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 2,
  }).format(amount);
}

export function QuickPriceCalculator() {
  const { lang } = useLang();
  const [skuId, setSkuId] = useState<SkuId>('ATC1000');
  const [qty, setQty] = useState<number>(12);

  const product = useMemo(
    () => PRODUCTS.find(p => p.sku === skuId) ?? PRODUCTS[0],
    [skuId],
  );

  const unit = useMemo(() => unitPriceFor(product, qty), [product, qty]);
  const subtotal = useMemo(() => unit * qty, [unit, qty]);
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;
  const total = subtotal + shipping;

  return (
    <div
      className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 text-white shadow-2xl"
      role="region"
      aria-label={lang === 'en' ? 'Quick price calculator' : 'Calculateur de prix rapide'}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold tracking-tight">
          {lang === 'en' ? 'Instant price' : 'Prix instantané'}
        </h3>
        <span className="text-[11px] uppercase tracking-[1.5px] font-bold text-[#0052CC] bg-white rounded-full px-2.5 py-1">
          {lang === 'en' ? 'Live' : 'En direct'}
        </span>
      </div>

      {/* Product tile picker — 5 across on wider, wraps on narrow. */}
      <div className="grid grid-cols-5 gap-2 mb-5">
        {PRODUCTS.map(p => {
          const active = p.sku === skuId;
          return (
            <button
              key={p.sku}
              type="button"
              onClick={() => setSkuId(p.sku)}
              aria-pressed={active}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl py-3 px-1 text-[11px] font-semibold transition-all ${
                active
                  ? 'bg-white text-[#0A0A0A] shadow-lg scale-[1.03]'
                  : 'bg-white/10 text-white/80 hover:bg-white/20 border border-white/10'
              }`}
            >
              <span className="text-xl leading-none" aria-hidden="true">{p.emoji}</span>
              <span className="leading-tight">
                {lang === 'en' ? p.labelEn : p.labelFr}
              </span>
            </button>
          );
        })}
      </div>

      {/* Quantity slider */}
      <div className="mb-5">
        <div className="flex items-baseline justify-between mb-2">
          <label htmlFor="qpc-qty" className="text-sm text-white/80 font-medium">
            {lang === 'en' ? 'Quantity' : 'Quantité'}
          </label>
          <span className="text-2xl font-black tracking-tight">{qty}</span>
        </div>
        <input
          id="qpc-qty"
          type="range"
          min={1}
          max={200}
          step={1}
          value={qty}
          onChange={e => setQty(parseInt(e.target.value, 10))}
          className="w-full accent-[#0052CC] cursor-pointer"
          aria-valuemin={1}
          aria-valuemax={200}
          aria-valuenow={qty}
        />
        <div className="flex justify-between text-[10px] text-white/50 mt-1 font-medium">
          <span>1</span>
          <span>50</span>
          <span>100</span>
          <span>200</span>
        </div>
      </div>

      {/* Live totals */}
      <div className="space-y-2 mb-5 text-sm">
        <div className="flex justify-between text-white/80">
          <span>{lang === 'en' ? 'Unit price' : 'Prix unitaire'}</span>
          <span className="font-bold text-white">{fmtCAD(unit, lang)}</span>
        </div>
        <div className="flex justify-between text-white/80">
          <span>{lang === 'en' ? 'Subtotal' : 'Sous-total'}</span>
          <span className="font-bold text-white">{fmtCAD(subtotal, lang)}</span>
        </div>
        <div className="flex justify-between text-white/80">
          <span>{lang === 'en' ? 'Shipping' : 'Livraison'}</span>
          <span className={`font-bold ${shipping === 0 ? 'text-[#34D399]' : 'text-white'}`}>
            {shipping === 0
              ? (lang === 'en' ? 'FREE' : 'GRATUIT')
              : fmtCAD(shipping, lang)}
          </span>
        </div>
        <div className="border-t border-white/20 pt-2 flex justify-between items-baseline">
          <span className="text-white/90 font-semibold">{lang === 'en' ? 'Total' : 'Total'}</span>
          <span className="text-2xl font-black text-white tracking-tight">{fmtCAD(total, lang)}</span>
        </div>
        {shipping > 0 ? (
          <p className="text-[11px] text-white/60 leading-snug">
            {lang === 'en'
              ? `Add ${fmtCAD(FREE_SHIPPING_THRESHOLD - subtotal, lang)} more for free shipping.`
              : `Ajoute ${fmtCAD(FREE_SHIPPING_THRESHOLD - subtotal, lang)} pour la livraison gratuite.`}
          </p>
        ) : null}
      </div>

      {/* CTA */}
      <Link
        to={`/product/${product.sku.toLowerCase()}`}
        className="group inline-flex w-full items-center justify-center gap-2 bg-[#0052CC] hover:bg-[#003D99] text-white font-bold px-6 py-3.5 rounded-xl text-base shadow-lg shadow-[#0052CC]/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
      >
        <span>{lang === 'en' ? 'Order at this price' : 'Commander à ce prix'}</span>
        <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </Link>

      <p className="mt-3 text-[11px] text-white/50 text-center leading-snug">
        {lang === 'en'
          ? 'Indicative price — final quote includes setup & taxes.'
          : 'Prix indicatif — devis final inclut frais de mise en place et taxes.'}
      </p>
    </div>
  );
}

export default QuickPriceCalculator;
