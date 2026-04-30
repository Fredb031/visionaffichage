'use client';

import { useTranslations } from 'next-intl';
import { CheckCircle2, Mail, Phone, Printer } from 'lucide-react';

import { Button } from '@/components/Button';
import type { StoredQuote } from '@/lib/quoteForm';
import type { Locale } from '@/lib/types';

const NEXT_STEP_KEYS = ['1', '2', '3', '4'] as const;
const SUPPORT_PHONE_HREF = 'tel:+13673804808';
const SUPPORT_PHONE_DISPLAY = '(367) 380-4808';
const SUPPORT_EMAIL = 'contact@visionaffichage.com';

type Props = {
  locale: Locale;
  quote: StoredQuote;
};

export function QuoteSubmittedClient({ locale, quote }: Props) {
  const t = useTranslations('quote.success');
  const tPrint = useTranslations('print');
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
            {tPrint('header.title.quote')}
          </span>
          <span>
            {tPrint('header.dateLabel')}: {printDate} ·{' '}
            {tPrint('header.refLabel')}: {quote.quoteId}
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
        <div className="space-y-2">
          <h1 className="text-display-md font-semibold text-ink-950 sm:text-display-lg">
            {t('heading')}
          </h1>
          <p className="text-body-md text-stone-600">{t('subhead')}</p>
        </div>
        <p className="inline-flex items-center gap-2 rounded-md border border-sand-300 bg-canvas-050 px-3 py-2 text-body-sm font-medium text-ink-950">
          <span className="text-meta-xs uppercase tracking-wider text-stone-600">
            {t('ref')}
          </span>
          <span className="font-mono">{quote.quoteId}</span>
        </p>
      </header>

      <section className="rounded-lg border border-sand-300 bg-canvas-000 p-6 sm:p-8">
        <h2 className="text-title-lg font-semibold text-ink-950">
          {t('nextSteps.heading')}
        </h2>
        <ol className="mt-4 space-y-3">
          {NEXT_STEP_KEYS.map((k, i) => (
            <li
              key={k}
              className="flex items-start gap-3 text-body-md text-ink-950"
            >
              <span
                aria-hidden
                className="mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-pill bg-ink-950 text-meta-xs font-semibold text-canvas-000"
              >
                {i + 1}
              </span>
              <span>{t(`nextSteps.${k}`)}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-lg border border-sand-300 bg-canvas-050 p-6 sm:p-8">
        <h2 className="text-title-md font-semibold text-ink-950">
          {t('support')}
        </h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <a
            href={SUPPORT_PHONE_HREF}
            className="inline-flex items-center gap-2 text-body-md font-medium text-ink-950 underline underline-offset-2 hover:text-ink-800"
          >
            <Phone aria-hidden className="h-4 w-4" />
            {SUPPORT_PHONE_DISPLAY}
          </a>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="inline-flex items-center gap-2 text-body-md font-medium text-ink-950 underline underline-offset-2 hover:text-ink-800"
          >
            <Mail aria-hidden className="h-4 w-4" />
            {SUPPORT_EMAIL}
          </a>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button href={`/${locale}`} variant="primary" size="lg">
          {t('returnHome')}
        </Button>
      </div>
    </div>
  );
}
