"use client";

import { useCallback, useState } from "react";
import {
  Upload,
  FileType2,
  Loader2,
  Languages,
  Download,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import { usePresentationStore } from "@/lib/store/presentation-store";
import { useI18n } from "@/lib/i18n/use-i18n";

type TranslateStep = "upload" | "ready" | "translating" | "done";

export default function TranslationTab() {
  const {
    presentation,
    processingStatus,
    translationStatus,
    loadFile,
    translateAll,
    exportToFile,
    reset,
  } = usePresentationStore();
  const { t } = useI18n();

  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetLang, setTargetLang] = useState<"ko" | "ja">("ko");
  const [isExporting, setIsExporting] = useState(false);

  const isProcessing =
    processingStatus.stage !== "idle" && processingStatus.stage !== "complete";

  // Determine current step
  let step: TranslateStep = "upload";
  if (presentation && processingStatus.stage === "complete") {
    if (translationStatus.stage === "translating") {
      step = "translating";
    } else if (translationStatus.stage === "complete") {
      step = "done";
    } else {
      step = "ready";
    }
  }

  const handleFile = useCallback(
    async (file: File) => {
      const ext = file.name.toLowerCase();
      if (!ext.endsWith(".docx") && !ext.endsWith(".doc")) {
        setError(t("translate.onlyDocx"));
        return;
      }

      setError(null);
      try {
        await loadFile(file, "docx");
      } catch (err) {
        setError(err instanceof Error ? err.message : t("upload.error"));
      }
    },
    [loadFile, t]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleTranslate = async () => {
    try {
      await translateAll(targetLang);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Translation failed");
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportToFile(targetLang);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleReset = () => {
    reset();
    setError(null);
  };

  const getStatusText = () => {
    switch (processingStatus.stage) {
      case "loading-docx":
        return t("status.loadingDocx");
      case "rendering-pages":
        return `${t("status.renderingPages")} (${processingStatus.current}/${processingStatus.total})`;
      default:
        return "";
    }
  };

  // --- Upload step ---
  if (step === "upload") {
    return (
      <div className="flex flex-col items-center gap-6 w-full max-w-xl mx-auto">
        {/* DOCX drop zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative w-full rounded-2xl border-2 border-dashed p-12
            flex flex-col items-center gap-4 transition-all cursor-pointer
            ${
              isDragging
                ? "border-primary bg-blue-50 scale-[1.02]"
                : "border-border hover:border-primary/50 hover:bg-slate-50"
            }
            ${isProcessing ? "pointer-events-none opacity-70" : ""}
          `}
        >
          <input
            type="file"
            accept=".docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
            onChange={handleFileInput}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={isProcessing}
          />

          {isProcessing ? (
            <>
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <p className="text-lg font-medium text-foreground">
                {getStatusText()}
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-violet-50 flex items-center justify-center">
                {isDragging ? (
                  <FileType2 className="w-8 h-8 text-violet-600" />
                ) : (
                  <Upload className="w-8 h-8 text-violet-600" />
                )}
              </div>
              <div className="text-center">
                <p className="text-lg font-medium text-foreground">
                  {isDragging ? t("upload.dragHere") : t("translate.dragDocx")}
                </p>
                <p className="text-sm text-muted mt-1">
                  {t("upload.clickToSelect")}
                </p>
              </div>
              <span className="text-xs px-2 py-1 bg-slate-100 rounded-md text-muted">
                DOCX
              </span>
            </>
          )}
        </div>

        {error && (
          <div className="w-full p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}
      </div>
    );
  }

  // --- Ready step: choose language and start ---
  if (step === "ready") {
    return (
      <div className="flex flex-col items-center gap-8 w-full max-w-md mx-auto">
        {/* File info */}
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl w-full">
          <FileType2 className="w-5 h-5 text-muted" />
          <span className="text-sm font-medium text-foreground truncate">
            {presentation?.fileName}
          </span>
          <span className="text-xs text-muted ml-auto">
            {presentation?.slides.length}{t("toolbar.slides")}
          </span>
        </div>

        {/* Language selection */}
        <div className="w-full">
          <p className="text-sm font-medium text-foreground mb-3 text-center">
            {t("translate.selectLang")}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setTargetLang("ko")}
              className={`
                flex items-center gap-2 px-5 py-3 rounded-xl border-2 transition-all cursor-pointer
                ${
                  targetLang === "ko"
                    ? "border-violet-500 bg-violet-50 text-violet-700 shadow-sm"
                    : "border-border text-muted hover:border-violet-300 hover:text-foreground"
                }
              `}
            >
              <Languages className="w-5 h-5" />
              <div className="text-left">
                <div className="text-sm font-medium">{t("toolbar.korean")}</div>
              </div>
            </button>
            <button
              onClick={() => setTargetLang("ja")}
              className={`
                flex items-center gap-2 px-5 py-3 rounded-xl border-2 transition-all cursor-pointer
                ${
                  targetLang === "ja"
                    ? "border-violet-500 bg-violet-50 text-violet-700 shadow-sm"
                    : "border-border text-muted hover:border-violet-300 hover:text-foreground"
                }
              `}
            >
              <Languages className="w-5 h-5" />
              <div className="text-left">
                <div className="text-sm font-medium">{t("toolbar.japanese")}</div>
              </div>
            </button>
          </div>
        </div>

        {/* Start button */}
        <button
          onClick={handleTranslate}
          className="flex items-center gap-2 px-8 py-3 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700 transition-colors shadow-sm"
        >
          <Languages className="w-5 h-5" />
          {t("translate.start")}
        </button>

        {/* Reset */}
        <button
          onClick={handleReset}
          className="text-sm text-muted hover:text-foreground transition-colors"
        >
          {t("translate.backToUpload")}
        </button>

        {error && (
          <div className="w-full p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}
      </div>
    );
  }

  // --- Translating step ---
  if (step === "translating") {
    const progress =
      translationStatus.stage === "translating"
        ? (translationStatus.current / translationStatus.total) * 100
        : 0;
    const currentCount =
      translationStatus.stage === "translating"
        ? translationStatus.current
        : 0;
    const totalCount =
      translationStatus.stage === "translating"
        ? translationStatus.total
        : 0;

    return (
      <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto">
        <Loader2 className="w-16 h-16 text-violet-600 animate-spin" />
        <div className="text-center">
          <p className="text-lg font-medium text-foreground">
            {t("translate.translating")}...
          </p>
          <p className="text-sm text-muted mt-1">
            {currentCount} / {totalCount}
          </p>
        </div>
        <div className="w-full max-w-xs bg-slate-200 rounded-full h-2">
          <div
            className="bg-violet-600 h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  // --- Done step ---
  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto">
      <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
        <CheckCircle2 className="w-8 h-8 text-green-600" />
      </div>
      <div className="text-center">
        <p className="text-lg font-medium text-foreground">
          {t("translate.complete")}
        </p>
        <p className="text-sm text-muted mt-1">
          {presentation?.fileName}
        </p>
      </div>

      {/* Export buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700 transition-colors shadow-sm disabled:opacity-50"
        >
          {isExporting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Download className="w-5 h-5" />
          )}
          {t("translate.export")} (DOCX)
        </button>
      </div>

      {/* Start over */}
      <button
        onClick={handleReset}
        className="flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors"
      >
        <RotateCcw className="w-3 h-3" />
        {t("translate.backToUpload")}
      </button>
    </div>
  );
}
