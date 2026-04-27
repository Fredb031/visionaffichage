import { useEffect, useState } from 'react';
import { Cookie, X } from 'lucide-react';
import { useLang } from '@/lib/langContext';

/**
 * Québec Law 25 (CCQ) requires explicit opt-in for non-essential cookies
 * and analytics. This component renders a bilingual consent panel that
 * defaults to declined, persists the user's per-category choice to
 * localStorage, and only shows until a choice is recorded.
 *
 * Downstream code (analytics bootstrap, marketing pixels, etc.) MUST
 * gate on getCookieConsent() before firing any third-party tracker.
 */

const STORAGE_KEY = 'vision-cookie-consent';

export interface ConsentState {
  essentials: true;
  analytics: boolean;
  marketing: boolean;
  at: string; // ISO timestamp of the user's decision
}

/**
 * Read the persisted consent choice, if any. Returns null when the user
 * has not yet made a decision (banner should still be shown). Safe in
 * private-mode browsers where localStorage access throws.
 */
export function getCookieConsent(): ConsentState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      parsed.essentials === true &&
      typeof parsed.analytics === 'boolean' &&
      typeof parsed.marketing === 'boolean' &&
      typeof parsed.at === 'string'
    ) {
      return parsed as ConsentState;
    }
    return null;
  } catch {
    return null;
  }
}

function persistConsent(state: ConsentState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode / quota — silent is fine, banner will show again next visit */
  }
}

export function CookieConsent() {
  const { lang } = useLang();
  const [visible, setVisible] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  // Law 25 default: non-essential trackers are OFF until the user opts in.
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    // Only reveal once — if a choice already exists, stay hidden.
    if (getCookieConsent() === null) setVisible(true);
  }, []);

  if (!visible) return null;

  const record = (next: { analytics: boolean; marketing: boolean }) => {
    persistConsent({
      essentials: true,
      analytics: next.analytics,
      marketing: next.marketing,
      at: new Date().toISOString(),
    });
    setVisible(false);
  };

  const handleAcceptAll = () => record({ analytics: true, marketing: true });
  const handleDeclineAll = () => record({ analytics: false, marketing: false });
  const handleSave = () => record({ analytics, marketing });

  const isFr = lang === 'fr';

  return (
    <div
      role="dialog"
      aria-label={isFr ? 'Avis de confidentialité' : 'Privacy notice'}
      aria-describedby="cookie-consent-description"
      className="fixed bottom-4 left-4 z-[60] max-w-sm rounded-2xl border border-[#D4AF37]/40 bg-[#0A1A2F] text-white shadow-2xl ring-1 ring-black/5"
      // Task 16.10 — lift the consent panel above the iPhone home
      // indicator. margin-bottom on top of the existing bottom-4 so
      // non-notched devices are unchanged (inset resolves to 0px).
      style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="relative p-5">
        <button
          type="button"
          onClick={handleDeclineAll}
          aria-label={isFr ? 'Fermer et refuser' : 'Close and decline'}
          className="absolute right-3 top-3 rounded-full p-1 text-white/60 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#D4AF37]/15 text-[#D4AF37]">
            <Cookie className="h-4 w-4" aria-hidden="true" />
          </span>
          <h2 className="text-base font-semibold tracking-tight">
            {isFr ? 'Confidentialité' : 'Privacy'}
          </h2>
        </div>

        <p id="cookie-consent-description" className="text-sm leading-relaxed text-white/80">
          {isFr
            ? "Nous utilisons des témoins (cookies) essentiels au fonctionnement et, avec ton accord, des témoins d'analyse pour améliorer l'expérience. Conformément à la Loi 25 du Québec, ton choix est respecté."
            : "We use essential cookies for core site functionality and, with your consent, analytics cookies to improve the experience. In line with Québec's Law 25, your choice is respected."}
        </p>

        {customizing && (
          <fieldset className="mt-4 space-y-2 rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
            <legend className="sr-only">
              {isFr ? 'Catégories de témoins' : 'Cookie categories'}
            </legend>
            <label className="flex items-center justify-between gap-3 text-white/70">
              <span>{isFr ? 'Essentiels' : 'Essentials'}</span>
              <input
                type="checkbox"
                checked
                disabled
                aria-label={isFr ? 'Essentiels (toujours actifs)' : 'Essentials (always on)'}
                className="h-4 w-4 accent-[#D4AF37]"
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-white/90">
              <span>{isFr ? 'Analyse' : 'Analytics'}</span>
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                className="h-4 w-4 accent-[#D4AF37]"
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-white/90">
              <span>{isFr ? 'Marketing' : 'Marketing'}</span>
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                className="h-4 w-4 accent-[#D4AF37]"
              />
            </label>
            <button
              type="button"
              onClick={handleSave}
              className="mt-2 w-full rounded-md border border-[#D4AF37] px-3 py-1.5 text-xs font-medium text-[#D4AF37] hover:bg-[#D4AF37]/10 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
            >
              {isFr ? 'Enregistrer mes choix' : 'Save my choices'}
            </button>
          </fieldset>
        )}

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={handleDeclineAll}
            className="flex-1 rounded-md border border-white/25 bg-transparent px-3 py-2 text-sm font-medium text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
          >
            {isFr ? 'Refuser' : 'Decline'}
          </button>
          <button
            type="button"
            onClick={handleAcceptAll}
            className="flex-1 rounded-md bg-[#D4AF37] px-3 py-2 text-sm font-semibold text-[#0A1A2F] shadow-sm hover:bg-[#E6C24D] focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:ring-offset-2 focus:ring-offset-[#0A1A2F]"
          >
            {isFr ? 'Accepter' : 'Accept'}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setCustomizing((v) => !v)}
          aria-expanded={customizing}
          aria-label={isFr ? 'Préférences cookies' : 'Cookie preferences'}
          className="mt-3 text-xs text-white/60 underline-offset-2 hover:text-[#D4AF37] hover:underline focus:outline-none focus:ring-2 focus:ring-[#D4AF37] rounded"
        >
          {isFr ? 'Préférences cookies' : 'Cookie preferences'}
        </button>
      </div>
    </div>
  );
}

export default CookieConsent;
