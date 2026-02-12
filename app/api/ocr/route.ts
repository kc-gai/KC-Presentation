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

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY가 설정되지 않았습니다. .env.local에 추가해주세요." },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: image,
        },
      },
      { text: OCR_PROMPT },
    ]);

    const responseText = result.response.text();

    // Parse JSON - handle markdown code blocks
    let jsonStr = responseText.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    let textElements: Array<{
      text: string;
      x: number;
      y: number;
      width: number;
      height: number;
      fontSize: number;
    }>;

    try {
      textElements = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse OCR response:", jsonStr);
      textElements = [];
    }

    // Normalize text encoding
    textElements = textElements.map((el) => ({
      ...el,
      text: (el.text || "").normalize("NFC"),
    }));

    return NextResponse.json(
      { textElements },
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
      }
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
