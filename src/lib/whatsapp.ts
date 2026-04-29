// Vision Affichage Volume II §09 — WhatsApp Business CTA helpers.
// Centralizes the phone number + canonical pre-filled message templates
// so every surface (floating button, PDP link, future quote/customizer
// banners) shares the same wording. If the operator ever swaps numbers
// or rewords the templates, this is the single source of truth — no
// grep-and-replace across components.
//
// We do NOT include the leading "+" or any spaces in WA_NUMBER: wa.me
// expects a bare E.164-style digits string (`https://wa.me/13673804808`).

export const WA_NUMBER = '13673804808';

// Frozen at module load to align with the runtime-immutability pattern
// used by pricing.ts, tax.ts, productLabels.ts, automations.ts, and
// caseStudies.ts. WA_MESSAGES is the single source of truth for every
// WhatsApp CTA prefill — a stray consumer doing
// `WA_MESSAGES.default = '...'` mid-session would silently retarget
// every floating button + PDP link in the SPA at the new copy until
// the next reload. The freeze makes that mutation throw in strict
// mode; the readonly templates remain callable as a function reference.
export const WA_MESSAGES = Object.freeze({
  default: "Bonjour Vision Affichage! J'ai une question sur votre site.",
  product: (n: string) => `Bonjour! Je veux commander des ${n} avec mon logo.`,
  customizer: "Bonjour! J'ai besoin d'aide pour personnaliser un produit.",
  quote: "Bonjour! J'aimerais obtenir une soumission pour mon équipe.",
});

/**
 * Build a wa.me deep link with the given pre-filled message.
 * Always pair the returned URL with `target="_blank"` and
 * `rel="noopener noreferrer"` so we don't leak the merch site's
 * window.opener to WhatsApp Web (and so iOS/Android route to the
 * native app correctly).
 */
export function waLink(message: string): string {
  // Guard against undefined/empty/whitespace-only: encodeURIComponent(undefined)
  // yields the literal "undefined", and a whitespace-only message would prefill
  // the chat with blank space — both look broken on the operator's side.
  const trimmed = typeof message === 'string' ? message.trim() : '';
  const text = trimmed.length > 0 ? trimmed : WA_MESSAGES.default;
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;
}
