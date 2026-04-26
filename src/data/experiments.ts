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
 */

export const EXPERIMENTS = {
  HERO_HEADLINE: {
    id: 'hero-headline-2026-04',
    name: 'Hero headline framing',
    variants: ['control', 'variant_a', 'variant_b'],
    // 50/25/25 split: control gets the larger bucket so the existing
    // baseline keeps most of the traffic while we read variants.
    weights: [0.5, 0.25, 0.25],
    active: false,
  },
  PRIMARY_CTA: {
    id: 'primary-cta-2026-04',
    name: 'Primary CTA copy + colour',
    variants: ['control', 'variant_a'],
    // Even split for a two-arm test — fastest path to significance
    // when there are only two variants to compare.
    weights: [0.5, 0.5],
    active: false,
  },
} satisfies Record<string, Experiment>;
