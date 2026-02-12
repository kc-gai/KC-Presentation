import { v4 as uuidv4 } from "uuid";
import type { ImageElement } from "@/types/presentation";

interface ImageRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Crop image regions from a rendered page background image.
 * Takes the full-res blob URL and percentage-based bounding boxes from OCR,
 * returns ImageElements with cropped image data.
 */
export async function cropImageRegions(
  backgroundBlobUrl: string,
  regions: ImageRegion[]
): Promise<ImageElement[]> {
  if (regions.length === 0) return [];

  // Load the background image
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load background image for cropping"));
    image.src = backgroundBlobUrl;
  });

  const results: ImageElement[] = [];

  for (const region of regions) {
    const sx = (region.x / 100) * img.width;
    const sy = (region.y / 100) * img.height;
    const sw = Math.max(1, Math.round((region.width / 100) * img.width));
    const sh = Math.max(1, Math.round((region.height / 100) * img.height));

    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

    const base64 = canvas.toDataURL("image/png").split(",")[1];
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), "image/png");
    });
    const blobUrl = URL.createObjectURL(blob);

    results.push({
      id: uuidv4(),
      imageUrl: blobUrl,
      imageBase64: base64,
      mimeType: "image/png",
      x: Math.max(0, Math.min(100, region.x)),
      y: Math.max(0, Math.min(100, region.y)),
      width: Math.max(1, Math.min(100, region.width)),
      height: Math.max(1, Math.min(100, region.height)),
      originalWidth: sw,
      originalHeight: sh,
    });
  }

  return results;
}
