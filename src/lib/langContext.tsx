import { createContext, useContext, useState, ReactNode } from 'react';
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
    try { localStorage.setItem('vision-lang', newLang); } catch {}
  };

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
  return (
    <button
      onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
      className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground border border-border rounded-full px-3 py-1.5 hover:border-muted-foreground transition-all"
      title={lang === 'fr' ? 'Switch to English' : 'Passer en français'}
    >
      <span className={lang === 'fr' ? 'text-foreground font-black' : ''}>FR</span>
      <span className="text-border">|</span>
      <span className={lang === 'en' ? 'text-foreground font-black' : ''}>EN</span>
    </button>
  );
}
