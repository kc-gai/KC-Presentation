/**
 * Claude DSL Generator
 *
 * SlideIR → Claude API → SlideDSL
 * Claude가 "슬라이드 컴파일러" 역할을 하여 IR을 PPT-ready DSL로 변환.
 */

import type { SlideIR } from "@/types/slide-ir";
import type { SlideDSL } from "@/types/slide-dsl";

interface DSLGenerationResult {
  dsl: SlideDSL;
  processingTimeMs: number;
}

/**
 * 단일 슬라이드의 DSL 생성 (API 호출)
 */
export async function generateSlideDSL(
  slideIR: SlideIR
): Promise<DSLGenerationResult> {
  const startTime = Date.now();

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "/presentation";
  const response = await fetch(`${basePath}/api/dsl`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ slideIR }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error || `DSL generation failed: ${response.status}`);
  }

  const data: { dsl: SlideDSL } = await response.json();

  return {
    dsl: data.dsl,
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * DSL 리페어 요청 (QA 실패 시)
 */
export async function repairSlideDSL(
  originalDSL: SlideDSL,
  issues: { type: string; elementIds: string[]; details: string }[]
): Promise<DSLGenerationResult> {
  const startTime = Date.now();

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "/presentation";
  const response = await fetch(`${basePath}/api/dsl`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ repair: true, originalDSL, issues }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error || `DSL repair failed: ${response.status}`);
  }

  const data: { dsl: SlideDSL } = await response.json();

  return {
    dsl: data.dsl,
    processingTimeMs: Date.now() - startTime,
  };
}
