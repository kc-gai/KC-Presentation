/**
 * QA Checks
 *
 * SlideDSL의 품질 문제를 자동 감지.
 * 감지된 문제는 repair.ts에서 Claude를 통해 자동 수정.
 */

import type { SlideDSL, DSLElement, DSLText, DSLPanel, DSLBBox } from "@/types/slide-dsl";

export interface QAIssue {
  type: "overflow" | "overlap" | "alignment" | "font-size" | "missing-text";
  elementIds: string[];
  details: string;
  severity: "error" | "warning";
}

/**
 * 텍스트 오버플로우 감지
 * 텍스트 크기 대비 bbox가 너무 작은 경우
 */
function checkTextOverflow(dsl: SlideDSL): QAIssue[] {
  const issues: QAIssue[] = [];

  for (const el of dsl.elements) {
    if (el.type !== "text") continue;

    const text = el as DSLText;
    const lineCount = text.text.split("\n").length + (text.listItems?.length || 0);
    const lineHeight = text.style.lineHeight || 1.4;
    const estimatedHeight = lineCount * text.style.size * lineHeight;

    if (estimatedHeight > text.bbox.h * 1.2) {
      issues.push({
        type: "overflow",
        elementIds: [text.id],
        details: `Text "${text.text.slice(0, 30)}..." (${lineCount} lines, ~${Math.round(estimatedHeight)}pt) overflows bbox height (${Math.round(text.bbox.h)}pt)`,
        severity: "error",
      });
    }
  }

  return issues;
}

/**
 * 요소 간 겹침 감지
 */
function checkOverlaps(dsl: SlideDSL): QAIssue[] {
  const issues: QAIssue[] = [];

  const boxElements = dsl.elements.filter(
    (el): el is DSLText | DSLPanel => el.type === "text" || el.type === "panel"
  );

  for (let i = 0; i < boxElements.length; i++) {
    for (let j = i + 1; j < boxElements.length; j++) {
      const a = boxElements[i];
      const b = boxElements[j];

      // 패널 안의 텍스트는 겹침 허용
      if (a.type === "panel" && b.type === "text") continue;
      if (b.type === "panel" && a.type === "text") continue;

      if (bboxOverlap(a.bbox, b.bbox) > 0.3) {
        issues.push({
          type: "overlap",
          elementIds: [a.id, b.id],
          details: `${a.type} "${a.id}" overlaps with ${b.type} "${b.id}" by ${Math.round(bboxOverlap(a.bbox, b.bbox) * 100)}%`,
          severity: "warning",
        });
      }
    }
  }

  return issues;
}

/**
 * 폰트 크기 이상치 감지
 */
function checkFontSizes(dsl: SlideDSL): QAIssue[] {
  const issues: QAIssue[] = [];

  for (const el of dsl.elements) {
    if (el.type !== "text") continue;

    const text = el as DSLText;

    if (text.style.size < 6) {
      issues.push({
        type: "font-size",
        elementIds: [text.id],
        details: `Font size ${text.style.size}pt is too small (min 6pt)`,
        severity: "warning",
      });
    }

    if (text.style.size > 72) {
      issues.push({
        type: "font-size",
        elementIds: [text.id],
        details: `Font size ${text.style.size}pt is unusually large (max recommended 72pt)`,
        severity: "warning",
      });
    }
  }

  return issues;
}

/**
 * 슬라이드 경계 밖 요소 감지
 */
function checkBounds(dsl: SlideDSL): QAIssue[] {
  const issues: QAIssue[] = [];
  const { widthPt, heightPt } = dsl.size;

  for (const el of dsl.elements) {
    if (el.type === "background") continue;
    if (!("bbox" in el)) continue;

    const bbox = (el as { bbox: DSLBBox }).bbox;
    const id = (el as { id: string }).id;

    if (bbox.x + bbox.w > widthPt * 1.05 || bbox.y + bbox.h > heightPt * 1.05) {
      issues.push({
        type: "overflow",
        elementIds: [id],
        details: `Element extends beyond slide bounds (${Math.round(bbox.x + bbox.w)}pt x ${Math.round(bbox.y + bbox.h)}pt vs slide ${widthPt}x${heightPt})`,
        severity: "error",
      });
    }
  }

  return issues;
}

/**
 * 두 bbox의 겹침 비율 (0-1)
 */
function bboxOverlap(a: DSLBBox, b: DSLBBox): number {
  const overlapX = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const overlapY = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

  if (overlapX === 0 || overlapY === 0) return 0;

  const overlapArea = overlapX * overlapY;
  const minArea = Math.min(a.w * a.h, b.w * b.h);

  return minArea > 0 ? overlapArea / minArea : 0;
}

/**
 * 전체 QA 실행
 */
export function runQAChecks(dsl: SlideDSL): QAIssue[] {
  return [
    ...checkTextOverflow(dsl),
    ...checkOverlaps(dsl),
    ...checkFontSizes(dsl),
    ...checkBounds(dsl),
  ];
}

/**
 * 에러 수준 이슈만 필터
 */
export function hasErrors(issues: QAIssue[]): boolean {
  return issues.some((i) => i.severity === "error");
}
