import { NextResponse } from "next/server";

/**
 * Minimal Gemini OCR fallback — ONLY called when native PDF text extraction returns 0 results.
 * Sends a page image to Gemini and asks for text block positions.
 */
export async function POST(req: Request) {
  try {
    const { imageBase64, pageWidth, pageHeight } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });
    }

    const prompt = `Analyze this presentation slide image. Extract ALL text blocks with their positions.

Return a JSON array of text blocks. Each block:
{
  "text": "the text content",
  "x": percent from left (0-100),
  "y": percent from top (0-100),
  "width": percent width (0-100),
  "height": percent height (0-100),
  "fontSize": estimated font size in points,
  "fontWeight": "bold" or "normal"
}

Rules:
- Merge text on the same line into one block
- x/y/width/height are percentages of the slide dimensions
- Be precise with positions
- Return ONLY the JSON array, no markdown`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: "image/jpeg",
                    data: imageBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("[OCR Fallback] Gemini error:", errText);
      return NextResponse.json({ error: "Gemini API failed" }, { status: 500 });
    }

    const data = await res.json();
    const rawText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";

    // Parse JSON from Gemini response (might have markdown fences)
    const jsonStr = rawText
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    const blocks = JSON.parse(jsonStr);

    return NextResponse.json({ blocks });
  } catch (error) {
    console.error("[OCR Fallback] Error:", error);
    return NextResponse.json({ error: "OCR fallback failed" }, { status: 500 });
  }
}
