/**
 * Slide DSL (Domain-Specific Language)
 *
 * Claude가 생성하는 최종 출력 형식.
 * 이것을 그대로 PPTX/DOCX 생성기에 넘기면 파일이 만들어짐.
 *
 * 레이어 순서: elements 배열 순서 = 렌더링 순서 (앞→뒤)
 * background → panel/card → table → icon → image → text
 */

/** 바운딩 박스 (pt 단위) */
export interface DSLBBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 그라데이션 정의 */
export interface DSLGradient {
  from: [number, number];    // [x, y] 시작점 (0-1 비율)
  to: [number, number];      // [x, y] 끝점 (0-1 비율)
  stops: { pos: number; color: string }[];  // 0-1 위치, hex 색상
}

/** 배경 채우기 */
export interface DSLFill {
  kind: "solid" | "linearGradient";
  color?: string;            // solid일 때 hex
  gradient?: DSLGradient;    // linearGradient일 때
}

// ============================================================
// DSL 요소 타입들
// ============================================================

/** 배경 요소 */
export interface DSLBackground {
  type: "background";
  fill: DSLFill;
}

/** 패널/카드 도형 */
export interface DSLPanel {
  type: "panel";
  id: string;
  bbox: DSLBBox;
  style: {
    radius?: number;         // corner radius (pt)
    stroke?: string;         // hex
    strokeWidth?: number;    // pt
    fill?: string;           // hex
    shadow?: boolean;
    opacity?: number;        // 0-1
  };
}

/** 텍스트 요소 */
export interface DSLText {
  type: "text";
  id: string;
  bbox: DSLBBox;
  text: string;
  style: {
    font: "title" | "body";
    size: number;            // pt
    bold?: boolean;
    italic?: boolean;
    color: string;           // hex
    align: "left" | "center" | "right";
    valign?: "top" | "middle" | "bottom";
    lineHeight?: number;
  };
  listItems?: string[];      // 불릿 리스트일 때
}

/** 표 요소 */
export interface DSLTable {
  type: "table";
  id: string;
  bbox: DSLBBox;
  rows: {
    text: string;
    style?: {
      bold?: boolean;
      color?: string;
      align?: "left" | "center" | "right";
      fillColor?: string;
    };
  }[][];
  style: {
    grid?: string;           // 테두리 색상 hex
    headerFill?: string;     // 헤더 행 배경색
    cellPadding?: number;    // pt
    fontSize?: number;       // pt
  };
}

/** 아이콘 요소 */
export interface DSLIcon {
  type: "icon";
  id: string;
  bbox: DSLBBox;
  iconName: string;          // Lucide 아이콘 이름 (예: "alert-triangle", "bar-chart")
  style: {
    color: string;           // hex
    size?: number;           // pt
  };
}

/** 이미지 요소 */
export interface DSLImage {
  type: "image";
  id: string;
  bbox: DSLBBox;
  ref: string;               // asset 참조 (예: "asset://page-1-fig-0.png")
}

/** 구분선 */
export interface DSLDivider {
  type: "divider";
  id: string;
  bbox: DSLBBox;
  style: {
    color: string;
    width: number;           // pt (두께)
    direction: "horizontal" | "vertical";
  };
}

/** DSL 요소 유니온 */
export type DSLElement =
  | DSLBackground
  | DSLPanel
  | DSLText
  | DSLTable
  | DSLIcon
  | DSLImage
  | DSLDivider;

/** 불확실한 영역 메모 */
export interface DSLUncertainty {
  reason: string;
  bbox: DSLBBox;
  suggestion: string;
}

/** 테마 정의 */
export interface DSLTheme {
  palette: {
    primary: string;
    accent: string;
    danger: string;
    text: string;
    mutedText: string;
    bg: string;
  };
  fonts: {
    title: string;
    body: string;
  };
  defaults: {
    titleSize: number;
    bodySize: number;
    lineHeight: number;
  };
}

/** 한 페이지의 DSL */
export interface SlideDSL {
  pageIndex: number;
  size: {
    widthPt: number;
    heightPt: number;
  };
  theme: DSLTheme;
  elements: DSLElement[];
  notes?: {
    uncertain?: DSLUncertainty[];
  };
}

/** 전체 프레젠테이션 DSL */
export interface PresentationDSL {
  fileName: string;
  globalTheme: DSLTheme;
  slides: SlideDSL[];
}
