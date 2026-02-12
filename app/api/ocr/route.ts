import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const OCR_PROMPT = `You are an OCR engine that extracts text and identifies visual elements from presentation slide images.

## Text Elements
For each text block you find, return:
- "text": exact text content (preserve line breaks within a block)
- "x": x position as percentage (0-100) from left edge
- "y": y position as percentage (0-100) from top edge
- "width": width as percentage (0-100) of the slide
- "height": height as percentage (0-100) of the slide
- "fontSize": font size as percentage of the slide height (a large title is typically 6-10, body text 3-5, small text 1.5-2.5)

Group text that belongs together (same paragraph/heading) into one block.
Be very precise with position estimates.

## Image Regions
Identify significant non-text visual elements: diagrams, charts, logos, illustrations, photos, graphs, network diagrams, architecture diagrams, or any visual graphic area.
For each, return:
- "x", "y", "width", "height": bounding box as percentages (0-100)
Do NOT include: full-slide backgrounds, tiny decorative elements, or elements smaller than 3% of the slide.

## Output Format
Return ONLY a valid JSON object (no markdown, no code blocks, no explanation):
{"textElements":[{"text":"Title","x":5,"y":3,"width":90,"height":8,"fontSize":7.0}],"imageRegions":[{"x":55,"y":15,"width":40,"height":60}]}

If no image regions found, return empty imageRegions array.`;

type OcrTextElement = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
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
