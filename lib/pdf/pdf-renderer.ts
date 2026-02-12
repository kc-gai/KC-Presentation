import type { PDFPageProxy } from "pdfjs-dist";

// Anthropic API limit is ~5MB for base64 image data.
// Use 2.5MB as target to leave very generous margin.
const MAX_BASE64_BYTES = 2.5 * 1024 * 1024;

export interface RenderedPage {
  fullImage: string;     // blob URL - high res
  thumbnail: string;     // blob URL - thumbnail
  width: number;         // page width in PDF points
  height: number;        // page height in PDF points
  fullImageBase64: string; // compressed base64 for OCR
  backgroundBase64: string; // higher-quality JPEG base64 for export fallback
}

function resizeCanvas(
  source: HTMLCanvasElement,
  ratio: number
): HTMLCanvasElement {
  const small = document.createElement("canvas");
  small.width = Math.max(1, Math.round(source.width * ratio));
  small.height = Math.max(1, Math.round(source.height * ratio));
  const ctx = small.getContext("2d")!;
  ctx.drawImage(source, 0, 0, small.width, small.height);
  return small;
}

function compressCanvasToBase64(canvas: HTMLCanvasElement): string {
  const qualities = [0.6, 0.4, 0.3, 0.2];
  let current = canvas;

  // Try up to 6 rounds of shrinking (each round reduces resolution by 40%)
  for (let round = 0; round < 6; round++) {
    for (const quality of qualities) {
      const dataUrl = current.toDataURL("image/jpeg", quality);
      const base64 = dataUrl.split(",")[1];
      if (base64.length <= MAX_BASE64_BYTES) {
        console.log(
          `[OCR] Compressed to ${(base64.length / 1024 / 1024).toFixed(1)}MB ` +
          `(round=${round}, quality=${quality}, ${current.width}x${current.height})`
        );
        return base64;
      }
    }
    // Shrink canvas by 40% for next round
    current = resizeCanvas(current, 0.6);
  }

  // Final fallback: very small image at lowest quality
  const dataUrl = current.toDataURL("image/jpeg", 0.15);
  return dataUrl.split(",")[1];
}

export async function renderPageToImage(
  page: PDFPageProxy,
  scale: number = 2.0
): Promise<RenderedPage> {
  const viewport = page.getViewport({ scale });
  const thumbViewport = page.getViewport({ scale: 0.3 });
  // OCR doesn't need full resolution - use low scale to keep base64 well under API limit
  const ocrScale = Math.min(scale, 0.5);
  const ocrViewport = page.getViewport({ scale: ocrScale });

  // Render full resolution (for display)
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;

  await page.render({
    canvas,
    canvasContext: ctx,
    viewport,
  }).promise;

  const fullBlob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/png")
  );
  const fullImage = URL.createObjectURL(fullBlob);

  // Render separate smaller canvas for OCR base64
  const ocrCanvas = document.createElement("canvas");
  ocrCanvas.width = ocrViewport.width;
  ocrCanvas.height = ocrViewport.height;
  const ocrCtx = ocrCanvas.getContext("2d")!;

  await page.render({
    canvas: ocrCanvas,
    canvasContext: ocrCtx,
    viewport: ocrViewport,
  }).promise;

  // Compress OCR canvas to stay well under API limit
  const fullImageBase64 = compressCanvasToBase64(ocrCanvas);

  // Render thumbnail
  const thumbCanvas = document.createElement("canvas");
  thumbCanvas.width = thumbViewport.width;
  thumbCanvas.height = thumbViewport.height;
  const thumbCtx = thumbCanvas.getContext("2d")!;

  await page.render({
    canvas: thumbCanvas,
    canvasContext: thumbCtx,
    viewport: thumbViewport,
  }).promise;

  const thumbBlob = await new Promise<Blob>((resolve) =>
    thumbCanvas.toBlob((b) => resolve(b!), "image/png")
  );
  const thumbnail = URL.createObjectURL(thumbBlob);

  // Generate higher-quality JPEG for export fallback (from the full-res canvas)
  const backgroundBase64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];

  const origViewport = page.getViewport({ scale: 1.0 });

  return {
    fullImage,
    thumbnail,
    width: origViewport.width,
    height: origViewport.height,
    fullImageBase64,
    backgroundBase64,
  };
}

export async function tryExtractText(
  page: PDFPageProxy
): Promise<{ hasText: boolean; text: string }> {
  const content = await page.getTextContent();
  const allText = content.items
    .filter((item): item is { str: string; transform: number[] } & typeof item => "str" in item)
    .map((item) => item.str)
    .join("");

  return {
    hasText: allText.trim().length > 10,
    text: allText,
  };
}
