import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Lang } from './i18n';
import { t as translate, TranslationKey } from './i18n';

interface LangContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey, ...args: (string | number)[]) => string;
}

const LangContext = createContext<LangContextType>({
  lang: 'fr',
  setLang: () => {},
  t: (key) => key,
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    // Validate before trusting — a corrupted or tampered localStorage
    // value (older site version, browser extension, typo) would
    // otherwise feed a string that isn't 'fr'|'en' into translate(),
    // which indexes by those literals and would return the key path
    // instead of real French/English text.
    try {
      const raw = localStorage.getItem('vision-lang');
      if (raw === 'fr' || raw === 'en') return raw;
    } catch { /* private mode */ }
    return 'fr';
  });

  const handleSetLang = (newLang: Lang) => {
    setLang(newLang);
    try { localStorage.setItem('vision-lang', newLang); } catch { /* quota exceeded, private mode, etc — silent is fine */ }
  };

  // Keep <html lang="..."> in sync so screen readers pronounce text in the
  // right language and Chrome's "translate this page" prompt behaves.
  // We use the full BCP 47 tag with region (fr-CA / en-CA) instead of the
  // bare 'fr' / 'en' to match index.html and to give screen readers a
  // Quebec/Canada locale hint — VoiceOver, NVDA and TalkBack all pick
  // region-appropriate phoneme tables when the region subtag is present
  // (e.g. fr-CA voices Québécois 'icitte' / sentence intonation more
  // accurately than the default fr-FR fallback). The internal `lang`
  // state stays as the bare 'fr' | 'en' since the i18n dictionary is
  // keyed on those literals.
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang === 'fr' ? 'fr-CA' : 'en-CA';
    }
  }, [lang]);

  // Cross-tab sync — when the user flips language in one tab, every
  // other open tab (cart, product, checkout) should follow without a
  // manual refresh. authStore's signOut already clears other customer-
  // scoped state the same way, so the pattern is consistent.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      // localStorage.clear() in another tab fires a storage event with
      // key === null. Reset to the French default so this tab matches
      // the post-clear state instead of holding a stale preference.
      if (e.key === null) {
        setLang('fr');
        return;
      }
      if (e.key !== 'vision-lang') return;
      // Explicit removal (removeItem) — newValue is null. Treat the
      // same as clear: revert to the default rather than ignoring the
      // event and leaving the tabs out of sync.
      if (e.newValue === null) {
        setLang('fr');
        return;
      }
      if (e.newValue !== 'fr' && e.newValue !== 'en') return;
      setLang(e.newValue as Lang);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const tFn = (key: TranslationKey, ...args: (string | number)[]) => translate(lang, key, ...args);

  return (
    <LangContext.Provider value={{ lang, setLang: handleSetLang, t: tFn }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() { return useContext(LangContext); }

// Language toggle button component
export function LangToggle() {
  const { lang, setLang } = useLang();
  const switchLabel = lang === 'fr' ? 'Switch to English' : 'Passer en français';
  return (
    <button
      type="button"
      onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
      className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground border border-border rounded-full px-3 py-1.5 hover:border-muted-foreground transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
      title={switchLabel}
      aria-label={switchLabel}
      lang={lang === 'fr' ? 'en' : 'fr'}
    >
      <span className={lang === 'fr' ? 'text-foreground font-black' : ''} aria-hidden="true">FR</span>
      <span className="text-border" aria-hidden="true">|</span>
      <span className={lang === 'en' ? 'text-foreground font-black' : ''} aria-hidden="true">EN</span>
    </button>
  );
}
