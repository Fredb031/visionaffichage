import type { Locale } from './types';

const TZ = 'America/Toronto';
const CUTOFF_HOUR = 14;

const localeMap: Record<Locale, 'fr-CA' | 'en-CA'> = {
  'fr-ca': 'fr-CA',
  'en-ca': 'en-CA',
};

function getTorontoParts(date: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  weekday: number;
} {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string): string =>
    parts.find((p) => p.type === type)?.value ?? '';
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    weekday: weekdayMap[get('weekday')] ?? 0,
  };
}

function isWeekend(weekday: number): boolean {
  return weekday === 0 || weekday === 6;
}

function addBusinessDays(start: Date, businessDays: number): Date {
  const result = new Date(start.getTime());
  let added = 0;
  while (added < businessDays) {
    result.setUTCDate(result.getUTCDate() + 1);
    const { weekday } = getTorontoParts(result);
    if (!isWeekend(weekday)) {
      added += 1;
    }
  }
  return result;
}

export function getDeliveryEstimate(
  leadTimeDays: { min: number; max: number },
  locale: Locale,
  now: Date = new Date(),
): { earliest: Date; latest: Date; formatted: string } {
  // If after cutoff or weekend, start counting from next business day.
  const parts = getTorontoParts(now);
  const startDelay =
    isWeekend(parts.weekday) || parts.hour >= CUTOFF_HOUR ? 1 : 0;

  const baseStart =
    startDelay > 0 ? addBusinessDays(now, startDelay) : new Date(now.getTime());

  const earliest = addBusinessDays(baseStart, leadTimeDays.min);
  const latest = addBusinessDays(baseStart, leadTimeDays.max);

  const fmt = new Intl.DateTimeFormat(localeMap[locale], {
    timeZone: TZ,
    month: 'long',
    day: 'numeric',
  });
  const earliestStr = fmt.format(earliest);
  const latestStr = fmt.format(latest);

  const formatted =
    locale === 'fr-ca'
      ? `Livraison estimée : ${earliestStr} – ${latestStr}`
      : `Estimated delivery: ${earliestStr} – ${latestStr}`;

  return { earliest, latest, formatted };
}
