/**
 * Coordinate Normalization
 *
 * Gemini 분석 결과의 좌표(% 0-100)를 슬라이드 pt 좌표로 변환.
 */

import type { BoundingBox } from "@/types/docai";
import type { IRBBox } from "@/types/slide-ir";

/**
 * BoundingBox (% 기준) → IRBBox (pt 기준) 변환
 */
export function normalizeBox(
  bbox: BoundingBox,
  widthPt: number,
  heightPt: number
): IRBBox {
  return {
    x: (bbox.x / 100) * widthPt,
    y: (bbox.y / 100) * heightPt,
    w: (bbox.width / 100) * widthPt,
    h: (bbox.height / 100) * heightPt,
  };
}

/**
 * IRBBox (pt 기준) → BoundingBox (% 기준) 역변환
 */
export function denormalizeBox(
  bbox: IRBBox,
  widthPt: number,
  heightPt: number
): BoundingBox {
  return {
    x: (bbox.x / widthPt) * 100,
    y: (bbox.y / heightPt) * 100,
    width: (bbox.w / widthPt) * 100,
    height: (bbox.h / heightPt) * 100,
  };
}

/**
 * pt → inches (pptxgenjs용)
 */
export function ptToInch(pt: number): number {
  return pt / 72;
}

/**
 * inches → pt
 */
export function inchToPt(inch: number): number {
  return inch * 72;
}

/**
 * BoundingBox 유효성 검사 + 클램핑
 */
export function clampBox(bbox: BoundingBox): BoundingBox {
  return {
    x: Math.max(0, Math.min(100, bbox.x)),
    y: Math.max(0, Math.min(100, bbox.y)),
    width: Math.max(0, Math.min(100 - bbox.x, bbox.width)),
    height: Math.max(0, Math.min(100 - bbox.y, bbox.height)),
  };
}

/**
 * 두 IRBBox가 겹치는지 확인
 */
export function boxesOverlap(a: IRBBox, b: IRBBox): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

/**
 * IRBBox가 다른 IRBBox 안에 포함되는지 확인
 */
export function boxContains(outer: IRBBox, inner: IRBBox): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}
