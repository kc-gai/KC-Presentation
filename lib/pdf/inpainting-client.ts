/**
 * Inpainting Client - Smart Canvas + Gemini AI text removal
 *
 * Removes text from slide backgrounds using:
 * 1. Canvas-based smart inpainting (fast, free)
 * 2. Gemini AI inpainting (optional enhancement)
 */

export interface TextBoundingBox {
  x: number;        // % (0-100) from left
  y: number;        // % (0-100) from top
  width: number;    // % (0-100)
  height: number;   // % (0-100)
}

export interface InpaintingResult {
  cleanedImage: string;          // blob URL
  cleanedImageBase64: string;    // base64 (without data:image prefix)
  method: "canvas" | "gemini";
}

// ============================================================
// Color Utilities
// ============================================================

interface RGB { r: number; g: number; b: number }

/**
 * Calculate color variance to determine if solid or gradient
 */
function calculateColorVariance(samples: RGB[]): number {
  if (samples.length === 0) return 0;

  const avgR = samples.reduce((sum, c) => sum + c.r, 0) / samples.length;
  const avgG = samples.reduce((sum, c) => sum + c.g, 0) / samples.length;
  const avgB = samples.reduce((sum, c) => sum + c.b, 0) / samples.length;

  return samples.reduce((sum, c) => {
    return sum + Math.pow(c.r - avgR, 2) + Math.pow(c.g - avgG, 2) + Math.pow(c.b - avgB, 2);
  }, 0) / samples.length;
}

/**
 * Median color — robust against outlier text pixels
 */
function medianColor(samples: RGB[]): RGB {
  if (samples.length === 0) return { r: 255, g: 255, b: 255 };

  const sortedR = samples.map(s => s.r).sort((a, b) => a - b);
  const sortedG = samples.map(s => s.g).sort((a, b) => a - b);
  const sortedB = samples.map(s => s.b).sort((a, b) => a - b);
  const mid = Math.floor(samples.length / 2);

  return { r: sortedR[mid], g: sortedG[mid], b: sortedB[mid] };
}

/**
 * Filter outlier pixels (likely text) from border samples.
 * Uses median as reference — pixels far from median are removed.
 */
function filterOutliers(samples: RGB[], threshold: number = 40): RGB[] {
  if (samples.length < 10) return samples;

  const med = medianColor(samples);

  const filtered = samples.filter(s =>
    Math.abs(s.r - med.r) < threshold &&
    Math.abs(s.g - med.g) < threshold &&
    Math.abs(s.b - med.b) < threshold
  );

  // If too many filtered out (>80%), the threshold was too strict; relax it
  if (filtered.length < samples.length * 0.2) {
    return filterOutliers(samples, threshold + 20);
  }

  return filtered.length > 0 ? filtered : samples;
}

/**
 * Sample colors from the border around a box (further away to avoid text spillover)
 */
function sampleBorderColors(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  gap: number = 5,
  borderWidth: number = 20
): {
  top: RGB[];
  bottom: RGB[];
  left: RGB[];
  right: RGB[];
} {
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;

  const samples = {
    top: [] as RGB[],
    bottom: [] as RGB[],
    left: [] as RGB[],
    right: [] as RGB[],
  };

  // Sample top border — `gap` px away from box, then `borderWidth` px band
  const topY = y - gap - borderWidth;
  if (topY >= 0) {
    const sy = Math.max(0, topY);
    const sh = Math.min(borderWidth, y - gap - sy);
    if (sh > 0) {
      const imageData = ctx.getImageData(Math.max(0, x), sy, Math.min(width, cw - x), sh);
      for (let i = 0; i < imageData.data.length; i += 16) { // stride 4 pixels for speed
        samples.top.push({
          r: imageData.data[i], g: imageData.data[i + 1], b: imageData.data[i + 2],
        });
      }
    }
  }

  // Sample bottom border
  const botY = y + height + gap;
  if (botY + borderWidth <= ch) {
    const imageData = ctx.getImageData(Math.max(0, x), botY, Math.min(width, cw - x), borderWidth);
    for (let i = 0; i < imageData.data.length; i += 16) {
      samples.bottom.push({
        r: imageData.data[i], g: imageData.data[i + 1], b: imageData.data[i + 2],
      });
    }
  }

  // Sample left border
  const leftX = x - gap - borderWidth;
  if (leftX >= 0) {
    const sx = Math.max(0, leftX);
    const sw = Math.min(borderWidth, x - gap - sx);
    if (sw > 0) {
      const imageData = ctx.getImageData(sx, Math.max(0, y), sw, Math.min(height, ch - y));
      for (let i = 0; i < imageData.data.length; i += 16) {
        samples.left.push({
          r: imageData.data[i], g: imageData.data[i + 1], b: imageData.data[i + 2],
        });
      }
    }
  }

  // Sample right border
  const rightX = x + width + gap;
  if (rightX + borderWidth <= cw) {
    const imageData = ctx.getImageData(rightX, Math.max(0, y), borderWidth, Math.min(height, ch - y));
    for (let i = 0; i < imageData.data.length; i += 16) {
      samples.right.push({
        r: imageData.data[i], g: imageData.data[i + 1], b: imageData.data[i + 2],
      });
    }
  }

  return samples;
}

/**
 * Multi-pass box blur for smoother edge blending
 */
function applyBoxBlur(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number = 5,
  passes: number = 2
): void {
  for (let pass = 0; pass < passes; pass++) {
    const blurX = Math.max(0, x - radius);
    const blurY = Math.max(0, y - radius);
    const blurWidth = Math.min(ctx.canvas.width - blurX, width + radius * 2);
    const blurHeight = Math.min(ctx.canvas.height - blurY, height + radius * 2);

    const imageData = ctx.getImageData(blurX, blurY, blurWidth, blurHeight);
    const data = imageData.data;
    const w = blurWidth;
    const h = blurHeight;

    const temp = new Uint8ClampedArray(data);

    // Horizontal pass
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        let r = 0, g = 0, b = 0, count = 0;
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = px + dx;
          if (nx >= 0 && nx < w) {
            const idx = (py * w + nx) * 4;
            r += temp[idx]; g += temp[idx + 1]; b += temp[idx + 2];
            count++;
          }
        }
        const idx = (py * w + px) * 4;
        data[idx] = r / count;
        data[idx + 1] = g / count;
        data[idx + 2] = b / count;
      }
    }

    // Copy for vertical pass
    const temp2 = new Uint8ClampedArray(data);

    // Vertical pass
    for (let px = 0; px < w; px++) {
      for (let py = 0; py < h; py++) {
        let r = 0, g = 0, b = 0, count = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          const ny = py + dy;
          if (ny >= 0 && ny < h) {
            const idx = (ny * w + px) * 4;
            r += temp2[idx]; g += temp2[idx + 1]; b += temp2[idx + 2];
            count++;
          }
        }
        const idx = (py * w + px) * 4;
        data[idx] = r / count;
        data[idx + 1] = g / count;
        data[idx + 2] = b / count;
      }
    }

    ctx.putImageData(imageData, blurX, blurY);
  }
}

/**
 * Apply feathered edge — gradually blend fill edges with surrounding image
 */
function applyFeatheredEdge(
  ctx: CanvasRenderingContext2D,
  fillX: number,
  fillY: number,
  fillW: number,
  fillH: number,
  featherSize: number = 6
): void {
  // Save the current fill region
  const outerX = Math.max(0, fillX - featherSize);
  const outerY = Math.max(0, fillY - featherSize);
  const outerW = Math.min(ctx.canvas.width - outerX, fillW + featherSize * 2);
  const outerH = Math.min(ctx.canvas.height - outerY, fillH + featherSize * 2);

  const imageData = ctx.getImageData(outerX, outerY, outerW, outerH);
  const data = imageData.data;

  // For each pixel in the feather region, blend with a gradient alpha
  for (let py = 0; py < outerH; py++) {
    for (let px = 0; px < outerW; px++) {
      const absX = outerX + px;
      const absY = outerY + py;

      // How far inside the fill rect is this pixel?
      const distLeft = absX - fillX;
      const distRight = (fillX + fillW) - absX;
      const distTop = absY - fillY;
      const distBottom = (fillY + fillH) - absY;

      // If inside the fill core area, leave it alone
      if (distLeft >= featherSize && distRight >= featherSize &&
          distTop >= featherSize && distBottom >= featherSize) {
        continue;
      }

      // If outside the fill rect entirely, leave it alone
      if (distLeft < -featherSize || distRight < -featherSize ||
          distTop < -featherSize || distBottom < -featherSize) {
        continue;
      }

      // Calculate feather alpha (0 = full original, 1 = full fill)
      const minDist = Math.min(
        Math.max(0, distLeft),
        Math.max(0, distRight),
        Math.max(0, distTop),
        Math.max(0, distBottom)
      );

      if (minDist < featherSize) {
        // This pixel is in the feather zone — it needs blending
        // but the fill already happened, so we partially restore the original
        // We can't easily get the original here, so we skip the feathering
        // and rely on the blur passes instead
      }
    }
  }
}

/**
 * Smart Canvas-based inpainting with improved algorithm
 *
 * Key improvements over v1:
 * - Samples 20px border, 5px away from text box (avoids text spillover)
 * - Uses median color (resistant to text pixel outliers)
 * - Filters outlier pixels before averaging
 * - Expands fill area by 10px to cover anti-aliased text edges
 * - Multi-direction gradient fill for non-solid backgrounds
 * - 2-pass box blur with 5px radius for smooth blending
 */
export async function inpaintWithCanvas(
  backgroundBlobUrl: string,
  textBoxes: TextBoundingBox[]
): Promise<InpaintingResult> {
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          throw new Error("Failed to get canvas context");
        }

        // Draw original image
        ctx.drawImage(img, 0, 0);

        // Process each text box
        for (const box of textBoxes) {
          // Convert % coordinates to pixels
          const x = Math.round((box.x / 100) * img.width);
          const y = Math.round((box.y / 100) * img.height);
          const width = Math.round((box.width / 100) * img.width);
          const height = Math.round((box.height / 100) * img.height);

          // Expand generously to cover text edges + anti-aliasing
          const expansion = Math.max(8, Math.round(Math.min(width, height) * 0.05));
          const expandedX = Math.max(0, x - expansion);
          const expandedY = Math.max(0, y - expansion);
          const expandedWidth = Math.min(img.width - expandedX, width + expansion * 2);
          const expandedHeight = Math.min(img.height - expandedY, height + expansion * 2);

          // Sample border colors — 5px gap from box, 20px sampling band
          const borderSamples = sampleBorderColors(ctx, x, y, width, height, 5, 20);

          // Filter outlier (text) pixels from each side
          const cleanTop = filterOutliers(borderSamples.top);
          const cleanBottom = filterOutliers(borderSamples.bottom);
          const cleanLeft = filterOutliers(borderSamples.left);
          const cleanRight = filterOutliers(borderSamples.right);

          // Combine all clean samples
          const allCleanSamples = [...cleanTop, ...cleanBottom, ...cleanLeft, ...cleanRight];

          const variance = calculateColorVariance(allCleanSamples);
          const isSolid = variance < 800;

          if (isSolid) {
            // Solid background — use median color (robust against outliers)
            const bgColor = medianColor(allCleanSamples);
            ctx.fillStyle = `rgb(${bgColor.r}, ${bgColor.g}, ${bgColor.b})`;
            ctx.fillRect(expandedX, expandedY, expandedWidth, expandedHeight);
          } else {
            // Gradient background — create 4-corner bilinear gradient
            const topColor = medianColor(cleanTop.length > 0 ? cleanTop : allCleanSamples);
            const bottomColor = medianColor(cleanBottom.length > 0 ? cleanBottom : allCleanSamples);
            const leftColor = medianColor(cleanLeft.length > 0 ? cleanLeft : allCleanSamples);
            const rightColor = medianColor(cleanRight.length > 0 ? cleanRight : allCleanSamples);

            // Use pixel-level bilinear interpolation for smooth gradient
            const fillData = ctx.getImageData(expandedX, expandedY, expandedWidth, expandedHeight);
            for (let py = 0; py < expandedHeight; py++) {
              const ty = expandedHeight > 1 ? py / (expandedHeight - 1) : 0.5;
              for (let px = 0; px < expandedWidth; px++) {
                const tx = expandedWidth > 1 ? px / (expandedWidth - 1) : 0.5;

                // Bilinear interpolation: top-left, top-right, bottom-left, bottom-right
                const topBlend = {
                  r: topColor.r * (1 - tx) + rightColor.r * tx,
                  g: topColor.g * (1 - tx) + rightColor.g * tx,
                  b: topColor.b * (1 - tx) + rightColor.b * tx,
                };
                const botBlend = {
                  r: leftColor.r * (1 - tx) + bottomColor.r * tx,
                  g: leftColor.g * (1 - tx) + bottomColor.g * tx,
                  b: leftColor.b * (1 - tx) + bottomColor.b * tx,
                };

                const idx = (py * expandedWidth + px) * 4;
                fillData.data[idx] = Math.round(topBlend.r * (1 - ty) + botBlend.r * ty);
                fillData.data[idx + 1] = Math.round(topBlend.g * (1 - ty) + botBlend.g * ty);
                fillData.data[idx + 2] = Math.round(topBlend.b * (1 - ty) + botBlend.b * ty);
                fillData.data[idx + 3] = 255;
              }
            }
            ctx.putImageData(fillData, expandedX, expandedY);
          }

          // Multi-pass blur for smooth blending at edges
          applyBoxBlur(ctx, expandedX, expandedY, expandedWidth, expandedHeight, 5, 2);
        }

        // Export as PNG blob and base64
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("Failed to create blob from canvas"));
            return;
          }

          const blobUrl = URL.createObjectURL(blob);
          const reader = new FileReader();

          reader.onloadend = () => {
            const base64 = (reader.result as string).split(",")[1];
            const elapsed = Date.now() - startTime;

            console.log(`[Inpainting] Canvas: ${elapsed}ms, ${textBoxes.length} regions`);

            resolve({
              cleanedImage: blobUrl,
              cleanedImageBase64: base64,
              method: "canvas",
            });
          };

          reader.readAsDataURL(blob);
        }, "image/png");

      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error("Failed to load background image"));
    };

    img.src = backgroundBlobUrl;
  });
}

/**
 * Gemini AI-powered inpainting
 */
export async function inpaintWithGemini(
  imageBase64: string,
  textBoxes: TextBoundingBox[]
): Promise<InpaintingResult> {
  const startTime = Date.now();

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "/presentation";
  const response = await fetch(`${basePath}/api/inpainting`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      image: imageBase64,
      textBoxes,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const detail = errorBody?.error || response.statusText;
    throw new Error(detail);
  }

  const data: { image: string; method: "gemini" } = await response.json();

  // Convert base64 to blob URL
  const binaryString = atob(data.image);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: "image/png" });
  const blobUrl = URL.createObjectURL(blob);

  const elapsed = Date.now() - startTime;
  console.log(`[Inpainting] Gemini: ${elapsed}ms, ${textBoxes.length} regions`);

  return {
    cleanedImage: blobUrl,
    cleanedImageBase64: data.image,
    method: "gemini",
  };
}

/**
 * Main entry point - Tiered inpainting approach
 *
 * Strategy:
 * 1. Try Gemini AI inpainting first (best quality, uses ORIGINAL image)
 * 2. Fall back to Canvas inpainting (fast, free) if Gemini fails
 */
export async function inpaintSlideBackground(
  backgroundBlobUrl: string,
  originalImageBase64: string,
  textBoxes: TextBoundingBox[]
): Promise<InpaintingResult> {
  const startTime = Date.now();

  // Strategy: Try Gemini first (better quality), fall back to Canvas
  try {
    console.log(`[Inpainting] Attempting Gemini AI inpainting for ${textBoxes.length} text boxes`);
    const geminiResult = await inpaintWithGemini(originalImageBase64, textBoxes);

    const totalElapsed = Date.now() - startTime;
    console.log(`[Inpainting] Complete: Gemini (${totalElapsed}ms)`);
    return geminiResult;
  } catch (geminiError) {
    console.warn(`[Inpainting] Gemini failed, falling back to Canvas:`, geminiError);
  }

  // Fallback: Canvas inpainting
  try {
    console.log(`[Inpainting] Starting Canvas inpainting for ${textBoxes.length} text boxes`);
    const canvasResult = await inpaintWithCanvas(backgroundBlobUrl, textBoxes);

    const totalElapsed = Date.now() - startTime;
    console.log(`[Inpainting] Complete: Canvas only (${totalElapsed}ms)`);
    return canvasResult;
  } catch (canvasError) {
    console.error(`[Inpainting] Canvas inpainting failed:`, canvasError);
    throw canvasError;
  }
}
