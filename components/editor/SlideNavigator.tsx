"use client";

import Image from "next/image";
import type { Slide } from "@/types/presentation";
import { useI18n } from "@/lib/i18n/use-i18n";

interface SlideNavigatorProps {
  slides: Slide[];
  currentIndex: number;
  onSelectSlide: (index: number) => void;
}

export default function SlideNavigator({
  slides,
  currentIndex,
  onSelectSlide,
}: SlideNavigatorProps) {
  const { t } = useI18n();

  return (
    <div className="w-48 bg-card border-r border-border flex flex-col overflow-hidden">
      <div className="p-3 border-b border-border">
        <h3 className="text-sm font-medium text-foreground">
          {t("navigator.title")} ({slides.length})
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            onClick={() => onSelectSlide(index)}
            className={`
              w-full rounded-lg overflow-hidden border-2 transition-all
              ${currentIndex === index
                ? "border-primary shadow-md"
                : "border-transparent hover:border-primary/30"
              }
            `}
          >
            <div className="relative aspect-video bg-slate-100">
              <Image
                src={slide.thumbnailImage}
                alt={`Slide ${index + 1}`}
                fill
                className="object-contain"
                unoptimized
              />
            </div>
            <div className="py-1 text-xs text-muted">{index + 1}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
