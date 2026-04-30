'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, CheckCircle2, Star } from 'lucide-react';

import { FormField } from '@/components/checkout/FormField';
import {
  reviewSubmitSchema,
  type ReviewSubmitValues,
  type StoredReview,
} from '@/lib/reviewSubmitForm';
import { products } from '@/lib/products';
import type { Locale } from '@/lib/types';

type Props = {
  locale: Locale;
};

const TITLE_MAX = 80;
const BODY_MAX = 1000;

export function ReviewSubmitClient({ locale }: Props) {
  const t = useTranslations('reviewSubmit');
  const tErrors = useTranslations('reviewSubmit.form.errors');
  const [submitted, setSubmitted] = useState<StoredReview | null>(null);

  const form = useForm<ReviewSubmitValues>({
    resolver: zodResolver(reviewSubmitSchema),
    mode: 'onTouched',
    defaultValues: {
      name: '',
      email: '',
      company: '',
      role: '',
      productId: '',
      rating: 5,
      title: '',
      body: '',
      consentPublish: false as unknown as true,
      emailMarketing: false,
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = form;

  const ratingValue = Number(watch('rating') ?? 5);
  const titleValue = watch('title') ?? '';
  const bodyValue = watch('body') ?? '';

  const onSubmit: SubmitHandler<ReviewSubmitValues> = (values) => {
    const ref = `R-${Date.now().toString(36).toUpperCase()}`;
    const stored: StoredReview = {
      ref,
      createdAt: new Date().toISOString(),
      name: values.name,
      email: values.email,
      company: values.company?.trim() ? values.company.trim() : undefined,
      role: values.role?.trim() ? values.role.trim() : undefined,
      productId: values.productId?.trim()
        ? values.productId.trim()
        : undefined,
      rating: values.rating,
      title: values.title,
      body: values.body,
      consentPublish: true,
      emailMarketing: values.emailMarketing,
    };
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem('va-last-review', JSON.stringify(stored));
      } catch {
        // ignore
      }
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
    setSubmitted(stored);
  };

  if (submitted) {
    return <SuccessView ref={submitted.ref} locale={locale} />;
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="space-y-6 rounded-lg border border-sand-300 bg-canvas-050 p-6 md:p-8"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="name"
          label={t('form.name')}
          required
          error={resolveError(errors.name?.message, tErrors)}
        >
          <input
            id="name"
            type="text"
            autoComplete="name"
            placeholder={t('form.namePlaceholder')}
            {...register('name')}
            className={inputClass}
          />
        </FormField>
        <FormField
          id="email"
          label={t('form.email')}
          required
          helper={t('form.emailHelper')}
          error={resolveError(errors.email?.message, tErrors)}
        >
          <input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            {...register('email')}
            className={inputClass}
          />
        </FormField>
        <FormField
          id="company"
          label={t('form.company')}
          error={resolveError(errors.company?.message, tErrors)}
        >
          <input
            id="company"
            type="text"
            autoComplete="organization"
            placeholder={t('form.companyPlaceholder')}
            {...register('company')}
            className={inputClass}
          />
        </FormField>
        <FormField
          id="role"
          label={t('form.role')}
          error={resolveError(errors.role?.message, tErrors)}
        >
          <input
            id="role"
            type="text"
            autoComplete="organization-title"
            placeholder={t('form.rolePlaceholder')}
            {...register('role')}
            className={inputClass}
          />
        </FormField>
        <FormField
          id="productId"
          label={t('form.product.label')}
          error={resolveError(errors.productId?.message, tErrors)}
          className="sm:col-span-2"
        >
          <select
            id="productId"
            {...register('productId')}
            className={selectClass}
          >
            <option value="">{t('form.product.options.none')}</option>
            <option value="multiple">
              {t('form.product.options.multiple')}
            </option>
            {products.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.title[locale]}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-body-sm font-medium text-ink-950">
          {t('form.rating.label')}
          <span aria-hidden className="ml-0.5 text-error-700">
            *
          </span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((n) => {
            const active = n <= ratingValue;
            return (
              <label
                key={n}
                className={`inline-flex h-12 w-12 cursor-pointer items-center justify-center rounded-md border transition-colors ${
                  active
                    ? 'border-ink-950 bg-ink-950 text-canvas-000'
                    : 'border-sand-300 bg-canvas-000 text-stone-600 hover:bg-sand-100'
                }`}
                aria-label={t('form.rating.starsLabel', { n })}
              >
                <input
                  type="radio"
                  value={n}
                  className="sr-only"
                  checked={ratingValue === n}
                  onChange={() => {
                    setValue('rating', n, { shouldValidate: true });
                  }}
                />
                <Star
                  aria-hidden
                  className="h-5 w-5"
                  fill={active ? 'currentColor' : 'none'}
                />
              </label>
            );
          })}
        </div>
        {errors.rating?.message ? (
          <p role="alert" className="text-meta-xs font-medium text-error-700">
            {resolveError(errors.rating.message, tErrors)}
          </p>
        ) : null}
      </fieldset>

      <FormField
        id="title"
        label={t('form.title')}
        required
        helper={t('form.titleHelper', { used: titleValue.length, max: TITLE_MAX })}
        error={resolveError(errors.title?.message, tErrors)}
      >
        <input
          id="title"
          type="text"
          maxLength={TITLE_MAX}
          placeholder={t('form.titlePlaceholder')}
          {...register('title')}
          className={inputClass}
        />
      </FormField>

      <FormField
        id="body"
        label={t('form.body')}
        required
        helper={t('form.bodyHelper', { used: bodyValue.length, max: BODY_MAX })}
        error={resolveError(errors.body?.message, tErrors)}
      >
        <textarea
          id="body"
          rows={6}
          maxLength={BODY_MAX}
          placeholder={t('form.bodyPlaceholder')}
          {...register('body')}
          className={textareaClass}
        />
      </FormField>

      <div className="space-y-3">
        <label className="flex items-start gap-3 rounded-md border border-sand-300 bg-canvas-000 p-4 text-body-sm text-ink-950">
          <input
            id="consentPublish"
            type="checkbox"
            {...register('consentPublish')}
            className="mt-0.5 h-4 w-4 accent-ink-950"
          />
          <span>
            {t('form.consentPublish')}
            <span aria-hidden className="ml-0.5 text-error-700">
              *
            </span>
          </span>
        </label>
        {errors.consentPublish?.message ? (
          <p role="alert" className="text-meta-xs font-medium text-error-700">
            {resolveError(errors.consentPublish.message, tErrors)}
          </p>
        ) : null}

        <label className="flex items-start gap-3 rounded-md bg-canvas-000 p-4 text-body-sm text-ink-950">
          <input
            id="emailMarketing"
            type="checkbox"
            {...register('emailMarketing')}
            className="mt-0.5 h-4 w-4 accent-ink-950"
          />
          <span>{t('form.emailMarketing')}</span>
        </label>
      </div>

      <div className="flex justify-end border-t border-sand-300 pt-6">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-ink-950 px-6 text-body-md font-medium text-canvas-000 transition-colors duration-base hover:bg-ink-800 disabled:opacity-60"
        >
          {t('form.submit')}
          <ArrowRight aria-hidden className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}

type SuccessViewProps = {
  ref: string;
  locale: Locale;
};

function SuccessView({ ref, locale }: SuccessViewProps) {
  const t = useTranslations('reviewSubmit.success');
  return (
    <div className="space-y-6 rounded-lg border border-success-700/40 bg-canvas-050 p-6 md:p-8">
      <div className="flex items-start gap-3">
        <CheckCircle2
          aria-hidden
          className="mt-0.5 h-6 w-6 flex-none text-success-700"
        />
        <div className="space-y-2">
          <h2 className="text-title-lg font-semibold text-ink-950">
            {t('heading')}
          </h2>
          <p className="text-body-md text-stone-600">{t('body')}</p>
          <p className="text-body-sm text-stone-600">{t('ref', { ref })}</p>
        </div>
      </div>
      <div className="border-t border-sand-300 pt-6">
        <Link
          href={`/${locale}/avis`}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-ink-950 bg-canvas-000 px-5 text-body-sm font-medium text-ink-950 transition-colors duration-base hover:bg-sand-100"
        >
          {t('returnTo')}
        </Link>
      </div>
    </div>
  );
}

function resolveError(
  raw: string | undefined,
  tErrors: ReturnType<typeof useTranslations>,
): string | undefined {
  if (!raw) return undefined;
  if (raw === 'required') return tErrors('required');
  if (raw === 'email') return tErrors('email');
  if (raw === 'rating') return tErrors('rating');
  if (raw === 'titleMax') return tErrors('titleMax');
  if (raw === 'bodyMin') return tErrors('bodyMin');
  if (raw === 'bodyMax') return tErrors('bodyMax');
  if (raw === 'consentRequired') return tErrors('consentRequired');
  if (/email/i.test(raw)) return tErrors('email');
  if (/min|String must contain/i.test(raw)) return tErrors('required');
  return raw;
}

const inputClass =
  'h-11 w-full rounded-md border border-sand-300 bg-canvas-000 px-3 text-body-md text-ink-950 placeholder:text-stone-600 focus:border-ink-950 focus:outline-none focus:ring-2 focus:ring-ink-950/30';

const selectClass =
  'h-11 w-full rounded-md border border-sand-300 bg-canvas-000 px-3 text-body-md text-ink-950 focus:border-ink-950 focus:outline-none focus:ring-2 focus:ring-ink-950/30';

const textareaClass =
  'w-full resize-y rounded-md border border-sand-300 bg-canvas-000 px-3 py-2 text-body-md text-ink-950 placeholder:text-stone-600 focus:border-ink-950 focus:outline-none focus:ring-2 focus:ring-ink-950/30';
