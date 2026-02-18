import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { SlideIR } from "@/types/slide-ir";
import type { SlideDSL } from "@/types/slide-dsl";
import { SYSTEM_PROMPT, buildTaskPrompt, buildRepairPrompt } from "@/lib/dsl/prompts";

interface DSLRequest {
  slideIR?: SlideIR;
  repair?: boolean;
  originalDSL?: SlideDSL;
  issues?: { type: string; elementIds: string[]; details: string }[];
}

/**
 * JSON 응답에서 실제 JSON 추출 (마크다운 코드블록 등 제거)
 */
function extractJSON(text: string): string {
  // 1. ```json ... ``` 블록 추출
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();

  // 2. 첫 번째 { ... } 블록 추출
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];

  return text.trim();
}

/**
 * DSL 유효성 기본 검증
 */
function validateDSL(dsl: unknown): dsl is SlideDSL {
  if (!dsl || typeof dsl !== "object") return false;
  const d = dsl as Record<string, unknown>;
  return (
    typeof d.pageIndex === "number" &&
    d.size != null &&
    Array.isArray(d.elements)
  );
}

export async function POST(request: NextRequest) {
  try {
    const body: DSLRequest = await request.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    const client = new Anthropic({ apiKey });

    let userPrompt: string;

    if (body.repair && body.originalDSL && body.issues) {
      // Repair mode
      userPrompt = buildRepairPrompt(
        JSON.stringify(body.originalDSL, null, 2),
        body.issues
      );
    } else if (body.slideIR) {
      // Generation mode
      userPrompt = buildTaskPrompt(body.slideIR);
    } else {
      return NextResponse.json(
        { error: "slideIR or (repair + originalDSL + issues) is required" },
        { status: 400 }
      );
    }

    console.log(`[DSL] Calling Claude API (page ${body.slideIR?.pageIndex ?? "repair"})...`);

    const message = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [
        { role: "user", content: userPrompt },
      ],
    });

    // Extract text response
    const textContent = message.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("Claude returned no text content");
    }

    const rawJSON = extractJSON(textContent.text);

    let dsl: SlideDSL;
    try {
      dsl = JSON.parse(rawJSON);
    } catch {
      console.error("[DSL] JSON parse failed. Raw response:", textContent.text.slice(0, 500));
      throw new Error("Claude returned invalid JSON");
    }

    if (!validateDSL(dsl)) {
      console.error("[DSL] Validation failed. Parsed:", JSON.stringify(dsl).slice(0, 500));
      throw new Error("Claude returned DSL that doesn't match schema");
    }

    console.log(
      `[DSL] Success: page ${dsl.pageIndex}, ${dsl.elements.length} elements, ` +
      `${message.usage.input_tokens}+${message.usage.output_tokens} tokens`
    );

    return NextResponse.json({ dsl });
  } catch (error) {
    console.error("[DSL] Error:", error);
    let errorMessage = "DSL 생성 실패";
    if (error instanceof Error) {
      if (error.message.includes("API_KEY") || error.message.includes("api_key")) {
        errorMessage = "Anthropic API 키가 유효하지 않습니다.";
      } else if (error.message.includes("rate") || error.message.includes("429")) {
        errorMessage = "API 호출 한도 초과. 잠시 후 다시 시도해주세요.";
      } else {
        errorMessage = error.message;
      }
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
