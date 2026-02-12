import { v4 as uuidv4 } from "uuid";
import type { TextElement } from "@/types/presentation";

const MAX_BASE64_FOR_API = 4 * 1024 * 1024;

interface OcrResponse {
  textElements: Array<{
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
    fontWeight?: "bold" | "normal";
    fontColor?: string;
  }>;
  imageRegions?: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  engine?: string; // "paddleocr" | "vertexai" | "gemini-free"
}

export interface OcrResult {
  textElements: TextElement[];
  imageRegions: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}

/**
 * Resize a base64 JPEG image using browser canvas until it's under maxSize.
 */
async function shrinkBase64Image(
  base64: string,
  maxSize: number
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      const qualities = [0.5, 0.3, 0.2];

      for (let round = 0; round < 5; round++) {
        for (const q of qualities) {
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL("image/jpeg", q);
          const b64 = dataUrl.split(",")[1];
          if (b64.length <= maxSize) {
            console.log(
              `[OCR-client] Resized to ${(b64.length / 1024 / 1024).toFixed(1)}MB (${w}x${h}, q=${q})`
            );
            resolve(b64);
            return;
          }
        }
        w = Math.round(w * 0.5);
        h = Math.round(h * 0.5);
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.15).split(",")[1]);
    };
    img.src = `data:image/jpeg;base64,${base64}`;
  });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Track last OCR call time for rate limiting (only for gemini-free)
let lastOcrCallTime = 0;
const MIN_INTERVAL_MS = 5000; // ~12 RPM, safely under Gemini free tier 15 RPM

// Track which engine was used last - skip rate limiting for local/vertex engines
let lastEngine: string = "";

// Circuit breaker: stop OCR attempts after rate limit error
let circuitBreakerTripped = false;

export class OcrRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OcrRateLimitError";
  }
}

/** Reset circuit breaker (call at start of new document processing) */
export function resetOcrCircuitBreaker() {
  circuitBreakerTripped = false;
  lastOcrCallTime = 0;
  lastEngine = "";
}

export async function extractTextWithOcr(
  imageBase64: string
): Promise<OcrResult> {
  // Circuit breaker: if already tripped, skip immediately
  if (circuitBreakerTripped) {
    throw new OcrRateLimitError("OCR 호출 중단됨 (API 한도 초과로 남은 페이지 스킵)");
  }

  // Safety check: shrink if still too large for API
  let base64ToSend = imageBase64;
  if (base64ToSend.length > MAX_BASE64_FOR_API) {
    console.warn(
      `[OCR] Image base64 is ${(base64ToSend.length / 1024 / 1024).toFixed(1)}MB, ` +
      `exceeds ${(MAX_BASE64_FOR_API / 1024 / 1024).toFixed(0)}MB limit. Resizing...`
    );
    base64ToSend = await shrinkBase64Image(base64ToSend, MAX_BASE64_FOR_API);
  }

  // Rate limit only for gemini-free engine (local/vertex don't need it)
  const needsRateLimit = lastEngine === "" || lastEngine === "gemini-free";
  if (needsRateLimit) {
    const now = Date.now();
    const elapsed = now - lastOcrCallTime;
    if (elapsed < MIN_INTERVAL_MS) {
      const waitTime = MIN_INTERVAL_MS - elapsed;
      console.log(`[OCR] Rate limiting (gemini-free): waiting ${waitTime}ms`);
      await delay(waitTime);
    }
  }

  // Single retry only (avoid long backoff cascades)
  const maxRetries = 1;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    lastOcrCallTime = Date.now();

    const response = await fetch("/api/ocr", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ image: base64ToSend }),
    });

    if (response.ok) {
      const data: OcrResponse = await response.json();
      // Track engine for rate limiting decisions
      if (data.engine) {
        lastEngine = data.engine;
        console.log(`[OCR] Engine: ${data.engine}`);
      }
      return {
        textElements: data.textElements.map((el) => ({
          id: uuidv4(),
          text: (el.text || "").normalize("NFC"),
          textKo: "",
          textJa: "",
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
          fontSize: el.fontSize,
          fontColor: el.fontColor || "#000000",
          fontWeight: el.fontWeight === "bold" ? "bold" as const : "normal" as const,
          textAlign: "left" as const,
          isEdited: false,
        })),
        imageRegions: data.imageRegions || [],
      };
    }

    const errorBody = await response.json().catch(() => null);
    const detail = errorBody?.error || response.statusText;

    // Check if rate limited (429 or quota error)
    const isRateLimit =
      response.status === 429 ||
      detail.includes("한도") ||
      detail.includes("quota") ||
      detail.includes("rate") ||
      detail.includes("RESOURCE_EXHAUSTED");

    if (isRateLimit) {
      if (attempt < maxRetries) {
        const backoff = 8000; // 8s single retry
        console.warn(`[OCR] Rate limited (attempt ${attempt + 1}/${maxRetries}), retrying in ${backoff / 1000}s...`);
        await delay(backoff);
        continue;
      }
      // Trip circuit breaker: no point retrying remaining pages
      circuitBreakerTripped = true;
      console.error("[OCR] Circuit breaker tripped - skipping OCR for remaining pages");
      throw new OcrRateLimitError(detail);
    }

    throw new Error(detail);
  }

  throw new Error("OCR 최대 재시도 횟수 초과");
}
