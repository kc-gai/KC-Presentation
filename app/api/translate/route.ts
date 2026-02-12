import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request: NextRequest) {
  try {
    const { texts, targetLang } = await request.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY가 설정되지 않았습니다. .env.local에 추가해주세요." },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const langName = targetLang === "ko" ? "Korean" : "Japanese";

    // Batch texts into groups to optimize API calls
    const batchSize = 20;
    const allTranslations: string[] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      // Create numbered text list for batch translation
      const numberedTexts = batch
        .map((text: string, idx: number) => `[${idx + 1}] ${text}`)
        .join("\n");

      const result = await model.generateContent([
        {
          text: `Translate the following texts to ${langName}.
Return ONLY the translations in the same numbered format. Do not add explanations.
Keep the same line breaks and formatting within each item.
Ensure natural, fluent ${langName} translation.

${numberedTexts}`,
        },
      ]);

      const responseText = result.response.text();

      // Extract translations by numbered pattern
      const translations: string[] = [];
      const lines = responseText.split("\n");
      let currentIdx = -1;
      let currentText = "";

      for (const line of lines) {
        const match = line.match(/^\[(\d+)\]\s*(.*)/);
        if (match) {
          if (currentIdx >= 0) {
            translations[currentIdx] = currentText.trim().normalize("NFC");
          }
          currentIdx = parseInt(match[1]) - 1;
          currentText = match[2];
        } else if (currentIdx >= 0) {
          currentText += "\n" + line;
        }
      }
      // Push last item
      if (currentIdx >= 0) {
        translations[currentIdx] = currentText.trim().normalize("NFC");
      }

      // Fill any missing translations with original text
      for (let j = 0; j < batch.length; j++) {
        allTranslations.push(translations[j] || batch[j]);
      }
    }

    return NextResponse.json(
      { translations: allTranslations },
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
      }
    );
  } catch (error) {
    console.error("Translation error:", error);
    let errorMessage = "번역 처리 실패";
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
