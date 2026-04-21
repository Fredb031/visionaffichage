import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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

export function normalizeInvisible(value: string): string {
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
export function isValidEmail(value: string): boolean {
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

export function isValidCanadianPostal(value: string): boolean {
  const v = normalizeInvisible(value).trim().toUpperCase();
  return CANADIAN_POSTAL_RE.test(v);
}
