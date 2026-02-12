"use client";

import { useState } from "react";
import { usePresentationStore } from "@/lib/store/presentation-store";
import FileUploader from "@/components/upload/FileUploader";
import SlideEditor from "@/components/editor/SlideEditor";
import TranslationTab from "@/components/translate/TranslationTab";
import { FileText, Languages } from "lucide-react";
import { useI18n } from "@/lib/i18n/use-i18n";
import UILanguageSwitcher from "@/components/ui/UILanguageSwitcher";

type ActiveTab = "extract" | "translate";

export default function Home() {
  const { presentation, processingStatus, reset } = usePresentationStore();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<ActiveTab>("extract");

  // Show editor when presentation is loaded in extract mode
  if (
    activeTab === "extract" &&
    presentation &&
    processingStatus.stage === "complete"
  ) {
    return <SlideEditor />;
  }

  const handleTabChange = (tab: ActiveTab) => {
    if (tab !== activeTab) {
      reset();
      setActiveTab(tab);
    }
  };

  // Show upload page with tabs
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <h1 className="text-lg font-bold text-foreground">Document Editor</h1>
        <UILanguageSwitcher />
      </div>

      {/* Tab navigation */}
      <div className="flex justify-center border-b border-border bg-card">
        <button
          onClick={() => handleTabChange("extract")}
          className={`
            flex items-center gap-2 px-6 py-3 text-sm font-medium transition-all border-b-2
            ${
              activeTab === "extract"
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-foreground hover:border-slate-300"
            }
          `}
        >
          <FileText className="w-4 h-4" />
          {t("tab.extract")}
        </button>
        <button
          onClick={() => handleTabChange("translate")}
          className={`
            flex items-center gap-2 px-6 py-3 text-sm font-medium transition-all border-b-2
            ${
              activeTab === "translate"
                ? "border-violet-600 text-violet-600"
                : "border-transparent text-muted hover:text-foreground hover:border-slate-300"
            }
          `}
        >
          <Languages className="w-4 h-4" />
          {t("tab.translate")}
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-2xl px-6 py-12">
          {activeTab === "extract" ? (
            <>
              {/* Extract tab header */}
              <div className="flex flex-col items-center gap-6 mb-10">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <FileText className="w-7 h-7 text-primary" />
                </div>
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-foreground">
                    {t("tab.extract")}
                  </h2>
                  <p className="text-sm text-muted mt-2">
                    {t("tab.extract.desc")}
                  </p>
                </div>
              </div>

              <FileUploader />

              <div className="mt-10 grid grid-cols-3 gap-6 text-center">
                <div className="p-4">
                  <div className="text-2xl mb-2">1</div>
                  <h3 className="text-sm font-medium text-foreground">
                    {t("app.step1.title")}
                  </h3>
                  <p className="text-xs text-muted mt-1">
                    {t("app.step1.desc")}
                  </p>
                </div>
                <div className="p-4">
                  <div className="text-2xl mb-2">2</div>
                  <h3 className="text-sm font-medium text-foreground">
                    {t("app.step2.title")}
                  </h3>
                  <p className="text-xs text-muted mt-1">
                    {t("app.step2.desc")}
                  </p>
                </div>
                <div className="p-4">
                  <div className="text-2xl mb-2">3</div>
                  <h3 className="text-sm font-medium text-foreground">
                    {t("app.step3.title")}
                  </h3>
                  <p className="text-xs text-muted mt-1">
                    {t("app.step3.desc")}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Translation tab header */}
              <div className="flex flex-col items-center gap-6 mb-10">
                <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center">
                  <Languages className="w-7 h-7 text-violet-600" />
                </div>
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-foreground">
                    {t("translate.title")}
                  </h2>
                  <p className="text-sm text-muted mt-2">
                    {t("translate.description")}
                  </p>
                </div>
              </div>

              <TranslationTab />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
