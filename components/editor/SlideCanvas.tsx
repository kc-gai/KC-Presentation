"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import TextOverlay from "./TextOverlay";
import ImageOverlay from "./ImageOverlay";
import type { Slide, TextElement, ImageElement } from "@/types/presentation";
import { useI18n } from "@/lib/i18n/use-i18n";

interface SlideCanvasProps {
  slide: Slide;
  activeLanguage: "original" | "ko" | "ja";
  onUpdateElement: (elementId: string, updates: Partial<TextElement>) => void;
  onDeleteElement: (elementId: string) => void;
  onUpdateImageElement: (elementId: string, updates: Partial<ImageElement>) => void;
  onDeleteImageElement: (elementId: string) => void;
}

export default function SlideCanvas({
  slide,
  activeLanguage,
  onUpdateElement,
  onDeleteElement,
  onUpdateImageElement,
  onDeleteImageElement,
}: SlideCanvasProps) {
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [canvasHeight, setCanvasHeight] = useState(0);
  const canvasRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

  // Track canvas actual rendered height for font size scaling
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCanvasHeight(entry.contentRect.height);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleCanvasClick = useCallback(() => {
    setSelectedElementId(null);
  }, []);

  const aspectRatio = slide.width / slide.height;
  const hasExtractedElements = slide.imageElements.length > 0 || slide.textElements.length > 0;

  // Build CSS background from DocAI analysis
  const bgStyle: React.CSSProperties = {};
  if (hasExtractedElements && slide.backgroundColor) {
    if (slide.backgroundColor.type === "solid" && slide.backgroundColor.color) {
      bgStyle.backgroundColor = slide.backgroundColor.color;
    } else if (
      slide.backgroundColor.type === "gradient" &&
      slide.backgroundColor.gradientFrom &&
      slide.backgroundColor.gradientTo
    ) {
      const angle = slide.backgroundColor.gradientAngle ?? 180;
      bgStyle.background = `linear-gradient(${angle}deg, ${slide.backgroundColor.gradientFrom}, ${slide.backgroundColor.gradientTo})`;
    }
  }

  return (
    <div className="flex items-center justify-center w-full h-full p-4">
      <div
        ref={canvasRef}
        data-slide-canvas
        className="relative shadow-lg rounded-lg overflow-hidden"
        style={{
          aspectRatio: `${aspectRatio}`,
          maxWidth: "100%",
          maxHeight: "100%",
          width: "100%",
          backgroundColor: bgStyle.backgroundColor || "#ffffff",
          background: bgStyle.background || undefined,
        }}
        onClick={handleCanvasClick}
      >
        {/* Background image: shown ONLY when no extracted elements (fallback) */}
        {!hasExtractedElements && (
          <Image
            src={slide.backgroundImage}
            alt={`Slide ${slide.pageIndex + 1}`}
            fill
            className="object-contain pointer-events-none"
            unoptimized
            priority
          />
        )}

        {/* Extraction failure notice */}
        {!hasExtractedElements && (
          <div className="absolute inset-x-0 bottom-4 flex justify-center z-10 pointer-events-none">
            <div className="flex items-center gap-2 px-4 py-2 bg-black/60 text-white text-xs rounded-lg backdrop-blur-sm">
              <ImageOff className="w-3.5 h-3.5" />
              {t("canvas.noElements")}
            </div>
          </div>
        )}

        {/* Image overlays - individual editable images */}
        {slide.imageElements.map((element) => (
          <ImageOverlay
            key={element.id}
            element={element}
            isSelected={selectedElementId === element.id}
            onSelect={() => setSelectedElementId(element.id)}
            onUpdate={(updates) => onUpdateImageElement(element.id, updates)}
            onDelete={() => {
              onDeleteImageElement(element.id);
              setSelectedElementId(null);
            }}
          />
        ))}

        {/* Text overlays */}
        {slide.textElements.map((element) => (
          <TextOverlay
            key={element.id}
            element={element}
            activeLanguage={activeLanguage}
            canvasHeight={canvasHeight}
            isSelected={selectedElementId === element.id}
            onSelect={() => setSelectedElementId(element.id)}
            onUpdate={(updates) => onUpdateElement(element.id, updates)}
            onDelete={() => {
              onDeleteElement(element.id);
              setSelectedElementId(null);
            }}
          />
        ))}
      </div>
    </div>
  );
}
