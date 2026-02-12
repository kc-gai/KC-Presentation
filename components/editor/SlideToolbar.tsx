"use client";

import { useState } from "react";
import { Download, RotateCcw, Loader2 } from "lucide-react";
import { usePresentationStore } from "@/lib/store/presentation-store";
import { useI18n } from "@/lib/i18n/use-i18n";
import UILanguageSwitcher from "@/components/ui/UILanguageSwitcher";

export default function SlideToolbar() {
  const {
    presentation,
    translationStatus,
    setActiveLanguage,
    translateAll,
    exportToFile,
    reset,
  } = usePresentationStore();
  const { t } = useI18n();
  const [isExporting, setIsExporting] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  if (!presentation) return null;

  const handleLanguageTab = async (lang: "original" | "ko" | "ja") => {
    if (lang === "original") {
      setActiveLanguage(lang);
      return;
    }

    // Check if translation already exists
    const hasTranslation = presentation.slides.some((slide) =>
      slide.textElements.some((el) => {
        const field = lang === "ko" ? el.textKo : el.textJa;
        return field && field.trim().length > 0;
      })
    );

    if (hasTranslation) {
      setActiveLanguage(lang);
    } else {
      // Auto-translate then switch
      setIsTranslating(true);
      try {
        await translateAll(lang);
      } catch (err) {
        console.error("Translation error:", err);
      } finally {
        setIsTranslating(false);
      }
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportToFile(presentation.activeLanguage);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const langLabels = {
    original: t("toolbar.original"),
    ko: t("toolbar.korean"),
    ja: t("toolbar.japanese"),
  };

  const exportLabel =
    presentation.outputFormat === "docx"
      ? t("toolbar.exportDoc")
      : t("toolbar.exportPpt");
  const formatBadge =
    presentation.outputFormat === "docx" ? "DOCX" : "PPTX";

  return (
    <div className="h-14 bg-card border-b border-border flex items-center justify-between px-4">
      {/* Left: file info */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-foreground truncate max-w-[200px]">
          {presentation.fileName}
        </span>
        <span className="text-xs text-muted">
          {presentation.slides.length}{t("toolbar.slides")}
        </span>
        <span className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded font-medium">
          {formatBadge}
        </span>
      </div>

      {/* Center: content language tabs (auto-translate on click) */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
        {(["original", "ko", "ja"] as const).map((lang) => {
          const isTranslatingThis =
            isTranslating &&
            translationStatus.stage === "translating" &&
            translationStatus.language === lang;

          return (
            <button
              key={lang}
              onClick={() => handleLanguageTab(lang)}
              disabled={isTranslating}
              className={`
                px-3 py-1.5 rounded-md text-xs font-medium transition-all
                ${
                  presentation.activeLanguage === lang
                    ? "bg-white text-foreground shadow-sm"
                    : "text-muted hover:text-foreground"
                }
                ${isTranslating ? "opacity-50" : ""}
              `}
            >
              {isTranslatingThis ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {langLabels[lang]}
                </span>
              ) : (
                langLabels[lang]
              )}
            </button>
          );
        })}
      </div>

      {/* Right: UI language + export + reset */}
      <div className="flex items-center gap-2">
        <UILanguageSwitcher />

        {/* Export - single button, exports current active language */}
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-primary hover:bg-primary-hover transition-colors disabled:opacity-50"
        >
          {isExporting ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Download className="w-3 h-3" />
          )}
          {exportLabel}
        </button>

        {/* Reset */}
        <button
          onClick={reset}
          className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-slate-100 transition-colors"
          title={t("toolbar.newFile")}
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
