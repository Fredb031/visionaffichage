import type { Experiment } from '@/lib/experiments';

/**
 * Experiment registry — Volume II Section 07 priority tests.
 *
 * Both entries ship inactive. The operator flips `.active` to `true`
 * once they're ready to begin collecting exposure data. Keeping them
 * registered (even when off) lets the wiring in components stay in
 * place permanently — toggling the flag is the only change needed to
 * start or stop a test.
 *
 * Weights must sum to 1.0 and align positionally with `variants`.
 * The first variant should always be `control` so an inactive
 * experiment short-circuits to the unmodified baseline experience.
 *
 * Same freeze pattern as pricing.ts (ba33680) and caseStudies.ts
 * (7df2683): the registry is the source of truth for bucket
 * assignment. A stray consumer flipping `EXPERIMENTS.HERO_HEADLINE.active = true`
 * mid-session, pushing onto `variants`, or rewriting `weights` would
 * silently re-bucket every subsequent visitor in the SPA session and
 * corrupt the exposure stream. Object.freeze on the table, on each
 * experiment, and on the variants/weights arrays makes that mutation
 * throw in strict mode; the `Readonly<…>` type surfaces the same
 * guarantee at compile time so a "let me just toggle this here" attempt
 * fails the build instead. Consumers (`assignVariant`, `useExperiment`)
 * only do read-only ops — `.length`, `.includes`, `.reduce`, indexing —
 * so no consumer changes are required.
 */

type FrozenExperiment = Readonly<{
  id: string;
  name: string;
  variants: readonly string[];
  weights: readonly number[];
  active: boolean;
}>;

const REGISTRY = {
  HERO_HEADLINE: Object.freeze({
    id: 'hero-headline-2026-04',
    name: 'Hero headline framing',
    variants: Object.freeze(['control', 'variant_a', 'variant_b'] as const),
    // 50/25/25 split: control gets the larger bucket so the existing
    // baseline keeps most of the traffic while we read variants.
    weights: Object.freeze([0.5, 0.25, 0.25] as const),
    active: false,
  }),
  PRIMARY_CTA: Object.freeze({
    id: 'primary-cta-2026-04',
    name: 'Primary CTA copy + colour',
    variants: Object.freeze(['control', 'variant_a'] as const),
    // Even split for a two-arm test — fastest path to significance
    // when there are only two variants to compare.
    weights: Object.freeze([0.5, 0.5] as const),
    active: false,
  }),
} as const satisfies Record<string, Experiment>;

export const EXPERIMENTS: Readonly<Record<keyof typeof REGISTRY, FrozenExperiment>> =
  Object.freeze(REGISTRY);
