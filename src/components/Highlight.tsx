/**
 * Highlight — wraps every case-insensitive occurrence of `query` inside
 * `text` with a <mark> using a gold tint. Task 2.18.
 *
 * Scanning a grid of results after typing "shirt" gave the user no
 * visual signal for WHICH part of each title matched — the eye had to
 * re-parse every card. This component surfaces the match inline.
 *
 * Behaviour:
 *  - Empty / whitespace-only query → returns plain text (no <mark>).
 *  - Non-string text/query (e.g. accidental null/undefined leaking
 *    through from upstream API data) → returns plain text rather than
 *    throwing on `.trim()` / `.replace()`.
 *  - Query special chars are regex-escaped so a user typing ".",
 *    "(", "+", etc. doesn't blow up the RegExp constructor or match
 *    unintended characters.
 *  - Match is case-insensitive but the ORIGINAL casing from `text` is
 *    preserved inside the <mark> (we slice by index, not replace with
 *    the query).
 *  - Zero-width matches (which shouldn't happen after the empty-query
 *    guard, but defensively) are skipped so we don't infinite-loop.
 *  - Ridiculously long text (>10k chars) is rendered as plain text —
 *    this component lives in product cards & search rows, anything
 *    that big is almost certainly a bug upstream and we don't want to
 *    burn CPU regex-scanning a novel.
 *  - Result is memoised on (text, query) so a parent re-render that
 *    leaves both props stable reuses the previous parts array instead
 *    of running the regex scan again — meaningful when a search grid
 *    re-renders for an unrelated state change.
 */
import { useMemo } from 'react';

interface HighlightProps {
  text: string;
  query: string;
}

// Belt-and-braces cap. The hot path renders Highlight once per card in
// a grid, so a runaway string would multiply across the viewport.
const MAX_TEXT_LEN = 10_000;

// Escape the 12 regex metacharacters so user input like "t-shirt (v2)"
// matches literally instead of being interpreted as a pattern.
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function Highlight({ text, query }: HighlightProps) {
  const parts = useMemo<Array<string | JSX.Element>>(() => {
    // Defensive coercion — TS says these are strings but upstream data
    // (product titles, search hits) occasionally arrives null when an
    // API field is missing. Bail to a single string rather than crash.
    if (typeof text !== 'string' || typeof query !== 'string') {
      return [typeof text === 'string' ? text : ''];
    }
    if (text.length > MAX_TEXT_LEN) return [text];
    const q = query.trim();
    if (!q || !text) return [text];

    const escaped = escapeRegex(q);
    let re: RegExp;
    try {
      re = new RegExp(escaped, 'gi');
    } catch {
      // Escaping should make this unreachable, but if the RegExp
      // constructor somehow throws, bail to plain text rather than
      // crashing the whole product card.
      return [text];
    }

    const out: Array<string | JSX.Element> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;
    while ((match = re.exec(text)) !== null) {
      // Defensive guard against zero-width matches causing an infinite
      // loop. The empty-query check above should prevent this, but an
      // exotic input could still produce a 0-width regex.
      if (match.index === re.lastIndex) {
        re.lastIndex++;
        continue;
      }
      if (match.index > lastIndex) {
        out.push(text.slice(lastIndex, match.index));
      }
      out.push(
        <mark
          key={key++}
          className="bg-[#E8A838]/25 text-inherit rounded-sm px-0.5"
        >
          {match[0]}
        </mark>,
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      out.push(text.slice(lastIndex));
    }
    return out;
  }, [text, query]);

  return <>{parts}</>;
}
