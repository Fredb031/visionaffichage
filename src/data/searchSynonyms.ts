/**
 * searchSynonyms.ts — query-expansion table for the smart search bar.
 *
 * Volume II §2.2. The brief calls for a table that maps the words shoppers
 * actually type ("chandail", "hodie", "black") to the canonical tokens our
 * product index stores ("t-shirt", "hoodie", "noir"). search() resolves
 * each query word through this map BEFORE scoring — so a user looking for
 * a "chandail rouge" still hits the t-shirt rouge SKUs even though no
 * product has the literal word "chandail" in its name or tags.
 *
 * Keys are normalised lowercase tokens; values are arrays of equivalent
 * canonical tokens that should also be matched. A key MUST be included in
 * its own value list when the original token still has indexing relevance
 * (so "noir" still matches "noir"); otherwise we'd drop the original term
 * during expansion. Common typos ("hodie", "tshrit") are first-class
 * entries — typo tolerance via Levenshtein is a backstop, but explicit
 * synonyms are 100x cheaper and catch the long tail predictably.
 *
 * Add new entries lowercase, accents stripped (we normalise both sides).
 */
const SYNONYMS_RAW: Record<string, string[]> = {
  // ── Garment types — FR ↔ EN ↔ slang ↔ typo ────────────────────────────────
  'chandail':   ['t-shirt', 'tshirt', 'chandail'],
  'tshirt':     ['t-shirt', 'tshirt'],
  't-shirt':    ['t-shirt', 'tshirt'],
  'tshrit':     ['t-shirt', 'tshirt'],          // typo
  'tee':        ['t-shirt', 'tshirt'],
  'gilet':      ['hoodie', 'crewneck'],
  'kangourou':  ['hoodie'],
  'capuche':    ['hoodie'],
  'hoodie':     ['hoodie'],
  'hodie':      ['hoodie'],                     // typo
  'hoody':      ['hoodie'],
  'sweat':      ['hoodie', 'crewneck'],
  'sweater':    ['crewneck', 'hoodie'],
  'crewneck':   ['crewneck'],
  'crew':       ['crewneck'],
  'polo':       ['polo'],
  'longsleeve': ['longsleeve', 'manches longues'],
  'manches':    ['longsleeve'],
  'sport':      ['sport'],
  'casquette':  ['cap', 'casquette'],
  'cap':        ['cap', 'casquette'],
  'tuque':      ['toque', 'tuque', 'beanie'],
  'toque':      ['toque', 'tuque', 'beanie'],
  'beanie':     ['toque', 'tuque', 'beanie'],

  // ── Colors — EN → FR (we index FR + EN names, but normalise queries) ──────
  'black':      ['noir', 'black'],
  'noir':       ['noir', 'black'],
  'white':      ['blanc', 'white'],
  'blanc':      ['blanc', 'white'],
  'navy':       ['marine', 'navy'],
  'marine':     ['marine', 'navy'],
  'red':        ['rouge', 'red'],
  'rouge':      ['rouge', 'red'],
  'royal':      ['royal', 'bleu royal'],
  'blue':       ['bleu', 'royal', 'navy', 'marine'],
  'bleu':       ['bleu', 'royal', 'marine'],
  'green':      ['vert', 'forest', 'green'],
  'vert':       ['vert', 'forest', 'green'],
  'grey':       ['gris', 'grey', 'gray', 'charcoal', 'charbon'],
  'gray':       ['gris', 'grey', 'gray'],
  'gris':       ['gris', 'grey', 'gray'],
  'charcoal':   ['charbon', 'charcoal'],
  'charbon':    ['charbon', 'charcoal'],
  'gold':       ['or', 'gold'],
  'or':         ['or', 'gold'],
  'purple':     ['mauve', 'purple', 'violet'],
  'mauve':      ['mauve', 'purple'],
  'burgundy':   ['bourgogne', 'burgundy', 'maroon', 'bordeaux'],
  'bourgogne':  ['bourgogne', 'burgundy', 'maroon'],
  'maroon':     ['bordeaux', 'maroon', 'bourgogne'],
  'bordeaux':   ['bordeaux', 'maroon'],
  'pink':       ['rose', 'pink'],
  'rose':       ['rose', 'pink'],
  'orange':     ['orange'],
  'yellow':     ['jaune', 'yellow'],
  'jaune':      ['jaune', 'yellow'],

  // ── Audience / fit ────────────────────────────────────────────────────────
  'femme':      ['femme', 'women', 'ladies'],
  'women':      ['femme', 'women', 'ladies'],
  'ladies':     ['femme', 'ladies'],
  'homme':      ['homme', 'men', 'unisex'],
  'men':        ['homme', 'men'],
  'enfant':     ['enfant', 'youth', 'kids', 'jeunesse'],
  'kids':       ['enfant', 'kids', 'youth'],
  'youth':      ['enfant', 'youth'],
  'jeunesse':   ['enfant', 'jeunesse', 'youth'],
};

/**
 * Normalise a token the same way the consumer (search.ts) does: NFD decompose,
 * strip combining marks, lowercase, trim. Kept inline here so this module has
 * zero runtime deps and the contract check below can't drift from the consumer.
 */
function normaliseKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Dev-time contract check. The consumer looks up `SYNONYMS[t]` where `t` is
 * already lowercased + accent-stripped + trimmed. If a contributor adds a key
 * like `'Café'` or `' marine'` it would be silently unreachable — defined but
 * never matched. We assert the invariant once at module load so the failure
 * surfaces immediately in dev, not as a mysterious "why isn't this synonym
 * firing?" two weeks later.
 *
 * In production the check is elided by the bundler (import.meta.env.DEV is
 * a compile-time constant under Vite) so this costs nothing at runtime.
 */
if (import.meta.env.DEV) {
  for (const key of Object.keys(SYNONYMS_RAW)) {
    const normalised = normaliseKey(key);
    if (key !== normalised) {
      // eslint-disable-next-line no-console
      console.warn(
        `[searchSynonyms] Key "${key}" is not normalised (expected "${normalised}"). ` +
        `It will be unreachable from search() because queries are normalised before lookup.`,
      );
    }
  }
}

/**
 * Deep-frozen so accidental runtime mutation can't corrupt the shared
 * dictionary. The outer Object.freeze blocks key add/remove, but each
 * value array stays mutable until we freeze it too — without that, a
 * stray `SYNONYMS.noir.push('foo')` would silently teach search() to
 * expand "noir" → "foo" for the rest of the SPA session. Same pattern
 * applied in pricing.ts, productPlacements.ts, experiments.ts, and
 * orderLogos.ts so search behaviour matches the rest of the data
 * surface.
 */
for (const key of Object.keys(SYNONYMS_RAW)) {
  Object.freeze(SYNONYMS_RAW[key]);
}
export const SYNONYMS: Readonly<Record<string, readonly string[]>> = Object.freeze(SYNONYMS_RAW);
