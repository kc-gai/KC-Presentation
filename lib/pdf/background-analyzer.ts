export interface BackgroundColor {
  type: "solid" | "gradient" | "image";
  color?: string;           // hex (#RRGGBB)
  gradientFrom?: string;    // hex
  gradientTo?: string;      // hex
  gradientAngle?: number;   // degrees
}

interface ColorSample {
  r: number;
  g: number;
  b: number;
  x: number;
  y: number;
}

/**
 * Analyze background color from a slide image
 * Extracts solid color or gradient by sampling non-text regions
 */
export async function analyzeBackground(
  imageBlobUrl: string,
  textBoxes: { x: number; y: number; width: number; height: number }[]
): Promise<BackgroundColor> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        ctx.drawImage(img, 0, 0);

        // Sample colors from non-text regions
        const samples = sampleBackgroundColors(ctx, img.width, img.height, textBoxes);

        if (samples.length === 0) {
          // No samples available, return white as default
          resolve({ type: "solid", color: "#FFFFFF" });
          return;
        }

        // Analyze color variance
        const variance = calculateColorVariance(samples);
        const SOLID_THRESHOLD = 1000;      // Low variance → solid color
        const GRADIENT_THRESHOLD = 5000;   // Medium variance → gradient

        if (variance < SOLID_THRESHOLD) {
          // Solid color: use median
          const medianColor = getMedianColor(samples);
          resolve({
            type: "solid",
            color: rgbToHex(medianColor.r, medianColor.g, medianColor.b),
          });
        } else if (variance < GRADIENT_THRESHOLD) {
          // Gradient: detect direction and colors
          const gradient = detectGradient(samples, img.width, img.height);
          resolve(gradient);
        } else {
          // High variance → photo/complex background, use original image
          resolve({ type: "image" });
        }
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      reject(new Error("Failed to load background image"));
    };

    img.src = imageBlobUrl;
  });
}

/**
 * Sample colors from corners, edges, and empty regions (avoiding text areas)
 */
function sampleBackgroundColors(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  textBoxes: { x: number; y: number; width: number; height: number }[]
): ColorSample[] {
  const samples: ColorSample[] = [];
  const sampleSize = 20; // 20x20px sampling area

  // Define sampling regions
  const regions = [
    // 4 corners
    { x: 0, y: 0 },
    { x: width - sampleSize, y: 0 },
    { x: 0, y: height - sampleSize },
    { x: width - sampleSize, y: height - sampleSize },
    // 4 edges (center)
    { x: width / 2 - sampleSize / 2, y: 0 },
    { x: width / 2 - sampleSize / 2, y: height - sampleSize },
    { x: 0, y: height / 2 - sampleSize / 2 },
    { x: width - sampleSize, y: height / 2 - sampleSize / 2 },
    // Center (if not covered by text)
    { x: width / 2 - sampleSize / 2, y: height / 2 - sampleSize / 2 },
  ];

  for (const region of regions) {
    const x = Math.max(0, Math.min(width - sampleSize, region.x));
    const y = Math.max(0, Math.min(height - sampleSize, region.y));

    // Check if this region overlaps with any text box
    if (isRegionOverlappingText(x, y, sampleSize, sampleSize, width, height, textBoxes)) {
      continue;
    }

    // Sample average color from this region
    const imageData = ctx.getImageData(x, y, sampleSize, sampleSize);
    const avgColor = getAverageColor(imageData);

    samples.push({
      r: avgColor.r,
      g: avgColor.g,
      b: avgColor.b,
      x: x + sampleSize / 2,
      y: y + sampleSize / 2,
    });
  }

  return samples;
}

/**
 * Check if a region overlaps with any text box
 */
function isRegionOverlappingText(
  x: number,
  y: number,
  w: number,
  h: number,
  imgWidth: number,
  imgHeight: number,
  textBoxes: { x: number; y: number; width: number; height: number }[]
): boolean {
  const regionX1 = x / imgWidth * 100;
  const regionY1 = y / imgHeight * 100;
  const regionX2 = (x + w) / imgWidth * 100;
  const regionY2 = (y + h) / imgHeight * 100;

  for (const box of textBoxes) {
    const boxX1 = box.x;
    const boxY1 = box.y;
    const boxX2 = box.x + box.width;
    const boxY2 = box.y + box.height;

    // Check overlap
    if (!(regionX2 < boxX1 || regionX1 > boxX2 || regionY2 < boxY1 || regionY1 > boxY2)) {
      return true;
    }
  }

  return false;
}

/**
 * Get average color from image data
 */
function getAverageColor(imageData: ImageData): { r: number; g: number; b: number } {
  let r = 0, g = 0, b = 0, count = 0;

  for (let i = 0; i < imageData.data.length; i += 4) {
    r += imageData.data[i];
    g += imageData.data[i + 1];
    b += imageData.data[i + 2];
    count++;
  }

  return {
    r: Math.round(r / count),
    g: Math.round(g / count),
    b: Math.round(b / count),
  };
}

/**
 * Calculate color variance across samples
 */
function calculateColorVariance(samples: ColorSample[]): number {
  if (samples.length === 0) return 0;

  const avgR = samples.reduce((sum, s) => sum + s.r, 0) / samples.length;
  const avgG = samples.reduce((sum, s) => sum + s.g, 0) / samples.length;
  const avgB = samples.reduce((sum, s) => sum + s.b, 0) / samples.length;

  const variance = samples.reduce((sum, s) => {
    const dr = s.r - avgR;
    const dg = s.g - avgG;
    const db = s.b - avgB;
    return sum + (dr * dr + dg * dg + db * db);
  }, 0) / samples.length;

  return variance;
}

/**
 * Get median color from samples
 */
function getMedianColor(samples: ColorSample[]): { r: number; g: number; b: number } {
  const rs = samples.map(s => s.r).sort((a, b) => a - b);
  const gs = samples.map(s => s.g).sort((a, b) => a - b);
  const bs = samples.map(s => s.b).sort((a, b) => a - b);

  const mid = Math.floor(samples.length / 2);

  return {
    r: rs[mid],
    g: gs[mid],
    b: bs[mid],
  };
}

/**
 * Detect gradient direction and colors
 */
function detectGradient(
  samples: ColorSample[],
  width: number,
  height: number
): BackgroundColor {
  // Separate samples into top/bottom halves
  const topSamples = samples.filter(s => s.y < height / 2);
  const bottomSamples = samples.filter(s => s.y >= height / 2);

  if (topSamples.length === 0 || bottomSamples.length === 0) {
    // Fallback to solid color if we can't determine gradient
    const median = getMedianColor(samples);
    return {
      type: "solid",
      color: rgbToHex(median.r, median.g, median.b),
    };
  }

  const topColor = getAverageColorFromSamples(topSamples);
  const bottomColor = getAverageColorFromSamples(bottomSamples);

  return {
    type: "gradient",
    gradientFrom: rgbToHex(topColor.r, topColor.g, topColor.b),
    gradientTo: rgbToHex(bottomColor.r, bottomColor.g, bottomColor.b),
    gradientAngle: 180, // top to bottom
  };
}

/**
 * Get average color from color samples
 */
function getAverageColorFromSamples(samples: ColorSample[]): { r: number; g: number; b: number } {
  const avgR = samples.reduce((sum, s) => sum + s.r, 0) / samples.length;
  const avgG = samples.reduce((sum, s) => sum + s.g, 0) / samples.length;
  const avgB = samples.reduce((sum, s) => sum + s.b, 0) / samples.length;

  return {
    r: Math.round(avgR),
    g: Math.round(avgG),
    b: Math.round(avgB),
  };
}

/**
 * Convert RGB to hex color string
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.max(0, Math.min(255, Math.round(n))).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}
