"use client";

import { useState, useCallback } from "react";
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
  const { t } = useI18n();

  const handleCanvasClick = useCallback(() => {
    setSelectedElementId(null);
  }, []);

  const aspectRatio = slide.width / slide.height;
  const hasExtractedElements = slide.imageElements.length > 0 || slide.textElements.length > 0;

  return (
    <div className="flex items-center justify-center w-full h-full p-4">
      <div
        data-slide-canvas
        className="relative bg-white shadow-lg rounded-lg overflow-hidden"
        style={{
          aspectRatio: `${aspectRatio}`,
          maxWidth: "100%",
          maxHeight: "100%",
          width: "100%",
        }}
        onClick={handleCanvasClick}
      >
        {/* Background image - shown as faint reference when elements are extracted */}
        <Image
          src={slide.backgroundImage}
          alt={`Slide ${slide.pageIndex + 1}`}
          fill
          className={`object-contain pointer-events-none ${
            hasExtractedElements ? "opacity-10" : "opacity-100"
          }`}
          unoptimized
          priority
        />

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
