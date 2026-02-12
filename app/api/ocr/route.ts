import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const OCR_PROMPT = `You are an OCR engine that extracts text from presentation slide images.
For each text block you find in the image, return a JSON object with:
- "text": the exact text content (preserve line breaks within a block)
- "x": x position as percentage (0-100) from left edge
- "y": y position as percentage (0-100) from top edge
- "width": width as percentage (0-100) of the slide
- "height": height as percentage (0-100) of the slide
- "fontSize": estimated font size in pixels (rough estimate based on text size relative to slide)

Return ONLY a valid JSON array of these objects. No markdown, no explanation, no code blocks.
Group text that belongs together (same paragraph/heading) into one block.
Be very precise with position estimates - look at where each text block starts and its size relative to the full slide.

Example output:
[{"text":"Title Text","x":5,"y":3,"width":90,"height":8,"fontSize":36},{"text":"Bullet point one\\nBullet point two","x":5,"y":20,"width":45,"height":15,"fontSize":18}]`;

type OcrTextElement = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
};

// ============================================================
// Engine 1: PaddleOCR (local, free, unlimited)
// ============================================================
async function tryPaddleOcr(imageBase64: string): Promise<OcrTextElement[] | null> {
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
  return data.textElements || [];
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

async function tryVertexAi(imageBase64: string): Promise<OcrTextElement[] | null> {
  const projectId = process.env.VERTEX_PROJECT_ID || "gemini-vertex-470601";
  const location = process.env.VERTEX_LOCATION || "us-central1";

  // Skip if no credentials available and not local
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
async function tryGeminiFree(imageBase64: string): Promise<OcrTextElement[]> {
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
  return parseGeminiResponse(responseText) || [];
}

// ============================================================
// Shared: Parse Gemini/Vertex AI JSON response
// ============================================================
function parseGeminiResponse(responseText: string): OcrTextElement[] | null {
  let jsonStr = responseText.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    const elements: OcrTextElement[] = JSON.parse(jsonStr);
    return elements.map((el) => ({
      ...el,
      text: (el.text || "").normalize("NFC"),
    }));
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
      console.log(`[OCR] PaddleOCR: ${paddleResult.length} elements`);
      return NextResponse.json(
        { textElements: paddleResult, engine: "paddleocr" },
        { headers: { "Content-Type": "application/json; charset=utf-8" } }
      );
    }

    // 2) Vertex AI Gemini (Google Cloud, high limits)
    const vertexResult = await tryVertexAi(image);
    if (vertexResult !== null) {
      console.log(`[OCR] Vertex AI: ${vertexResult.length} elements`);
      return NextResponse.json(
        { textElements: vertexResult, engine: "vertexai" },
        { headers: { "Content-Type": "application/json; charset=utf-8" } }
      );
    }

    // 3) Gemini Free API (rate-limited fallback)
    const geminiResult = await tryGeminiFree(image);
    console.log(`[OCR] Gemini Free: ${geminiResult.length} elements`);
    return NextResponse.json(
      { textElements: geminiResult, engine: "gemini-free" },
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
