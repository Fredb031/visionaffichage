import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { search } from '@/lib/search';
import type { SearchIndexEntry } from '@/lib/searchIndex';
import { toWebp } from '@/lib/toWebp';

// Minimum trimmed query length before the dropdown opens. Single-character
// searches against the merch index produce too much noise (every "t-shirt"
// matches "t"), so we wait for two characters before showing results.
const MIN_QUERY_LENGTH = 2;

/**
 * SearchBar — Volume II §2 smart product search.
 *
 * Compact input + dropdown of the top-5 in-memory matches. Arrow keys
 * move highlight, Enter navigates, Esc closes. The query is debounced
 * implicitly by the controlled-input render cycle (the index is small
 * enough that scoring on every keystroke is sub-millisecond — no
 * useDebouncedValue needed).
 *
 * Mounts in the Navbar's center region on desktop. Mobile is hidden by
 * default; a future iteration can promote it to a sheet — for now we
 * keep the navbar clean on phones and let BottomNav own discovery there.
 */
export function SearchBar({ className = '', autoFocus = false, onNavigate }: {
  className?: string;
  autoFocus?: boolean;
  /** Optional hook fired AFTER navigation — used by the mobile sheet to
   *  close itself when a result is picked. Desktop callers ignore it. */
  onNavigate?: () => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listboxId = 'navbar-search-listbox';

  const results = useMemo<SearchIndexEntry[]>(() => search(query), [query]);

  // Reset the keyboard highlight whenever the result set changes so the
  // user never lands on a stale row that was previously rank 3 but no
  // longer exists in the new top-5.
  useEffect(() => {
    setHighlighted(0);
  }, [query]);

  // Close on outside click. We listen to mousedown, not click, so the
  // dropdown closes BEFORE any focus shift handlers fire — otherwise a
  // click on a result would race with the close, and on slow devices
  // sometimes the close ran first and dropped the navigation entirely.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const node = wrapperRef.current;
      if (node && !node.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  const goTo = useCallback((entry: SearchIndexEntry) => {
    setOpen(false);
    setQuery('');
    onNavigate?.();
    navigate(entry.href);
  }, [navigate, onNavigate]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      // Esc clears the query first if there is one, then closes — gives
      // keyboard users a two-step "cancel" without forcing them to
      // backspace through a long string.
      if (query.length > 0) {
        setQuery('');
      } else {
        setOpen(false);
        inputRef.current?.blur();
      }
      return;
    }
    if (!open || results.length === 0) {
      // Open on ArrowDown even from an empty state — feels natural for
      // power users who want to confirm "yes, the bar is alive".
      if (e.key === 'ArrowDown' && results.length > 0) setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => (h + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => (h - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = results[highlighted] ?? results[0];
      if (pick) goTo(pick);
    }
  }, [open, results, highlighted, goTo, query]);

  const showDropdown = open && query.trim().length >= MIN_QUERY_LENGTH;

  // Screen-reader announcement for result count. WAI-ARIA APG combobox
  // pattern requires the listbox state changes be announced via a polite
  // live region — sighted users see results materialize, AT users get
  // nothing without this. Empty string while the dropdown is closed so
  // we don't announce anything during typing below MIN_QUERY_LENGTH.
  const liveMessage = showDropdown
    ? results.length === 0
      ? `Aucun résultat pour ${query.trim()}`
      : `${results.length} résultat${results.length > 1 ? 's' : ''} trouvé${results.length > 1 ? 's' : ''}`
    : '';

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div className="flex items-center gap-2 border border-border rounded-full px-3 py-[6px] bg-background/70 backdrop-blur-sm focus-within:border-foreground transition-colors">
        <Search size={14} aria-hidden="true" className="text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          autoFocus={autoFocus}
          placeholder="Recherche un produit, une couleur..."
          className="bg-transparent text-[13px] outline-none w-full placeholder:text-muted-foreground/80"
          aria-label="Recherche un produit, une couleur"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={showDropdown}
          aria-activedescendant={showDropdown && results[highlighted]
            ? `search-result-${results[highlighted].sku}` : undefined}
          role="combobox"
          // type=search gives the browser a free clear-X affordance on
          // most platforms; we still handle Esc-to-clear ourselves for
          // platforms that don't render one (Firefox desktop).
        />
      </div>

      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {liveMessage}
      </div>

      {showDropdown && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 mt-2 bg-background border border-border rounded-2xl shadow-2xl overflow-hidden z-[450]"
        >
          {results.length === 0 ? (
            <div className="px-4 py-3 text-[12px] text-muted-foreground">
              Aucun résultat pour « {query} »
            </div>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto">
              {results.map((r, i) => {
                const active = i === highlighted;
                return (
                  <li
                    key={r.sku}
                    id={`search-result-${r.sku}`}
                    role="option"
                    aria-selected={active}
                  >
                    <button
                      type="button"
                      onClick={() => goTo(r)}
                      onMouseEnter={() => setHighlighted(i)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-none cursor-pointer ${
                        active ? 'bg-secondary' : 'bg-transparent hover:bg-secondary/60'
                      }`}
                    >
                      <picture>
                        <source srcSet={toWebp(r.image)} type="image/webp" />
                        <img
                          src={r.image}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          width={40}
                          height={40}
                          className="w-10 h-10 rounded-lg object-cover bg-secondary shrink-0"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                        />
                      </picture>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold truncate">{r.typeName}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {r.colorCount > 0 ? `${r.colorCount} couleur${r.colorCount > 1 ? 's' : ''} · ` : ''}
                          {/* fr-CA renders the comma decimal ("12,34 $") expected
                              next to the French "À partir de" copy. Falling back
                              to en-CA form ("12.34 $") read like a typo against
                              every other money string on the page. Guarding
                              against a non-finite basePrice (Shopify variant
                              missing a price, mid-flight hydration) so the row
                              never surfaces "NaN $" in the dropdown. */}
                          À partir de {Number.isFinite(r.basePrice)
                            ? r.basePrice.toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            : '—'} $
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
