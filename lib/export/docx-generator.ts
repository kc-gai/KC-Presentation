import {
  Document,
  Paragraph,
  TextRun,
  ImageRun,
  HeadingLevel,
  AlignmentType,
  Packer,
} from "docx";
import type { Slide, TextElement, ImageElement } from "@/types/presentation";

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

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getAlignmentType(
  align: "left" | "center" | "right"
): (typeof AlignmentType)[keyof typeof AlignmentType] {
  switch (align) {
    case "center":
      return AlignmentType.CENTER;
    case "right":
      return AlignmentType.RIGHT;
    default:
      return AlignmentType.LEFT;
  }
}

export async function generateDocx(
  slides: Slide[],
  language: Language
): Promise<Blob> {
  const children: Paragraph[] = [];

  for (let slideIdx = 0; slideIdx < slides.length; slideIdx++) {
    const slide = slides[slideIdx];

    // Add page break between slides (except first)
    if (slideIdx > 0) {
      children.push(
        new Paragraph({
          pageBreakBefore: true,
          children: [],
        })
      );
    }

    const contentStartCount = children.length;

    // Sort elements by Y position (top to bottom), then X (left to right)
    const allElements: {
      type: "text" | "image";
      y: number;
      textEl?: TextElement;
      imgEl?: ImageElement;
    }[] = [];

    for (const el of slide.textElements) {
      allElements.push({ type: "text", y: el.y, textEl: el });
    }
    for (const el of slide.imageElements) {
      allElements.push({ type: "image", y: el.y, imgEl: el });
    }

    allElements.sort((a, b) => a.y - b.y);

    for (const elem of allElements) {
      if (elem.type === "text" && elem.textEl) {
        const text = getTextForLanguage(elem.textEl, language);
        if (!text.trim()) continue;

        const detectedLang = detectLanguage(text);
        const fontFace = getFontForLanguage(detectedLang);
        const fontSize = elem.textEl.fontSize;

        // Determine heading level based on font size
        let heading: (typeof HeadingLevel)[keyof typeof HeadingLevel] | undefined;
        if (fontSize >= 28) {
          heading = HeadingLevel.HEADING_1;
        } else if (fontSize >= 22) {
          heading = HeadingLevel.HEADING_2;
        } else if (fontSize >= 18) {
          heading = HeadingLevel.HEADING_3;
        }

        // Split text by newlines and create separate runs
        const lines = text.split("\n");
        const runs: TextRun[] = [];

        for (let i = 0; i < lines.length; i++) {
          if (i > 0) {
            runs.push(new TextRun({ break: 1, text: "" }));
          }
          runs.push(
            new TextRun({
              text: lines[i],
              font: fontFace,
              size: Math.round(fontSize * 1.5), // half-points
              bold: elem.textEl.fontWeight === "bold",
              color: elem.textEl.fontColor.replace("#", ""),
            })
          );
        }

        children.push(
          new Paragraph({
            heading,
            alignment: getAlignmentType(elem.textEl.textAlign),
            children: runs,
          })
        );
      } else if (elem.type === "image" && elem.imgEl) {
        try {
          const imgData = base64ToUint8Array(elem.imgEl.imageBase64);

          // Scale image for document (max 600px width)
          const maxWidth = 600;
          const maxHeight = 400;
          let width = elem.imgEl.originalWidth;
          let height = elem.imgEl.originalHeight;

          if (width > maxWidth) {
            const ratio = maxWidth / width;
            width = maxWidth;
            height = Math.round(height * ratio);
          }
          if (height > maxHeight) {
            const ratio = maxHeight / height;
            height = maxHeight;
            width = Math.round(width * ratio);
          }

          children.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  data: imgData,
                  transformation: { width, height },
                  type: "png",
                }),
              ],
            })
          );
        } catch (err) {
          console.warn("Failed to add image to DOCX:", err);
        }
      }
    }

    // Fallback: if no text or image elements were added, embed the full page render
    const hasSlideContent = children.length > contentStartCount;
    if (!hasSlideContent && slide.backgroundImageBase64) {
      try {
        const imgData = base64ToUint8Array(slide.backgroundImageBase64);
        const aspectRatio = slide.width / slide.height;
        const imgWidth = 600;
        const imgHeight = Math.round(imgWidth / aspectRatio);

        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                data: imgData,
                transformation: { width: imgWidth, height: imgHeight },
                type: "jpg",
              }),
            ],
          })
        );
      } catch (err) {
        console.warn("Failed to add background image fallback to DOCX:", err);
      }
    }
  }

  const doc = new Document({
    sections: [{ children }],
  });

  return await Packer.toBlob(doc);
}
