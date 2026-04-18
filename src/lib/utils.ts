import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Tighter than /^[^@]+@[^@]+\.[^@]+$/ — rejects "a@b.c" and similar
// two-char-prefix/suffix garbage while still accepting real addresses.
// Used by the newsletter signup and the checkout contact step.
export function isValidEmail(value: string): boolean {
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(value.trim());
}
