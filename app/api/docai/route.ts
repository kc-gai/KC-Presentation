import { NextRequest, NextResponse } from "next/server";
import type { DocAIRequest, DocAIResponse, PageAnalysis } from "@/types/docai";

// ============================================================
// Gemini Prompt for Slide Structure Analysis
// ============================================================
const DOCAI_PROMPT = `You are a slide layout analyzer. Analyze this presentation slide image and return a structured JSON.

For each element, provide bounding box as percentage (0-100) of image dimensions.

Analyze and return:

1. **background**: { type: "solid"|"gradient"|"image", primaryColor, secondaryColor, gradientDirection }

2. **textBlocks**: Array of text elements found. For each:
   - id: unique identifier (e.g., "text-0", "text-1")
   - role: "title"|"subtitle"|"heading"|"body"|"caption"|"label"|"number"|"bullet"|"footnote"
   - text: the actual text content (preserve line breaks as \\n)
   - bbox: { x, y, width, height } in % (0-100)
   - style: { fontSize (pt estimate), fontWeight: "normal"|"bold", fontColor: "#RRGGBB", textAlign: "left"|"center"|"right" }
   - confidence: 0-1

3. **tables**: Array of tables. For each:
   - id, bbox, confidence
   - rows: 2D array of { text, isHeader, rowSpan, colSpan }

4. **shapes**: Array of decorative shapes/panels/cards. For each:
   - id, type: "rectangle"|"rounded-rectangle"|"card"|"panel"|"divider"
   - bbox, style: { fillColor, strokeColor, cornerRadius, shadow }

5. **icons**: Array of icons/symbols. For each:
   - id, bbox, description (what the icon represents), suggestedName (Lucide icon name), color

6. **figures**: Array of images/charts/diagrams. For each:
   - id, bbox, description, type: "photo"|"chart"|"diagram"|"illustration"

7. **designHints**: { palette: [hex colors], layoutPattern: "two-column"|"centered"|"sidebar"|"grid"|"full-width", hasDarkBackground: bool }

IMPORTANT:
- Coordinates are percentages (0-100) of image width/height
- Colors are hex format (#RRGGBB)
- Preserve exact text content including punctuation and special characters
- For multi-line text blocks, use \\n for line breaks
- Group related text (e.g., a title and its subtitle) separately, don't merge them
- Tables must preserve row/column structure accurately

Return ONLY valid JSON matching the schema. No markdown, no explanation.`;

// ============================================================
// Engine 1: Vertex AI Gemini (Google Cloud, high limits)
// ============================================================
function getVertexAuthOptions() {
  // 1) Service account JSON from env var (for Vercel deployment)
  const credJson = process.env.GOOGLE_CREDENTIALS_JSON;
  if (credJson) {
    try {
      const credentials = JSON.parse(credJson);
      return { credentials };
    } catch {
      console.warn("[DocAI] Failed to parse GOOGLE_CREDENTIALS_JSON");
    }
  }
  // 2) Fall back to ADC (local gcloud auth)
  return undefined;
}

async function tryVertexAi(
  imageBase64: string,
  pageIndex: number,
  widthPt: number,
  heightPt: number
): Promise<PageAnalysis | null> {
  const projectId = process.env.VERTEX_PROJECT_ID || "gemini-vertex-470601";
  const location = process.env.VERTEX_LOCATION || "us-central1";

  const authOptions = getVertexAuthOptions();

  try {
    const { VertexAI } = await import("@google-cloud/vertexai");

    const vertexAI = new VertexAI({
      project: projectId,
      location,
      googleAuthOptions: authOptions,
    });
    const model = vertexAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: imageBase64,
              },
            },
            { text: DOCAI_PROMPT },
          ],
        },
      ],
    });

    const responseText = result.response?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) return null;

    return parseGeminiResponse(responseText, pageIndex, widthPt, heightPt);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (
      msg.includes("Could not load the default credentials") ||
      msg.includes("GOOGLE_APPLICATION_CREDENTIALS") ||
      msg.includes("not found") ||
      msg.includes("Unable to detect")
    ) {
      console.log("[DocAI] Vertex AI not available (no credentials), skipping");
    } else {
      console.warn("[DocAI] Vertex AI failed:", msg);
    }
    return null;
  }
}

// ============================================================
// Engine 2: Gemini Free API (rate-limited fallback)
// ============================================================
async function tryGeminiFree(
  imageBase64: string,
  pageIndex: number,
  widthPt: number,
  heightPt: number
): Promise<PageAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
  }

  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: "image/jpeg",
        data: imageBase64,
      },
    },
    { text: DOCAI_PROMPT },
  ]);

  const responseText = result.response.text();
  const analysis = parseGeminiResponse(responseText, pageIndex, widthPt, heightPt);

  if (!analysis) {
    throw new Error("Gemini 응답 파싱 실패");
  }

  return analysis;
}

// ============================================================
// Shared: Parse Gemini/Vertex AI JSON response
// ============================================================
function extractJsonFromText(text: string): string | null {
  // Try to extract JSON from markdown code block
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) return codeBlockMatch[1];

  // Try to find JSON object
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) return objectMatch[0];

  return null;
}

function parseGeminiResponse(
  responseText: string,
  pageIndex: number,
  widthPt: number,
  heightPt: number
): PageAnalysis | null {
  let jsonStr = responseText.trim();

  // Strip markdown code block wrapper
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  // Attempt 1: Direct JSON parse
  let parsed = tryParseJson(jsonStr);

  // Attempt 2: Extract JSON from surrounding text
  if (!parsed) {
    const extracted = extractJsonFromText(responseText);
    if (extracted) {
      parsed = tryParseJson(extracted);
    }
  }

  if (!parsed) {
    console.error("[DocAI] Failed to parse response:", responseText.slice(0, 300));
    return null;
  }

  // Build PageAnalysis with defaults
  return buildPageAnalysis(parsed, pageIndex, widthPt, heightPt);
}

function tryParseJson(jsonStr: string): any | null {
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

function buildPageAnalysis(
  parsed: any,
  pageIndex: number,
  widthPt: number,
  heightPt: number
): PageAnalysis {
  return {
    pageIndex,
    size: { widthPt, heightPt },
    background: parsed.background || {
      type: "solid",
      primaryColor: "#FFFFFF",
    },
    textBlocks: Array.isArray(parsed.textBlocks) ? parsed.textBlocks : [],
    tables: Array.isArray(parsed.tables) ? parsed.tables : [],
    shapes: Array.isArray(parsed.shapes) ? parsed.shapes : [],
    icons: Array.isArray(parsed.icons) ? parsed.icons : [],
    figures: Array.isArray(parsed.figures) ? parsed.figures : [],
    designHints: {
      palette: Array.isArray(parsed.designHints?.palette)
        ? parsed.designHints.palette
        : [],
      layoutPattern: parsed.designHints?.layoutPattern,
      hasDarkBackground: parsed.designHints?.hasDarkBackground ?? false,
    },
  };
}

// ============================================================
// Main route handler
// ============================================================
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: DocAIRequest = await request.json();
    const { image, pageIndex, widthPt, heightPt } = body;

    if (!image || typeof pageIndex !== "number") {
      return NextResponse.json(
        { error: "Invalid request: image and pageIndex required" },
        { status: 400 }
      );
    }

    // 1) Vertex AI Gemini (Google Cloud, high limits)
    const vertexResult = await tryVertexAi(image, pageIndex, widthPt, heightPt);
    if (vertexResult) {
      const processingTimeMs = Date.now() - startTime;
      console.log(`[DocAI] Vertex AI: page ${pageIndex}, ${processingTimeMs}ms`);

      const response: DocAIResponse = {
        analysis: vertexResult,
        processingTimeMs,
      };

      return NextResponse.json(response, {
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    // 2) Gemini Free API (rate-limited fallback)
    const geminiResult = await tryGeminiFree(image, pageIndex, widthPt, heightPt);
    const processingTimeMs = Date.now() - startTime;
    console.log(`[DocAI] Gemini Free: page ${pageIndex}, ${processingTimeMs}ms`);

    const response: DocAIResponse = {
      analysis: geminiResult,
      processingTimeMs,
    };

    return NextResponse.json(response, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (error) {
    console.error("[DocAI] Error:", error);

    let errorMessage = "DocAI 처리 실패";
    if (error instanceof Error) {
      if (error.message.includes("API_KEY") || error.message.includes("API key")) {
        errorMessage = "Gemini API 키가 유효하지 않습니다.";
      } else if (
        error.message.includes("quota") ||
        error.message.includes("rate") ||
        error.message.includes("429")
      ) {
        errorMessage = "API 호출 한도 초과. 잠시 후 다시 시도해주세요.";
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
