import { useEffect, useState } from 'react';
import { useLang } from '@/lib/langContext';

/**
 * Section 7.3 — First-visit orientation banner.
 *
 * Renders above the page chrome for visitors with no
 * "va_visited" localStorage flag. The flag is set once the visitor
 * either scrolls 30% of the document or clicks anywhere — both signals
 * indicate they've engaged enough to be considered "no longer new",
 * after which the banner disappears for the rest of their session and
 * future visits.
 */

const STORAGE_KEY = 'va_visited';

function readVisited(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function markVisited() {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* private mode — banner will reappear next visit, acceptable */
  }
}

export function FirstVisitBanner() {
  const { lang } = useLang();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (readVisited()) return;
    setVisible(true);

    const dismiss = () => {
      markVisited();
      setVisible(false);
      cleanup();
    };

    const onScroll = () => {
      if (typeof window === 'undefined') return;
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const ratio = window.scrollY / scrollable;
      if (ratio >= 0.3) dismiss();
    };

    const onClick = () => dismiss();

    const cleanup = () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('click', onClick);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    // Capture-phase so we register the very first click even if the
    // target stops propagation upstream.
    window.addEventListener('click', onClick, { capture: true });
    return cleanup;
  }, []);

  if (!visible) return null;

  const isFr = lang === 'fr';

  return (
    <div
      role="note"
      className="bg-[#0052CC] text-white py-3 px-4 text-center text-sm font-medium"
    >
      {isFr ? 'Premiere visite ? Commence par choisir ton produit ' : 'First visit? Start by choosing your product '}
      <a
        href="/products"
        className="underline underline-offset-2 hover:no-underline focus:outline-none focus:ring-2 focus:ring-white rounded"
      >
        {isFr ? 'Voir la boutique' : 'See the shop'} &rarr;
      </a>
    </div>
  );
}

export default FirstVisitBanner;
