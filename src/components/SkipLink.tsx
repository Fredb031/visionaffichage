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
 */
export function SkipLink() {
  const { lang } = useLang();
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-[#0052CC] focus:text-white focus:rounded-lg focus:text-sm focus:font-bold focus:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2"
    >
      {lang === 'en' ? 'Skip to main content' : 'Passer au contenu principal'}
    </a>
  );
}
