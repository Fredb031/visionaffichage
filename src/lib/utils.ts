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
export function isValidEmail(value: string): boolean {
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(
    normalizeInvisible(value).trim(),
  );
}
