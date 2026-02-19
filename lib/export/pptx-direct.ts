import PptxGenJS from "pptxgenjs";
import type { Slide, TextElement } from "@/types/presentation";

type Language = "original" | "ko" | "ja";

/**
 * Direct PPTX generator — uses high-res background image + text overlay approach.
 * NO LLM calls. Fast, reliable, pixel-perfect.
 *
 * Strategy:
 * - For "original" language: just use high-res background images (instant export)
 * - For translations: background + white cover rectangles + translated text overlay
 */
export async function generatePptxDirect(
  slides: Slide[],
  language: Language
): Promise<Blob> {
  const pptx = new PptxGenJS();

  // Calculate slide dimensions from first slide's aspect ratio
  if (slides.length > 0) {
    const firstSlide = slides[0];
    const aspectRatio = firstSlide.width / firstSlide.height;

    // Standard 16:9 widescreen
    if (aspectRatio > 1.5) {
      pptx.defineLayout({ name: "CUSTOM", width: 10, height: 5.625 });
    }
    // Standard 4:3
    else if (aspectRatio > 1.2) {
      pptx.defineLayout({ name: "CUSTOM", width: 10, height: 7.5 });
    }
    // Custom aspect ratio
    else {
      pptx.defineLayout({
        name: "CUSTOM",
        width: 10,
        height: 10 / aspectRatio,
      });
    }
    pptx.layout = "CUSTOM";
  }

  const layoutW = pptx.presLayout?.width
    ? Number(pptx.presLayout.width)
    : 10;
  const layoutH = pptx.presLayout?.height
    ? Number(pptx.presLayout.height)
    : 5.625;

  for (const slideData of slides) {
    const pptSlide = pptx.addSlide();

    // Step 1: Set background image (priority: high-res > original > color > white)
    if (slideData.highResBackgroundBase64) {
      // Use 4x quality background — captures EVERYTHING
      pptSlide.background = {
        data: `image/jpeg;base64,${slideData.highResBackgroundBase64}`,
      };
    } else if (slideData.backgroundImageBase64) {
      // Fallback to original quality
      pptSlide.background = {
        data: `image/jpeg;base64,${slideData.backgroundImageBase64}`,
      };
    } else if (slideData.backgroundColor) {
      // Fallback to analyzed background color
      if (slideData.backgroundColor.type === "solid") {
        pptSlide.background = {
          fill: slideData.backgroundColor.color!.replace("#", ""),
        };
      } else if (slideData.backgroundColor.type === "gradient") {
        // pptxgenjs doesn't support gradients — use the "from" color
        pptSlide.background = {
          fill: slideData.backgroundColor.gradientFrom!.replace("#", ""),
        };
      }
    } else {
      // Default white background
      pptSlide.background = { fill: "FFFFFF" };
    }

    // Step 2: Overlay translated text (ONLY if language !== "original")
    if (language !== "original") {
      for (const element of slideData.textElements) {
        const translatedText = getTextForLanguage(element, language);
        const originalText = element.text;

        // Skip if translation is the same as original AND not manually edited
        if (translatedText === originalText && !element.isEdited) {
          continue; // Already in background image
        }

        // Skip empty text
        if (!translatedText.trim()) {
          continue;
        }

        const xInches = (element.x / 100) * layoutW;
        const yInches = (element.y / 100) * layoutH;
        const wInches = (element.width / 100) * layoutW;
        const hInches = (element.height / 100) * layoutH;

        // Convert fontSize from % of slide height to pt
        const fontSizePt = Math.max(
          8,
          Math.round((element.fontSize / 100) * slideData.height)
        );

        // Detect language and get appropriate font
        const detectedLang = detectLanguage(translatedText);
        const fontFace = getFontForLanguage(detectedLang);

        // Add white rectangle to cover original text
        pptSlide.addShape(pptx.ShapeType.rect, {
          x: xInches,
          y: yInches,
          w: wInches,
          h: hInches,
          fill: { color: "FFFFFF" },
          line: { type: "none" },
        });

        // Add translated text on top
        pptSlide.addText(translatedText, {
          x: xInches,
          y: yInches,
          w: wInches,
          h: hInches,
          fontSize: fontSizePt,
          fontFace,
          color: element.fontColor.replace("#", ""),
          bold: element.fontWeight === "bold",
          align: element.textAlign,
          valign: "top",
          wrap: true,
          charSpacing: 0,
        });
      }
    }

    // Step 3: Overlay image elements (if edited/moved)
    // For "original" export, skip this — images are already in background
    // For translated export, overlay only if needed
    if (language !== "original") {
      for (const imgElement of slideData.imageElements) {
        const xInches = (imgElement.x / 100) * layoutW;
        const yInches = (imgElement.y / 100) * layoutH;
        const wInches = (imgElement.width / 100) * layoutW;
        const hInches = (imgElement.height / 100) * layoutH;

        pptSlide.addImage({
          data: `data:${imgElement.mimeType};base64,${imgElement.imageBase64}`,
          x: xInches,
          y: yInches,
          w: wInches,
          h: hInches,
        });
      }
    }
  }

  const blob = (await pptx.write({ outputType: "blob" })) as Blob;
  return blob;
}

// Helper functions (from legacy pptx-generator.ts)

function getTextForLanguage(element: TextElement, language: Language): string {
  switch (language) {
    case "ko":
      return element.textKo || element.text;
    case "ja":
      return element.textJa || element.text;
    default:
      return element.text;
  }
}

function detectLanguage(text: string): "ko" | "ja" | "en" {
  const koreanRegex = /[\uAC00-\uD7AF]/;
  const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF]/;

  if (koreanRegex.test(text)) return "ko";
  if (japaneseRegex.test(text)) return "ja";
  return "en";
}

function getFontForLanguage(lang: "ko" | "ja" | "en"): string {
  switch (lang) {
    case "ko":
      return "Malgun Gothic";
    case "ja":
      return "Yu Gothic";
    default:
      return "Calibri";
  }
}
