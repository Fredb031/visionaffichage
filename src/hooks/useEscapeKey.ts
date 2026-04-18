import { useEffect } from 'react';

interface Options {
  /** Skip Escape when focus is in a text input / textarea — e.g. so
   *  Esc clears a field instead of killing the whole overlay. */
  skipInTextInputs?: boolean;
}

/**
 * Trigger `onEscape` when the user presses the Escape key, only while
 * `active` is true. Centralizes the modal/drawer dismiss pattern.
 */
export function useEscapeKey(
  active: boolean,
  onEscape: () => void,
  { skipInTextInputs = false }: Options = {},
): void {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (skipInTextInputs) {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      }
      onEscape();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onEscape, skipInTextInputs]);
}
