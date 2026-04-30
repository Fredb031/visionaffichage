/**
 * search.ts — smart product search with synonym expansion + typo tolerance.
 *
 * Volume II §2.1. Public API: `search(query: string)` returns the top-5
 * SearchIndexEntry matches ranked by score:
 *   • +10  for an exact match against sku / typeName / typeNameEn
 *   • +1   for every query word found in the haystack
 *   • +0.5 for partial / typo matches (substring or Levenshtein <= 1)
 *
 * Each query word is first expanded through the SYNONYMS table — so
 * "chandail rouge" becomes the token bag {chandail, t-shirt, tshirt,
 * rouge, red} before scoring. This is what makes the bar feel "smart":
 * users type their language and we map it to the catalog's language.
 *
 * Min query length is 2 — single letters generate too much noise and
 * trigger a top-5 dropdown that's pure chaff.
 */
import { SEARCH_INDEX, type SearchIndexEntry } from '@/lib/searchIndex';
import { SYNONYMS } from '@/data/searchSynonyms';
import { normalize as canonicalNormalize } from '@/lib/normalize';

/**
 * Centralised tuning knobs for the search engine. Lifted out of the body so
 * an operator can tweak ranking + result-list shape without spelunking
 * through scoring logic. Frozen so callers can't mutate it at runtime.
 *
 *   minQueryLength     — below this, return [] (dropdown stays closed)
 *   maxResults         — hard cap on returned entries
 *   exactMatchScore    — bonus when the whole query equals sku/name
 *   wordMatchScore     — per-token full word-boundary hit
 *   partialMatchScore  — per-token substring or Levenshtein-1 hit
 */
export const SEARCH_TUNING = {
  minQueryLength: 2,
  maxResults: 5,
  exactMatchScore: 10,
  wordMatchScore: 1,
  partialMatchScore: 0.5,
} as const;

/**
 * Strip diacritics + lowercase. We index lowercase already, but queries
 * arrive raw — "Marine" needs to hit the "marine" haystack, "café" needs
 * to hit "cafe", etc. Using NFD + combining-mark strip is the standard
 * unicode-correct way to do this without an external lib.
 */
function normalise(s: string): string {
  // Diacritic strip + lowercase delegated to the shared `normalize()` helper
  // in src/lib/normalize.ts so this module shares one character-space
  // contract with searchIndex.ts, colorMap.ts, etc. \u2014 drift between producer
  // and matcher silently breaks every accented hit. The `.trim()` stays here
  // because callers feed raw <input value> strings and we don't want stray
  // whitespace to derail the tokenizer regex below; the canonical helper
  // deliberately doesn't trim so consumers that don't want trim (Highlight,
  // colorMap) keep working.
  return canonicalNormalize(s).trim();
}

/**
 * Tokenise a query into individual words, dropping empties. Hyphens are
 * preserved as-is inside a token (so "t-shirt" stays one token) but
 * runs of whitespace and other punctuation split.
 */
function tokenise(query: string): string[] {
  return normalise(query)
    .split(/[\s,;.!?/\\()[\]{}'"]+/)
    .filter(t => t.length > 0);
}

/**
 * Expand each query token through SYNONYMS. The original token is always
 * included (via the synonym entry's self-reference, or the fallback
 * below) so a token without a synonym row still contributes.
 */
function expandTokens(tokens: string[]): string[] {
  const expanded = new Set<string>();
  for (const t of tokens) {
    expanded.add(t);
    // Guard against prototype-chain lookups: SYNONYMS is a plain object,
    // so a query token of "__proto__", "constructor", "toString", etc.
    // resolves to Object.prototype values (objects/functions) instead of
    // undefined. The truthy `if (syns)` check then passes and the
    // `for ... of syns` iteration throws TypeError ("syns is not
    // iterable"), which would crash the entire search() call and blank
    // the dropdown for the rest of the keystroke. Restrict to own array
    // values so prototype keys + accidental non-array entries both fall
    // through cleanly. hasOwn check via Object.prototype.hasOwnProperty
    // for ES2017 compatibility.
    if (!Object.prototype.hasOwnProperty.call(SYNONYMS, t)) continue;
    const syns = SYNONYMS[t];
    if (Array.isArray(syns)) {
      for (const s of syns) expanded.add(normalise(s));
    }
  }
  return Array.from(expanded);
}

/**
 * Levenshtein distance, capped at maxDistance for early termination.
 * Used only for short tokens (<=8 chars) where a 1-edit typo is the
 * realistic mistake — beyond that, partial substring matches are more
 * useful than fuzzy edit distance and a lot cheaper.
 */
function levenshtein(a: string, b: string, maxDistance: number): number {
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost,
      );
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > maxDistance) return maxDistance + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/**
 * Score a single index entry against the expanded token bag.
 * Returns 0 if no token matches at all so the caller can drop misses.
 */
function scoreEntry(entry: SearchIndexEntry, expandedTokens: string[], rawQuery: string): number {
  let score = 0;

  // ── Exact match: +10 ──────────────────────────────────────────────────────
  // The whole query string equals sku/name. Strong intent signal — usually
  // means the shopper pasted a SKU from a quote or typed the exact label.
  const q = rawQuery;
  if (
    entry.sku === q ||
    normalise(entry.typeName) === q ||
    normalise(entry.typeNameEn) === q
  ) {
    score += SEARCH_TUNING.exactMatchScore;
  }

  // ── Per-token scoring ─────────────────────────────────────────────────────
  for (const tok of expandedTokens) {
    if (tok.length < 2) continue;

    // Full word boundary match in the haystack: +1
    // Build a per-token regex once; the haystack is short enough that
    // .test() is fine (no need for an Aho-Corasick automaton here).
    const wordRe = new RegExp(`(?:^|\\s)${escapeRegex(tok)}(?:\\s|$)`);
    if (wordRe.test(entry.haystack)) {
      score += SEARCH_TUNING.wordMatchScore;
      continue;
    }

    // Substring (partial) match: +0.5 — covers prefix searches like
    // "hood" matching "hoodie" before the user has finished typing.
    if (entry.haystack.includes(tok)) {
      score += SEARCH_TUNING.partialMatchScore;
      continue;
    }

    // Typo tolerance via Levenshtein 1 — only worth the cost on tokens
    // long enough that a single edit is meaningful (≥4 chars). Walk the
    // haystack words once; any close-enough match awards the partial
    // score and breaks. Capped at 12 chars to keep the work bounded —
    // the comment used to claim 8 chars but the code already used 12;
    // 12 is the correct cap (catches longer brand/product tokens like
    // "casquettes", 10 chars, which would otherwise miss typo matching).
    if (tok.length >= 4 && tok.length <= 12) {
      const words = entry.haystack.split(/\s+/);
      for (const w of words) {
        if (Math.abs(w.length - tok.length) > 1) continue;
        if (levenshtein(w, tok, 1) <= 1) {
          score += SEARCH_TUNING.partialMatchScore;
          break;
        }
      }
    }
  }

  return score;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Run the search. Returns at most {@link SEARCH_TUNING.maxResults} entries
 * sorted by descending score. Below {@link SEARCH_TUNING.minQueryLength} we
 * return an empty list — the dropdown should stay closed until the query is
 * meaningful.
 */
export function search(query: string): SearchIndexEntry[] {
  // Defensive: callers wire this to an <input value>, which can occasionally
  // surface as null/undefined (cleared programmatically, hydration race).
  // Bail early instead of throwing inside .normalize().
  if (typeof query !== 'string' || query.length === 0) return [];

  const normalised = normalise(query);
  if (normalised.length < SEARCH_TUNING.minQueryLength) return [];

  const tokens = tokenise(normalised);
  if (tokens.length === 0) return [];

  const expanded = expandTokens(tokens);

  const scored: Array<{ entry: SearchIndexEntry; score: number }> = [];
  for (const entry of SEARCH_INDEX) {
    const score = scoreEntry(entry, expanded, normalised);
    if (score > 0) scored.push({ entry, score });
  }

  // Stable-ish sort: primary by score desc, tiebreak by sku asc so the
  // results don't shuffle on every keystroke when scores tie.
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.entry.sku.localeCompare(b.entry.sku);
  });

  return scored.slice(0, SEARCH_TUNING.maxResults).map(s => s.entry);
}
