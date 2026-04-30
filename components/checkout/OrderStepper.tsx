import { Check } from 'lucide-react';
import type { Locale } from '@/lib/types';

export type CheckoutStepKey =
  | 'contact'
  | 'shipping'
  | 'billing'
  | 'payment'
  | 'review';

type Props = {
  currentStep: CheckoutStepKey;
  locale: Locale;
  className?: string;
};

const order: CheckoutStepKey[] = [
  'contact',
  'shipping',
  'billing',
  'payment',
  'review',
];

const labels: Record<CheckoutStepKey, { 'fr-ca': string; 'en-ca': string }> = {
  contact: { 'fr-ca': 'Contact', 'en-ca': 'Contact' },
  shipping: { 'fr-ca': 'Livraison', 'en-ca': 'Shipping' },
  billing: { 'fr-ca': 'Facturation', 'en-ca': 'Billing' },
  payment: { 'fr-ca': 'Paiement', 'en-ca': 'Payment' },
  review: { 'fr-ca': 'Révision', 'en-ca': 'Review' },
};

export function OrderStepper({ currentStep, locale, className = '' }: Props) {
  const currentIdx = order.indexOf(currentStep);
  return (
    <nav
      aria-label={locale === 'fr-ca' ? 'Étapes de commande' : 'Checkout steps'}
      className={className}
    >
      <ol className="flex flex-wrap items-center gap-x-3 gap-y-2 text-body-sm">
        {order.map((step, idx) => {
          const isCurrent = idx === currentIdx;
          const isComplete = idx < currentIdx;
          return (
            <li key={step} className="flex items-center gap-3">
              <span
                aria-current={isCurrent ? 'step' : undefined}
                className={`inline-flex items-center gap-2 rounded-pill px-3 py-1 font-medium ${
                  isCurrent
                    ? 'bg-ink-950 text-canvas-000'
                    : isComplete
                      ? 'bg-success-50 text-success-700'
                      : 'bg-sand-100 text-stone-500'
                }`}
              >
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-pill bg-canvas-000/20 text-meta-xs">
                  {isComplete ? <Check aria-hidden className="h-3 w-3" /> : idx + 1}
                </span>
                {labels[step][locale]}
              </span>
              {idx < order.length - 1 ? (
                <span aria-hidden className="text-sand-300">
                  /
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
