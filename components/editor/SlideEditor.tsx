"use client";

import { useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { usePresentationStore } from "@/lib/store/presentation-store";
import SlideCanvas from "./SlideCanvas";
import SlideNavigator from "./SlideNavigator";
import SlideToolbar from "./SlideToolbar";

export default function SlideEditor() {
  const {
    presentation,
    processingStatus,
    setCurrentSlide,
    updateTextElement,
    deleteTextElement,
    updateImageElement,
    deleteImageElement,
  } = usePresentationStore();

  const [warningsDismissed, setWarningsDismissed] = useState(false);

  if (!presentation) return null;

  const currentSlide = presentation.slides[presentation.currentSlideIndex];
  if (!currentSlide) return null;

  const warnings =
    processingStatus.stage === "complete" ? processingStatus.warnings : undefined;

  return (
    <div className="flex flex-col h-screen">
      <SlideToolbar />

      {/* Warning banner */}
      {warnings && warnings.length > 0 && !warningsDismissed && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
          <div className="flex items-start gap-3 max-w-4xl mx-auto">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              {warnings.map((w, idx) => (
                <p key={idx} className="text-sm text-amber-800">
                  {w}
                </p>
              ))}
            </div>
            <button
              onClick={() => setWarningsDismissed(true)}
              className="flex-shrink-0 p-1 rounded hover:bg-amber-100 text-amber-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <SlideNavigator
          slides={presentation.slides}
          currentIndex={presentation.currentSlideIndex}
          onSelectSlide={setCurrentSlide}
        />
        <div className="flex-1 bg-slate-100 overflow-hidden">
          <SlideCanvas
            slide={currentSlide}
            activeLanguage={presentation.activeLanguage}
            onUpdateElement={(elementId, updates) =>
              updateTextElement(currentSlide.id, elementId, updates)
            }
            onDeleteElement={(elementId) =>
              deleteTextElement(currentSlide.id, elementId)
            }
            onUpdateImageElement={(elementId, updates) =>
              updateImageElement(currentSlide.id, elementId, updates)
            }
            onDeleteImageElement={(elementId) =>
              deleteImageElement(currentSlide.id, elementId)
            }
          />
        </div>
      </div>
    </div>
  );
}
