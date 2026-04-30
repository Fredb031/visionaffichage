'use client';

import { useEffect, useId, useMemo, useRef, useState, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import { search as searchIndex, type SearchEntry, type SearchEntryType } from '@/lib/searchIndex';
import type { Locale } from '@/i18n/routing';

type SearchDialogProps = {
  open: boolean;
  onClose: () => void;
};

const RESULT_LIMIT = 10;
const TYPE_ORDER: SearchEntryType[] = ['product', 'industry', 'page'];

function getImageSrc(entry: SearchEntry): string | null {
  if (!entry.imageSlug) return null;
  if (entry.type === 'product') return `/placeholders/products/${entry.imageSlug}.svg`;
  if (entry.type === 'industry') return `/placeholders/industries/${entry.imageSlug}.svg`;
  return null;
}

export function SearchDialog({ open, onClose }: SearchDialogProps) {
  const locale = useLocale() as Locale;
  const t = useTranslations('search');

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const results = useMemo<SearchEntry[]>(() => {
    if (!query.trim()) return [];
    return searchIndex(query, locale, RESULT_LIMIT);
  }, [query, locale]);

  const grouped = useMemo(() => {
    const map: Record<SearchEntryType, SearchEntry[]> = {
      product: [],
      industry: [],
      page: [],
    };
    for (const r of results) map[r.type].push(r);
    return map;
  }, [results]);

  // Flatten in display order so arrow-key navigation matches visual order.
  const flatResults = useMemo<SearchEntry[]>(() => {
    return TYPE_ORDER.flatMap((type) => grouped[type]);
  }, [grouped]);

  // Reset active selection when results change.
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Focus management: autofocus input on open, restore focus on close.
  useEffect(() => {
    if (!open) return;
    lastFocusedRef.current = (typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null);
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
    return () => {
      window.clearTimeout(id);
      const last = lastFocusedRef.current;
      if (last && typeof last.focus === 'function') {
        last.focus();
      }
    };
  }, [open]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  // Focus trap on Tab / Shift+Tab.
  const handleKeyDownTrap = useCallback((event: KeyboardEvent) => {
    if (!open || event.key !== 'Tab') return;
    const root = dialogRef.current;
    if (!root) return;
    const focusables = root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (!first || !last) return;
    const active = document.activeElement as HTMLElement | null;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDownTrap);
    return () => {
      document.removeEventListener('keydown', handleKeyDownTrap);
    };
  }, [open, handleKeyDownTrap]);

  const onSelect = useCallback(
    (_entry: SearchEntry) => {
      onClose();
      setQuery('');
    },
    [onClose],
  );

  const handleInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (flatResults.length === 0) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((i) => (i + 1) % flatResults.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((i) => (i - 1 + flatResults.length) % flatResults.length);
      } else if (event.key === 'Enter') {
        const entry = flatResults[activeIndex];
        if (entry) {
          event.preventDefault();
          onSelect(entry);
          if (typeof window !== 'undefined') {
            window.location.href = entry.href(locale);
          }
        }
      }
    },
    [flatResults, activeIndex, locale, onClose, onSelect],
  );

  if (!open) return null;

  const showEmptyState = query.trim().length === 0;
  const showNoResults = !showEmptyState && flatResults.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center sm:pt-24 px-0 sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      ref={dialogRef}
    >
      <button
        type="button"
        aria-label={t('dialog.close')}
        onClick={onClose}
        className="absolute inset-0 bg-ink-950/50"
        tabIndex={-1}
      />
      <div className="relative z-10 flex h-full w-full flex-col bg-canvas-000 shadow-lg sm:h-auto sm:max-h-[80vh] sm:w-full sm:max-w-2xl sm:rounded-md">
        <div className="flex items-center gap-2 border-b border-sand-300 px-4 py-3">
          <Search aria-hidden className="h-5 w-5 text-slate-700" />
          <label htmlFor={`${titleId}-input`} className="sr-only" id={titleId}>
            {t('dialog.placeholder')}
          </label>
          <input
            id={`${titleId}-input`}
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={t('dialog.placeholder')}
            className="flex-1 bg-transparent text-body-md text-ink-950 placeholder:text-slate-700 focus:outline-none"
            autoComplete="off"
            spellCheck={false}
            aria-controls={`${titleId}-results`}
            aria-activedescendant={
              flatResults[activeIndex] ? `${titleId}-result-${flatResults[activeIndex].id}` : undefined
            }
          />
          <button
            type="button"
            onClick={onClose}
            aria-label={t('dialog.close')}
            className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-ink-950 hover:bg-sand-100 transition-colors duration-base ease-standard"
          >
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>

        <div id={`${titleId}-results`} className="flex-1 overflow-y-auto px-2 py-2 sm:max-h-[60vh]">
          {showEmptyState && (
            <p className="px-3 py-6 text-center text-body-md text-slate-700">{t('dialog.empty')}</p>
          )}
          {showNoResults && (
            <p className="px-3 py-6 text-center text-body-md text-slate-700">{t('dialog.noResults')}</p>
          )}
          {!showEmptyState && flatResults.length > 0 && (
            <ul role="listbox" className="space-y-4">
              {TYPE_ORDER.map((type) => {
                const items = grouped[type];
                if (items.length === 0) return null;
                return (
                  <li key={type}>
                    <h3 className="px-3 pb-1 pt-2 text-meta-xs font-semibold uppercase tracking-wide text-slate-700">
                      {t(`results.heading.${type === 'product' ? 'products' : type === 'industry' ? 'industries' : 'pages'}`)}
                    </h3>
                    <ul>
                      {items.map((entry) => {
                        const flatIdx = flatResults.indexOf(entry);
                        const isActive = flatIdx === activeIndex;
                        const img = getImageSrc(entry);
                        return (
                          <li key={entry.id}>
                            <Link
                              id={`${titleId}-result-${entry.id}`}
                              href={entry.href(locale)}
                              role="option"
                              aria-selected={isActive}
                              onClick={() => onSelect(entry)}
                              onMouseEnter={() => setActiveIndex(flatIdx)}
                              className={`flex items-center gap-3 rounded-sm px-3 py-2 text-body-md text-ink-950 transition-colors duration-base ease-standard ${
                                isActive ? 'bg-sand-100' : 'hover:bg-sand-100'
                              }`}
                            >
                              {img ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={img}
                                  alt=""
                                  className="h-10 w-10 flex-none rounded-sm bg-sand-100 object-contain"
                                  aria-hidden
                                  loading="lazy"
                                />
                              ) : (
                                <span aria-hidden className="flex h-10 w-10 flex-none items-center justify-center rounded-sm bg-sand-100 text-meta-xs font-semibold text-ink-950">
                                  {entry.type === 'page' ? '#' : '·'}
                                </span>
                              )}
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium">{entry.title[locale]}</span>
                                <span className="block truncate text-meta-xs text-slate-700">{entry.snippet[locale]}</span>
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
