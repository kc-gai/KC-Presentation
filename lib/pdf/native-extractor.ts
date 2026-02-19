import type { PDFPageProxy } from "pdfjs-dist";
import { v4 as uuidv4 } from "uuid";
import type { TextElement, ImageElement } from "@/types/presentation";
import { extractImagesFromPage } from "./image-extractor";

export interface NativeExtractionResult {
  textElements: TextElement[];
  imageElements: ImageElement[];
}

interface TextItem {
  str: string;
  transform: number[]; // [a, b, c, d, e, f] - 2D affine transform matrix
  width: number;
  height: number;
  fontName: string;
  hasEOL: boolean;
}

interface MergedTextLine {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontName: string;
  items: number; // count of merged items
}

/**
 * Extract text and images from a PDF page using pdfjs's native APIs.
 * NO LLM/OCR - gets exact positions, fonts, sizes from the PDF's text layer.
 */
export async function extractPageNative(
  page: PDFPageProxy
): Promise<NativeExtractionResult> {
  const viewport = page.getViewport({ scale: 1.0 });
  const pageWidth = viewport.width;
  const pageHeight = viewport.height;

  // Extract text elements
  const textContent = await page.getTextContent();
  const textElements = extractTextElements(
    textContent.items as TextItem[],
    pageWidth,
    pageHeight
  );

  // Extract image elements (reuse existing logic)
  const imageElements = await extractImagesFromPage(page);

  return { textElements, imageElements };
}

function extractTextElements(
  items: TextItem[],
  pageWidth: number,
  pageHeight: number
): TextElement[] {
  // Step 1: Convert text items to positioned text with metadata
  const positionedItems = items
    .map((item) => {
      const str = item.str.trim();
      if (!str) return null;

      // Transform matrix: [a, b, c, d, e, f]
      // Position: (e, f) is the baseline origin
      // Font size: sqrt(a^2 + b^2) or sqrt(c^2 + d^2) (usually same for unrotated text)
      const [a, b, c, d, e, f] = item.transform;
      const fontSize = Math.sqrt(a * a + b * b);

      // PDF coordinate system: origin at bottom-left
      // Convert to top-left origin for our percentage system
      const x = e;
      const y = pageHeight - f; // Flip Y-axis
      const width = item.width;
      const height = fontSize; // Approximate height from font size

      return {
        text: str,
        x,
        y,
        width,
        height,
        fontSize,
        fontName: item.fontName,
        hasEOL: item.hasEOL,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  // Step 2: Group text items into lines (merge items on same Y coordinate)
  const lines = mergeTextItemsIntoLines(positionedItems);

  // Step 3: Convert lines to TextElements with percentage coordinates
  return lines.map((line): TextElement => {
    // Convert to percentage coordinates (0-100)
    const xPct = (line.x / pageWidth) * 100;
    const yPct = (line.y / pageHeight) * 100;
    const widthPct = (line.width / pageWidth) * 100;
    const heightPct = (line.height / pageHeight) * 100;

    // Detect font weight from font name
    const fontWeight = /bold/i.test(line.fontName) ? "bold" : "normal";

    // Detect text alignment based on position
    const textAlign = detectTextAlign(line.x, line.width, pageWidth);

    // fontSize: store as % of page height (consistent with legacy code + pptx-direct)
    const fontSizePct = (line.fontSize / pageHeight) * 100;

    return {
      id: uuidv4(),
      text: line.text,
      textKo: "", // Will be filled by translation
      textJa: "", // Will be filled by translation
      x: Math.max(0, Math.min(100, xPct)),
      y: Math.max(0, Math.min(100, yPct)),
      width: Math.max(1, Math.min(100, widthPct)),
      height: Math.max(1, Math.min(100, heightPct)),
      fontSize: fontSizePct,
      fontColor: "#000000", // Default - pdfjs doesn't reliably provide text color
      fontWeight,
      textAlign,
      isEdited: false,
    };
  });
}

/**
 * Merge text items that are on the same line (same Y, same font size).
 * pdfjs splits text into individual words/characters - we need to group them.
 */
function mergeTextItemsIntoLines(
  items: Array<{
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
    fontName: string;
    hasEOL: boolean;
  }>
): MergedTextLine[] {
  if (items.length === 0) return [];

  const lines: MergedTextLine[] = [];
  const Y_TOLERANCE = 2; // Points - items within 2pt vertically are considered same line
  const FONT_SIZE_TOLERANCE = 1; // Font size must match within 1pt

  let currentLine: MergedTextLine | null = null;

  for (const item of items) {
    const canMerge =
      currentLine &&
      Math.abs(currentLine.y - item.y) < Y_TOLERANCE &&
      Math.abs(currentLine.fontSize - item.fontSize) < FONT_SIZE_TOLERANCE &&
      currentLine.fontName === item.fontName;

    if (canMerge && currentLine) {
      // Merge into current line
      currentLine.text += " " + item.text;
      // Expand bounding box
      const rightEdge = Math.max(
        currentLine.x + currentLine.width,
        item.x + item.width
      );
      currentLine.width = rightEdge - currentLine.x;
      currentLine.items++;
    } else {
      // Start new line
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = {
        text: item.text,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        fontSize: item.fontSize,
        fontName: item.fontName,
        items: 1,
      };
    }

    // Force new line on explicit line break
    if (item.hasEOL && currentLine) {
      lines.push(currentLine);
      currentLine = null;
    }
  }

  // Push final line
  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Detect text alignment based on horizontal position.
 * Left margin < 10% → left
 * Right margin < 10% → right
 * Otherwise → center
 */
function detectTextAlign(
  x: number,
  width: number,
  pageWidth: number
): "left" | "center" | "right" {
  const leftMarginPct = (x / pageWidth) * 100;
  const rightMarginPct = ((pageWidth - (x + width)) / pageWidth) * 100;

  if (leftMarginPct < 10) return "left";
  if (rightMarginPct < 10) return "right";
  return "center";
}
