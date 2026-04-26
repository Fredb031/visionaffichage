# Experiment wiring pattern

Volume II Section 07 — A/B framework usage. This file is documentation
only; nothing imports it and no live experiment is active.

## Basic usage

```tsx
import { useExperiment } from '@/lib/experiments';
import { EXPERIMENTS } from '@/data/experiments';

export function Hero() {
  const variant = useExperiment(EXPERIMENTS.HERO_HEADLINE);

  return (
    <h1>
      {variant === 'variant_a' && '5 jours, livré chez vous.'}
      {variant === 'variant_b' && 'Affichage local, expédié vite.'}
      {variant === 'control' && 'Vision Affichage — impression locale.'}
    </h1>
  );
}
```

`useExperiment` returns `'control'` whenever the experiment is
inactive in `src/data/experiments.ts`, so the call site can stay wired
even when the test is off — flipping `.active = true` in the registry
is the only change needed to ship the test live.

## Conversion tracking

The `experiment_viewed` exposure event fires automatically once per
mount. To attribute conversions, dispatch a paired event when the
desired action completes:

```tsx
import { trackEvent } from '@/lib/analytics';

trackEvent('experiment_converted', {
  experiment_id: EXPERIMENTS.HERO_HEADLINE.id,
  variant,
  value: orderTotalCad,
});
```

Both events flow through the Law 25 consent gate in
`@/lib/analytics`, so they no-op silently when the visitor hasn't
opted in to analytics — no `localStorage` mirror, no `dataLayer`
push, no `gtag` call.

## Why visitor-stable assignment

The framework hashes a persisted visitor id together with the
experiment id. The same visitor sees the same variant across
sessions, which keeps reported lift honest: a returning visitor
isn't reshuffled into a different bucket on day two and double
counted.

## Operator checklist before activating a test

1. Confirm both variants render correctly at every viewport.
2. Add the corresponding `experiment_converted` dispatch at the
   conversion point (purchase, signup, whichever the test targets).
3. Flip `.active = true` in `src/data/experiments.ts`.
4. Watch the `experiment_viewed` and `experiment_converted` events
   in GA4 / the diagnostics queue and let the test accumulate
   exposures before reading results.
