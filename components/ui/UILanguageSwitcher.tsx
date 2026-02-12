"use client";

import { Globe } from "lucide-react";
import { useI18n } from "@/lib/i18n/use-i18n";
import type { UILanguage } from "@/lib/i18n/translations";

const languages: { code: UILanguage; label: string }[] = [
  { code: "ko", label: "한국어" },
  { code: "ja", label: "日本語" },
  { code: "en", label: "English" },
];

export default function UILanguageSwitcher() {
  const { uiLanguage, setUILanguage } = useI18n();

  return (
    <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
      <Globe className="w-3.5 h-3.5 text-muted ml-2" />
      {languages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => setUILanguage(lang.code)}
          className={`
            px-2.5 py-1 rounded-md text-xs font-medium transition-all
            ${uiLanguage === lang.code
              ? "bg-white text-foreground shadow-sm"
              : "text-muted hover:text-foreground"
            }
          `}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
