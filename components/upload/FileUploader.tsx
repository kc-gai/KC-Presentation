"use client";

import { useCallback, useState } from "react";
import { Upload, FileText, Loader2, FileType2, Presentation } from "lucide-react";
import { usePresentationStore } from "@/lib/store/presentation-store";
import { useI18n } from "@/lib/i18n/use-i18n";
import type { OutputFormat } from "@/types/presentation";

export default function FileUploader() {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOutput, setSelectedOutput] = useState<OutputFormat>("pptx");
  const { loadFile, processingStatus } = usePresentationStore();
  const { t } = useI18n();

  const isProcessing =
    processingStatus.stage !== "idle" && processingStatus.stage !== "complete";

  const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".doc"];
  const ACCEPTED_MIME = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
  ];

  const isValidFile = (file: File): boolean => {
    const ext = file.name.toLowerCase();
    return ACCEPTED_EXTENSIONS.some((e) => ext.endsWith(e));
  };

  const handleFile = useCallback(
    async (file: File) => {
      if (!isValidFile(file)) {
        setError(t("upload.invalidFile"));
        return;
      }

      setError(null);
      try {
        await loadFile(file, selectedOutput);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t("upload.error")
        );
      }
    },
    [loadFile, selectedOutput, t]
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

  const getStatusText = () => {
    switch (processingStatus.stage) {
      case "loading-pdf":
        return t("status.loadingPdf");
      case "loading-docx":
        return t("status.loadingDocx");
      case "rendering-pages":
        return `${t("status.renderingPages")} (${processingStatus.current}/${processingStatus.total})`;
      case "extracting-images":
        return `${t("status.extractingImages")} (${processingStatus.current}/${processingStatus.total})`;
      case "ocr-processing":
        return `${t("status.ocrProcessing")} (${processingStatus.current}/${processingStatus.total})`;
      default:
        return "";
    }
  };

  const getProgressValue = () => {
    if (
      "current" in processingStatus &&
      "total" in processingStatus
    ) {
      return (processingStatus.current / processingStatus.total) * 100;
    }
    return 0;
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-xl mx-auto">
      {/* Output format selector */}
      <div className="w-full">
        <p className="text-sm font-medium text-foreground mb-3 text-center">
          {t("upload.outputFormat")}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => setSelectedOutput("pptx")}
            disabled={isProcessing}
            className={`
              flex items-center gap-2 px-5 py-3 rounded-xl border-2 transition-all
              ${
                selectedOutput === "pptx"
                  ? "border-primary bg-primary/5 text-primary shadow-sm"
                  : "border-border text-muted hover:border-primary/30 hover:text-foreground"
              }
              ${isProcessing ? "opacity-50 pointer-events-none" : "cursor-pointer"}
            `}
          >
            <Presentation className="w-5 h-5" />
            <div className="text-left">
              <div className="text-sm font-medium">{t("upload.ppt")}</div>
              <div className="text-xs opacity-70">{t("upload.pptDesc")}</div>
            </div>
          </button>
          <button
            onClick={() => setSelectedOutput("docx")}
            disabled={isProcessing}
            className={`
              flex items-center gap-2 px-5 py-3 rounded-xl border-2 transition-all
              ${
                selectedOutput === "docx"
                  ? "border-primary bg-primary/5 text-primary shadow-sm"
                  : "border-border text-muted hover:border-primary/30 hover:text-foreground"
              }
              ${isProcessing ? "opacity-50 pointer-events-none" : "cursor-pointer"}
            `}
          >
            <FileType2 className="w-5 h-5" />
            <div className="text-left">
              <div className="text-sm font-medium">{t("upload.doc")}</div>
              <div className="text-xs opacity-70">{t("upload.docDesc")}</div>
            </div>
          </button>
        </div>
      </div>

      {/* File drop zone */}
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
          accept={[...ACCEPTED_EXTENSIONS, ...ACCEPTED_MIME].join(",")}
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
            {("current" in processingStatus && "total" in processingStatus) && (
              <div className="w-full max-w-xs bg-slate-200 rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${getProgressValue()}%` }}
                />
              </div>
            )}
            {processingStatus.stage === "ocr-processing" && (
              <div className="text-xs text-muted text-left mt-2 max-w-xs space-y-1">
                <p>{t("status.ocrHint")}</p>
                <p>{t("status.recommendPdf")}</p>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
              {isDragging ? (
                <FileText className="w-8 h-8 text-primary" />
              ) : (
                <Upload className="w-8 h-8 text-primary" />
              )}
            </div>
            <div className="text-center">
              <p className="text-lg font-medium text-foreground">
                {isDragging ? t("upload.dragHere") : t("upload.dragFile")}
              </p>
              <p className="text-sm text-muted mt-1">
                {t("upload.clickToSelect")}
              </p>
            </div>
            <div className="flex gap-2">
              <span className="text-xs px-2 py-1 bg-slate-100 rounded-md text-muted">
                PDF
              </span>
              <span className="text-xs px-2 py-1 bg-slate-100 rounded-md text-muted">
                DOCX
              </span>
            </div>
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
