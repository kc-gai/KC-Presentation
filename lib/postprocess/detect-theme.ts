/**
 * Design System / Theme Detection
 *
 * Gemini 분석 결과에서 디자인 시스템(테마)을 추정.
 * 색상 팔레트, 폰트 크기 통계, 레이아웃 패턴 등.
 */

import type { PageAnalysis } from "@/types/docai";
import type { IRTheme } from "@/types/slide-ir";

/** 색상 빈도 카운트 */
function countColorFrequency(colors: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const color of colors) {
    const normalized = color.toLowerCase();
    freq.set(normalized, (freq.get(normalized) || 0) + 1);
  }
  return freq;
}

/** 색상 밝기 계산 (0=검정, 1=흰색) */
function colorBrightness(hex: string): number {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** 가장 빈도 높은 색상 N개 추출 */
function topColors(freq: Map<string, number>, n: number): string[] {
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([color]) => color);
}

/**
 * 여러 페이지의 분석 결과에서 글로벌 테마 추정
 */
export function detectGlobalTheme(analyses: PageAnalysis[]): IRTheme {
  // 모든 색상 수집
  const allTextColors: string[] = [];
  const allFillColors: string[] = [];
  const allBgColors: string[] = [];
  const allFontSizes: number[] = [];
  const titleFontSizes: number[] = [];
  const bodyFontSizes: number[] = [];

  for (const analysis of analyses) {
    // 배경 색상
    if (analysis.background.primaryColor) {
      allBgColors.push(analysis.background.primaryColor);
    }

    // 텍스트 색상 & 폰트 크기
    for (const block of analysis.textBlocks) {
      allTextColors.push(block.style.fontColor);
      allFontSizes.push(block.style.fontSize);

      if (block.role === "title" || block.role === "subtitle") {
        titleFontSizes.push(block.style.fontSize);
      } else if (block.role === "body" || block.role === "bullet") {
        bodyFontSizes.push(block.style.fontSize);
      }
    }

    // 도형 색상
    for (const shape of analysis.shapes) {
      if (shape.style.fillColor) allFillColors.push(shape.style.fillColor);
    }

    // 팔레트 힌트
    for (const color of analysis.designHints.palette) {
      allFillColors.push(color);
    }
  }

  // 팔레트 추정
  const fillFreq = countColorFrequency(allFillColors);
  const textFreq = countColorFrequency(allTextColors);
  const bgFreq = countColorFrequency(allBgColors);

  const topFills = topColors(fillFreq, 5);
  const topTexts = topColors(textFreq, 3);
  const topBgs = topColors(bgFreq, 2);

  // Primary: 가장 많이 쓰인 도형 채우기 색상 (흰색/검정/회색 제외)
  const primaryColor = topFills.find(c => {
    const b = colorBrightness(c);
    return b > 0.1 && b < 0.9; // 너무 밝거나 어두운 건 제외
  }) || "#2563EB"; // 기본 파란색

  // Accent: primary 다음으로 많이 쓰인 색상
  const accentColor = topFills.find(c => c !== primaryColor && colorBrightness(c) > 0.1 && colorBrightness(c) < 0.9)
    || "#10B981";

  // Danger: 빨간 계열 색상 찾기
  const dangerColor = topFills.find(c => {
    const clean = c.replace("#", "");
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    return r > 180 && g < 100;
  }) || "#EF4444";

  // Text color: 가장 많이 쓰인 텍스트 색상
  const textColor = topTexts[0] || "#1F2937";

  // Muted text
  const mutedTextColor = topTexts.find(c => {
    const b = colorBrightness(c);
    return b > 0.3 && b < 0.7;
  }) || "#6B7280";

  // Background
  const bgColor = topBgs[0] || "#FFFFFF";

  // 폰트 크기 통계
  const avgTitleSize = titleFontSizes.length > 0
    ? Math.round(titleFontSizes.reduce((a, b) => a + b, 0) / titleFontSizes.length)
    : 28;

  const avgBodySize = bodyFontSizes.length > 0
    ? Math.round(bodyFontSizes.reduce((a, b) => a + b, 0) / bodyFontSizes.length)
    : 14;

  // 폰트 감지 (텍스트 내용 기반)
  let titleFont = "Calibri";
  let bodyFont = "Calibri";

  for (const analysis of analyses) {
    for (const block of analysis.textBlocks) {
      if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(block.text)) {
        titleFont = "Noto Sans JP";
        bodyFont = "Noto Sans JP";
        break;
      }
      if (/[\uAC00-\uD7AF]/.test(block.text)) {
        titleFont = "Malgun Gothic";
        bodyFont = "Malgun Gothic";
        break;
      }
    }
  }

  return {
    palette: {
      primary: primaryColor,
      accent: accentColor,
      danger: dangerColor,
      text: textColor,
      mutedText: mutedTextColor,
      background: bgColor,
    },
    fonts: {
      title: titleFont,
      body: bodyFont,
    },
    defaults: {
      titleSize: avgTitleSize,
      bodySize: avgBodySize,
      lineHeight: 1.4,
    },
  };
}

/**
 * 단일 페이지에서 레이아웃 패턴 추정
 */
export function detectLayoutPattern(
  analysis: PageAnalysis
): string {
  // Gemini가 이미 감지한 패턴이 있으면 사용
  if (analysis.designHints.layoutPattern) {
    return analysis.designHints.layoutPattern;
  }

  const textBlocks = analysis.textBlocks;
  if (textBlocks.length === 0) return "full-width";

  // 중앙 정렬 감지
  const centerAligned = textBlocks.filter(b => b.style.textAlign === "center");
  if (centerAligned.length > textBlocks.length * 0.6) return "centered";

  // 2컬럼 감지
  const midX = 50;
  let leftCount = 0;
  let rightCount = 0;
  for (const block of textBlocks) {
    const centerX = block.bbox.x + block.bbox.width / 2;
    if (centerX < midX * 0.8) leftCount++;
    else if (centerX > midX * 1.2) rightCount++;
  }
  if (leftCount >= 2 && rightCount >= 2) return "two-column";

  // 사이드바 감지 (패널이 한쪽에 있으면)
  const panels = analysis.shapes.filter(s => s.type === "panel" || s.type === "card");
  if (panels.length > 0) {
    const panelLeft = panels.some(p => p.bbox.x < 30 && p.bbox.width < 40);
    const panelRight = panels.some(p => p.bbox.x > 50 && p.bbox.width < 40);
    if (panelLeft || panelRight) return "sidebar";
  }

  // 그리드 감지 (카드가 여러 개 정렬)
  const cards = analysis.shapes.filter(s => s.type === "card" || s.type === "rounded-rectangle");
  if (cards.length >= 3) return "grid";

  return "full-width";
}
