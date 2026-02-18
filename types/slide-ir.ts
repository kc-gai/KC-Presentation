/**
 * Slide Intermediate Representation (SlideIR)
 *
 * Gemini 분석 결과를 정규화한 중간 표현.
 * 좌표 통일, 텍스트 병합, 디자인 시스템 추정 완료 상태.
 * 이것이 Claude DSL 생성의 입력이 됨.
 */

/** 좌표 (pt 단위, 슬라이드 좌상단 기준) */
export interface IRBBox {
  x: number;      // pt from left
  y: number;      // pt from top
  w: number;      // pt width
  h: number;      // pt height
}

/** 디자인 시스템/테마 정보 */
export interface IRTheme {
  palette: {
    primary: string;     // 주요 강조색 (hex)
    accent: string;      // 보조 강조색
    danger: string;      // 경고색
    text: string;        // 기본 텍스트색
    mutedText: string;   // 보조 텍스트색
    background: string;  // 배경색
  };
  fonts: {
    title: string;       // 제목 폰트
    body: string;        // 본문 폰트
  };
  defaults: {
    titleSize: number;   // pt
    bodySize: number;    // pt
    lineHeight: number;  // 배수 (예: 1.4)
  };
}

/** 정규화된 텍스트 블록 */
export interface IRTextBlock {
  id: string;
  role: "title" | "subtitle" | "heading" | "body" | "caption" | "label" | "number" | "bullet" | "footnote";
  text: string;
  bbox: IRBBox;
  style: {
    font: "title" | "body";
    size: number;          // pt
    bold: boolean;
    italic: boolean;
    color: string;         // hex
    align: "left" | "center" | "right";
    lineHeight: number;
  };
  listItems?: string[];    // 불릿 리스트일 때 각 항목
  parentId?: string;       // 카드/패널 소속
}

/** 정규화된 표 */
export interface IRTable {
  id: string;
  bbox: IRBBox;
  rows: {
    cells: {
      text: string;
      rowSpan: number;
      colSpan: number;
      isHeader: boolean;
      style?: {
        bold?: boolean;
        color?: string;
        align?: "left" | "center" | "right";
        fillColor?: string;
      };
    }[];
  }[];
}

/** 정규화된 도형/패널 */
export interface IRShape {
  id: string;
  type: "rectangle" | "rounded-rectangle" | "circle" | "card" | "panel" | "divider" | "arrow";
  bbox: IRBBox;
  style: {
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    cornerRadius?: number;
    shadow?: boolean;
    opacity?: number;
  };
  containedElements?: string[];  // 이 도형 안에 있는 텍스트/아이콘 ID
}

/** 정규화된 아이콘 */
export interface IRIcon {
  id: string;
  bbox: IRBBox;
  description: string;
  suggestedName: string;   // Lucide 아이콘 이름
  color: string;
}

/** 정규화된 이미지 */
export interface IRFigure {
  id: string;
  bbox: IRBBox;
  description: string;
  type: "photo" | "chart" | "diagram" | "illustration" | "screenshot";
  imageBase64?: string;    // 크롭된 이미지 데이터
  mimeType?: string;
}

/** 배경 정보 */
export interface IRBackground {
  type: "solid" | "gradient" | "image";
  color?: string;
  gradient?: {
    from: string;          // hex
    to: string;            // hex
    angle: number;         // degrees (0=top→bottom, 90=left→right)
  };
  imageBase64?: string;    // 사진 배경일 때
}

/** 하나의 슬라이드 IR */
export interface SlideIR {
  pageIndex: number;
  size: {
    widthPt: number;
    heightPt: number;
  };
  theme: IRTheme;
  background: IRBackground;
  textBlocks: IRTextBlock[];
  tables: IRTable[];
  shapes: IRShape[];
  icons: IRIcon[];
  figures: IRFigure[];
  layoutPattern: string;   // "two-column" | "centered" | "sidebar" | "grid" | "full-width"
}

/** 전체 프레젠테이션 IR */
export interface PresentationIR {
  fileName: string;
  globalTheme: IRTheme;     // 전체 슬라이드에서 추정한 공통 테마
  slides: SlideIR[];
}
