'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, CheckCircle2, Mail, MapPin, Phone } from 'lucide-react';

import { FormField } from '@/components/checkout/FormField';
import {
  CONTACT_SUBJECTS,
  contactFormSchema,
  type ContactFormValues,
  type StoredContactMessage,
} from '@/lib/contactForm';
import type { Locale } from '@/lib/types';

type Props = {
  locale: Locale;
};

const PHONE_HREF = 'tel:+13673804808';
const PHONE_DISPLAY = '(367) 380-4808';
const EMAIL = 'contact@visionaffichage.com';
const EMAIL_HREF = `mailto:${EMAIL}`;

const MESSAGE_MAX = 2000;

export function ContactClient({ locale }: Props) {
  const t = useTranslations('contact');
  const tErrors = useTranslations('contact.errors');
  const [submitted, setSubmitted] = useState<StoredContactMessage | null>(null);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    mode: 'onTouched',
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      subject: 'product',
      message: '',
      language: locale === 'fr-ca' ? 'fr' : 'en',
      marketingConsent: false,
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = form;

  const messageValue = watch('message') ?? '';

  const onSubmit: SubmitHandler<ContactFormValues> = (values) => {
    const ticketId = `T-${Date.now().toString(36).toUpperCase()}`;
    const stored: StoredContactMessage = {
      ticketId,
      createdAt: new Date().toISOString(),
      name: values.name,
      email: values.email,
      phone: values.phone?.trim() ? values.phone.trim() : undefined,
      subject: values.subject,
      message: values.message,
      language: values.language,
      marketingConsent: values.marketingConsent,
    };
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem(
          'va-last-contact',
          JSON.stringify(stored),
        );
      } catch {
        // ignore
      }
    }
    setSubmitted(stored);
    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  };

  const handleSendAnother = () => {
    setSubmitted(null);
    reset({
      name: '',
      email: '',
      phone: '',
      subject: 'product',
      message: '',
      language: locale === 'fr-ca' ? 'fr' : 'en',
      marketingConsent: false,
    });
  };

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-display-md font-semibold text-ink-950">
          {t('heading')}
        </h1>
        <p className="max-w-2xl text-body-md text-stone-600">{t('subhead')}</p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          {submitted ? (
            <SuccessView
              ticketId={submitted.ticketId}
              onSendAnother={handleSendAnother}
            />
          ) : (
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
                  className="sm:col-span-2"
                >
                  <input
                    id="name"
                    type="text"
                    autoComplete="name"
                    {...register('name')}
                    className={inputClass}
                  />
                </FormField>
                <FormField
                  id="email"
                  label={t('form.email')}
                  required
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
                  id="phone"
                  label={t('form.phone')}
                  error={resolveError(errors.phone?.message, tErrors)}
                >
                  <input
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    {...register('phone')}
                    className={inputClass}
                  />
                </FormField>
                <FormField
                  id="subject"
                  label={t('form.subject')}
                  required
                  error={resolveError(errors.subject?.message, tErrors)}
                  className="sm:col-span-2"
                >
                  <select
                    id="subject"
                    {...register('subject')}
                    className={selectClass}
                  >
                    {CONTACT_SUBJECTS.map((opt) => (
                      <option key={opt} value={opt}>
                        {t(`form.subjectOptions.${opt}`)}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField
                  id="message"
                  label={t('form.message')}
                  required
                  helper={t('form.messageHelper', {
                    used: messageValue.length,
                    max: MESSAGE_MAX,
                  })}
                  error={resolveError(errors.message?.message, tErrors)}
                  className="sm:col-span-2"
                >
                  <textarea
                    id="message"
                    rows={6}
                    maxLength={MESSAGE_MAX}
                    {...register('message')}
                    className={textareaClass}
                  />
                </FormField>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-body-sm font-medium text-ink-950">
                  {t('form.language')}
                </legend>
                <div className="flex flex-wrap gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-sand-300 px-3 py-2 text-body-sm text-ink-950 has-[:checked]:border-ink-950 has-[:checked]:bg-sand-100">
                    <input
                      type="radio"
                      value="fr"
                      {...register('language')}
                      className="h-4 w-4 accent-ink-950"
                    />
                    {t('form.languageFr')}
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-sand-300 px-3 py-2 text-body-sm text-ink-950 has-[:checked]:border-ink-950 has-[:checked]:bg-sand-100">
                    <input
                      type="radio"
                      value="en"
                      {...register('language')}
                      className="h-4 w-4 accent-ink-950"
                    />
                    {t('form.languageEn')}
                  </label>
                </div>
              </fieldset>

              <label className="flex items-start gap-3 rounded-md bg-canvas-000 p-4 text-body-sm text-ink-950">
                <input
                  id="marketingConsent"
                  type="checkbox"
                  {...register('marketingConsent')}
                  className="mt-0.5 h-4 w-4 accent-ink-950"
                />
                <span>{t('form.marketingOptIn')}</span>
              </label>

              <div className="flex justify-end border-t border-sand-300 pt-6">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-ink-950 px-6 text-body-md font-medium text-canvas-000 transition-colors duration-base hover:bg-ink-800 disabled:opacity-60"
                >
                  {t('form.ctaSubmit')}
                  <ArrowRight aria-hidden className="h-4 w-4" />
                </button>
              </div>
            </form>
          )}
        </div>

        <aside aria-label={t('alternatives.heading')}>
          <h2 className="mb-4 text-title-md font-semibold text-ink-950">
            {t('alternatives.heading')}
          </h2>
          <ul className="space-y-4">
            <li>
              <ContactCard
                icon={<Phone aria-hidden className="h-5 w-5" />}
                label={t('alternatives.phoneLabel')}
                primary={
                  <a
                    href={PHONE_HREF}
                    className="text-body-md font-medium text-ink-950 underline underline-offset-2 hover:text-ink-800"
                  >
                    {PHONE_DISPLAY}
                  </a>
                }
                detail={t('alternatives.phoneHours')}
              />
            </li>
            <li>
              <ContactCard
                icon={<Mail aria-hidden className="h-5 w-5" />}
                label={t('alternatives.emailLabel')}
                primary={
                  <a
                    href={EMAIL_HREF}
                    className="break-words text-body-md font-medium text-ink-950 underline underline-offset-2 hover:text-ink-800"
                  >
                    {EMAIL}
                  </a>
                }
                detail={t('alternatives.emailReplyTime')}
              />
            </li>
            <li>
              <ContactCard
                icon={<MapPin aria-hidden className="h-5 w-5" />}
                label={t('alternatives.workshopLabel')}
                primary={
                  <span className="text-body-md font-medium text-ink-950">
                    {t('alternatives.workshopAddress')}
                  </span>
                }
                detail={t('alternatives.workshopByAppointment')}
              />
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}

type ContactCardProps = {
  icon: React.ReactNode;
  label: string;
  primary: React.ReactNode;
  detail: string;
};

function ContactCard({ icon, label, primary, detail }: ContactCardProps) {
  return (
    <div className="flex gap-3 rounded-lg border border-sand-300 bg-canvas-000 p-4">
      <div className="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-sand-100 text-ink-950">
        {icon}
      </div>
      <div className="space-y-1">
        <p className="text-meta-xs uppercase tracking-wider text-stone-600">
          {label}
        </p>
        <div>{primary}</div>
        <p className="text-body-sm text-stone-600">{detail}</p>
      </div>
    </div>
  );
}

type SuccessViewProps = {
  ticketId: string;
  onSendAnother: () => void;
};

function SuccessView({ ticketId, onSendAnother }: SuccessViewProps) {
  const t = useTranslations('contact');
  return (
    <div className="space-y-6 rounded-lg border border-success-700/40 bg-canvas-050 p-6 md:p-8">
      <div className="flex items-start gap-3">
        <CheckCircle2
          aria-hidden
          className="mt-0.5 h-6 w-6 flex-none text-success-700"
        />
        <div className="space-y-2">
          <h2 className="text-title-lg font-semibold text-ink-950">
            {t('success.heading')}
          </h2>
          <p className="text-body-md text-stone-600">
            {t('success.body', { ref: ticketId })}
          </p>
          <p className="text-body-sm text-stone-600">
            {t('success.ref', { ref: ticketId })}
          </p>
        </div>
      </div>
      <div className="flex justify-start border-t border-sand-300 pt-6">
        <button
          type="button"
          onClick={onSendAnother}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-ink-950 bg-canvas-000 px-5 text-body-sm font-medium text-ink-950 transition-colors duration-base hover:bg-sand-100"
        >
          {t('success.sendAnother')}
        </button>
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
  if (raw === 'messageMin') return tErrors('messageMin');
  if (raw === 'messageMax') return tErrors('messageMax');
  if (/email/i.test(raw)) return tErrors('email');
  if (/min|String must contain at least/i.test(raw)) {
    return tErrors('required');
  }
  return raw;
}

const inputClass =
  'h-11 w-full rounded-md border border-sand-300 bg-canvas-000 px-3 text-body-md text-ink-950 placeholder:text-stone-600 focus:border-ink-950 focus:outline-none focus:ring-2 focus:ring-ink-950/30';

const selectClass =
  'h-11 w-full rounded-md border border-sand-300 bg-canvas-000 px-3 text-body-md text-ink-950 focus:border-ink-950 focus:outline-none focus:ring-2 focus:ring-ink-950/30';

const textareaClass =
  'w-full resize-y rounded-md border border-sand-300 bg-canvas-000 px-3 py-2 text-body-md text-ink-950 placeholder:text-stone-600 focus:border-ink-950 focus:outline-none focus:ring-2 focus:ring-ink-950/30';
