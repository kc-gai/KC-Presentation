/**
 * PageAnalysis → SlideIR 변환
 *
 * Gemini 분석 결과를 정규화된 중간 표현(SlideIR)으로 변환.
 * 이것이 Claude DSL 생성의 입력이 됨.
 */

import type { PageAnalysis } from "@/types/docai";
import type {
  SlideIR,
  PresentationIR,
  IRBackground,
  IRTextBlock,
  IRTable,
  IRShape,
  IRIcon,
  IRFigure,
  IRTheme,
} from "@/types/slide-ir";
import { normalizeBox } from "./normalize";
import { mergeTextBlocks, sortByReadingOrder } from "./merge-text";
import { detectGlobalTheme, detectLayoutPattern } from "./detect-theme";

/**
 * 배경 정보 변환
 */
function convertBackground(analysis: PageAnalysis): IRBackground {
  const bg = analysis.background;

  if (bg.type === "gradient" && bg.primaryColor && bg.secondaryColor) {
    let angle = 180; // default: top → bottom
    if (bg.gradientDirection === "horizontal") angle = 90;
    else if (bg.gradientDirection === "diagonal") angle = 135;
    if (bg.gradientAngle !== undefined) angle = bg.gradientAngle;

    return {
      type: "gradient",
      gradient: {
        from: bg.primaryColor,
        to: bg.secondaryColor,
        angle,
      },
    };
  }

  if (bg.type === "image") {
    return { type: "image" };
  }

  return {
    type: "solid",
    color: bg.primaryColor || "#FFFFFF",
  };
}

/**
 * 표 변환
 */
function convertTables(
  analysis: PageAnalysis,
  widthPt: number,
  heightPt: number
): IRTable[] {
  return analysis.tables.map((table) => ({
    id: table.id,
    bbox: normalizeBox(table.bbox, widthPt, heightPt),
    rows: table.rows.map((row) => ({
      cells: row.map((cell) => ({
        text: cell.text,
        rowSpan: cell.rowSpan || 1,
        colSpan: cell.colSpan || 1,
        isHeader: cell.isHeader || false,
        style: cell.style ? {
          bold: cell.style.fontWeight === "bold",
          color: cell.style.fontColor,
          align: cell.style.textAlign,
        } : undefined,
      })),
    })),
  }));
}

/**
 * 도형 변환
 */
function convertShapes(
  analysis: PageAnalysis,
  widthPt: number,
  heightPt: number
): IRShape[] {
  return analysis.shapes.map((shape) => {
    const irShape: IRShape = {
      id: shape.id,
      type: shape.type,
      bbox: normalizeBox(shape.bbox, widthPt, heightPt),
      style: {
        fillColor: shape.style.fillColor,
        strokeColor: shape.style.strokeColor,
        strokeWidth: shape.style.strokeWidth,
        cornerRadius: shape.style.cornerRadius,
        shadow: shape.style.shadow,
        opacity: shape.style.opacity,
      },
    };

    // 이 도형 안에 포함된 텍스트 블록 찾기
    const containedTexts = analysis.textBlocks
      .filter((t) => t.parentId === shape.id)
      .map((t) => t.id);

    if (containedTexts.length > 0) {
      irShape.containedElements = containedTexts;
    }

    return irShape;
  });
}

/**
 * 아이콘 변환
 */
function convertIcons(
  analysis: PageAnalysis,
  widthPt: number,
  heightPt: number
): IRIcon[] {
  return analysis.icons.map((icon) => ({
    id: icon.id,
    bbox: normalizeBox(icon.bbox, widthPt, heightPt),
    description: icon.description,
    suggestedName: icon.suggestedName || "circle",
    color: icon.color || "#333333",
  }));
}

/**
 * 이미지/그림 변환
 */
function convertFigures(
  analysis: PageAnalysis,
  widthPt: number,
  heightPt: number
): IRFigure[] {
  return analysis.figures.map((fig) => ({
    id: fig.id,
    bbox: normalizeBox(fig.bbox, widthPt, heightPt),
    description: fig.description,
    type: fig.type,
  }));
}

/**
 * 단일 페이지 분석 → SlideIR 변환
 */
export function pageAnalysisToSlideIR(
  analysis: PageAnalysis,
  theme: IRTheme
): SlideIR {
  const { widthPt, heightPt } = analysis.size;

  // 텍스트 블록 병합 + 정렬
  const mergedText = mergeTextBlocks(analysis.textBlocks, widthPt, heightPt);
  const sortedText = sortByReadingOrder(mergedText);

  return {
    pageIndex: analysis.pageIndex,
    size: { widthPt, heightPt },
    theme,
    background: convertBackground(analysis),
    textBlocks: sortedText,
    tables: convertTables(analysis, widthPt, heightPt),
    shapes: convertShapes(analysis, widthPt, heightPt),
    icons: convertIcons(analysis, widthPt, heightPt),
    figures: convertFigures(analysis, widthPt, heightPt),
    layoutPattern: detectLayoutPattern(analysis),
  };
}

/**
 * 전체 프레젠테이션 분석 → PresentationIR 변환
 */
export function analysesToPresentationIR(
  fileName: string,
  analyses: PageAnalysis[]
): PresentationIR {
  // 글로벌 테마 추정
  const globalTheme = detectGlobalTheme(analyses);

  // 각 페이지를 SlideIR로 변환
  const slides = analyses.map((analysis) =>
    pageAnalysisToSlideIR(analysis, globalTheme)
  );

  return {
    fileName,
    globalTheme,
    slides,
  };
}
