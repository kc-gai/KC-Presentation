import type { PageAnalysis } from "@/types/docai";

export interface TextElement {
  id: string;
  text: string;
  textKo: string;
  textJa: string;
  x: number;       // % (0-100) from left
  y: number;       // % (0-100) from top
  width: number;   // % (0-100)
  height: number;  // % (0-100)
  fontSize: number;
  fontColor: string;
  fontWeight: "normal" | "bold";
  textAlign: "left" | "center" | "right";
  isEdited: boolean;
}

export interface ImageElement {
  id: string;
  imageUrl: string;      // blob URL for display
  imageBase64: string;   // base64 data for export
  mimeType: string;      // image/png, image/jpeg, etc.
  x: number;             // % (0-100) from left
  y: number;             // % (0-100) from top
  width: number;         // % (0-100)
  height: number;        // % (0-100)
  originalWidth: number; // px - original image dimensions
  originalHeight: number;
}

export interface Slide {
  id: string;
  pageIndex: number;
  backgroundImage: string;         // blob URL for display
  backgroundImageBase64?: string;  // PNG base64 for export fallback
  thumbnailImage: string;
  textElements: TextElement[];
  imageElements: ImageElement[];
  width: number;
  height: number;
  highResBackgroundBase64?: string;     // 4x scale base64 for high-quality export
  // New pipeline: analyzed background color
  backgroundColor?: {
    type: "solid" | "gradient" | "image";
    color?: string;           // hex (#RRGGBB) for solid
    gradientFrom?: string;    // hex start color
    gradientTo?: string;      // hex end color
    gradientAngle?: number;   // degrees
  };
  // Gemini DocAI analysis result (stored for DSL generation during export)
  pageAnalysis?: PageAnalysis;
}

export type OutputFormat = "pptx" | "docx";

export type InputFileType = "pdf" | "docx";

export interface Presentation {
  id: string;
  fileName: string;
  slides: Slide[];
  currentSlideIndex: number;
  activeLanguage: "original" | "ko" | "ja";
  outputFormat: OutputFormat;
  inputFileType: InputFileType;
}

export type ProcessingStatus =
  | { stage: "idle" }
  | { stage: "loading-pdf"; progress: number }
  | { stage: "loading-docx"; progress: number }
  | { stage: "rendering-pages"; current: number; total: number }
  | { stage: "extracting-images"; current: number; total: number }
  | { stage: "analyzing"; current: number; total: number }
  | { stage: "high-res-rendering"; current: number; total: number }
  | { stage: "generating-dsl"; current: number; total: number }
  | { stage: "qa-repair"; current: number; total: number }
  | { stage: "complete"; warnings?: string[] };

export type TranslationStatus =
  | { stage: "idle" }
  | { stage: "translating"; language: "ko" | "ja"; current: number; total: number }
  | { stage: "complete" };
