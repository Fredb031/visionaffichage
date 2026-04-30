import type { CartItem } from '@/lib/cart';
import type { Locale } from '@/lib/types';
import { formatCAD } from '@/lib/format';

const QC_TAX_RATE = 0.14975; // GST 5% + QST 9.975%
const SHIPPING_FLAT_CENTS = 1500;
const FREE_SHIPPING_THRESHOLD_CENTS = 25000;

type Props = {
  items: CartItem[];
  locale: Locale;
  className?: string;
  showItems?: boolean;
};

export function OrderSummary({
  items,
  locale,
  className = '',
  showItems = true,
}: Props) {
  const subtotalCents = items.reduce(
    (sum, i) => sum + i.unitPriceCents * i.qty,
    0,
  );
  const shippingCents =
    items.length === 0
      ? 0
      : subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS
        ? 0
        : SHIPPING_FLAT_CENTS;
  const taxCents = Math.round(subtotalCents * QC_TAX_RATE);
  const totalCents = subtotalCents + shippingCents + taxCents;

  const t =
    locale === 'fr-ca'
      ? {
          summary: 'Récapitulatif',
          subtotal: 'Sous-total',
          shipping: 'Livraison',
          freeShipping: 'Gratuite',
          tax: 'Taxes (TPS + TVQ)',
          total: 'Total',
          empty: 'Aucun article.',
        }
      : {
          summary: 'Summary',
          subtotal: 'Subtotal',
          shipping: 'Shipping',
          freeShipping: 'Free',
          tax: 'Taxes (GST + QST)',
          total: 'Total',
          empty: 'No items.',
        };

  return (
    <aside
      aria-label={t.summary}
      className={`rounded-lg border border-sand-300 bg-canvas-050 p-6 ${className}`.trim()}
    >
      <h2 className="text-title-md text-ink-950">{t.summary}</h2>

      {showItems ? (
        <ul className="mt-4 divide-y divide-sand-300">
          {items.length === 0 ? (
            <li className="py-3 text-body-sm text-stone-500">{t.empty}</li>
          ) : (
            items.map((item) => (
              <li
                key={`${item.productId}-${item.variantKey}`}
                className="flex items-start justify-between gap-3 py-3 text-body-sm"
              >
                <div>
                  <p className="font-medium text-ink-950">
                    {locale === 'fr-ca' ? item.titleFr : item.titleEn}
                  </p>
                  <p className="text-stone-500">
                    {item.color} · {item.size} · ×{item.qty}
                  </p>
                </div>
                <p className="font-medium text-ink-950">
                  {formatCAD(item.unitPriceCents * item.qty, locale)}
                </p>
              </li>
            ))
          )}
        </ul>
      ) : null}

      <dl className="mt-4 space-y-2 border-t border-sand-300 pt-4 text-body-sm">
        <div className="flex justify-between">
          <dt className="text-stone-500">{t.subtotal}</dt>
          <dd className="font-medium text-ink-950">
            {formatCAD(subtotalCents, locale)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-stone-500">{t.shipping}</dt>
          <dd className="font-medium text-ink-950">
            {shippingCents === 0 && items.length > 0
              ? t.freeShipping
              : formatCAD(shippingCents, locale)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-stone-500">{t.tax}</dt>
          <dd className="font-medium text-ink-950">
            {formatCAD(taxCents, locale)}
          </dd>
        </div>
        <div className="flex justify-between border-t border-sand-300 pt-3 text-title-md">
          <dt>{t.total}</dt>
          <dd className="font-semibold">{formatCAD(totalCents, locale)}</dd>
        </div>
      </dl>
    </aside>
  );
}
