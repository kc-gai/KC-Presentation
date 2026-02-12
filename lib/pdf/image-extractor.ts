import type { PDFPageProxy } from "pdfjs-dist";
import { OPS } from "pdfjs-dist";
import { v4 as uuidv4 } from "uuid";
import type { ImageElement } from "@/types/presentation";

interface ExtractedImage {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
  kind: number; // 1=GRAYSCALE, 2=RGB, 3=RGBA
}

function imageDataToCanvas(imgData: ExtractedImage): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = imgData.width;
  canvas.height = imgData.height;
  const ctx = canvas.getContext("2d")!;

  const imageData = ctx.createImageData(imgData.width, imgData.height);
  const src = imgData.data;
  const dst = imageData.data;

  if (imgData.kind === 3) {
    // RGBA
    dst.set(src);
  } else if (imgData.kind === 2) {
    // RGB → RGBA
    let si = 0;
    let di = 0;
    for (let i = 0; i < imgData.width * imgData.height; i++) {
      dst[di++] = src[si++];
      dst[di++] = src[si++];
      dst[di++] = src[si++];
      dst[di++] = 255;
    }
  } else {
    // Grayscale → RGBA
    let si = 0;
    let di = 0;
    for (let i = 0; i < imgData.width * imgData.height; i++) {
      const v = src[si++];
      dst[di++] = v;
      dst[di++] = v;
      dst[di++] = v;
      dst[di++] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function canvasToBase64(canvas: HTMLCanvasElement): string {
  const dataUrl = canvas.toDataURL("image/png");
  return dataUrl.split(",")[1];
}

function canvasToBlobUrl(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(URL.createObjectURL(blob!));
    }, "image/png");
  });
}

/**
 * Extract individual embedded images from a PDF page.
 * Returns ImageElement[] with position/size info relative to the page.
 */
export async function extractImagesFromPage(
  page: PDFPageProxy
): Promise<ImageElement[]> {
  const viewport = page.getViewport({ scale: 1.0 });
  const opList = await page.getOperatorList();
  const imageElements: ImageElement[] = [];

  // Track the current transformation matrix to get image positions
  const transformStack: number[][] = [];
  let currentTransform = [1, 0, 0, 1, 0, 0]; // identity

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i];

    if (fn === OPS.save) {
      transformStack.push([...currentTransform]);
    } else if (fn === OPS.restore) {
      currentTransform = transformStack.pop() || [1, 0, 0, 1, 0, 0];
    } else if (fn === OPS.transform) {
      // Multiply current transform by new transform
      const [a, b, c, d, e, f] = args as number[];
      const [ca, cb, cc, cd, ce, cf] = currentTransform;
      currentTransform = [
        ca * a + cc * b,
        cb * a + cd * b,
        ca * c + cc * d,
        cb * c + cd * d,
        ca * e + cc * f + ce,
        cb * e + cd * f + cf,
      ];
    } else if (
      fn === OPS.paintImageXObject ||
      fn === OPS.paintImageXObjectRepeat
    ) {
      const imgName = args[0] as string;

      try {
        const imgData = await new Promise<ExtractedImage>((resolve, reject) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (page as any).objs.get(imgName, (data: ExtractedImage | null) => {
            if (data) resolve(data);
            else reject(new Error(`Image ${imgName} not found`));
          });
        });

        // Skip very small images (likely decorative/icons less than 10x10)
        if (imgData.width < 10 || imgData.height < 10) continue;

        // Get position from current transform matrix
        // Transform: [scaleX, skewY, skewX, scaleY, translateX, translateY]
        const [scaleX, , , scaleY, tx, ty] = currentTransform;

        const imgWidthPt = Math.abs(scaleX);
        const imgHeightPt = Math.abs(scaleY);

        // Convert to percentage of page
        const x = (tx / viewport.width) * 100;
        const y = ((viewport.height - ty - imgHeightPt) / viewport.height) * 100;
        const width = (imgWidthPt / viewport.width) * 100;
        const height = (imgHeightPt / viewport.height) * 100;

        // Skip images that cover more than 95% of the page (likely full-page backgrounds)
        if (width > 95 && height > 95) continue;

        // Convert image data to canvas, then to base64 and blob URL
        const canvas = imageDataToCanvas(imgData);
        const base64 = canvasToBase64(canvas);
        const blobUrl = await canvasToBlobUrl(canvas);

        imageElements.push({
          id: uuidv4(),
          imageUrl: blobUrl,
          imageBase64: base64,
          mimeType: "image/png",
          x: Math.max(0, Math.min(100, x)),
          y: Math.max(0, Math.min(100, y)),
          width: Math.max(1, Math.min(100, width)),
          height: Math.max(1, Math.min(100, height)),
          originalWidth: imgData.width,
          originalHeight: imgData.height,
        });
      } catch (err) {
        console.warn(`Failed to extract image ${imgName}:`, err);
      }
    }
  }

  return imageElements;
}
