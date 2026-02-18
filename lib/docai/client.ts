import type { PageAnalysis, DocAIResponse } from "@/types/docai";

/**
 * Analyze slide image with Gemini Vision API
 *
 * @param imageBase64 - Base64-encoded slide image (JPEG)
 * @param pageIndex - Page number (0-indexed)
 * @param widthPt - Slide width in points
 * @param heightPt - Slide height in points
 * @returns PageAnalysis containing text blocks, tables, shapes, icons, etc.
 */
export async function analyzeSlideWithGemini(
  imageBase64: string,
  pageIndex: number,
  widthPt: number,
  heightPt: number
): Promise<PageAnalysis> {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "/presentation";

  const response = await fetch(`${basePath}/api/docai`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ image: imageBase64, pageIndex, widthPt, heightPt }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error || `DocAI failed: ${response.status}`);
  }

  const data: DocAIResponse = await response.json();
  return data.analysis;
}
