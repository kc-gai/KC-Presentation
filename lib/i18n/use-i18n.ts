import { create } from "zustand";
import { translations, type UILanguage, type TranslationKey } from "./translations";

interface I18nStore {
  uiLanguage: UILanguage;
  setUILanguage: (lang: UILanguage) => void;
}

function getInitialLanguage(): UILanguage {
  if (typeof window === "undefined") return "ko";
  const stored = localStorage.getItem("ui-language");
  if (stored === "ko" || stored === "ja" || stored === "en") return stored;

  // Auto-detect from browser
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith("ja")) return "ja";
  if (browserLang.startsWith("en")) return "en";
  return "ko";
}

export const useI18nStore = create<I18nStore>((set) => ({
  uiLanguage: getInitialLanguage(),
  setUILanguage: (lang: UILanguage) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("ui-language", lang);
    }
    set({ uiLanguage: lang });
  },
}));

export function useI18n() {
  const { uiLanguage, setUILanguage } = useI18nStore();

  const t = (key: TranslationKey): string => {
    const entry = translations[key];
    if (!entry) return key;
    return entry[uiLanguage] || entry.en || key;
  };

  return { t, uiLanguage, setUILanguage };
}
