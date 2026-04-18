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
    try { return (localStorage.getItem('vision-lang') as Lang) || 'fr'; } catch { return 'fr'; }
  });

  const handleSetLang = (newLang: Lang) => {
    setLang(newLang);
    try { localStorage.setItem('vision-lang', newLang); } catch { /* quota exceeded, private mode, etc — silent is fine */ }
  };

  // Keep <html lang="..."> in sync so screen readers pronounce text in the
  // right language and Chrome's "translate this page" prompt behaves.
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  }, [lang]);

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
