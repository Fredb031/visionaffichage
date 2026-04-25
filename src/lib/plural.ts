// Task 13.5 — Intl.PluralRules helper.
// ----------------------------------------------------------------------------
// Count-based UI strings ("N produits", "1 article", "0 items") were being
// hand-forked across Products.tsx, Cart.tsx, WishlistGrid.tsx, ProductCard.tsx
// and AdminCustomers.tsx. Each site reinvented the same `count !== 1 ? 's' :
// ''` ternary, sometimes with subtle drift (e.g. the FR "disponible" concord
// vs. the EN plural-only noun). This helper routes every site through
// Intl.PluralRules so the locale picks the form — fr-CA groups 0 and 1 under
// `one`, en-CA reserves `one` strictly for 1, and future locales plug in
// without touching call sites.
//
// `{count}` in the returned string is replaced with the numeric count so the
// number lives inside the phrase rather than adjacent to it — gives callers
// the option of "1 article" or "article unique" / "1 item" without rewiring.

export type PluralLang = 'fr' | 'en';

export interface PluralForms {
  one: string;
  other: string;
  // Optional categories. `zero`/`few`/`many` aren't emitted by Intl for fr/en
  // integers, but we accept them as explicit overrides (e.g. copy wants a
  // distinct empty-state string like "Aucun article" for count=0).
  zero?: string;
  few?: string;
  many?: string;
}

// Cache Intl.PluralRules instances. Construction isn't free and we hit this
// on every render of any list-count string.
const pluralRulesCache = new Map<PluralLang, Intl.PluralRules>();

function getPluralRules(lang: PluralLang): Intl.PluralRules {
  let rules = pluralRulesCache.get(lang);
  if (!rules) {
    rules = new Intl.PluralRules(lang);
    pluralRulesCache.set(lang, rules);
  }
  return rules;
}

/**
 * Resolve the correct plural form for `count` in `lang`, then substitute
 * `{count}` with the numeric count.
 *
 * Callers can short-circuit a specific cardinal by passing `zero`. The
 * helper checks `zero` first when the count is exactly 0 so copy like
 * "Aucun article" wins over the generic plural form.
 *
 * Defensive guards:
 *  - Non-finite counts (NaN, ±Infinity) would otherwise leak through to
 *    Intl.PluralRules — engines disagree on which CLDR bucket NaN lands
 *    in, and the literal "NaN article" rendering reaches the UI. We
 *    coerce to 0 so the `other`/`zero` fallback fires and the rendered
 *    number is never the string "NaN".
 *  - `String.prototype.replace` with a string pattern only swaps the
 *    first match, so a template like "{count} of {count}" (rare but
 *    legal) would render the count once and leave a literal `{count}`
 *    behind. We use a global regex so every placeholder in the template
 *    is substituted.
 */
const COUNT_PLACEHOLDER = /\{count\}/g;

export function plural(
  count: number,
  forms: PluralForms,
  lang: PluralLang = 'fr',
): string {
  const safeCount = Number.isFinite(count) ? count : 0;
  const countStr = String(safeCount);

  // Explicit zero override wins regardless of what Intl decides — fr/en
  // both bucket 0 under `one`/`other` respectively, so a caller that wants
  // a distinct empty-state string has no other way to hook it.
  if (safeCount === 0 && forms.zero != null) {
    return forms.zero.replace(COUNT_PLACEHOLDER, countStr);
  }

  const category = getPluralRules(lang).select(safeCount);
  // Prefer the named category if the caller supplied it; otherwise fall
  // back through `other` (always defined). This keeps FR `many` (large
  // numbers in some locales) routable without forcing every call site to
  // define it.
  const template =
    (category === 'zero' && forms.zero) ||
    (category === 'one' && forms.one) ||
    (category === 'two' && forms.other) ||
    (category === 'few' && forms.few) ||
    (category === 'many' && forms.many) ||
    forms.other;

  return template.replace(COUNT_PLACEHOLDER, countStr);
}
