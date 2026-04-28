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
import { readLS, writeLS } from './storage';

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
  /** Salesman commission rate as a fraction (0.10 == 10%). Used by
   *  src/lib/commissions.ts to compute per-order payouts. */
  commissionRate: number;
  /** Per-side print fee in CAD. The customizer multiplies this by the
   *  placement-side count (none=0, front|back=1, both=2). Owner-editable
   *  so a shop-rate bump doesn't require a redeploy. */
  printPrice: number;
  /** Task 9.20 — when true, the admin surface surfaces a warning banner
   *  for any admin/president account that hasn't yet enabled 2FA from
   *  their own profile. UI stub: toggling this does not enforce 2FA on
   *  the backend, it only changes what the admin dashboard nags about.
   *  The real TOTP / authenticator integration lives in a future task. */
  require2fa: boolean;
}

// Deep-frozen so a stray `DEFAULT_APP_SETTINGS.discountCodes.NEWCODE = 0.5`
// from an admin component (or a mistakenly-shared reference inside this
// file) can't poison every subsequent fallback for the lifetime of the
// page. The Readonly type catches it at compile time; Object.freeze is
// the runtime belt-and-braces in case a JS consumer or a `as any` cast
// slips past tsc. All current readers spread/clone before mutating, so
// this is a tightening — not a behaviour change.
export const DEFAULT_APP_SETTINGS: Readonly<AppSettings> = Object.freeze({
  taxGst: 0.05,
  taxQst: 0.09975,
  bulkThreshold: 12,
  bulkRate: 0.15,
  discountCodes: Object.freeze({
    VISION10: 0.10,
    VISION15: 0.15,
    VISION20: 0.20,
  }) as Readonly<Record<string, number>>,
  commissionRate: 0.10,
  printPrice: 5.00,
  require2fa: false,
});

// ───────────── 2FA per-user status (Task 9.20, UI stub) ─────────────
//
// The real 2FA enrolment flow belongs in the user-profile surface wired
// to a backend TOTP secret. Until that lands we need *somewhere* to
// read the state from so the admin surfaces (badge in AdminUsers,
// warning banner in AdminDashboard) can render a plausible preview.
// Stored under `vision-user-2fa-enabled` as a `{ [userId]: boolean }`
// map — deliberately decoupled from the `vision-app-settings` bag so a
// backup/restore roundtrip of the settings bag doesn't overwrite
// per-user 2FA state.

const USER_2FA_KEY = 'vision-user-2fa-enabled';

export function getUser2faMap(): Record<string, boolean> {
  const parsed = readLS<Record<string, unknown> | null>(USER_2FA_KEY, null);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (typeof k === 'string' && k.length > 0) out[k] = Boolean(v);
  }
  return out;
}

export function isUser2faEnabled(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return getUser2faMap()[userId] === true;
}

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

function clampPrice(v: unknown, fallback: number): number {
  // Money value: non-negative, capped at a sane ceiling so a stray
  // admin keystroke can't accidentally quote a $1M print fee.
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  if (n < 0) return 0;
  if (n > 1000) return 1000;
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
  // readLS handles the parse + private-mode guard. Everything below is
  // schema validation that readLS doesn't — and shouldn't — know about.
  const parsed = readLS<Record<string, unknown> | null>(STORAGE_KEY, null);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ...DEFAULT_APP_SETTINGS, discountCodes: { ...DEFAULT_APP_SETTINGS.discountCodes } };
  }
  const codes = parsed.discountCodes != null
    ? sanitizeCodes(parsed.discountCodes)
    : { ...DEFAULT_APP_SETTINGS.discountCodes };
  return {
    taxGst: clampFraction(parsed.taxGst, DEFAULT_APP_SETTINGS.taxGst, 0.3),
    taxQst: clampFraction(parsed.taxQst, DEFAULT_APP_SETTINGS.taxQst, 0.3),
    bulkThreshold: clampThreshold(parsed.bulkThreshold, DEFAULT_APP_SETTINGS.bulkThreshold),
    bulkRate: clampFraction(parsed.bulkRate, DEFAULT_APP_SETTINGS.bulkRate, 0.95),
    discountCodes: Object.keys(codes).length > 0 ? codes : { ...DEFAULT_APP_SETTINGS.discountCodes },
    commissionRate: clampFraction(parsed.commissionRate, DEFAULT_APP_SETTINGS.commissionRate, 0.5),
    printPrice: clampPrice(parsed.printPrice, DEFAULT_APP_SETTINGS.printPrice),
    require2fa: typeof parsed.require2fa === 'boolean' ? parsed.require2fa : DEFAULT_APP_SETTINGS.require2fa,
  };
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
    commissionRate: clampFraction(merged.commissionRate, DEFAULT_APP_SETTINGS.commissionRate, 0.5),
    printPrice: clampPrice(merged.printPrice, DEFAULT_APP_SETTINGS.printPrice),
    require2fa: typeof merged.require2fa === 'boolean' ? merged.require2fa : DEFAULT_APP_SETTINGS.require2fa,
  };
  // Private mode or storage quota — state still works in-memory for
  // the current session. Fire the event either way (below) so open
  // admin tabs reflect the attempted change.
  writeLS(STORAGE_KEY, clean);
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
      // `e.key === null` signals a cross-tab `localStorage.clear()` —
      // every key was wiped, including ours, so re-read to fall back to
      // defaults instead of leaving this tab rendering stale settings
      // until the next manual reload. Same pattern as useRecentlyViewed
      // / useWishlist (commit 0eac287).
      if (e.key === null || e.key === STORAGE_KEY) setSettings(getSettings());
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
