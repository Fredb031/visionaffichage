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
      // Respect deeper handlers that already consumed the Esc — e.g. a
      // combobox inside a modal clearing its own input, or a datepicker
      // popover closing itself. Without this guard the outer overlay
      // would also dismiss on the same keystroke, forcing the user to
      // reopen it after every inline cancel.
      if (e.defaultPrevented) return;
      if (skipInTextInputs) {
        const t = e.target as HTMLElement | null;
        const tag = t?.tagName;
        // Also treat contentEditable elements as text inputs — rich-text
        // surfaces (fabric.IText's hidden editor, any future WYSIWYG)
        // expect Esc to exit editing mode, not kill the containing modal.
        if (tag === 'INPUT' || tag === 'TEXTAREA' || t?.isContentEditable) return;
      }
      onEscape();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onEscape, skipInTextInputs]);
}
