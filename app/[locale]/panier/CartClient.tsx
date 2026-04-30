'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LogoStatusBadge } from '@/components/checkout/LogoStatusBadge';
import { OrderSummary } from '@/components/checkout/OrderSummary';
import { useCart, type CartItem } from '@/lib/cart';
import { formatCAD } from '@/lib/format';
import type { Locale } from '@/lib/types';

type Props = {
  locale: Locale;
};

export function CartClient({ locale }: Props) {
  const [mounted, setMounted] = useState(false);
  const items = useCart((s) => s.items);
  const updateQty = useCart((s) => s.updateQty);
  const removeItem = useCart((s) => s.removeItem);
  const itemCount = useCart((s) => s.itemCount);
  const t = useTranslations('cart');

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="grid gap-8 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-4">
          <div className="h-8 w-48 animate-pulse rounded bg-sand-100" />
          <div className="h-4 w-32 animate-pulse rounded bg-sand-100" />
          <div className="space-y-3 pt-4">
            <div className="h-32 animate-pulse rounded-lg bg-sand-100" />
            <div className="h-32 animate-pulse rounded-lg bg-sand-100" />
          </div>
        </div>
        <div className="h-72 animate-pulse rounded-lg bg-sand-100" />
      </div>
    );
  }

  const count = itemCount();

  if (items.length === 0) {
    return (
      <div className="space-y-8">
        <header>
          <h1 className="text-display-md font-semibold text-ink-950">
            {t('heading')}
          </h1>
        </header>
        <EmptyState
          icon={ShoppingBag}
          title={t('emptyState.title')}
          description={t('emptyState.body')}
          action={
            <Button href={`/${locale}/produits`} variant="primary" size="lg">
              {t('emptyState.cta')}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-display-md font-semibold text-ink-950">
          {t('heading')}
        </h1>
        <p className="mt-2 text-body-md text-stone-600">
          {t('count', { count })}
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[2fr,1fr]">
        <ul className="divide-y divide-sand-300 rounded-lg border border-sand-300 bg-canvas-000">
          {items.map((item) => (
            <CartLineItem
              key={`${item.productId}-${item.variantKey}`}
              item={item}
              locale={locale}
              onQtyChange={(qty) =>
                updateQty(item.productId, item.variantKey, qty)
              }
              onRemove={() => removeItem(item.productId, item.variantKey)}
            />
          ))}
        </ul>

        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <OrderSummary items={items} locale={locale} showItems={false} />
          <p className="rounded-md bg-canvas-050 px-4 py-3 text-meta-xs text-stone-600">
            {t('summary.leadTime')}
          </p>
          <div className="space-y-3">
            <Button
              href={`/${locale}/checkout`}
              variant="primary"
              size="lg"
              className="w-full"
            >
              {t('cta.checkout')}
            </Button>
            <Link
              href={`/${locale}/soumission`}
              className="block text-center text-body-sm font-medium text-ink-950 underline underline-offset-2 hover:text-ink-800"
            >
              {t('cta.quote')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function CartLineItem({
  item,
  locale,
  onQtyChange,
  onRemove,
}: {
  item: CartItem;
  locale: Locale;
  onQtyChange: (qty: number) => void;
  onRemove: () => void;
}) {
  const t = useTranslations('cart');
  const title = locale === 'fr-ca' ? item.titleFr : item.titleEn;
  const lineSubtotal = item.unitPriceCents * item.qty;

  return (
    <li className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:gap-6 sm:p-6">
      <div className="flex h-24 w-24 flex-none items-center justify-center rounded-md bg-canvas-050 text-meta-xs uppercase tracking-wider text-stone-600 sm:h-28 sm:w-28">
        {(title[0] ?? '·').toUpperCase()}
      </div>

      <div className="flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-title-md font-medium text-ink-950">{title}</h2>
          <p className="text-body-sm text-stone-600">
            {item.color} · {item.size}
          </p>
        </div>
        <LogoStatusBadge status="pending" locale={locale} className="self-start" />

        <div className="mt-2 flex flex-wrap items-center gap-4">
          <div
            role="group"
            aria-label={t('item.qty')}
            className="inline-flex items-center rounded-md border border-sand-300"
          >
            <button
              type="button"
              aria-label={t('item.decrease')}
              onClick={() => onQtyChange(Math.max(1, item.qty - 1))}
              disabled={item.qty <= 1}
              className="flex h-9 w-9 items-center justify-center text-ink-950 hover:bg-sand-100 disabled:opacity-40"
            >
              <Minus aria-hidden className="h-4 w-4" />
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={item.qty}
              aria-label={t('item.qty')}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (Number.isFinite(next) && next >= 1) {
                  onQtyChange(Math.round(next));
                }
              }}
              className="h-9 w-12 border-x border-sand-300 bg-canvas-000 text-center text-body-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ink-950"
            />
            <button
              type="button"
              aria-label={t('item.increase')}
              onClick={() => onQtyChange(item.qty + 1)}
              className="flex h-9 w-9 items-center justify-center text-ink-950 hover:bg-sand-100"
            >
              <Plus aria-hidden className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1.5 text-body-sm font-medium text-stone-600 hover:text-error-700"
          >
            <Trash2 aria-hidden className="h-4 w-4" />
            {t('remove')}
          </button>
        </div>
      </div>

      <div className="flex flex-col items-start gap-1 sm:items-end">
        <p className="text-meta-xs uppercase tracking-wider text-stone-600">
          {t('item.unitPrice')}
        </p>
        <p className="text-body-sm text-stone-600 tabular-nums">
          {formatCAD(item.unitPriceCents, locale)}
        </p>
        <p className="mt-1 text-title-md font-semibold text-ink-950 tabular-nums">
          {formatCAD(lineSubtotal, locale)}
        </p>
      </div>
    </li>
  );
}
