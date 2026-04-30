'use client';

import { useTranslations } from 'next-intl';
import { CheckCircle2, Mail, Phone, PackageCheck, Printer } from 'lucide-react';

import { Button } from '@/components/Button';
import { getKit } from '@/lib/kitTypes';
import { formatCAD } from '@/lib/format';
import type { StoredKitOrder } from '@/lib/kitForm';
import type { Locale } from '@/lib/types';

const NEXT_STEP_KEYS = ['1', '2', '3', '4'] as const;

type Props = {
  locale: Locale;
  order: StoredKitOrder;
};

export function KitSubmittedClient({ locale, order }: Props) {
  const t = useTranslations('kit.success');
  const tPrint = useTranslations('print');
  const kit = getKit(order.kitId);
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
            {tPrint('header.title.kit')}
          </span>
          <span>
            {tPrint('header.dateLabel')}: {printDate} ·{' '}
            {tPrint('header.refLabel')}: {order.orderNumber}
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
          <span className="text-stone-600">{t('ref')} :</span>{' '}
          <span className="font-semibold tabular-nums">{order.orderNumber}</span>
        </p>
      </header>

      {kit ? (
        <section
          aria-labelledby="kit-summary-heading"
          className="rounded-lg border border-sand-300 bg-canvas-000 p-6 md:p-8"
        >
          <header className="flex flex-col gap-2 border-b border-sand-300 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2
                id="kit-summary-heading"
                className="text-title-lg font-semibold text-ink-950"
              >
                {kit.name[locale]}
              </h2>
              <p className="text-body-sm text-stone-600">
                {kit.bestFor[locale]}
              </p>
            </div>
            <p className="text-body-md font-semibold text-ink-950 tabular-nums">
              {formatCAD(kit.priceCents, locale)}
            </p>
          </header>
          <ul className="mt-4 space-y-1.5 text-body-sm text-ink-950">
            {kit.contents.map((entry, idx) => (
              <li key={idx}>· {entry.description[locale]}</li>
            ))}
          </ul>
          <p className="mt-4 text-body-sm text-stone-600">
            {order.shipping.addressLine1}, {order.shipping.city},{' '}
            {order.shipping.province} {order.shipping.postalCode}
          </p>
        </section>
      ) : null}

      <section
        aria-labelledby="kit-next-steps"
        className="rounded-lg border border-sand-300 bg-canvas-050 p-6 md:p-8"
      >
        <h2
          id="kit-next-steps"
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

      <section
        aria-labelledby="kit-support"
        className="rounded-lg border border-sand-300 bg-canvas-050 p-6 md:p-8"
      >
        <h2
          id="kit-support"
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

      <div className="flex flex-col items-stretch gap-3 border-t border-sand-300 pt-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="inline-flex items-center gap-2 text-body-sm text-stone-600">
          <PackageCheck aria-hidden className="h-4 w-4 text-success-700" />
          {t('subhead')}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button href={`/${locale}/produits`} variant="secondary" size="lg">
            {t('ctaShop')}
          </Button>
          <Button href={`/${locale}/soumission`} variant="primary" size="lg">
            {t('ctaQuote')}
          </Button>
        </div>
      </div>
    </div>
  );
}
