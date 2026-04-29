/**
 * getDeliveryDate — Phase 4 Master Prompt helper.
 *
 * One source of truth for the "Estimated delivery: <date>" string the
 * site quotes in three places where consistency matters: the homepage
 * trust band, the Checkout summary, and the ExitIntent modal copy.
 * DeliveryBadge.tsx still owns its own inline computation for now (it
 * also has UI-specific tooltip wording); this module is the pure
 * function the rest of the codebase should consume.
 *
 * Rules
 *  • Default 5 business days from `from`.
 *  • Past the production cutoff (default 15h America/Toronto), add one
 *    extra business day — production won't start until tomorrow, so
 *    the day-1 commitment shouldn't include "today".
 *  • Saturdays and Sundays are skipped (weekends == zero-progress).
 *  • Cutoff is read in Quebec local time via Intl, NOT the visitor's
 *    machine clock. A buyer in Vancouver placing an order at 14h PST
 *    is 17h in Quebec — already past the cutoff — and they should see
 *    the same ETA Quebec ops will quote them.
 *
 * Returns an `Intl.DateTimeFormat`-shaped string like "lundi 5 mai" /
 * "Monday, May 5". For callers that need a different format (ISO, raw
 * Date for diffing), call `getDeliveryDateRaw()` and shape it locally.
 */

const STANDARD_BUSINESS_DAYS = 5;
const DEFAULT_CUTOFF_HOUR = 15;
const QUEBEC_TIMEZONE = 'America/Toronto';

export interface GetDeliveryDateOpts {
  /** Reference time. Defaults to `new Date()`. Tests pass a fixed
   *  value to pin behaviour across DST and weekend transitions. */
  from?: Date;
  /** 'fr' renders fr-CA ("lundi 5 mai"); 'en' renders en-CA
   *  ("Monday, May 5"). Defaults to 'fr' since Vision Affichage's
   *  primary market is Quebec. */
  lang?: 'fr' | 'en';
  /** Production cutoff hour in 24h time (Quebec local). Orders placed
   *  at or after this hour add an extra business day. Defaults to 15h
   *  (3pm), the same value DeliveryBadge / Checkout already use. */
  cutoffHour?: number;
}

/**
 * Read the current Quebec hour using Intl so the cutoff comparison is
 * timezone-correct regardless of the visitor's machine clock. A buyer
 * in Vancouver at 14h PST is 17h in Quebec — past cutoff. Without
 * this, naive `from.getHours()` would let them see a one-day-too-early
 * ETA that ops can't honour.
 */
function quebecHourFor(date: Date): number {
  const hourStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: QUEBEC_TIMEZONE,
    hour: 'numeric',
    hour12: false,
  }).format(date);
  // Intl returns "00".."23"; coerce defensively in case a future
  // browser ever drops the leading zero or returns " 5".
  const n = parseInt(hourStr, 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Read the current Quebec weekday (0 = Sunday, 6 = Saturday). We need
 * the Quebec-local weekday because at 23h Friday in Vancouver it's
 * already 02h Saturday in Quebec — the order should treat the weekend
 * as already started, otherwise it computes the wrong baseline.
 */
function quebecWeekdayFor(date: Date): number {
  const wkStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: QUEBEC_TIMEZONE,
    weekday: 'short',
  }).format(date);
  const map: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return map[wkStr.slice(0, 3)] ?? date.getUTCDay();
}

/**
 * Pure helper — adds N business days to a starting weekday index.
 * Operates on weekday math first so it's testable without a Date and
 * trivially reversible.
 *
 * Defensive: the only call site computes `days` from the constant
 * STANDARD_BUSINESS_DAYS (5 or 6), but a future caller passing NaN /
 * Infinity / negative would freeze this loop — `added < NaN` is
 * always false but `added < -1` is always true, so the wrapper either
 * spins forever or returns the start date with no progress. Floor at 0
 * so the function degrades to "return start" instead of hanging the
 * render. Mirrors the same guard added to DeliveryBadge's local copy.
 */
function addBusinessDays(start: Date, days: number): Date {
  const out = new Date(start);
  const safeDays = Number.isFinite(days) && days > 0 ? Math.floor(days) : 0;
  let added = 0;
  while (added < safeDays) {
    out.setUTCDate(out.getUTCDate() + 1);
    const d = quebecWeekdayFor(out);
    if (d !== 0 && d !== 6) added++;
  }
  return out;
}

/**
 * Compute the raw delivery `Date` so callers can format it themselves
 * (e.g. ISO for the order-tracking page, weekday-only for a chip).
 * The same business-day + cutoff rules apply.
 */
export function getDeliveryDateRaw(opts: GetDeliveryDateOpts = {}): Date {
  const { from = new Date(), cutoffHour = DEFAULT_CUTOFF_HOUR } = opts;
  const startWeekday = quebecWeekdayFor(from);
  const isWeekend = startWeekday === 0 || startWeekday === 6;
  const pastCutoff = isWeekend || quebecHourFor(from) >= cutoffHour;
  const days = pastCutoff
    ? STANDARD_BUSINESS_DAYS + 1
    : STANDARD_BUSINESS_DAYS;
  return addBusinessDays(from, days);
}

/**
 * Format a delivery Date as "lundi 5 mai" (fr) / "Monday, May 5" (en).
 * Uses Intl.DateTimeFormat in Quebec timezone so the weekday matches
 * what a Quebec ops team would say on the phone.
 */
export function getDeliveryDate(opts: GetDeliveryDateOpts = {}): string {
  const { lang = 'fr' } = opts;
  const eta = getDeliveryDateRaw(opts);
  const fmt = new Intl.DateTimeFormat(
    lang === 'fr' ? 'fr-CA' : 'en-CA',
    {
      timeZone: QUEBEC_TIMEZONE,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    },
  );
  return fmt.format(eta);
}

/** Re-export so test harnesses can pin against the cutoff constant
 *  without duplicating the magic number. */
export { STANDARD_BUSINESS_DAYS, DEFAULT_CUTOFF_HOUR, QUEBEC_TIMEZONE };
