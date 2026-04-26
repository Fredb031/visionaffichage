import { useEffect, useMemo, useRef } from 'react';
import { trackEvent } from '@/lib/analytics';

/**
 * Visitor-stable A/B testing framework — Volume II Section 07.
 *
 * The framework is built around three guarantees:
 *
 *  1. **Stable assignment**: a visitor sees the same variant for the
 *     same experiment across sessions, achieved by hashing a
 *     persistent visitor id together with the experiment id and
 *     bucketing the result against the experiment's weight vector.
 *
 *  2. **Consent-safe**: we forward exposure events through
 *     `trackEvent` from `@/lib/analytics`, which is already Law 25
 *     gated. When consent isn't granted the dispatch silently no-ops
 *     and no `experiment_viewed` rows ever leave the device.
 *
 *  3. **No-op when inactive**: experiments default to inactive in the
 *     registry. An inactive experiment short-circuits to `'control'`
 *     and skips the exposure event, so pre-registered tests cost
 *     nothing until the operator flips `.active = true`.
 *
 * The hash is the FNV-1a 32-bit non-cryptographic hash. We don't need
 * cryptographic strength — we need a fast, dependency-free hash with
 * good avalanche so that small changes to the visitor id yield
 * uniformly distributed buckets. Producing `Math.random()`-style
 * randomness would defeat the point: the same visitor would be
 * reassigned every render.
 */

export interface Experiment {
  id: string;
  name: string;
  variants: string[];
  weights: number[];
  active: boolean;
}

const VISITOR_ID_KEY = 'va:visitor-id';

/**
 * Read or mint a stable per-browser visitor id. Stored in
 * localStorage so the same visitor lands in the same bucket across
 * sessions; falls back to an in-memory id if storage is unavailable
 * (private mode, quota, sandboxed iframe). The fallback id still
 * produces deterministic assignment within the page lifetime, which
 * is the best we can offer when the browser refuses to persist
 * anything.
 */
export function getVisitorId(): string {
  // SSR / non-browser — return a placeholder. Caller hooks only run
  // client-side via useEffect, so this branch is mostly defensive.
  if (typeof window === 'undefined') {
    return 'ssr';
  }

  try {
    const existing = window.localStorage.getItem(VISITOR_ID_KEY);
    if (existing && existing.length > 0) {
      return existing;
    }
  } catch {
    // Storage blocked — fall through to mint an ephemeral id.
  }

  const minted = mintVisitorId();

  try {
    window.localStorage.setItem(VISITOR_ID_KEY, minted);
  } catch {
    // Quota / private mode — assignment within this page still works
    // because the caller usually holds the id in a useMemo, but the
    // visitor will be re-bucketed on the next page load. Acceptable.
  }

  return minted;
}

function mintVisitorId(): string {
  // Prefer crypto.randomUUID where available (modern browsers + secure
  // contexts). Fall back to a Math.random hex string otherwise — the
  // collision probability is fine for analytics-grade uniqueness.
  try {
    const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (c?.randomUUID) {
      return c.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return (
    Math.random().toString(36).slice(2) +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2)
  );
}

/**
 * FNV-1a 32-bit hash → normalised to [0, 1). Deterministic for the
 * same input string; small input changes produce well-distributed
 * outputs, which is what bucket assignment needs.
 */
function hashToUnitInterval(input: string): number {
  let h = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    // Multiply by FNV prime (16777619). Using Math.imul keeps the
    // result in 32-bit signed range without BigInt overhead.
    h = Math.imul(h, 0x01000193);
  }
  // Convert signed 32-bit to unsigned, then to [0, 1).
  return (h >>> 0) / 0x100000000;
}

/**
 * Assign a variant deterministically. The bucket is `hash(expId + ':' + visitorId)`
 * walked against the cumulative weight vector. An inactive experiment
 * always returns `'control'` (or the first variant if `'control'` is
 * absent) so flipping `.active = false` is a clean kill-switch.
 */
export function assignVariant(exp: Experiment, visitorId: string): string {
  if (!exp.active) {
    return exp.variants.includes('control') ? 'control' : exp.variants[0];
  }

  // Defensive: malformed config (mismatched lengths or empty variant
  // list) shouldn't crash the page. Fail safe to control.
  if (exp.variants.length === 0) {
    return 'control';
  }
  if (exp.variants.length !== exp.weights.length) {
    return exp.variants[0];
  }

  const totalWeight = exp.weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight <= 0) {
    return exp.variants[0];
  }

  const bucket = hashToUnitInterval(`${exp.id}:${visitorId}`) * totalWeight;

  let cumulative = 0;
  for (let i = 0; i < exp.variants.length; i++) {
    cumulative += exp.weights[i];
    if (bucket < cumulative) {
      return exp.variants[i];
    }
  }
  // Floating-point edge case where bucket lands exactly on totalWeight.
  return exp.variants[exp.variants.length - 1];
}

/**
 * React hook: read the visitor id, assign a variant, and fire one
 * `experiment_viewed` exposure event per mount. The event is gated by
 * `trackEvent` itself — when Law 25 consent isn't granted nothing
 * leaves the device. We use `useRef` to guarantee single-fire per
 * mount even under React 18 strict-mode double effects.
 */
export function useExperiment(exp: Experiment): string {
  // Memoise visitor id + variant so re-renders don't recompute the
  // hash. The variant is referentially stable for the same experiment
  // active flag and visitor id.
  const variant = useMemo(() => {
    const visitorId = getVisitorId();
    return assignVariant(exp, visitorId);
  }, [exp]);

  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    if (!exp.active) return; // No exposure event for inactive tests.
    trackEvent('experiment_viewed', {
      experiment_id: exp.id,
      experiment_name: exp.name,
      variant,
    });
  }, [exp, variant]);

  return variant;
}
