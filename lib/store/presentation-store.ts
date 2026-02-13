import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import type {
  Presentation,
  Slide,
  TextElement,
  ImageElement,
  ProcessingStatus,
  TranslationStatus,
  OutputFormat,
} from "@/types/presentation";

/** Revoke all Blob URLs held by a presentation to prevent memory leaks */
function revokePresentationBlobUrls(presentation: Presentation | null) {
  if (!presentation) return;
  for (const slide of presentation.slides) {
    if (slide.backgroundImage) URL.revokeObjectURL(slide.backgroundImage);
    if (slide.thumbnailImage) URL.revokeObjectURL(slide.thumbnailImage);
    for (const img of slide.imageElements) {
      if (img.imageUrl) URL.revokeObjectURL(img.imageUrl);
    }
  }
}

/** Check if two bounding boxes (in % coordinates) overlap significantly (>50% IoU) */
function hasSignificantOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  const ax2 = a.x + a.width;
  const ay2 = a.y + a.height;
  const bx2 = b.x + b.width;
  const by2 = b.y + b.height;

  const ix1 = Math.max(a.x, b.x);
  const iy1 = Math.max(a.y, b.y);
  const ix2 = Math.min(ax2, bx2);
  const iy2 = Math.min(ay2, by2);

  if (ix2 <= ix1 || iy2 <= iy1) return false;

  const intersection = (ix2 - ix1) * (iy2 - iy1);
  const areaA = a.width * a.height;
  const areaB = b.width * b.height;
  const minArea = Math.min(areaA, areaB);

  // Overlap > 50% of the smaller region
  return minArea > 0 && intersection / minArea > 0.5;
}

/** Remove OCR-cropped images that overlap with PDF-embedded images */
function deduplicateImages(
  pdfImages: ImageElement[],
  ocrCroppedImages: ImageElement[],
): ImageElement[] {
  if (pdfImages.length === 0) return ocrCroppedImages;

  const deduplicated = ocrCroppedImages.filter((ocrImg) =>
    !pdfImages.some((pdfImg) => hasSignificantOverlap(ocrImg, pdfImg))
  );

  return deduplicated;
}

interface PresentationStore {
  presentation: Presentation | null;
  processingStatus: ProcessingStatus;
  translationStatus: TranslationStatus;

  // File Processing (PDF or DOCX)
  loadFile: (file: File, outputFormat: OutputFormat) => Promise<void>;

  // Navigation
  setCurrentSlide: (index: number) => void;

  // Text Editing
  updateTextElement: (
    slideId: string,
    elementId: string,
    updates: Partial<TextElement>
  ) => void;
  deleteTextElement: (slideId: string, elementId: string) => void;

  // Image Editing
  updateImageElement: (
    slideId: string,
    elementId: string,
    updates: Partial<ImageElement>
  ) => void;
  deleteImageElement: (slideId: string, elementId: string) => void;

  // Language
  setActiveLanguage: (lang: "original" | "ko" | "ja") => void;
  translateAll: (targetLang: "ko" | "ja") => Promise<void>;

  // Export
  exportToFile: (language: "original" | "ko" | "ja") => Promise<void>;

  // Reset
  reset: () => void;
}

export const usePresentationStore = create<PresentationStore>((set, get) => ({
  presentation: null,
  processingStatus: { stage: "idle" },
  translationStatus: { stage: "idle" },

  loadFile: async (file: File, outputFormat: OutputFormat) => {
    // Revoke old Blob URLs before loading new file
    revokePresentationBlobUrls(get().presentation);

    const ext = file.name.toLowerCase();

    if (ext.endsWith(".pdf")) {
      await loadPdfFile(file, outputFormat, set);
    } else if (ext.endsWith(".docx") || ext.endsWith(".doc")) {
      await loadDocxFile(file, outputFormat, set);
    } else {
      throw new Error("지원하지 않는 파일 형식입니다.");
    }
  },

  setCurrentSlide: (index: number) => {
    const { presentation } = get();
    if (!presentation) return;
    set({
      presentation: { ...presentation, currentSlideIndex: index },
    });
  },

  updateTextElement: (
    slideId: string,
    elementId: string,
    updates: Partial<TextElement>
  ) => {
    const { presentation } = get();
    if (!presentation) return;

    const updatedSlides = presentation.slides.map((slide) => {
      if (slide.id !== slideId) return slide;
      return {
        ...slide,
        textElements: slide.textElements.map((el) => {
          if (el.id !== elementId) return el;
          return { ...el, ...updates, isEdited: true };
        }),
      };
    });

    set({
      presentation: { ...presentation, slides: updatedSlides },
    });
  },

  deleteTextElement: (slideId: string, elementId: string) => {
    const { presentation } = get();
    if (!presentation) return;

    const updatedSlides = presentation.slides.map((slide) => {
      if (slide.id !== slideId) return slide;
      return {
        ...slide,
        textElements: slide.textElements.filter((el) => el.id !== elementId),
      };
    });

    set({
      presentation: { ...presentation, slides: updatedSlides },
    });
  },

  updateImageElement: (
    slideId: string,
    elementId: string,
    updates: Partial<ImageElement>
  ) => {
    const { presentation } = get();
    if (!presentation) return;

    const updatedSlides = presentation.slides.map((slide) => {
      if (slide.id !== slideId) return slide;
      return {
        ...slide,
        imageElements: slide.imageElements.map((el) => {
          if (el.id !== elementId) return el;
          return { ...el, ...updates };
        }),
      };
    });

    set({
      presentation: { ...presentation, slides: updatedSlides },
    });
  },

  deleteImageElement: (slideId: string, elementId: string) => {
    const { presentation } = get();
    if (!presentation) return;

    const updatedSlides = presentation.slides.map((slide) => {
      if (slide.id !== slideId) return slide;
      return {
        ...slide,
        imageElements: slide.imageElements.filter((el) => el.id !== elementId),
      };
    });

    set({
      presentation: { ...presentation, slides: updatedSlides },
    });
  },

  setActiveLanguage: (lang) => {
    const { presentation } = get();
    if (!presentation) return;
    set({
      presentation: { ...presentation, activeLanguage: lang },
    });
  },

  translateAll: async (targetLang) => {
    const { presentation } = get();
    if (!presentation) return;

    const allTexts: { slideId: string; elementId: string; text: string }[] = [];

    for (const slide of presentation.slides) {
      for (const el of slide.textElements) {
        const text = el.text;
        if (text.trim()) {
          allTexts.push({ slideId: slide.id, elementId: el.id, text });
        }
      }
    }

    if (allTexts.length === 0) return;

    set({
      translationStatus: {
        stage: "translating",
        language: targetLang,
        current: 0,
        total: allTexts.length,
      },
    });

    try {
      const { translateTexts } = await import("@/lib/translation/translate-client");
      const batchSize = 50;
      const translatedMap = new Map<string, string>();

      for (let i = 0; i < allTexts.length; i += batchSize) {
        const batch = allTexts.slice(i, i + batchSize);
        const texts = batch.map((b) => b.text);
        const translations = await translateTexts(texts, targetLang);

        batch.forEach((item, idx) => {
          translatedMap.set(
            `${item.slideId}:${item.elementId}`,
            translations[idx]
          );
        });

        set({
          translationStatus: {
            stage: "translating",
            language: targetLang,
            current: Math.min(i + batchSize, allTexts.length),
            total: allTexts.length,
          },
        });
      }

      // Apply translations
      const currentPresentation = get().presentation;
      if (!currentPresentation) return;

      const field = targetLang === "ko" ? "textKo" : "textJa";
      const updatedSlides = currentPresentation.slides.map((slide) => ({
        ...slide,
        textElements: slide.textElements.map((el) => {
          const key = `${slide.id}:${el.id}`;
          const translated = translatedMap.get(key);
          if (translated) {
            return { ...el, [field]: translated };
          }
          return el;
        }),
      }));

      set({
        presentation: {
          ...currentPresentation,
          slides: updatedSlides,
          activeLanguage: targetLang,
        },
        translationStatus: { stage: "complete" },
      });
    } catch (error) {
      console.error("Translation error:", error);
      set({ translationStatus: { stage: "idle" } });
      throw error;
    }
  },

  exportToFile: async (language) => {
    const { presentation } = get();
    if (!presentation) return;

    let blob: Blob;
    let extension: string;

    if (presentation.outputFormat === "docx") {
      const { generateDocx } = await import("@/lib/export/docx-generator");
      blob = await generateDocx(presentation.slides, language);
      extension = ".docx";
    } else {
      const { generatePptx } = await import("@/lib/export/pptx-generator");
      blob = await generatePptx(presentation.slides, language);
      extension = ".pptx";
    }

    // Download
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const langSuffix = language === "original" ? "" : `_${language}`;
    const baseName = presentation.fileName.replace(/\.(pdf|docx|doc)$/i, "");
    a.href = url;
    a.download = `${baseName}${langSuffix}${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  reset: () => {
    revokePresentationBlobUrls(get().presentation);
    set({
      presentation: null,
      processingStatus: { stage: "idle" },
      translationStatus: { stage: "idle" },
    });
  },
}));

// --- PDF Loading ---
async function loadPdfFile(
  file: File,
  outputFormat: OutputFormat,
  set: (state: Partial<{ presentation: Presentation | null; processingStatus: ProcessingStatus }>) => void,
) {
  const warnings: string[] = [];

  try {
    set({ processingStatus: { stage: "loading-pdf", progress: 0 } });

    const { loadPdf } = await import("@/lib/pdf/pdf-loader");
    const { renderPageToImage, tryExtractText } = await import("@/lib/pdf/pdf-renderer");
    const { extractImagesFromPage } = await import("@/lib/pdf/image-extractor");
    const { extractTextWithOcr, resetOcrCircuitBreaker, OcrRateLimitError } = await import("@/lib/pdf/ocr-client");
    const { cropImageRegions } = await import("@/lib/pdf/image-cropper");

    // Reset circuit breaker for new document
    resetOcrCircuitBreaker();

    const buffer = await file.arrayBuffer();
    const pdfDoc = await loadPdf(buffer);
    const numPages = pdfDoc.numPages;

    set({
      processingStatus: {
        stage: "rendering-pages",
        current: 0,
        total: numPages,
      },
    });

    const slides: Slide[] = [];
    let ocrErrorMsg: string | null = null;

    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDoc.getPage(i);

      set({
        processingStatus: {
          stage: "rendering-pages",
          current: i,
          total: numPages,
        },
      });

      const rendered = await renderPageToImage(page);

      // Extract individual images from this page
      set({
        processingStatus: {
          stage: "extracting-images",
          current: i,
          total: numPages,
        },
      });

      let imageElements: ImageElement[] = [];
      try {
        imageElements = await extractImagesFromPage(page);
      } catch (err) {
        console.warn(`[Page ${i}] Image extraction failed:`, err);
      }

      // OCR-based extraction: text with font info + image regions
      // (OCR provides better text grouping, font detection, and text/image separation)
      set({
        processingStatus: {
          stage: "ocr-processing",
          current: i,
          total: numPages,
        },
      });

      let textElements: TextElement[] = [];

      try {
        const ocrResult = await extractTextWithOcr(rendered.fullImageBase64);
        textElements = ocrResult.textElements;

        // Crop OCR-detected image regions (diagrams, charts, tables, etc.)
        // Then deduplicate against PDF-embedded images to avoid showing same image twice
        if (ocrResult.imageRegions.length > 0) {
          try {
            const croppedImages = await cropImageRegions(rendered.fullImage, ocrResult.imageRegions);
            const uniqueCroppedImages = deduplicateImages(imageElements, croppedImages);
            imageElements = [...imageElements, ...uniqueCroppedImages];
          } catch (cropErr) {
            console.warn(`[Page ${i}] Image region cropping failed:`, cropErr);
          }
        }

        console.log(`[Page ${i}] OCR: ${textElements.length} texts, ${imageElements.length} images`);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const isCircuitBreaker = err instanceof OcrRateLimitError;
        console.warn(`[Page ${i}] OCR failed${isCircuitBreaker ? " (circuit breaker)" : ""}:`, errMsg);

        // Record OCR error
        if (!ocrErrorMsg) {
          ocrErrorMsg = errMsg;
          warnings.push(isCircuitBreaker
            ? "OCR 실패: API 한도 초과"
            : `OCR 실패: ${errMsg}`);
        }

        // Fallback: text layer extraction when OCR fails
        try {
          const { hasText } = await tryExtractText(page);
          if (hasText) {
            const content = await page.getTextContent();
            const viewport = page.getViewport({ scale: 1.0 });
            textElements = buildTextLayerElements(content, viewport);
            console.log(`[Page ${i}] Fallback text layer: ${textElements.length} elements`);
          }
        } catch (textErr) {
          console.warn(`[Page ${i}] Text layer fallback also failed:`, textErr);
        }
      }

      // Report extraction failure for first page
      if (i === 1 && textElements.length === 0 && imageElements.length === 0) {
        warnings.push("텍스트/이미지 추출 실패");
        warnings.push("내보내기 시 페이지 이미지가 포함됩니다.");
      }

      slides.push({
        id: uuidv4(),
        pageIndex: i - 1,
        backgroundImage: rendered.fullImage,
        backgroundImageBase64: rendered.backgroundBase64,
        thumbnailImage: rendered.thumbnail,
        textElements,
        imageElements,
        width: rendered.width,
        height: rendered.height,
      });
    }

    set({
      presentation: {
        id: uuidv4(),
        fileName: file.name,
        slides,
        currentSlideIndex: 0,
        activeLanguage: "original",
        outputFormat,
        inputFileType: "pdf",
      },
      processingStatus: {
        stage: "complete",
        warnings: warnings.length > 0 ? warnings : undefined,
      },
    });
  } catch (error) {
    console.error("PDF loading error:", error);
    set({ processingStatus: { stage: "idle" } });
    throw error;
  }
}

// --- Text Layer Fallback (used only when OCR fails) ---
function buildTextLayerElements(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  viewport: any
): TextElement[] {
  const rawItems: Array<{
    text: string; x: number; y: number; width: number; height: number; fontSize: number;
  }> = [];

  for (const item of content.items) {
    if (!("str" in item) || !item.str.trim()) continue;
    const tx = item.transform[4];
    const ty = item.transform[5];
    const fontSizePt = Math.sqrt(item.transform[0] ** 2 + item.transform[1] ** 2);
    const fontSizePct = (fontSizePt / viewport.height) * 100;

    rawItems.push({
      text: item.str.normalize("NFC"),
      x: (tx / viewport.width) * 100,
      y: ((viewport.height - ty) / viewport.height) * 100,
      width: ((item.width || fontSizePt * item.str.length * 0.6) / viewport.width) * 100,
      height: fontSizePct * 1.3,
      fontSize: fontSizePct,
    });
  }

  if (rawItems.length === 0) return [];

  rawItems.sort((a, b) => a.y - b.y || a.x - b.x);
  const merged: typeof rawItems = [];
  let cur = { ...rawItems[0] };

  for (let j = 1; j < rawItems.length; j++) {
    const item = rawItems[j];
    const yTol = Math.max(cur.height, item.height) * 0.7;
    const xGap = item.x - (cur.x + cur.width);
    if (Math.abs(item.y - cur.y) <= yTol && xGap < 3) {
      cur.text += (xGap > 0.5 ? " " : "") + item.text;
      cur.width = Math.max(cur.width, item.x + item.width - cur.x);
      cur.height = Math.max(cur.height, item.height);
      cur.fontSize = Math.max(cur.fontSize, item.fontSize);
    } else {
      merged.push(cur);
      cur = { ...item };
    }
  }
  merged.push(cur);

  return merged.map((m) => ({
    id: uuidv4(),
    text: m.text,
    textKo: "",
    textJa: "",
    x: Math.max(0, Math.min(100, m.x)),
    y: Math.max(0, Math.min(100, m.y)),
    width: Math.max(1, Math.min(100, m.width)),
    height: Math.max(1, Math.min(100, m.height)),
    fontSize: m.fontSize,
    fontColor: "#000000",
    fontWeight: "normal" as const,
    textAlign: "left" as const,
    isEdited: false,
  }));
}

// --- DOCX Loading ---
async function loadDocxFile(
  file: File,
  outputFormat: OutputFormat,
  set: (state: Partial<{ presentation: Presentation | null; processingStatus: ProcessingStatus }>) => void,
) {
  try {
    set({ processingStatus: { stage: "loading-docx", progress: 0 } });

    const { loadDocx } = await import("@/lib/docx/docx-loader");
    const buffer = await file.arrayBuffer();

    const result = await loadDocx(buffer, (current, total) => {
      set({
        processingStatus: {
          stage: "rendering-pages",
          current,
          total,
        },
      });
    });

    set({
      presentation: {
        id: uuidv4(),
        fileName: file.name,
        slides: result.slides,
        currentSlideIndex: 0,
        activeLanguage: "original",
        outputFormat,
        inputFileType: "docx",
      },
      processingStatus: { stage: "complete" },
    });
  } catch (error) {
    console.error("DOCX loading error:", error);
    set({ processingStatus: { stage: "idle" } });
    throw error;
  }
}
