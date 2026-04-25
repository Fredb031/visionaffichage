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
 *  - Query special chars are regex-escaped so a user typing ".",
 *    "(", "+", etc. doesn't blow up the RegExp constructor or match
 *    unintended characters.
 *  - Match is case-insensitive but the ORIGINAL casing from `text` is
 *    preserved inside the <mark> (we slice by index, not replace with
 *    the query).
 *  - Zero-width matches (which shouldn't happen after the empty-query
 *    guard, but defensively) are skipped so we don't infinite-loop.
 */

interface HighlightProps {
  text: string;
  query: string;
}

// Escape the 12 regex metacharacters so user input like "t-shirt (v2)"
// matches literally instead of being interpreted as a pattern.
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function Highlight({ text, query }: HighlightProps) {
  const q = query.trim();
  if (!q || !text) return <>{text}</>;

  const escaped = escapeRegex(q);
  let re: RegExp;
  try {
    re = new RegExp(escaped, 'gi');
  } catch {
    // Escaping should make this unreachable, but if the RegExp
    // constructor somehow throws, bail to plain text rather than
    // crashing the whole product card.
    return <>{text}</>;
  }

  const parts: Array<string | JSX.Element> = [];
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
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <mark
        key={key++}
        className="bg-brand-blue/25 text-inherit rounded-sm px-0.5"
      >
        {match[0]}
      </mark>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return <>{parts}</>;
}
