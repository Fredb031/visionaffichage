// App-wide editable settings — tax rates, discount codes, bulk-pricing
// thresholds. Persisted to localStorage under a single key so admins
// can tweak without a redeploy. Non-admin pages read via getSettings()
// falling back to defaults so a wiped localStorage never blocks the app.
//
// Intentionally plain React state + a tiny pub/sub — the rest of the
// codebase mixes zustand stores and bespoke hooks, and this surface is
// small enough that pulling in zustand just to persist four values
// would be heavier than the read/write we need.

import { useEffect, useState } from 'react';

export interface AppSettings {
  /** GST/TPS rate as a fraction (0.05 == 5%) */
  taxGst: number;
  /** QST/TVQ rate as a fraction (0.09975 == 9.975%) */
  taxQst: number;
  /** Units threshold above which the bulk discount triggers */
  bulkThreshold: number;
  /** Bulk discount rate as a fraction (0.15 == 15% off) */
  bulkRate: number;
  /** Discount code → rate (fraction). Keys are uppercase. */
  discountCodes: Record<string, number>;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  taxGst: 0.05,
  taxQst: 0.09975,
  bulkThreshold: 12,
  bulkRate: 0.15,
  discountCodes: {
    VISION10: 0.10,
    VISION15: 0.15,
    VISION20: 0.20,
  },
};

const STORAGE_KEY = 'vision-app-settings';
const EVENT_NAME = 'vision-app-settings-change';

function clampFraction(v: unknown, fallback: number, max = 1): number {
  // Clamp into [0, max] so devtools edits or malformed saves can't
  // return a negative tax rate or a >100% discount through the app.
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  if (n < 0) return 0;
  if (n > max) return max;
  return n;
}

function clampThreshold(v: unknown, fallback: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : fallback;
  if (n < 1) return 1;
  if (n > 10_000) return 10_000;
  return n;
}

function sanitizeCodes(input: unknown): Record<string, number> {
  if (!input || typeof input !== 'object') return { ...DEFAULT_APP_SETTINGS.discountCodes };
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    const code = String(key).trim().toUpperCase();
    if (!code || !/^[A-Z0-9_-]{2,32}$/.test(code)) continue;
    const rate = clampFraction(raw, 0, 1);
    if (rate <= 0) continue;
    out[code] = rate;
  }
  return out;
}

export function getSettings(): AppSettings {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return { ...DEFAULT_APP_SETTINGS, discountCodes: { ...DEFAULT_APP_SETTINGS.discountCodes } };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') throw new Error('malformed');
    const codes = parsed.discountCodes != null
      ? sanitizeCodes(parsed.discountCodes)
      : { ...DEFAULT_APP_SETTINGS.discountCodes };
    return {
      taxGst: clampFraction(parsed.taxGst, DEFAULT_APP_SETTINGS.taxGst, 0.3),
      taxQst: clampFraction(parsed.taxQst, DEFAULT_APP_SETTINGS.taxQst, 0.3),
      bulkThreshold: clampThreshold(parsed.bulkThreshold, DEFAULT_APP_SETTINGS.bulkThreshold),
      bulkRate: clampFraction(parsed.bulkRate, DEFAULT_APP_SETTINGS.bulkRate, 0.95),
      discountCodes: Object.keys(codes).length > 0 ? codes : { ...DEFAULT_APP_SETTINGS.discountCodes },
    };
  } catch {
    return { ...DEFAULT_APP_SETTINGS, discountCodes: { ...DEFAULT_APP_SETTINGS.discountCodes } };
  }
}

export function saveSettings(patch: Partial<AppSettings>): AppSettings {
  const current = getSettings();
  const merged: AppSettings = {
    ...current,
    ...patch,
    // Shallow-merge but keep discountCodes sanitized if it was touched.
    discountCodes: patch.discountCodes != null
      ? sanitizeCodes(patch.discountCodes)
      : current.discountCodes,
  };
  // Re-clamp everything so a bad patch can't slip past the getter guards.
  const clean: AppSettings = {
    taxGst: clampFraction(merged.taxGst, DEFAULT_APP_SETTINGS.taxGst, 0.3),
    taxQst: clampFraction(merged.taxQst, DEFAULT_APP_SETTINGS.taxQst, 0.3),
    bulkThreshold: clampThreshold(merged.bulkThreshold, DEFAULT_APP_SETTINGS.bulkThreshold),
    bulkRate: clampFraction(merged.bulkRate, DEFAULT_APP_SETTINGS.bulkRate, 0.95),
    discountCodes: Object.keys(merged.discountCodes).length > 0
      ? merged.discountCodes
      : { ...DEFAULT_APP_SETTINGS.discountCodes },
  };
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    }
  } catch {
    // Private mode or storage quota — state still works in-memory for
    // the current session. Fire the event either way so open admin tabs
    // reflect the attempted change.
  }
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: clean }));
    }
  } catch { /* ignore — SSR or sandboxed iframe */ }
  return clean;
}

/**
 * React hook that tracks the persisted app settings across tabs + in-page
 * updates. Rerenders when any component calls saveSettings(), and when a
 * sibling tab writes to the same storage key.
 */
export function useAppSettings(): AppSettings {
  const [settings, setSettings] = useState<AppSettings>(() => getSettings());

  useEffect(() => {
    const onChange = () => setSettings(getSettings());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setSettings(getSettings());
    };
    window.addEventListener(EVENT_NAME, onChange as EventListener);
    window.addEventListener('storage', onStorage);
    // Re-read on mount so SSR/initial-render mismatches reconcile.
    setSettings(getSettings());
    return () => {
      window.removeEventListener(EVENT_NAME, onChange as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return settings;
}

/** Convenience: total Quebec tax (GST + QST) as a fraction. */
export function getTaxRate(): number {
  const s = getSettings();
  return s.taxGst + s.taxQst;
}
