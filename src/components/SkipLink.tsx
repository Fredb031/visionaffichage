import { useLang } from '@/lib/langContext';

/**
 * SkipLink — invisible until focused via Tab, then appears in the top-
 * left corner. Lets keyboard users jump past the fixed navbar straight
 * to the main content on every page.
 *
 * Every main page should wrap its primary content in an element with
 * id="main-content" so this anchor has somewhere to land. If the id is
 * missing the browser falls back to focusing the body — still better
 * than nothing.
 *
 * Pass `target` to override the default `#main-content` anchor.
 */
export function SkipLink({ target = '#main-content' }: { target?: string } = {}) {
  const { lang } = useLang();

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    // Some browsers don't reliably move focus to a non-interactive anchor
    // (e.g. a <main> without tabIndex) even though the URL hash updates.
    // Explicitly focus the target so screen readers and keyboard users
    // land on the correct element.
    const id = target.startsWith('#') ? target.slice(1) : target;
    // Bail out if the caller passed an empty / `#` target — getElementById('')
    // always returns null and we don't want to update the URL hash to just `#`.
    if (!id) return;
    const el = typeof document !== 'undefined' ? document.getElementById(id) : null;
    if (el) {
      event.preventDefault();
      // Ensure programmatic focus works on non-interactive elements.
      if (!el.hasAttribute('tabindex')) {
        el.setAttribute('tabindex', '-1');
      }
      el.focus({ preventScroll: false });
      // Keep the URL hash in sync so deep-linking still works. Wrap in
      // try/catch because replaceState can throw SecurityError in sandboxed
      // iframes or when the document has no browsing context.
      if (typeof history !== 'undefined' && history.replaceState) {
        try {
          history.replaceState(null, '', `#${id}`);
        } catch {
          // Ignore — focus already succeeded, hash sync is best-effort.
        }
      }
    }
  };

  return (
    <a
      href={target}
      onClick={handleClick}
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-[#0052CC] focus:text-white focus:rounded-lg focus:text-sm focus:font-bold focus:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2"
    >
      {lang === 'en' ? 'Skip to main content' : 'Passer au contenu principal'}
    </a>
  );
}
