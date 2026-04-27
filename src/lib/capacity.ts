// Volume II §10.1 — weekly production-capacity model.
//
// The real source of truth is the operator-side Supabase
// `weekly_capacity` table (one row per ISO-week, columns
// week_start_iso / total_slots / booked_slots). That wiring is a
// follow-up for the VA team — until it lands, the UI needs a
// believable surrogate so the scarcity widget can be designed,
// reviewed and shipped without blocking on a backend change.
//
// This module is that surrogate. It reads/writes a single
// `va:capacity` blob in localStorage with the same shape the
// Supabase row will eventually hydrate. Swapping in the real
// fetch later is a one-function change inside getCurrentCapacity()
// — every consumer (CapacityWidget, AdminCapacity) speaks the
// neutral WeeklyCapacity shape, not localStorage internals.
//
// readLS / writeLS handle the corrupted-blob + private-mode-Safari
// failure modes the rest of the app already protects against, so
// a malformed `va:capacity` value doesn't take the homepage hero
// down with it.

import { readLS, writeLS } from '@/lib/storage';

const CAPACITY_KEY = 'va:capacity';

export interface WeeklyCapacity {
  /** ISO date (YYYY-MM-DD) of the Monday that opens this capacity
   * week. Stored as a string rather than a Date so it round-trips
   * through JSON without timezone drift. */
  weekStartIso: string;
  /** Total production slots available for the week. Default 50 —
   * the VA team can adjust this from /admin/capacity if shop
   * capacity changes (extra press, holiday week, etc.). */
  totalSlots: number;
  /** Slots already booked by paid orders. Operator-edited until
   * the Shopify webhook → Supabase sync ships. */
  bookedSlots: number;
}

/** Returns the ISO date (YYYY-MM-DD) of the Monday that opens the
 * week containing `from`. Sunday is the previous week's Monday +
 * 6, so we treat day-of-week 0 as offset -6 rather than 0 (the
 * naive `getDay()` math would otherwise jump a week forward). */
export function mondayOfWeek(from: Date = new Date()): string {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + offset);
  // Build the ISO date string from the local-time components so we
  // don't accidentally shift back to Sunday in negative-UTC zones
  // (toISOString() converts to UTC first, which would flip Mon→Sun
  // for any client west of GMT before noon).
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Reads the current week's capacity from localStorage. If nothing
 * is stored, or the stored blob is for an earlier week, returns a
 * fresh stub for this week with totalSlots=50, bookedSlots=0 — the
 * "no scarcity yet" state. The stub is NOT written back; we only
 * persist what the operator explicitly saves from /admin/capacity,
 * which keeps test runs and dev sessions deterministic. */
export function getCurrentCapacity(): WeeklyCapacity {
  const thisMonday = mondayOfWeek();
  const stored = readLS<WeeklyCapacity | null>(CAPACITY_KEY, null);
  if (
    stored &&
    typeof stored === 'object' &&
    typeof stored.weekStartIso === 'string' &&
    typeof stored.totalSlots === 'number' &&
    typeof stored.bookedSlots === 'number' &&
    stored.weekStartIso === thisMonday
  ) {
    return stored;
  }
  return { weekStartIso: thisMonday, totalSlots: 50, bookedSlots: 0 };
}

/** Persists capacity for an admin/operator save. Returns false if
 * localStorage refused the write (quota / private-mode Safari) so
 * the caller can surface a toast — silent failure in an admin form
 * would be worse than a render-time exception. */
export function setCurrentCapacity(c: WeeklyCapacity): boolean {
  return writeLS(CAPACITY_KEY, c);
}

/** Convenience: slots remaining = total - booked, clamped at 0 so
 * an over-booked week (negative remaining) can't render as
 * "Plus que -3 créneaux..." which would read as broken UI.
 *
 * Also guards against NaN / non-finite inputs: `typeof NaN ===
 * 'number'` so a corrupted localStorage blob can slip past the
 * type checks in getCurrentCapacity, and `Math.max(0, NaN)` is
 * NaN (not 0), which would render as "Plus que NaN créneaux..."
 * — strictly worse than the negative case the clamp was added to
 * prevent. Falling back to 0 mirrors the over-booked branch: from
 * the customer's POV, "no slots left" is the safe story. */
export function getRemainingSlots(c: WeeklyCapacity): number {
  const total = Number.isFinite(c.totalSlots) ? c.totalSlots : 0;
  const booked = Number.isFinite(c.bookedSlots) ? c.bookedSlots : 0;
  return Math.max(0, total - booked);
}

/** Returns the ETA the customer can expect if they order today —
 * 5 business days from the Monday of *next* week, since this
 * week's slots are nearly full and a fresh order rolls into next
 * week's production block. Skips Sat/Sun on the count. Used by
 * CapacityWidget for the "garantir ta livraison avant le X"
 * commitment line. */
export function getNextDeliveryDate(from: Date = new Date()): Date {
  // Start from this week's Monday, advance by 7 to get next
  // Monday — that's the day a "ordered now, can't fit this week"
  // job actually starts production.
  const thisMonday = new Date(`${mondayOfWeek(from)}T00:00:00`);
  const nextMonday = new Date(thisMonday);
  nextMonday.setDate(nextMonday.getDate() + 7);

  // Add 5 business days. Mon + 5 business days = the following
  // Monday (M T W Th F => 5 working days, lands on next-next Mon).
  const eta = new Date(nextMonday);
  let added = 0;
  while (added < 5) {
    eta.setDate(eta.getDate() + 1);
    const d = eta.getDay();
    if (d !== 0 && d !== 6) added++;
  }
  return eta;
}
