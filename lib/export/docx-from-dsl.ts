/**
 * DOCX Generator from SlideDSL
 *
 * Converts PresentationDSL to Word document using docx library.
 */

import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Packer,
  WidthType,
  ImageRun,
} from "docx";
import type {
  PresentationDSL,
  SlideDSL,
  DSLElement,
  DSLTheme,
  DSLText,
  DSLTable,
  DSLImage,
  DSLDivider,
  DSLPanel,
} from "@/types/slide-dsl";

// ============================================================
// Utility Functions
// ============================================================

/** Detect font based on text content */
function detectFont(text: string, fontType: "title" | "body", theme: DSLTheme): string {
  // Korean
  if (/[\uAC00-\uD7AF]/.test(text)) return "Malgun Gothic";
  // Japanese
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return "Yu Gothic";
  // Default
  return fontType === "title" ? (theme.fonts.title || "Calibri") : (theme.fonts.body || "Calibri");
}

/** Remove # from hex color */
function cleanHex(color: string): string {
  return color.replace("#", "");
}

/** Convert pt to half-points (docx unit) */
function ptToHalfPt(pt: number): number {
  return pt * 2;
}

/** Convert alignment string to AlignmentType */
function getAlignment(align?: "left" | "center" | "right"): typeof AlignmentType[keyof typeof AlignmentType] {
  switch (align) {
    case "center":
      return AlignmentType.CENTER;
    case "right":
      return AlignmentType.RIGHT;
    default:
      return AlignmentType.LEFT;
  }
}

// ============================================================
// Element Converters
// ============================================================

function convertText(
  element: DSLText,
  theme: DSLTheme
): Paragraph[] {
  const { text, style, listItems } = element;
  const paragraphs: Paragraph[] = [];

  // Determine heading level based on size
  let heading: typeof HeadingLevel[keyof typeof HeadingLevel] | undefined;
  if (style.size > 20) {
    heading = HeadingLevel.HEADING_1;
  } else if (style.size >= 14) {
    heading = HeadingLevel.HEADING_2;
  }

  if (listItems && listItems.length > 0) {
    // Render as bullet list
    listItems.forEach((item) => {
      paragraphs.push(
        new Paragraph({
          text: item,
          bullet: { level: 0 },
          alignment: getAlignment(style.align),
        })
      );
    });
  } else {
    // Regular text
    paragraphs.push(
      new Paragraph({
        heading,
        children: [
          new TextRun({
            text: text,
            bold: style.bold,
            italics: style.italic,
            color: cleanHex(style.color),
            size: ptToHalfPt(style.size),
            font: detectFont(text, style.font, theme),
          }),
        ],
        alignment: getAlignment(style.align),
      })
    );
  }

  return paragraphs;
}

function convertTable(element: DSLTable): Table {
  const { rows, style } = element;

  const tableRows = rows.map(
    (row) =>
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: cell.text,
                      bold: cell.style?.bold,
                      color: cell.style?.color ? cleanHex(cell.style.color) : undefined,
                      size: ptToHalfPt(style.fontSize || 10),
                    }),
                  ],
                  alignment: getAlignment(cell.style?.align),
                }),
              ],
              shading: cell.style?.fillColor
                ? { fill: cleanHex(cell.style.fillColor) }
                : undefined,
            })
        ),
      })
  );

  const borderColor = style.grid ? cleanHex(style.grid) : "CCCCCC";
  const borderConfig = {
    style: BorderStyle.SINGLE,
    size: 1,
    color: borderColor,
  };

  return new Table({
    rows: tableRows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: borderConfig,
      bottom: borderConfig,
      left: borderConfig,
      right: borderConfig,
      insideHorizontal: borderConfig,
      insideVertical: borderConfig,
    },
  });
}

function convertImage(
  element: DSLImage,
  assetMap?: Record<string, string>
): Paragraph | null {
  const { ref, bbox } = element;

  const imgData = assetMap?.[ref];
  if (!imgData) return null;

  // Extract base64 from data URL
  const base64Match = imgData.match(/^data:image\/[^;]+;base64,(.+)$/);
  if (!base64Match) return null;

  const base64Data = base64Match[1];

  return new Paragraph({
    children: [
      new ImageRun({
        type: "png",
        data: Buffer.from(base64Data, "base64"),
        transformation: {
          width: bbox.w,
          height: bbox.h,
        },
      }),
    ],
  });
}

function convertDivider(element: DSLDivider): Paragraph {
  const { style } = element;

  return new Paragraph({
    text: "",
    border: {
      bottom: {
        style: BorderStyle.SINGLE,
        size: style.width * 8,
        color: cleanHex(style.color),
      },
    },
    spacing: { after: 200 },
  });
}

function convertPanel(element: DSLPanel): Paragraph {
  const { style } = element;

  return new Paragraph({
    text: "[Panel]",
    indent: { left: 720 },
    border: {
      left: {
        style: BorderStyle.SINGLE,
        size: 12,
        color: style.stroke ? cleanHex(style.stroke) : "CCCCCC",
      },
    },
    spacing: { after: 200 },
  });
}

// ============================================================
// Slide to Paragraphs Converter
// ============================================================

function convertSlideToParagraphs(
  slide: SlideDSL,
  language: "original" | "ko" | "ja",
  theme: DSLTheme,
  assetMap?: Record<string, string>
): (Paragraph | Table)[] {
  const content: (Paragraph | Table)[] = [];

  for (const element of slide.elements) {
    switch (element.type) {
      case "text": {
        const paragraphs = convertText(element, theme);
        content.push(...paragraphs);
        break;
      }
      case "table": {
        const table = convertTable(element);
        content.push(table);
        break;
      }
      case "image": {
        const imageParagraph = convertImage(element, assetMap);
        if (imageParagraph) content.push(imageParagraph);
        break;
      }
      case "divider": {
        const divider = convertDivider(element);
        content.push(divider);
        break;
      }
      case "panel": {
        const panel = convertPanel(element);
        content.push(panel);
        break;
      }
      // Skip background, icon
      default:
        break;
    }
  }

  return content;
}

// ============================================================
// Public API
// ============================================================

/**
 * Generate DOCX file from PresentationDSL
 *
 * @param dsl - Complete presentation DSL
 * @param language - Language variant (for future use)
 * @param assetMap - Map of asset refs to base64 data URLs
 * @returns DOCX file as Blob
 */
export async function generateDocxFromDSL(
  dsl: PresentationDSL,
  language: "original" | "ko" | "ja" = "original",
  assetMap?: Record<string, string>
): Promise<Blob> {
  const sections = dsl.slides.map((slide, index) => ({
    properties: {
      // Add page break between slides (except first)
      ...(index > 0 ? {} : {}), // Page breaks are handled by paragraphs
    },
    children: [
      // Add slide title/separator
      new Paragraph({
        text: `Slide ${slide.pageIndex + 1}`,
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
        pageBreakBefore: index > 0,
      }),
      // Convert slide elements
      ...convertSlideToParagraphs(slide, language, dsl.globalTheme, assetMap),
    ],
  }));

  const doc = new Document({
    sections,
  });

  const blob = await Packer.toBlob(doc);
  return blob;
}
