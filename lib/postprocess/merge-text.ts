/**
 * Text Block Merging
 *
 * Gemini가 반환한 텍스트 블록들을 문단 단위로 병합.
 * 같은 역할(role)이고 가까이 있는 블록은 하나로 합침.
 */

import type { AnalyzedTextBlock } from "@/types/docai";
import type { IRTextBlock, IRBBox } from "@/types/slide-ir";
import { normalizeBox } from "./normalize";

/** 두 bbox의 수직 거리 (겹치면 0) */
function verticalGap(a: IRBBox, b: IRBBox): number {
  const aBottom = a.y + a.h;
  const bTop = b.y;
  const bBottom = b.y + b.h;
  const aTop = a.y;

  if (aBottom <= bTop) return bTop - aBottom;
  if (bBottom <= aTop) return aTop - bBottom;
  return 0; // overlapping
}

/** 두 bbox의 수평 정렬 정도 (0-1, 1=완전 정렬) */
function horizontalAlignment(a: IRBBox, b: IRBBox): number {
  const aLeft = a.x;
  const aRight = a.x + a.w;
  const bLeft = b.x;
  const bRight = b.x + b.w;

  const overlapStart = Math.max(aLeft, bLeft);
  const overlapEnd = Math.min(aRight, bRight);

  if (overlapEnd <= overlapStart) return 0;

  const overlap = overlapEnd - overlapStart;
  const minWidth = Math.min(a.w, b.w);

  return minWidth > 0 ? overlap / minWidth : 0;
}

/** bbox 2개를 합쳐서 둘을 포함하는 최소 bbox 생성 */
function mergeBBox(a: IRBBox, b: IRBBox): IRBBox {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.w, b.x + b.w);
  const bottom = Math.max(a.y + a.h, b.y + b.h);
  return { x, y, w: right - x, h: bottom - y };
}

/**
 * 텍스트 블록 병합
 *
 * 규칙:
 * 1. 같은 role인 블록끼리만 병합
 * 2. 수직 거리가 폰트 크기의 1.5배 이내
 * 3. 수평 정렬이 50% 이상
 * 4. title/subtitle는 병합하지 않음 (보통 1개씩)
 */
export function mergeTextBlocks(
  blocks: AnalyzedTextBlock[],
  widthPt: number,
  heightPt: number
): IRTextBlock[] {
  if (blocks.length === 0) return [];

  // 1. AnalyzedTextBlock → IRTextBlock 변환
  const irBlocks: IRTextBlock[] = blocks.map((b) => ({
    id: b.id,
    role: b.role,
    text: b.text,
    bbox: normalizeBox(b.bbox, widthPt, heightPt),
    style: {
      font: (b.role === "title" || b.role === "subtitle" || b.role === "heading") ? "title" as const : "body" as const,
      size: b.style.fontSize,
      bold: b.style.fontWeight === "bold",
      italic: b.style.italic || false,
      color: b.style.fontColor,
      align: b.style.textAlign,
      lineHeight: 1.4,
    },
    parentId: b.parentId,
    listItems: b.role === "bullet" ? b.text.split("\n").filter(l => l.trim()) : undefined,
  }));

  // 2. Y좌표 기준 정렬
  irBlocks.sort((a, b) => a.bbox.y - b.bbox.y);

  // 3. 병합 (title/subtitle 제외)
  const noMergeRoles = new Set(["title", "subtitle", "number"]);
  const merged: IRTextBlock[] = [];
  const used = new Set<number>();

  for (let i = 0; i < irBlocks.length; i++) {
    if (used.has(i)) continue;

    const current = { ...irBlocks[i], bbox: { ...irBlocks[i].bbox } };

    if (noMergeRoles.has(current.role)) {
      merged.push(current);
      continue;
    }

    // 같은 role, 가까운 블록 찾아서 병합
    for (let j = i + 1; j < irBlocks.length; j++) {
      if (used.has(j)) continue;

      const candidate = irBlocks[j];
      if (candidate.role !== current.role) continue;
      if (candidate.parentId !== current.parentId) continue;

      const gap = verticalGap(current.bbox, candidate.bbox);
      const maxGap = current.style.size * 1.5; // 폰트 크기의 1.5배
      const hAlign = horizontalAlignment(current.bbox, candidate.bbox);

      if (gap <= maxGap && hAlign >= 0.5) {
        // 병합
        current.text += "\n" + candidate.text;
        current.bbox = mergeBBox(current.bbox, candidate.bbox);
        if (candidate.listItems) {
          current.listItems = [
            ...(current.listItems || []),
            ...candidate.listItems,
          ];
        }
        used.add(j);
      }
    }

    merged.push(current);
  }

  return merged;
}

/**
 * 읽기 순서 정렬 (위→아래, 같은 높이면 좌→우)
 */
export function sortByReadingOrder(blocks: IRTextBlock[]): IRTextBlock[] {
  return [...blocks].sort((a, b) => {
    const yDiff = a.bbox.y - b.bbox.y;
    // 같은 "행"으로 판단 (y 차이가 작으면)
    if (Math.abs(yDiff) < Math.min(a.bbox.h, b.bbox.h) * 0.3) {
      return a.bbox.x - b.bbox.x; // 좌→우
    }
    return yDiff; // 위→아래
  });
}

/**
 * 2컬럼 레이아웃 감지
 * X 좌표가 두 클러스터로 분리되면 2컬럼
 */
export function detectColumnLayout(
  blocks: IRTextBlock[],
  slideWidthPt: number
): "single" | "two-column" {
  if (blocks.length < 4) return "single";

  const midX = slideWidthPt / 2;
  let leftCount = 0;
  let rightCount = 0;

  for (const block of blocks) {
    const centerX = block.bbox.x + block.bbox.w / 2;
    if (centerX < midX * 0.8) leftCount++;
    else if (centerX > midX * 1.2) rightCount++;
  }

  // 양쪽에 각각 2개 이상 있으면 2컬럼
  if (leftCount >= 2 && rightCount >= 2) return "two-column";
  return "single";
}
