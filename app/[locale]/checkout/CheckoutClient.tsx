'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  useForm,
  type FieldErrors,
  type Path,
  type SubmitHandler,
  type UseFormRegister,
  type UseFormSetValue,
  type UseFormWatch,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Lock,
  MapPin,
  ShieldCheck,
} from 'lucide-react';

import { Button } from '@/components/Button';
import { OrderStepper, type CheckoutStepKey } from '@/components/checkout/OrderStepper';
import { OrderSummary } from '@/components/checkout/OrderSummary';
import { FormField } from '@/components/checkout/FormField';
import { useCart } from '@/lib/cart';
import {
  CONTACT_FIELDS,
  SHIPPING_FIELDS,
  PAYMENT_FIELDS,
  QC_PROVINCES,
  contactSchema,
  shippingSchema,
  billingSchema,
  paymentSchema,
  orderFormSchema,
  type OrderFormValues,
  type StoredOrder,
} from '@/lib/orderForm';
import type { Locale } from '@/lib/types';

const QC_TAX_RATE = 0.14975;
const SHIPPING_FLAT_CENTS = 1500;
const FREE_SHIPPING_THRESHOLD_CENTS = 25000;

const STEPS: CheckoutStepKey[] = [
  'contact',
  'shipping',
  'billing',
  'payment',
  'review',
];

type Props = {
  locale: Locale;
};

export function CheckoutClient({ locale }: Props) {
  const router = useRouter();
  const t = useTranslations('checkout');
  const tCart = useTranslations('cart');

  const [mounted, setMounted] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const items = useCart((s) => s.items);
  const clearCart = useCart((s) => s.clear);

  useEffect(() => {
    setMounted(true);
  }, []);

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    mode: 'onTouched',
    defaultValues: {
      email: '',
      phone: '',
      firstName: '',
      lastName: '',
      company: '',
      language: locale === 'fr-ca' ? 'fr' : 'en',
      marketingConsent: false,
      addressLine1: '',
      addressLine2: '',
      city: '',
      province: 'QC',
      postalCode: '',
      country: 'CA',
      sameAsShipping: true,
      cardNumber: '',
      cardExpiry: '',
      cardCvc: '',
      cardName: '',
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    setValue,
    formState: { errors, isSubmitting },
  } = form;

  const sameAsShipping = watch('sameAsShipping');

  if (mounted && items.length === 0) {
    return (
      <EmptyCheckout locale={locale} />
    );
  }

  if (!mounted) {
    return (
      <div className="grid gap-8 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-4">
          <div className="h-12 w-full animate-pulse rounded bg-sand-100" />
          <div className="h-72 animate-pulse rounded-lg bg-sand-100" />
        </div>
        <div className="h-72 animate-pulse rounded-lg bg-sand-100" />
      </div>
    );
  }

  const currentStep: CheckoutStepKey = STEPS[stepIdx] ?? 'contact';

  const goToStep = (idx: number) => {
    setStepIdx(Math.max(0, Math.min(STEPS.length - 1, idx)));
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNext = async () => {
    const ok = await validateStep(currentStep);
    if (ok) {
      goToStep(stepIdx + 1);
    }
  };

  const handlePrev = () => goToStep(stepIdx - 1);

  async function validateStep(step: CheckoutStepKey): Promise<boolean> {
    if (step === 'contact') {
      const ok = await trigger([...CONTACT_FIELDS] as Path<OrderFormValues>[]);
      if (!ok) return false;
      const partial = pluckPartial(form.getValues(), CONTACT_FIELDS);
      return contactSchema.safeParse(partial).success;
    }
    if (step === 'shipping') {
      const ok = await trigger([...SHIPPING_FIELDS] as Path<OrderFormValues>[]);
      if (!ok) return false;
      const partial = pluckPartial(form.getValues(), SHIPPING_FIELDS);
      return shippingSchema.safeParse(partial).success;
    }
    if (step === 'billing') {
      if (sameAsShipping) return true;
      const ok = await trigger([...SHIPPING_FIELDS] as Path<OrderFormValues>[]);
      if (!ok) return false;
      const partial = pluckPartial(form.getValues(), SHIPPING_FIELDS);
      return billingSchema.safeParse(partial).success;
    }
    if (step === 'payment') {
      const ok = await trigger([...PAYMENT_FIELDS] as Path<OrderFormValues>[]);
      if (!ok) return false;
      const partial = pluckPartial(form.getValues(), PAYMENT_FIELDS);
      return paymentSchema.safeParse(partial).success;
    }
    return true;
  }

  const onSubmit: SubmitHandler<OrderFormValues> = (values) => {
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

    const orderNumber = `VA-${Date.now().toString(36).toUpperCase()}`;
    const stored: StoredOrder = {
      orderNumber,
      createdAt: new Date().toISOString(),
      contact: {
        email: values.email,
        phone: values.phone,
        firstName: values.firstName,
        lastName: values.lastName,
        company: values.company,
        language: values.language,
        marketingConsent: values.marketingConsent,
      },
      shipping: {
        addressLine1: values.addressLine1,
        addressLine2: values.addressLine2,
        city: values.city,
        province: values.province,
        postalCode: values.postalCode.toUpperCase(),
        country: 'CA',
      },
      billing: values.sameAsShipping
        ? {
            sameAsShipping: true,
            addressLine1: values.addressLine1,
            addressLine2: values.addressLine2,
            city: values.city,
            province: values.province,
            postalCode: values.postalCode.toUpperCase(),
            country: 'CA',
          }
        : {
            sameAsShipping: false,
            addressLine1: values.addressLine1,
            addressLine2: values.addressLine2,
            city: values.city,
            province: values.province,
            postalCode: values.postalCode.toUpperCase(),
            country: 'CA',
          },
      items: items.map((i) => ({ ...i })),
      totals: { subtotalCents, shippingCents, taxCents, totalCents },
    };

    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem('va-last-order', JSON.stringify(stored));
      } catch {
        // sessionStorage unavailable; ignore
      }
    }

    clearCart();
    router.push(`/${locale}/confirmation?order=${orderNumber}`);
  };

  const handleFinalSubmit = async () => {
    const ok = await trigger();
    if (ok) {
      await handleSubmit(onSubmit)();
    }
  };

  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      noValidate
      className="space-y-8"
    >
      <header className="space-y-4">
        <h1 className="text-display-md font-semibold text-ink-950">
          {t('heading')}
        </h1>
        <OrderStepper currentStep={currentStep} locale={locale} />
      </header>

      <div className="grid gap-8 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-8">
          {currentStep === 'contact' && (
            <ContactStep
              register={register}
              errors={errors}
              setValue={setValue}
              watch={watch}
              locale={locale}
            />
          )}
          {currentStep === 'shipping' && (
            <ShippingStep
              register={register}
              errors={errors}
              setValue={setValue}
              locale={locale}
            />
          )}
          {currentStep === 'billing' && (
            <BillingStep
              register={register}
              errors={errors}
              setValue={setValue}
              watch={watch}
              locale={locale}
            />
          )}
          {currentStep === 'payment' && (
            <PaymentStep
              register={register}
              errors={errors}
              setValue={setValue}
              locale={locale}
            />
          )}
          {currentStep === 'review' && (
            <ReviewStep values={watch()} locale={locale} onEdit={goToStep} />
          )}

          <div className="flex flex-col-reverse items-stretch gap-3 border-t border-sand-300 pt-6 sm:flex-row sm:justify-between">
            {stepIdx > 0 ? (
              <button
                type="button"
                onClick={handlePrev}
                className="inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-body-sm font-medium text-ink-950 hover:bg-sand-100"
              >
                <ArrowLeft aria-hidden className="h-4 w-4" />
                {t('cta.previous')}
              </button>
            ) : (
              <span />
            )}

            {currentStep === 'review' ? (
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-ink-950 px-6 text-body-md font-medium text-canvas-000 transition-colors duration-base hover:bg-ink-800 disabled:opacity-60"
              >
                <Lock aria-hidden className="h-4 w-4" />
                {t('cta.placeOrder')}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-ink-950 px-6 text-body-md font-medium text-canvas-000 transition-colors duration-base hover:bg-ink-800"
              >
                {t('cta.continue')}
                <ArrowRight aria-hidden className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <details className="group rounded-lg border border-sand-300 bg-canvas-050 lg:hidden">
            <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-body-sm font-medium text-ink-950">
              <span>{tCart('summary.heading')}</span>
              <ChevronRight
                aria-hidden
                className="h-4 w-4 transition-transform group-open:rotate-90"
              />
            </summary>
            <div className="border-t border-sand-300 p-3">
              <OrderSummary items={items} locale={locale} showItems />
            </div>
          </details>

          <div className="hidden lg:block">
            <OrderSummary items={items} locale={locale} showItems />
          </div>
        </aside>
      </div>
    </form>
  );
}

function pluckPartial<T extends object, K extends keyof T>(
  values: T,
  fields: readonly K[],
): Partial<T> {
  const out: Partial<T> = {};
  for (const f of fields) {
    out[f] = values[f];
  }
  return out;
}

function EmptyCheckout({ locale }: { locale: Locale }) {
  const tCart = useTranslations('cart');
  return (
    <div className="rounded-lg border border-dashed border-sand-300 bg-canvas-050 px-6 py-16 text-center">
      <h2 className="text-title-md text-ink-950">
        {tCart('emptyState.title')}
      </h2>
      <p className="mt-2 text-body-md text-stone-600">
        {tCart('emptyState.body')}
      </p>
      <div className="mt-6">
        <Button href={`/${locale}/produits`} variant="primary" size="lg">
          {tCart('emptyState.cta')}
        </Button>
      </div>
    </div>
  );
}

type StepProps = {
  register: UseFormRegister<OrderFormValues>;
  errors: FieldErrors<OrderFormValues>;
  setValue: UseFormSetValue<OrderFormValues>;
  watch: UseFormWatch<OrderFormValues>;
  locale: Locale;
};

type SimpleStepProps = Omit<StepProps, 'watch'>;

function ContactStep({ register, errors, locale }: StepProps) {
  const t = useTranslations('checkout');
  const tErrors = useTranslations('checkout.errors');
  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-title-lg font-semibold text-ink-950">
          {t('contactForm.heading')}
        </h2>
        <p className="rounded-md bg-sand-100 px-3 py-2 text-body-sm text-ink-950">
          {t('contactForm.guestNote')}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="email"
          label={t('contactForm.email')}
          required
          error={resolveError(errors.email?.message, tErrors)}
          className="sm:col-span-2"
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
          label={t('contactForm.phone')}
          required
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
          id="company"
          label={t('contactForm.company')}
          required
          error={resolveError(errors.company?.message, tErrors)}
        >
          <input
            id="company"
            type="text"
            autoComplete="organization"
            {...register('company')}
            className={inputClass}
          />
        </FormField>
        <FormField
          id="firstName"
          label={t('contactForm.firstName')}
          required
          error={resolveError(errors.firstName?.message, tErrors)}
        >
          <input
            id="firstName"
            type="text"
            autoComplete="given-name"
            {...register('firstName')}
            className={inputClass}
          />
        </FormField>
        <FormField
          id="lastName"
          label={t('contactForm.lastName')}
          required
          error={resolveError(errors.lastName?.message, tErrors)}
        >
          <input
            id="lastName"
            type="text"
            autoComplete="family-name"
            {...register('lastName')}
            className={inputClass}
          />
        </FormField>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-body-sm font-medium text-ink-950">
          {t('contactForm.language')}
        </legend>
        <div className="flex flex-wrap gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-sand-300 px-3 py-2 text-body-sm text-ink-950 has-[:checked]:border-ink-950 has-[:checked]:bg-sand-100">
            <input
              type="radio"
              value="fr"
              {...register('language')}
              className="h-4 w-4 accent-ink-950"
            />
            {t('contactForm.languageFr')}
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-sand-300 px-3 py-2 text-body-sm text-ink-950 has-[:checked]:border-ink-950 has-[:checked]:bg-sand-100">
            <input
              type="radio"
              value="en"
              {...register('language')}
              className="h-4 w-4 accent-ink-950"
            />
            {t('contactForm.languageEn')}
          </label>
        </div>
      </fieldset>

      <label className="flex items-start gap-3 rounded-md bg-canvas-050 p-4 text-body-sm text-ink-950">
        <input
          id="marketingConsent"
          type="checkbox"
          {...register('marketingConsent')}
          className="mt-0.5 h-4 w-4 accent-ink-950"
        />
        <span>{t('contactForm.marketingOptIn')}</span>
      </label>
      <span className="sr-only">{locale}</span>
    </section>
  );
}

function ShippingStep({ register, errors, setValue, locale }: SimpleStepProps) {
  const t = useTranslations('checkout');
  const tErrors = useTranslations('checkout.errors');
  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-title-lg font-semibold text-ink-950">
          <MapPin
            aria-hidden
            className="mr-2 inline-block h-5 w-5 text-ink-950"
          />
          {t('shippingForm.heading')}
        </h2>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="addressLine1"
          label={t('shippingForm.addressLine1')}
          required
          error={resolveError(errors.addressLine1?.message, tErrors)}
          className="sm:col-span-2"
        >
          <input
            id="addressLine1"
            type="text"
            autoComplete="address-line1"
            {...register('addressLine1')}
            className={inputClass}
          />
        </FormField>
        <FormField
          id="addressLine2"
          label={t('shippingForm.addressLine2')}
          error={resolveError(errors.addressLine2?.message, tErrors)}
          className="sm:col-span-2"
        >
          <input
            id="addressLine2"
            type="text"
            autoComplete="address-line2"
            {...register('addressLine2')}
            className={inputClass}
          />
        </FormField>
        <FormField
          id="city"
          label={t('shippingForm.city')}
          required
          error={resolveError(errors.city?.message, tErrors)}
        >
          <input
            id="city"
            type="text"
            autoComplete="address-level2"
            {...register('city')}
            className={inputClass}
          />
        </FormField>
        <FormField
          id="province"
          label={t('shippingForm.province')}
          required
          error={resolveError(errors.province?.message, tErrors)}
        >
          <select
            id="province"
            autoComplete="address-level1"
            {...register('province')}
            className={selectClass}
          >
            {QC_PROVINCES.map((p) => (
              <option key={p.code} value={p.code}>
                {p.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          id="postalCode"
          label={t('shippingForm.postalCode')}
          required
          error={resolveError(errors.postalCode?.message, tErrors)}
        >
          <input
            id="postalCode"
            type="text"
            autoComplete="postal-code"
            {...register('postalCode', {
              onChange: (e) => {
                const next = e.target.value.toUpperCase();
                setValue('postalCode', next, { shouldValidate: false });
              },
            })}
            className={`${inputClass} uppercase`}
          />
        </FormField>
        <FormField
          id="country"
          label={t('shippingForm.country')}
          required
        >
          <input
            id="country"
            type="text"
            value={locale === 'fr-ca' ? 'Canada' : 'Canada'}
            readOnly
            aria-readonly
            className={`${inputClass} cursor-not-allowed bg-canvas-050`}
          />
          <input type="hidden" {...register('country')} value="CA" />
        </FormField>
      </div>
    </section>
  );
}

function BillingStep({ register, errors, setValue, watch, locale }: StepProps) {
  const t = useTranslations('checkout');
  const tErrors = useTranslations('checkout.errors');
  const sameAsShipping = watch('sameAsShipping');
  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-title-lg font-semibold text-ink-950">
          {t('billingForm.heading')}
        </h2>
      </header>

      <label className="flex items-start gap-3 rounded-md bg-canvas-050 p-4 text-body-sm text-ink-950">
        <input
          id="sameAsShipping"
          type="checkbox"
          {...register('sameAsShipping')}
          className="mt-0.5 h-4 w-4 accent-ink-950"
        />
        <span className="font-medium">
          {t('billingForm.sameAsShipping')}
        </span>
      </label>

      {!sameAsShipping ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="billing-addressLine1"
            label={t('shippingForm.addressLine1')}
            required
            error={resolveError(errors.addressLine1?.message, tErrors)}
            className="sm:col-span-2"
          >
            <input
              id="billing-addressLine1"
              type="text"
              {...register('addressLine1')}
              className={inputClass}
            />
          </FormField>
          <FormField
            id="billing-addressLine2"
            label={t('shippingForm.addressLine2')}
            className="sm:col-span-2"
          >
            <input
              id="billing-addressLine2"
              type="text"
              {...register('addressLine2')}
              className={inputClass}
            />
          </FormField>
          <FormField
            id="billing-city"
            label={t('shippingForm.city')}
            required
            error={resolveError(errors.city?.message, tErrors)}
          >
            <input
              id="billing-city"
              type="text"
              {...register('city')}
              className={inputClass}
            />
          </FormField>
          <FormField
            id="billing-province"
            label={t('shippingForm.province')}
            required
            error={resolveError(errors.province?.message, tErrors)}
          >
            <select
              id="billing-province"
              {...register('province')}
              className={selectClass}
            >
              {QC_PROVINCES.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField
            id="billing-postalCode"
            label={t('shippingForm.postalCode')}
            required
            error={resolveError(errors.postalCode?.message, tErrors)}
          >
            <input
              id="billing-postalCode"
              type="text"
              {...register('postalCode', {
                onChange: (e) => {
                  setValue('postalCode', e.target.value.toUpperCase(), {
                    shouldValidate: false,
                  });
                },
              })}
              className={`${inputClass} uppercase`}
            />
          </FormField>
        </div>
      ) : null}
      <span className="sr-only">{locale}</span>
    </section>
  );
}

function PaymentStep({ register, errors, setValue, locale }: SimpleStepProps) {
  const t = useTranslations('checkout');
  const tErrors = useTranslations('checkout.errors');
  return (
    <section className="space-y-6">
      <header className="space-y-3">
        <h2 className="text-title-lg font-semibold text-ink-950">
          {t('paymentForm.heading')}
        </h2>
        <div className="flex items-start gap-3 rounded-md border border-warning-200 bg-warning-50 p-4 text-body-sm text-warning-700">
          <Lock aria-hidden className="mt-0.5 h-4 w-4 flex-none" />
          <p className="font-medium">{t('paymentForm.simulationNotice')}</p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="cardNumber"
          label={t('paymentForm.cardNumber')}
          required
          error={resolveError(errors.cardNumber?.message, tErrors)}
          className="sm:col-span-2"
        >
          <input
            id="cardNumber"
            type="text"
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="4242 4242 4242 4242"
            maxLength={19}
            {...register('cardNumber', {
              onChange: (e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 16);
                const grouped = digits.replace(/(.{4})/g, '$1 ').trim();
                setValue('cardNumber', grouped, { shouldValidate: false });
              },
            })}
            className={`${inputClass} tabular-nums`}
          />
        </FormField>
        <FormField
          id="cardName"
          label={t('paymentForm.cardName')}
          required
          error={resolveError(errors.cardName?.message, tErrors)}
          className="sm:col-span-2"
        >
          <input
            id="cardName"
            type="text"
            autoComplete="cc-name"
            {...register('cardName')}
            className={inputClass}
          />
        </FormField>
        <FormField
          id="cardExpiry"
          label={t('paymentForm.cardExpiry')}
          required
          error={resolveError(errors.cardExpiry?.message, tErrors)}
        >
          <input
            id="cardExpiry"
            type="text"
            inputMode="numeric"
            autoComplete="cc-exp"
            placeholder="MM/YY"
            maxLength={5}
            {...register('cardExpiry', {
              onChange: (e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
                const formatted =
                  digits.length >= 3
                    ? `${digits.slice(0, 2)}/${digits.slice(2)}`
                    : digits;
                setValue('cardExpiry', formatted, { shouldValidate: false });
              },
            })}
            className={`${inputClass} tabular-nums`}
          />
        </FormField>
        <FormField
          id="cardCvc"
          label={t('paymentForm.cardCvc')}
          required
          error={resolveError(errors.cardCvc?.message, tErrors)}
        >
          <input
            id="cardCvc"
            type="text"
            inputMode="numeric"
            autoComplete="cc-csc"
            placeholder="123"
            maxLength={4}
            {...register('cardCvc', {
              onChange: (e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
                setValue('cardCvc', digits, { shouldValidate: false });
              },
            })}
            className={`${inputClass} tabular-nums`}
          />
        </FormField>
      </div>

      <ul className="grid gap-3 rounded-md border border-sand-300 bg-canvas-050 p-4 sm:grid-cols-3">
        <li className="flex items-center gap-2 text-meta-xs uppercase tracking-wider text-stone-600">
          <ShieldCheck aria-hidden className="h-4 w-4" />
          {t('paymentForm.trust.ssl')}
        </li>
        <li className="flex items-center gap-2 text-meta-xs uppercase tracking-wider text-stone-600">
          <CheckCircle2 aria-hidden className="h-4 w-4" />
          {t('paymentForm.trust.cards')}
        </li>
        <li className="flex items-center gap-2 text-meta-xs uppercase tracking-wider text-stone-600">
          <MapPin aria-hidden className="h-4 w-4" />
          {t('paymentForm.trust.canada')}
        </li>
      </ul>
      <span className="sr-only">{locale}</span>
    </section>
  );
}

function ReviewStep({
  values,
  locale,
  onEdit,
}: {
  values: OrderFormValues;
  locale: Locale;
  onEdit: (idx: number) => void;
}) {
  const t = useTranslations('checkout');
  const cardLast4 = useMemo(() => {
    const digits = (values.cardNumber || '').replace(/\D/g, '');
    return digits.length >= 4 ? digits.slice(-4) : '----';
  }, [values.cardNumber]);

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-title-lg font-semibold text-ink-950">
          {t('reviewStep.heading')}
        </h2>
      </header>

      <ReviewBlock
        title={t('reviewStep.contactSection')}
        editLabel={t('reviewStep.editStep')}
        onEdit={() => onEdit(0)}
      >
        <p className="text-body-sm text-ink-950">
          {values.firstName} {values.lastName} · {values.company}
        </p>
        <p className="text-body-sm text-stone-600">
          {values.email} · {values.phone}
        </p>
      </ReviewBlock>

      <ReviewBlock
        title={t('reviewStep.shippingSection')}
        editLabel={t('reviewStep.editStep')}
        onEdit={() => onEdit(1)}
      >
        <p className="text-body-sm text-ink-950">{values.addressLine1}</p>
        {values.addressLine2 ? (
          <p className="text-body-sm text-ink-950">{values.addressLine2}</p>
        ) : null}
        <p className="text-body-sm text-stone-600">
          {values.city}, {values.province} {values.postalCode}
        </p>
      </ReviewBlock>

      <ReviewBlock
        title={t('reviewStep.billingSection')}
        editLabel={t('reviewStep.editStep')}
        onEdit={() => onEdit(2)}
      >
        <p className="text-body-sm text-ink-950">
          {values.sameAsShipping
            ? t('billingForm.sameAsShipping')
            : `${values.addressLine1}, ${values.city}, ${values.province} ${values.postalCode}`}
        </p>
      </ReviewBlock>

      <ReviewBlock
        title={t('reviewStep.paymentSection')}
        editLabel={t('reviewStep.editStep')}
        onEdit={() => onEdit(3)}
      >
        <p className="text-body-sm text-ink-950">
          {values.cardName} · •••• {cardLast4} · {values.cardExpiry}
        </p>
        <p className="text-meta-xs uppercase tracking-wider text-warning-700">
          {t('paymentForm.simulationNotice')}
        </p>
      </ReviewBlock>
      <span className="sr-only">{locale}</span>
    </section>
  );
}

function ReviewBlock({
  title,
  editLabel,
  onEdit,
  children,
}: {
  title: string;
  editLabel: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-lg border border-sand-300 bg-canvas-000 p-4 sm:p-5">
      <header className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-title-md text-ink-950">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          className="text-body-sm font-medium text-ink-950 underline underline-offset-2 hover:text-ink-800"
        >
          {editLabel}
        </button>
      </header>
      <div className="space-y-1">{children}</div>
    </article>
  );
}

function resolveError(
  raw: string | undefined,
  tErrors: ReturnType<typeof useTranslations<'checkout.errors'>>,
): string | undefined {
  if (!raw) return undefined;
  // Map known zod messages to translated labels; fall back to required.
  if (/email/i.test(raw)) return tErrors('email');
  if (/regex|postal/i.test(raw) && /[A-Z]\\d/i.test(raw)) {
    return tErrors('postalCode');
  }
  if (/^Required$|min|String must contain at least/.test(raw)) {
    return tErrors('required');
  }
  return raw;
}

const inputClass =
  'h-11 w-full rounded-md border border-sand-300 bg-canvas-000 px-3 text-body-md text-ink-950 placeholder:text-stone-600 focus:border-ink-950 focus:outline-none focus:ring-2 focus:ring-ink-950/30';

const selectClass =
  'h-11 w-full rounded-md border border-sand-300 bg-canvas-000 px-3 text-body-md text-ink-950 focus:border-ink-950 focus:outline-none focus:ring-2 focus:ring-ink-950/30';
