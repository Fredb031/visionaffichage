import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Compose Tailwind class names with conflict resolution (clsx + tailwind-merge). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Invisible/zero-width chars that sneak in via copy-paste from chat
// clients, rich editors, or Unicode-savvy spam. ZWSP (U+200B), ZWNJ
// (U+200C), ZWJ (U+200D), BOM (U+FEFF), WORD JOINER (U+2060), plus
// the full control + bidi block. Strip before any regex check so a
// user who copies "john@example.com" from Slack doesn't get a
// confusing "invalid email" rejection for what looks correct.
// eslint-disable-next-line no-control-regex
const INVISIBLE_CHARS = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202F\u2060-\u206F\uFEFF]/g;

/** Strip zero-width / control / bidi chars that sneak in via copy-paste. Coerces non-strings to ''. */
export function normalizeInvisible(value: string): string {
  if (typeof value !== 'string') return '';
  return value.replace(INVISIBLE_CHARS, '');
}

// Tighter than /^[^@]+@[^@]+\.[^@]+$/ — rejects "a@b.c" and similar
// two-char-prefix/suffix garbage while still accepting real addresses.
// Used by the newsletter signup and the checkout contact step.
//
// Post-regex guards reject shapes the character-class regex accepts but
// SMTP / DNS would reject: consecutive dots anywhere, a leading or
// trailing dot in the local part, and a domain label that starts or
// ends with a dot or hyphen. Without these, "user@example..com",
// ".user@example.com", "user.@example.com", and "user@-ex.com" all
// slip through and surface later as bounced confirmations.
/** Validate an email address with stricter shape rules than a bare regex; rejects consecutive dots, leading/trailing dots in local part, and hyphen-bounded domain labels. */
export function isValidEmail(value: string): boolean {
  if (typeof value !== 'string') return false;
  const v = normalizeInvisible(value).trim();
  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(v)) return false;
  if (v.includes('..')) return false;
  const at = v.lastIndexOf('@');
  const local = v.slice(0, at);
  const domain = v.slice(at + 1);
  if (local.startsWith('.') || local.endsWith('.')) return false;
  if (domain.startsWith('.') || domain.startsWith('-')) return false;
  // Each dot-separated domain label must not start or end with a hyphen
  // (e.g. "foo-.com" or "-foo.com" — invalid per RFC 1035 label syntax).
  if (domain.split('.').some(label => label.startsWith('-') || label.endsWith('-'))) return false;
  return true;
}

// Canadian postal code: H2X 1Y2 — letter-digit-letter (space?) digit-letter-digit.
// Excluded letters (D, F, I, O, Q, U, W, Z in specific positions) follow
// Canada Post's assignment rules. We normalize invisible chars, trim, and
// uppercase so "h2x1y2", "H2X 1Y2", and "H2X\u200B1Y2" all accept. Without
// this the 'Continue' button enabled on 'foo' input and the user only
// learned at Shopify's checkout that the address was invalid.
const CANADIAN_POSTAL_RE = /^[A-CEGHJ-NPR-TVXY]\d[A-CEGHJ-NPR-TV-Z]\s?\d[A-CEGHJ-NPR-TV-Z]\d$/;

/** Validate a Canadian postal code (e.g. "H2X 1Y2"); accepts with or without space, and tolerates copy-pasted invisible chars. */
export function isValidCanadianPostal(value: string): boolean {
  if (typeof value !== 'string') return false;
  const v = normalizeInvisible(value).trim().toUpperCase();
  return CANADIAN_POSTAL_RE.test(v);
}

/** Format a number as CAD currency in fr-CA (default) or en-CA. Non-finite input renders as an em-dash so a missing/NaN price never surfaces as the literal "NaN $" in the UI. */
export function formatCurrency(amount: number, lang: 'fr' | 'en' = 'fr'): string {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '—';
  const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD' }).format(amount);
}

/** Human-readable relative time (fr default / en) with fr-CA/en-CA absolute fallback past 30 days. */
export function formatRelativeTime(date: Date | string | number, lang: 'fr' | 'en' = 'fr'): string {
  const then = date instanceof Date ? date.getTime() : new Date(date).getTime();
  if (!Number.isFinite(then)) return '';
  const diff = Math.max(0, Date.now() - then);
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (lang === 'en') {
    if (mins < 1) return 'just now';
    if (days < 1 && hrs < 1) return `${mins} min ago`;
    if (days < 1) return `${hrs} h ago`;
    if (days === 1) return 'yesterday';
    if (days <= 30) return `${days} d ago`;
    return new Date(then).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  if (mins < 1) return "à l'instant";
  if (days < 1 && hrs < 1) return `il y a ${mins} min`;
  if (days < 1) return `il y a ${hrs} h`;
  if (days === 1) return 'hier';
  if (days <= 30) return `il y a ${days} j`;
  return new Date(then).toLocaleDateString('fr-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Trailing-edge debounce: invokes `fn` `wait` ms after the last call; `.cancel()` clears pending. */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  wait: number,
): T & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = ((...args: unknown[]) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, wait);
  }) as T & { cancel: () => void };
  debounced.cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
  return debounced;
}

/** Clamp `n` to the inclusive [min, max] range. NaN inputs collapse to
 *  `min` so a corrupted upstream value (parseInt('') → NaN, division by
 *  zero on a tier breakpoint, an empty input mid-edit) can't propagate
 *  silently — Math.max(min, Math.min(max, NaN)) returns NaN, which
 *  poisons every downstream `*` / `+` and surfaces as "NaN" in the UI. */
export function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}
