import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const OCR_PROMPT = `You are a precision layout extractor for presentation slides. Decompose the slide into SEPARATE text and visual elements so it can be perfectly reconstructed.

## CRITICAL SEPARATION RULES
1. STANDALONE TEXT (titles, subtitles, body paragraphs, captions, standalone labels) → textElements
2. VISUAL ELEMENTS (diagrams, charts, tables, logos, photos, shapes, arrows, colored boxes/banners) → imageRegions
3. Text that is INSIDE or PART OF a visual element (chart labels, table cell text, diagram annotations, text on colored backgrounds/shapes) → belongs to the imageRegion, NOT textElements
4. textElements and imageRegions must NEVER overlap. No text element should be inside any image region's bounding box.

## Text Elements (standalone text ONLY)
For each standalone text block return:
- "text": exact text (preserve \\n for line breaks, bullet chars •/-, numbering)
- "x": left edge as % of slide width (0-100), precise to 0.5
- "y": top edge as % of slide height (0-100), precise to 0.5
- "width": as % of slide width
- "height": as % of slide height
- "fontSize": as % of slide height (large title: 6-10, subtitle: 4-6, body: 2.5-4, caption: 1.5-2.5)
- "fontWeight": "bold" or "normal" (detect from visual character thickness)
- "fontColor": hex color (e.g. "#000000", "#333333", "#3366CC", "#FFFFFF")

Rules:
- Group related text into ONE block (heading, paragraph, bullet list)
- Bounding box must TIGHTLY fit the actual text area
- Accurately recognize English, Japanese (漢字ひらがなカタカナ), Korean (한글)
- Detect bold from visual weight of characters

## Image Regions (all visual elements)
For each visual element return:
- "x", "y", "width", "height": tight bounding box as % (0-100)

Include as image regions:
- Tables (entire table including headers, rows, and cell text)
- Charts/graphs with their legends and labels
- Diagrams with their annotations
- Logos, photos, illustrations
- Colored shapes, banners, decorative boxes (even with text on them)
- Arrows, connectors (if visually significant)

## Output Format
Return ONLY valid JSON (no markdown, no code blocks):
{"textElements":[{"text":"Title","x":3,"y":2,"width":94,"height":7,"fontSize":7.5,"fontWeight":"bold","fontColor":"#000000"}],"imageRegions":[{"x":3,"y":15,"width":45,"height":65}]}

IMPORTANT: Zero overlap between text and image regions. Every visible element must be captured.`;

type OcrTextElement = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontWeight?: "bold" | "normal";
  fontColor?: string;
};

type OcrImageRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

interface OcrResult {
  textElements: OcrTextElement[];
  imageRegions: OcrImageRegion[];
}

// ============================================================
// Engine 1: PaddleOCR (local, free, unlimited)
// ============================================================
async function tryPaddleOcr(imageBase64: string): Promise<OcrResult | null> {
  const PADDLE_URL = process.env.PADDLE_OCR_URL || "http://localhost:8765";

  try {
    const healthCheck = await fetch(`${PADDLE_URL}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!healthCheck.ok) return null;
  } catch {
    // PaddleOCR server not running
    return null;
  }

  const response = await fetch(`${PADDLE_URL}/ocr`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: imageBase64 }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    console.warn("[OCR] PaddleOCR failed:", response.statusText);
    return null;
  }

  const data = await response.json();
  return { textElements: data.textElements || [], imageRegions: [] };
}

// ============================================================
// Engine 2: Vertex AI Gemini (Google Cloud, high limits)
// Supports: ADC (local gcloud) or service account JSON (Vercel)
// ============================================================
function getVertexAuthOptions() {
  // 1) Service account JSON from env var (for Vercel deployment)
  const credJson = process.env.GOOGLE_CREDENTIALS_JSON;
  if (credJson) {
    try {
      const credentials = JSON.parse(credJson);
      return { credentials };
    } catch {
      console.warn("[OCR] Failed to parse GOOGLE_CREDENTIALS_JSON");
    }
  }
  // 2) Fall back to ADC (local gcloud auth)
  return undefined;
}

async function tryVertexAi(imageBase64: string): Promise<OcrResult | null> {
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
            { text: OCR_PROMPT },
          ],
        },
      ],
    });

    const responseText = result.response?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) return null;

    return parseGeminiResponse(responseText);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("Could not load the default credentials") ||
        msg.includes("GOOGLE_APPLICATION_CREDENTIALS") ||
        msg.includes("not found") ||
        msg.includes("Unable to detect")) {
      console.log("[OCR] Vertex AI not available (no credentials), skipping");
    } else {
      console.warn("[OCR] Vertex AI failed:", msg);
    }
    return null;
  }
}

// ============================================================
// Engine 3: Gemini Free API (rate-limited fallback)
// ============================================================
async function tryGeminiFree(imageBase64: string): Promise<OcrResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: "image/jpeg",
        data: imageBase64,
      },
    },
    { text: OCR_PROMPT },
  ]);

  const responseText = result.response.text();
  return parseGeminiResponse(responseText) || { textElements: [], imageRegions: [] };
}

// ============================================================
// Shared: Parse Gemini/Vertex AI JSON response
// ============================================================
function parseGeminiResponse(responseText: string): OcrResult | null {
  let jsonStr = responseText.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    const parsed = JSON.parse(jsonStr);

    // New object format: {textElements: [...], imageRegions: [...]}
    if (parsed.textElements) {
      return {
        textElements: (parsed.textElements as OcrTextElement[]).map((el) => ({
          ...el,
          text: (el.text || "").normalize("NFC"),
        })),
        imageRegions: (parsed.imageRegions as OcrImageRegion[]) || [],
      };
    }

    // Legacy array format: [...]
    if (Array.isArray(parsed)) {
      return {
        textElements: (parsed as OcrTextElement[]).map((el) => ({
          ...el,
          text: (el.text || "").normalize("NFC"),
        })),
        imageRegions: [],
      };
    }

    return null;
  } catch {
    console.error("[OCR] Failed to parse response:", jsonStr.slice(0, 200));
    return null;
  }
}

// ============================================================
// Main route handler
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json();

    // 1) PaddleOCR (local, free, unlimited)
    const paddleResult = await tryPaddleOcr(image);
    if (paddleResult !== null) {
      console.log(`[OCR] PaddleOCR: ${paddleResult.textElements.length} texts, ${paddleResult.imageRegions.length} images`);
      return NextResponse.json(
        { textElements: paddleResult.textElements, imageRegions: paddleResult.imageRegions, engine: "paddleocr" },
        { headers: { "Content-Type": "application/json; charset=utf-8" } }
      );
    }

    // 2) Vertex AI Gemini (Google Cloud, high limits)
    const vertexResult = await tryVertexAi(image);
    if (vertexResult !== null) {
      console.log(`[OCR] Vertex AI: ${vertexResult.textElements.length} texts, ${vertexResult.imageRegions.length} images`);
      return NextResponse.json(
        { textElements: vertexResult.textElements, imageRegions: vertexResult.imageRegions, engine: "vertexai" },
        { headers: { "Content-Type": "application/json; charset=utf-8" } }
      );
    }

    // 3) Gemini Free API (rate-limited fallback)
    const geminiResult = await tryGeminiFree(image);
    console.log(`[OCR] Gemini Free: ${geminiResult.textElements.length} texts, ${geminiResult.imageRegions.length} images`);
    return NextResponse.json(
      { textElements: geminiResult.textElements, imageRegions: geminiResult.imageRegions, engine: "gemini-free" },
      { headers: { "Content-Type": "application/json; charset=utf-8" } }
    );
  } catch (error) {
    console.error("OCR error:", error);
    let errorMessage = "OCR 처리 실패";
    if (error instanceof Error) {
      if (error.message.includes("API_KEY") || error.message.includes("API key")) {
        errorMessage = "Gemini API 키가 유효하지 않습니다. Google AI Studio에서 확인해주세요.";
      } else if (error.message.includes("quota") || error.message.includes("rate") || error.message.includes("429")) {
        errorMessage = "API 호출 한도 초과. 잠시 후 다시 시도해주세요.";
      } else {
        errorMessage = error.message;
      }
    }
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
