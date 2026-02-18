/**
 * PPTX Generator from SlideDSL
 *
 * Converts PresentationDSL to PowerPoint file using pptxgenjs.
 */

import PptxGenJS from "pptxgenjs";
import type {
  PresentationDSL,
  SlideDSL,
  DSLElement,
  DSLTheme,
  DSLBBox,
  DSLFill,
  DSLPanel,
  DSLText,
  DSLTable,
  DSLIcon,
  DSLImage,
  DSLDivider,
  DSLBackground,
} from "@/types/slide-dsl";

// ============================================================
// Utility Functions
// ============================================================

/** Convert pt to inches (pptxgenjs uses inches) */
function ptToInch(pt: number): number {
  return pt / 72;
}

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

// ============================================================
// Element Renderers
// ============================================================

function renderBackground(
  slide: PptxGenJS.Slide,
  element: DSLBackground,
  slideBBox: { widthPt: number; heightPt: number }
): void {
  const { fill } = element;

  if (fill.kind === "solid" && fill.color) {
    slide.background = { fill: cleanHex(fill.color) };
  } else if (fill.kind === "linearGradient" && fill.gradient) {
    // pptxgenjs doesn't support gradient backgrounds directly
    // Workaround: add a full-size rectangle with gradient
    const grad = fill.gradient;
    slide.addShape("rect", {
      x: 0,
      y: 0,
      w: ptToInch(slideBBox.widthPt),
      h: ptToInch(slideBBox.heightPt),
      fill: {
        type: "solid",
        color: cleanHex(grad.stops[0]?.color || "#FFFFFF"),
        // Note: pptxgenjs has limited gradient support
        // This is a simplified fallback to the first color
      },
    });
  }
}

function renderPanel(slide: PptxGenJS.Slide, element: DSLPanel): void {
  const { bbox, style } = element;

  slide.addShape("rect", {
    x: ptToInch(bbox.x),
    y: ptToInch(bbox.y),
    w: ptToInch(bbox.w),
    h: ptToInch(bbox.h),
    fill: style.fill ? { type: "solid", color: cleanHex(style.fill) } : { type: "solid", color: "FFFFFF" },
    line: style.stroke
      ? {
          color: cleanHex(style.stroke),
          width: style.strokeWidth || 1,
        }
      : undefined,
    rectRadius: style.radius ? ptToInch(style.radius) : undefined,
    shadow: style.shadow
      ? {
          type: "outer",
          blur: 3,
          offset: 2,
          color: "000000",
          opacity: 0.2,
        }
      : undefined,
  });
}

function renderText(slide: PptxGenJS.Slide, element: DSLText, theme: DSLTheme): void {
  const { bbox, text, style, listItems } = element;

  if (listItems && listItems.length > 0) {
    // Render as bullet list
    slide.addText(
      listItems.map((item) => ({ text: item, options: { bullet: true } })),
      {
        x: ptToInch(bbox.x),
        y: ptToInch(bbox.y),
        w: ptToInch(bbox.w),
        h: ptToInch(bbox.h),
        fontSize: style.size,
        fontFace: detectFont(listItems.join(""), style.font, theme),
        color: cleanHex(style.color),
        bold: style.bold,
        italic: style.italic,
        align: style.align,
        valign: style.valign || "top",
      }
    );
  } else {
    // Regular text
    slide.addText(text, {
      x: ptToInch(bbox.x),
      y: ptToInch(bbox.y),
      w: ptToInch(bbox.w),
      h: ptToInch(bbox.h),
      fontSize: style.size,
      fontFace: detectFont(text, style.font, theme),
      color: cleanHex(style.color),
      bold: style.bold,
      italic: style.italic,
      align: style.align,
      valign: style.valign || "top",
      wrap: true,
    });
  }
}

function renderTable(slide: PptxGenJS.Slide, element: DSLTable): void {
  const { bbox, rows, style } = element;

  const tableData = rows.map((row) =>
    row.map((cell) => ({
      text: cell.text,
      options: {
        bold: cell.style?.bold,
        color: cell.style?.color ? cleanHex(cell.style.color) : undefined,
        align: cell.style?.align,
        fill: cell.style?.fillColor ? { color: cleanHex(cell.style.fillColor) } : undefined,
      },
    }))
  );

  slide.addTable(tableData, {
    x: ptToInch(bbox.x),
    y: ptToInch(bbox.y),
    w: ptToInch(bbox.w),
    fontSize: style.fontSize || 10,
    border: {
      type: "solid",
      color: style.grid ? cleanHex(style.grid) : "CCCCCC",
      pt: 0.5,
    },
  });
}

function renderIcon(slide: PptxGenJS.Slide, element: DSLIcon): void {
  const { bbox, style } = element;

  // Placeholder: render as ellipse (actual SVG in Phase 6)
  slide.addShape("ellipse", {
    x: ptToInch(bbox.x),
    y: ptToInch(bbox.y),
    w: ptToInch(bbox.w),
    h: ptToInch(bbox.h),
    fill: {
      type: "solid",
      color: cleanHex(style.color),
    },
  });
}

function renderImage(
  slide: PptxGenJS.Slide,
  element: DSLImage,
  assetMap?: Record<string, string>
): void {
  const { bbox, ref } = element;

  const imgData = assetMap?.[ref];
  if (imgData) {
    slide.addImage({
      data: imgData,
      x: ptToInch(bbox.x),
      y: ptToInch(bbox.y),
      w: ptToInch(bbox.w),
      h: ptToInch(bbox.h),
    });
  }
}

function renderDivider(slide: PptxGenJS.Slide, element: DSLDivider): void {
  const { bbox, style } = element;

  slide.addShape("line", {
    x: ptToInch(bbox.x),
    y: ptToInch(bbox.y),
    w: style.direction === "horizontal" ? ptToInch(bbox.w) : 0,
    h: style.direction === "vertical" ? ptToInch(bbox.h) : 0,
    line: {
      color: cleanHex(style.color),
      width: style.width,
    },
  });
}

// ============================================================
// Main Render Function
// ============================================================

function renderSlide(
  pptSlide: PptxGenJS.Slide,
  slide: SlideDSL,
  theme: DSLTheme,
  assetMap?: Record<string, string>
): void {
  for (const element of slide.elements) {
    switch (element.type) {
      case "background":
        renderBackground(pptSlide, element, slide.size);
        break;
      case "panel":
        renderPanel(pptSlide, element);
        break;
      case "text":
        renderText(pptSlide, element, theme);
        break;
      case "table":
        renderTable(pptSlide, element);
        break;
      case "icon":
        renderIcon(pptSlide, element);
        break;
      case "image":
        renderImage(pptSlide, element, assetMap);
        break;
      case "divider":
        renderDivider(pptSlide, element);
        break;
    }
  }
}

// ============================================================
// Public API
// ============================================================

/**
 * Generate PPTX file from PresentationDSL
 *
 * @param dsl - Complete presentation DSL
 * @param language - Language variant (for future use)
 * @param assetMap - Map of asset refs to base64 data URLs
 * @returns PPTX file as Blob
 */
export async function generatePptxFromDSL(
  dsl: PresentationDSL,
  language: "original" | "ko" | "ja" = "original",
  assetMap?: Record<string, string>
): Promise<Blob> {
  const pptx = new PptxGenJS();

  // Set custom slide size from first slide
  if (dsl.slides.length > 0) {
    const firstSlide = dsl.slides[0];
    const widthInch = ptToInch(firstSlide.size.widthPt);
    const heightInch = ptToInch(firstSlide.size.heightPt);

    pptx.defineLayout({ name: "CUSTOM", width: widthInch, height: heightInch });
    pptx.layout = "CUSTOM";
  }

  // Render each slide
  for (const slide of dsl.slides) {
    const pptSlide = pptx.addSlide();
    renderSlide(pptSlide, slide, dsl.globalTheme, assetMap);
  }

  // Generate blob
  const blob = await pptx.write({ outputType: "blob" }) as Blob;
  return blob;
}
