'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Minus, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { Locale, Product } from '@/lib/types';
import { useCart } from '@/lib/cart';
import { formatCAD } from '@/lib/format';

import { ColorSwatch } from '@/components/product/ColorSwatch';
import { SizePicker } from '@/components/product/SizePicker';
import { LeadTimeEstimator } from '@/components/pdp/LeadTimeEstimator';
import { StickyActionBar } from '@/components/pdp/StickyActionBar';
import { Button } from '@/components/Button';

type Props = {
  product: Product;
  locale: Locale;
};

const QTY_MAX = 1000;

export function PdpClient({ product, locale }: Props) {
  const t = useTranslations('pdp');
  const router = useRouter();
  const addItem = useCart((s) => s.addItem);

  const firstAvailableColor = useMemo(() => {
    const found = product.colors.find((c) => c.available !== false);
    return found ?? product.colors[0] ?? null;
  }, [product.colors]);

  const [selectedColorHex, setSelectedColorHex] = useState<string | null>(
    firstAvailableColor?.hex ?? null,
  );
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(product.minQuantity);
  const [sizeError, setSizeError] = useState<boolean>(false);

  const selectedColor =
    product.colors.find((c) => c.hex === selectedColorHex) ?? null;

  const clampQty = (value: number): number => {
    const min = product.minQuantity;
    if (Number.isNaN(value)) return min;
    if (value < min) return min;
    if (value > QTY_MAX) return QTY_MAX;
    return Math.floor(value);
  };

  const onQtyChange = (value: number) => setQuantity(clampQty(value));

  const onAddToCart = () => {
    if (!selectedSize) {
      setSizeError(true);
      return;
    }
    setSizeError(false);
    const colorLabel = selectedColor ? selectedColor.name[locale] : 'default';
    const variantKey = `${selectedColor?.hex ?? 'default'}-${selectedSize}`;
    addItem({
      productId: product.styleCode,
      variantKey,
      productSlug: product.slug,
      titleFr: product.title['fr-ca'],
      titleEn: product.title['en-ca'],
      color: colorLabel,
      size: selectedSize,
      qty: quantity,
      unitPriceCents: product.priceFromCents,
    });
    router.push(`/${locale}/panier`);
  };

  const colorLabel = t('variant.color');
  const sizeLabel = t('variant.size');
  const qtyLabel = t('qty.label');
  const qtyUnit = t('qty.unit');
  const ctaLabel = t('cta.addToCart');
  const quoteLabel = t('cta.quote.label');
  const quoteSubtext = t('cta.quote.subtext');
  const sizeErrorMsg = t('variant.error.size');

  return (
    <>
      {/* 8. Color picker */}
      <div>
        <span className="block text-meta-xs uppercase tracking-wider text-stone-600">
          {colorLabel}
          {selectedColor ? (
            <span className="ml-2 normal-case text-ink-950">
              · {selectedColor.name[locale]}
            </span>
          ) : null}
        </span>
        <div
          role="radiogroup"
          aria-label={colorLabel}
          className="mt-2 flex flex-wrap gap-2"
        >
          {product.colors.map((c) => {
            const available = c.available !== false;
            const isSelected = selectedColorHex === c.hex;
            return (
              <button
                key={c.hex}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={c.name[locale]}
                aria-disabled={!available}
                disabled={!available}
                onClick={() => available && setSelectedColorHex(c.hex)}
                className={[
                  'inline-flex h-10 w-10 items-center justify-center rounded-pill p-0.5 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700',
                  available ? 'cursor-pointer' : 'cursor-not-allowed opacity-50',
                ].join(' ')}
                title={c.name[locale]}
              >
                <ColorSwatch
                  name={c.name[locale]}
                  hex={c.hex}
                  available={available}
                  selected={isSelected}
                  size="md"
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* 9. Size picker */}
      <div>
        <span className="block text-meta-xs uppercase tracking-wider text-stone-600">
          {sizeLabel}
          {selectedSize ? (
            <span className="ml-2 normal-case text-ink-950">
              · {selectedSize}
            </span>
          ) : null}
        </span>
        <SizePicker
          className="mt-2"
          sizes={product.sizes}
          selectedSize={selectedSize}
          onSelect={(size) => {
            setSelectedSize(size);
            setSizeError(false);
          }}
          locale={locale}
          showSizeGuide
        />
      </div>

      {/* 10. Quantity */}
      <div>
        <label
          htmlFor="pdp-qty"
          className="block text-meta-xs uppercase tracking-wider text-stone-600"
        >
          {qtyLabel}
        </label>
        <div className="mt-2 inline-flex items-center gap-2">
          <button
            type="button"
            aria-label="−"
            onClick={() => onQtyChange(quantity - 1)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-sm border border-sand-300 bg-canvas-000 text-ink-950 transition-colors duration-base ease-standard hover:bg-sand-100 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 disabled:opacity-50"
            disabled={quantity <= product.minQuantity}
          >
            <Minus aria-hidden className="h-4 w-4" />
          </button>
          <input
            id="pdp-qty"
            type="number"
            inputMode="numeric"
            min={product.minQuantity}
            max={QTY_MAX}
            value={quantity}
            onChange={(e) => onQtyChange(Number(e.target.value))}
            onBlur={(e) => onQtyChange(Number(e.target.value))}
            className="h-11 w-20 rounded-sm border border-sand-300 bg-canvas-000 px-3 text-center text-body-md font-medium text-ink-950 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
          />
          <button
            type="button"
            aria-label="+"
            onClick={() => onQtyChange(quantity + 1)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-sm border border-sand-300 bg-canvas-000 text-ink-950 transition-colors duration-base ease-standard hover:bg-sand-100 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 disabled:opacity-50"
            disabled={quantity >= QTY_MAX}
          >
            <Plus aria-hidden className="h-4 w-4" />
          </button>
          <span className="ml-1 text-body-sm text-stone-600">{qtyUnit}</span>
        </div>
      </div>

      {/* 11. Lead time estimator */}
      <LeadTimeEstimator leadTimeDays={product.leadTimeDays} locale={locale} />

      {/* 12. Primary CTA */}
      <div className="space-y-2">
        {sizeError ? (
          <p
            role="alert"
            className="rounded-sm border border-error-200 bg-error-50 px-3 py-2 text-body-sm text-error-700"
          >
            {sizeErrorMsg}
          </p>
        ) : null}
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={onAddToCart}
        >
          {ctaLabel} · {formatCAD(product.priceFromCents * quantity, locale)}
        </Button>
      </div>

      {/* 13. Secondary CTA */}
      <div>
        <Button href={`/${locale}/soumission`} variant="tertiary" size="md" className="px-0">
          {quoteLabel}
        </Button>
        <p className="mt-1 text-body-sm text-stone-600">{quoteSubtext}</p>
      </div>

      <StickyActionBar
        priceFromCents={product.priceFromCents}
        selectedSize={selectedSize}
        ctaHref="#pdp-cta"
        ctaLabel={ctaLabel}
        locale={locale}
      />
    </>
  );
}
