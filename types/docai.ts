/**
 * Gemini Vision Document Analysis Types
 *
 * Gemini가 슬라이드 이미지를 분석한 결과의 타입 정의.
 * Document AI 대신 Gemini Vision을 사용하여 더 유연한 슬라이드 분석.
 */

/** 바운딩 박스 (% 기준, 0-100) */
export interface BoundingBox {
  x: number;      // % from left
  y: number;      // % from top
  width: number;  // % of slide width
  height: number; // % of slide height
}

/** 텍스트 블록 역할 */
export type TextRole =
  | "title"       // 슬라이드 제목
  | "subtitle"    // 부제목
  | "heading"     // 섹션 헤딩
  | "body"        // 본문 텍스트
  | "caption"     // 캡션, 주석
  | "label"       // 아이콘/이미지 라벨
  | "number"      // 숫자/통계
  | "bullet"      // 불릿 포인트 항목
  | "footnote";   // 각주

/** 텍스트 스타일 정보 */
export interface TextStyle {
  fontSize: number;          // pt 단위 추정
  fontWeight: "normal" | "bold";
  fontColor: string;         // hex (#RRGGBB)
  textAlign: "left" | "center" | "right";
  italic?: boolean;
}

/** 분석된 텍스트 블록 */
export interface AnalyzedTextBlock {
  id: string;
  role: TextRole;
  text: string;
  bbox: BoundingBox;
  style: TextStyle;
  confidence: number;        // 0-1
  listIndex?: number;        // 불릿 리스트일 때 순서
  parentId?: string;         // 카드/패널에 속할 때 부모 ID
}

/** 표 셀 */
export interface TableCell {
  text: string;
  rowSpan?: number;
  colSpan?: number;
  isHeader?: boolean;
  style?: Partial<TextStyle>;
}

/** 분석된 표 */
export interface AnalyzedTable {
  id: string;
  bbox: BoundingBox;
  rows: TableCell[][];
  confidence: number;
}

/** 도형/패널 타입 */
export type ShapeType =
  | "rectangle"
  | "rounded-rectangle"
  | "circle"
  | "card"         // 카드 UI 패턴
  | "panel"        // 색상 패널/블록
  | "divider"      // 구분선
  | "arrow";

/** 분석된 도형/패널 */
export interface AnalyzedShape {
  id: string;
  type: ShapeType;
  bbox: BoundingBox;
  style: {
    fillColor?: string;      // hex
    strokeColor?: string;    // hex
    strokeWidth?: number;    // pt
    cornerRadius?: number;   // px
    shadow?: boolean;
    opacity?: number;        // 0-1
  };
  confidence: number;
}

/** 분석된 아이콘 */
export interface AnalyzedIcon {
  id: string;
  bbox: BoundingBox;
  description: string;       // 아이콘 설명 (예: "warning triangle", "bar chart")
  suggestedName?: string;    // Lucide 아이콘 이름 제안
  color?: string;            // 아이콘 색상
  confidence: number;
}

/** 분석된 이미지/그림 영역 */
export interface AnalyzedFigure {
  id: string;
  bbox: BoundingBox;
  description: string;       // 이미지 설명
  type: "photo" | "chart" | "diagram" | "illustration" | "screenshot";
  confidence: number;
}

/** 배경 정보 */
export interface BackgroundInfo {
  type: "solid" | "gradient" | "image" | "pattern";
  primaryColor?: string;     // hex
  secondaryColor?: string;   // hex (그라데이션용)
  gradientDirection?: "horizontal" | "vertical" | "diagonal";
  gradientAngle?: number;    // degrees
}

/** 전체 페이지 분석 결과 */
export interface PageAnalysis {
  pageIndex: number;
  size: {
    widthPt: number;
    heightPt: number;
  };
  background: BackgroundInfo;
  textBlocks: AnalyzedTextBlock[];
  tables: AnalyzedTable[];
  shapes: AnalyzedShape[];
  icons: AnalyzedIcon[];
  figures: AnalyzedFigure[];
  designHints: {
    palette: string[];       // 주요 색상 목록 (hex)
    layoutPattern?: string;  // "two-column" | "centered" | "sidebar" | "grid" | "full-width"
    hasDarkBackground: boolean;
  };
}

/** Gemini API 분석 요청 */
export interface DocAIRequest {
  image: string;             // base64
  pageIndex: number;
  widthPt: number;
  heightPt: number;
}

/** Gemini API 분석 응답 */
export interface DocAIResponse {
  analysis: PageAnalysis;
  processingTimeMs: number;
}
