import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

type TextBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

interface InpaintingRequest {
  image: string;
  textBoxes: TextBox[];
}

interface InpaintingResponse {
  image: string;
  method: "gemini";
}

// ============================================================
// Build inpainting prompt
// ============================================================
function buildInpaintingPrompt(textBoxes: TextBox[]): string {
  const textBoxesJson = JSON.stringify(textBoxes, null, 2);

  return `You are a professional image editor. Your task is to remove ALL text from this presentation slide image and fill those areas with the surrounding background.

REGIONS containing text to remove (coordinates as % of image width/height):
${textBoxesJson}

RULES:
1. Erase every single character of text (titles, subtitles, body text, labels, numbers)
2. Replace each text area with the background color/gradient that surrounds it
3. Keep the fill seamless — match adjacent colors exactly
4. Preserve ALL non-text elements: shapes, borders, icons, images, charts, decorations
5. Keep the exact same image dimensions
6. Do NOT add any watermark, text, or new elements

The output must be a clean slide background with zero visible text.

Return ONLY the modified image with no text explanation.`;
}

// ============================================================
// Vertex AI auth helper
// ============================================================
function getVertexAuthOptions() {
  const credJson = process.env.GOOGLE_CREDENTIALS_JSON;
  if (credJson) {
    try {
      const credentials = JSON.parse(credJson);
      return { credentials };
    } catch {
      console.warn("[Inpainting] Failed to parse GOOGLE_CREDENTIALS_JSON");
    }
  }
  return undefined;
}

// ============================================================
// Engine 1: Vertex AI Gemini (primary - paid, high limits)
// ============================================================
async function tryVertexAiInpainting(
  imageBase64: string,
  prompt: string
): Promise<string | null> {
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

    // Use gemini-2.0-flash (latest) which supports image generation
    const model = vertexAI.getGenerativeModel({
      model: "gemini-2.0-flash",
    });

    console.log("[Inpainting] Vertex AI: sending request...");

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
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["IMAGE", "TEXT"],
      } as Record<string, unknown>,
    });

    const parts = result.response?.candidates?.[0]?.content?.parts;
    if (!parts) {
      console.warn("[Inpainting] Vertex AI returned no parts. Full response:", JSON.stringify(result.response?.candidates?.[0], null, 2).slice(0, 500));
      return null;
    }

    for (const part of parts) {
      if ("inlineData" in part && part.inlineData) {
        const imageData = part.inlineData.data;
        if (imageData) {
          console.log(`[Inpainting] Vertex AI success (${(imageData.length / 1024).toFixed(0)}KB)`);
          return imageData;
        }
      }
    }

    // Log what we got instead of an image
    const partTypes = parts.map(p => Object.keys(p).join(",")).join("; ");
    console.warn(`[Inpainting] Vertex AI returned parts but no image. Part types: ${partTypes}`);
    return null;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (
      msg.includes("Could not load the default credentials") ||
      msg.includes("GOOGLE_APPLICATION_CREDENTIALS") ||
      msg.includes("Unable to detect")
    ) {
      console.log("[Inpainting] Vertex AI not available (no credentials), skipping");
    } else {
      console.warn("[Inpainting] Vertex AI failed:", msg);
    }
    return null;
  }
}

// ============================================================
// Engine 2: Gemini API with API Key (fallback)
// ============================================================
async function tryGeminiFreeInpainting(
  imageBase64: string,
  prompt: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  // Use gemini-2.0-flash-exp for image generation support
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-exp",
  });

  console.log("[Inpainting] Gemini API: sending request...");

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
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ["IMAGE", "TEXT"],
    } as Record<string, unknown>,
  } as Parameters<typeof model.generateContent>[0]);

  const parts = result.response?.candidates?.[0]?.content?.parts;
  if (!parts) {
    console.warn("[Inpainting] Gemini API returned no parts. Finish reason:",
      result.response?.candidates?.[0]?.finishReason);
    throw new Error("Gemini API returned no response parts");
  }

  for (const part of parts) {
    if ("inlineData" in part && part.inlineData) {
      const imageData = part.inlineData.data;
      if (imageData) {
        console.log(`[Inpainting] Gemini API success (${(imageData.length / 1024).toFixed(0)}KB)`);
        return imageData;
      }
    }
  }

  // Log what we got
  const partTypes = parts.map(p => Object.keys(p).join(",")).join("; ");
  console.warn(`[Inpainting] Gemini API returned parts but no image. Part types: ${partTypes}`);
  throw new Error("Gemini API returned no image data in response");
}

// ============================================================
// Main route handler
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const body: InpaintingRequest = await request.json();
    const { image, textBoxes } = body;

    if (!image) {
      return NextResponse.json(
        { error: "image is required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(textBoxes) || textBoxes.length === 0) {
      return NextResponse.json(
        { error: "textBoxes array is required" },
        { status: 400 }
      );
    }

    console.log(`[Inpainting] Processing ${textBoxes.length} text boxes, image size: ${(image.length / 1024).toFixed(0)}KB`);

    const prompt = buildInpaintingPrompt(textBoxes);

    // 1) Try Vertex AI Gemini (primary)
    const vertexResult = await tryVertexAiInpainting(image, prompt);
    if (vertexResult !== null) {
      const response: InpaintingResponse = {
        image: vertexResult,
        method: "gemini",
      };
      return NextResponse.json(response);
    }

    // 2) Fallback to Gemini API with API Key
    const geminiResult = await tryGeminiFreeInpainting(image, prompt);
    const response: InpaintingResponse = {
      image: geminiResult,
      method: "gemini",
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error("[Inpainting] Error:", error);
    let errorMessage = "Inpainting 처리 실패";
    if (error instanceof Error) {
      if (
        error.message.includes("API_KEY") ||
        error.message.includes("API key")
      ) {
        errorMessage =
          "Gemini API 키가 유효하지 않습니다. Google AI Studio에서 확인해주세요.";
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
