import PptxGenJS from "pptxgenjs";
import type { Slide, TextElement } from "@/types/presentation";

type Language = "original" | "ko" | "ja";

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

export async function generatePptx(
  slides: Slide[],
  language: Language
): Promise<Blob> {
  const pptx = new PptxGenJS();

  // Detect slide aspect ratio from first slide
  if (slides.length > 0) {
    const firstSlide = slides[0];
    const aspectRatio = firstSlide.width / firstSlide.height;

    if (aspectRatio > 1.5) {
      pptx.defineLayout({ name: "CUSTOM", width: 10, height: 5.625 });
    } else if (aspectRatio > 1.2) {
      pptx.defineLayout({ name: "CUSTOM", width: 10, height: 7.5 });
    } else {
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

    // White background (no full-page image background)
    pptSlide.background = { fill: "FFFFFF" };

    // Add individual image elements
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

    // If no individual images were extracted, fall back to background image
    if (slideData.imageElements.length === 0) {
      if (slideData.backgroundImageBase64) {
        pptSlide.background = { data: `image/jpeg;base64,${slideData.backgroundImageBase64}` };
      } else if (slideData.backgroundImage) {
        const bgImg = await fetchImageAsBase64(slideData.backgroundImage);
        if (bgImg) {
          pptSlide.background = { data: `image/png;base64,${bgImg}` };
        }
      }
    }

    // Add text elements
    for (const element of slideData.textElements) {
      const text = getTextForLanguage(element, language);
      if (!text.trim()) continue;

      const detectedLang = detectLanguage(text);
      const fontFace = getFontForLanguage(detectedLang);

      const xInches = (element.x / 100) * layoutW;
      const yInches = (element.y / 100) * layoutH;
      const wInches = (element.width / 100) * layoutW;
      const hInches = (element.height / 100) * layoutH;

      pptSlide.addText(text, {
        x: xInches,
        y: yInches,
        w: wInches,
        h: hInches,
        fontSize: Math.round(element.fontSize * 0.75),
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

  const blob = (await pptx.write({ outputType: "blob" })) as Blob;
  return blob;
}

async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
