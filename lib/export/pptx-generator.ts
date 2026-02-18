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

    // Background priority: analyzed color > high-res image > original > white
    if (slideData.backgroundColor && slideData.backgroundColor.type === "solid") {
      // Solid color background
      pptSlide.background = { fill: slideData.backgroundColor.color!.replace("#", "") };
    } else if (slideData.backgroundColor && slideData.backgroundColor.type === "gradient") {
      // Gradient background: pptxgenjs doesn't support gradient background directly
      // Use a rectangle shape to simulate gradient (approximation with solid color)
      // For better results, we use the "from" color as the background
      pptSlide.background = { fill: slideData.backgroundColor.gradientFrom!.replace("#", "") };
    } else if (slideData.highResBackgroundBase64) {
      // Image background: high-resolution
      pptSlide.background = { data: `image/jpeg;base64,${slideData.highResBackgroundBase64}` };
    } else if (slideData.backgroundImageBase64) {
      // Image background: original quality
      pptSlide.background = { data: `image/jpeg;base64,${slideData.backgroundImageBase64}` };
    } else if (slideData.backgroundImage) {
      // Fallback: fetch blob URL as base64
      const bgImg = await fetchImageAsBase64(slideData.backgroundImage);
      if (bgImg) {
        pptSlide.background = { data: `image/png;base64,${bgImg}` };
      }
    } else {
      // Default: white background
      pptSlide.background = { fill: "FFFFFF" };
    }

    // Add individual image elements on top of background
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

    // Add text elements
    // fontSize is stored as % of slide height → convert to pt using slideData.height
    for (const element of slideData.textElements) {
      const text = getTextForLanguage(element, language);
      if (!text.trim()) continue;

      const detectedLang = detectLanguage(text);
      const fontFace = getFontForLanguage(detectedLang);

      const xInches = (element.x / 100) * layoutW;
      const yInches = (element.y / 100) * layoutH;
      const wInches = (element.width / 100) * layoutW;
      const hInches = (element.height / 100) * layoutH;

      // Convert fontSize from % of slide height to pt
      const fontSizePt = Math.max(8, Math.round((element.fontSize / 100) * slideData.height));

      pptSlide.addText(text, {
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
