import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { translations, Locale } from "./translations";

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  /** Resolve a translation by nested key like "nav.dashboard". */
  t: (path: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);
const STORAGE_KEY = "freshtrace.locale";

export function I18nProvider({ children }: { children: ReactNode }) {
  // Restore saved preference; default to English so first-time users see
  // familiar Web3 terminology, but allow easy switch to Vietnamese.
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (saved === "en" || saved === "vi") return saved;
    } catch {}
    return "en";
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, locale); } catch {}
  }, [locale]);

  const setLocale = (l: Locale) => setLocaleState(l);

  // Resolves a dot-separated path against the translations object.
  // Falls back to the path itself if the key is missing so missing
  // translations are visible in the UI rather than silently empty.
  const t = (path: string): string => {
    const parts = path.split(".");
    let node: any = translations;
    for (const p of parts) {
      if (node && typeof node === "object" && p in node) node = node[p];
      else return path;
    }
    if (node && typeof node === "object" && locale in node) return node[locale];
    return path;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
