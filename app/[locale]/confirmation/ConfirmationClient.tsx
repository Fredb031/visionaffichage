'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  CheckCircle2,
  Mail,
  PackageCheck,
  Phone,
  Printer,
  RotateCcw,
} from 'lucide-react';

import { Button } from '@/components/Button';
import { OrderSummary } from '@/components/checkout/OrderSummary';
import type { StoredOrder } from '@/lib/orderForm';
import type { Locale } from '@/lib/types';

type Props = {
  locale: Locale;
};

const NEXT_STEP_KEYS = ['1', '2', '3', '4'] as const;

export function ConfirmationClient({ locale }: Props) {
  const t = useTranslations('confirmation');
  const tPrint = useTranslations('print');
  const params = useSearchParams();
  const orderFromQuery = params.get('order');

  const [mounted, setMounted] = useState(false);
  const [order, setOrder] = useState<StoredOrder | null>(null);

  useEffect(() => {
    setMounted(true);
    if (typeof window === 'undefined') return;
    try {
      const raw = window.sessionStorage.getItem('va-last-order');
      if (raw) {
        const parsed = JSON.parse(raw) as StoredOrder;
        setOrder(parsed);
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  if (!mounted) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-72 animate-pulse rounded bg-sand-100" />
        <div className="h-48 animate-pulse rounded-lg bg-sand-100" />
      </div>
    );
  }

  const orderNumber = orderFromQuery || order?.orderNumber;

  if (!orderNumber) {
    return (
      <div className="rounded-lg border border-dashed border-sand-300 bg-canvas-050 px-6 py-16 text-center">
        <h1 className="text-title-lg font-semibold text-ink-950">
          {t('missing.heading')}
        </h1>
        <p className="mt-2 text-body-md text-stone-600">{t('missing.body')}</p>
        <div className="mt-6">
          <Button href={`/${locale}`} variant="primary" size="lg">
            {t('missing.cta')}
          </Button>
        </div>
      </div>
    );
  }

  const printDate = new Date().toLocaleDateString(locale);

  return (
    <div className="space-y-12" data-print-region>
      <header
        data-print-header
        className="border-b border-black pb-4 text-black"
      >
        <p className="text-xl font-bold tracking-wider">
          {tPrint('header.wordmark')}
        </p>
        <p className="text-sm">{tPrint('header.address')}</p>
        <div className="mt-3 flex justify-between text-sm">
          <span className="font-semibold uppercase tracking-wider">
            {tPrint('header.title.order')}
          </span>
          <span>
            {tPrint('header.dateLabel')}: {printDate} ·{' '}
            {tPrint('header.refLabel')}: {orderNumber}
          </span>
        </div>
      </header>

      <div data-print-hide className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            if (typeof window !== 'undefined') window.print();
          }}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-sand-300 bg-canvas-000 px-4 text-body-sm font-medium text-ink-950 transition-colors duration-base hover:bg-sand-100"
        >
          <Printer aria-hidden className="h-4 w-4" />
          {tPrint('button.label')}
        </button>
      </div>

      <header className="space-y-4 text-center sm:text-left">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-pill bg-success-50 text-success-700">
          <CheckCircle2 aria-hidden className="h-8 w-8" strokeWidth={2} />
        </div>
        <h1 className="text-display-md font-semibold text-ink-950">
          {t('heading')}
        </h1>
        <p className="text-body-md text-stone-600">{t('subhead')}</p>
        <p className="text-body-sm text-ink-950">
          <span className="text-stone-600">{t('orderNumber')} :</span>{' '}
          <span className="font-semibold tabular-nums">{orderNumber}</span>
        </p>
      </header>

      <section
        aria-labelledby="next-steps"
        className="rounded-lg border border-sand-300 bg-canvas-050 p-6 md:p-8"
      >
        <h2
          id="next-steps"
          className="text-title-lg font-semibold text-ink-950"
        >
          {t('nextSteps.heading')}
        </h2>
        <ol className="mt-6 grid gap-5 sm:grid-cols-2">
          {NEXT_STEP_KEYS.map((key, idx) => (
            <li key={key} className="flex gap-3">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-pill bg-ink-950 text-meta-xs font-semibold text-canvas-000">
                {idx + 1}
              </span>
              <p className="text-body-md text-ink-950">
                {t(`nextSteps.${key}`)}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {order ? (
        <section
          aria-labelledby="order-summary"
          className="grid gap-6 lg:grid-cols-[2fr,1fr]"
        >
          <div className="space-y-3">
            <h2
              id="order-summary"
              className="text-title-lg font-semibold text-ink-950"
            >
              {t('summary.heading')}
            </h2>
            <ul className="divide-y divide-sand-300 rounded-lg border border-sand-300 bg-canvas-000">
              {order.items.map((item) => (
                <li
                  key={`${item.productId}-${item.variantKey}`}
                  className="flex items-center justify-between gap-4 p-4"
                >
                  <div>
                    <p className="text-body-md font-medium text-ink-950">
                      {locale === 'fr-ca' ? item.titleFr : item.titleEn}
                    </p>
                    <p className="text-body-sm text-stone-600">
                      {item.color} · {item.size} · ×{item.qty}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <OrderSummary items={order.items} locale={locale} showItems={false} />
        </section>
      ) : null}

      <section
        aria-labelledby="reorder"
        className="rounded-lg border border-sand-300 bg-canvas-000 p-6 md:p-8"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2 max-w-xl">
            <h2
              id="reorder"
              className="flex items-center gap-2 text-title-lg font-semibold text-ink-950"
            >
              <RotateCcw aria-hidden className="h-5 w-5" />
              {t('reorder.heading')}
            </h2>
            <p className="text-body-md text-stone-600">{t('reorder.body')}</p>
          </div>
          <Button href={`/${locale}/produits`} variant="secondary" size="lg">
            {t('reorder.cta')}
          </Button>
        </div>
      </section>

      <section
        aria-labelledby="support"
        className="rounded-lg border border-sand-300 bg-canvas-050 p-6 md:p-8"
      >
        <h2
          id="support"
          className="text-title-lg font-semibold text-ink-950"
        >
          {t('support.heading')}
        </h2>
        <p className="mt-1 text-body-md text-stone-600">{t('support.body')}</p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          <li>
            <a
              href={`tel:${t('support.phone').replace(/[^\d+]/g, '')}`}
              className="flex items-center gap-3 rounded-md border border-sand-300 bg-canvas-000 px-4 py-3 text-body-md text-ink-950 hover:bg-sand-100"
            >
              <Phone aria-hidden className="h-5 w-5" />
              <span>
                <span className="block text-meta-xs uppercase tracking-wider text-stone-600">
                  {t('support.phoneLabel')}
                </span>
                <span className="font-medium">{t('support.phone')}</span>
              </span>
            </a>
          </li>
          <li>
            <a
              href={`mailto:${t('support.email')}`}
              className="flex items-center gap-3 rounded-md border border-sand-300 bg-canvas-000 px-4 py-3 text-body-md text-ink-950 hover:bg-sand-100"
            >
              <Mail aria-hidden className="h-5 w-5" />
              <span>
                <span className="block text-meta-xs uppercase tracking-wider text-stone-600">
                  {t('support.emailLabel')}
                </span>
                <span className="font-medium">{t('support.email')}</span>
              </span>
            </a>
          </li>
        </ul>
      </section>

      <div className="flex flex-col items-start gap-3 border-t border-sand-300 pt-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="inline-flex items-center gap-2 text-body-sm text-stone-600">
          <PackageCheck aria-hidden className="h-4 w-4 text-success-700" />
          {t('subhead')}
        </p>
        <Link
          href={`/${locale}/produits`}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink-950 px-5 text-body-md font-medium text-canvas-000 hover:bg-ink-800"
        >
          {t('continue.cta')}
        </Link>
      </div>
    </div>
  );
}
