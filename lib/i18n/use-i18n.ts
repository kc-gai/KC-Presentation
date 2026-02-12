import { useEffect } from "react";
import { create } from "zustand";
import { translations, type UILanguage, type TranslationKey } from "./translations";

interface I18nStore {
  uiLanguage: UILanguage;
  hydrated: boolean;
  setUILanguage: (lang: UILanguage) => void;
  hydrate: () => void;
}

function getStoredLanguage(): UILanguage {
  const stored = localStorage.getItem("ui-language");
  if (stored === "ko" || stored === "ja" || stored === "en") return stored;

  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith("ja")) return "ja";
  if (browserLang.startsWith("en")) return "en";
  return "ko";
}

export const useI18nStore = create<I18nStore>((set) => ({
  uiLanguage: "ko",
  hydrated: false,
  setUILanguage: (lang: UILanguage) => {
    localStorage.setItem("ui-language", lang);
    set({ uiLanguage: lang });
  },
  hydrate: () => {
    set({ uiLanguage: getStoredLanguage(), hydrated: true });
  },
}));

export function useI18n() {
  const { uiLanguage, setUILanguage, hydrated, hydrate } = useI18nStore();

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  const t = (key: TranslationKey): string => {
    const entry = translations[key];
    if (!entry) return key;
    return entry[uiLanguage] || entry.en || key;
  };

  return { t, uiLanguage, setUILanguage };
}
