import mammoth from "mammoth";
import { v4 as uuidv4 } from "uuid";
import type { Slide, TextElement, ImageElement } from "@/types/presentation";

interface MammothImage {
  read: (type: "base64") => Promise<string>;
  contentType: string;
}

interface DocxParseResult {
  slides: Slide[];
}

/**
 * Parse a DOCX file and extract text + images.
 * Each "section" (separated by page breaks or headings) becomes a slide.
 * Images are extracted as individual ImageElement objects.
 */
export async function loadDocx(
  arrayBuffer: ArrayBuffer,
  onProgress?: (current: number, total: number) => void
): Promise<DocxParseResult> {
  // Extract images from DOCX
  const extractedImages: {
    base64: string;
    mimeType: string;
    blobUrl: string;
    width: number;
    height: number;
  }[] = [];

  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      convertImage: mammoth.images.imgElement(async (image: MammothImage) => {
        const base64 = await image.read("base64");
        const mimeType = image.contentType || "image/png";
        const dataUrl = `data:${mimeType};base64,${base64}`;

        // Get image dimensions
        const dims = await getImageDimensions(dataUrl);

        const blob = base64ToBlob(base64, mimeType);
        const blobUrl = URL.createObjectURL(blob);

        extractedImages.push({
          base64,
          mimeType,
          blobUrl,
          width: dims.width,
          height: dims.height,
        });

        return { src: blobUrl };
      }),
    }
  );

  const html = result.value;

  // Parse HTML to extract structured content
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // Split content into slides based on headings or page breaks
  const slides: Slide[] = [];
  const slideWidth = 960;  // virtual slide width
  const slideHeight = 540; // virtual slide height (16:9)

  // Group content by sections (each h1/h2 starts a new slide)
  const sections = splitIntoSections(doc.body);
  const totalSections = Math.max(sections.length, 1);

  for (let i = 0; i < sections.length; i++) {
    onProgress?.(i + 1, totalSections);

    const section = sections[i];
    const textElements: TextElement[] = [];
    const imageElements: ImageElement[] = [];

    let currentY = 5; // Start at 5% from top

    for (const node of section.elements) {
      if (node.type === "heading") {
        const fontSizePt = node.level === 1 ? 32 : node.level === 2 ? 24 : 20;
        const fontSize = (fontSizePt / slideHeight) * 100; // convert pt to % of slide height
        const height = fontSize * 1.3;

        textElements.push({
          id: uuidv4(),
          text: node.text.normalize("NFC"),
          textKo: "",
          textJa: "",
          x: 5,
          y: currentY,
          width: 90,
          height: Math.max(height, 5),
          fontSize,
          fontColor: "#000000",
          fontWeight: "bold",
          textAlign: "left",
          isEdited: false,
        });

        currentY += height + 2;
      } else if (node.type === "paragraph") {
        if (!node.text.trim()) continue;

        const fontSizePt = 16;
        const fontSize = (fontSizePt / slideHeight) * 100; // convert pt to % of slide height
        const lineCount = Math.ceil(node.text.length / 60);
        const height = Math.max(fontSize * 1.3 * lineCount, 4);

        textElements.push({
          id: uuidv4(),
          text: node.text.normalize("NFC"),
          textKo: "",
          textJa: "",
          x: 5,
          y: currentY,
          width: 90,
          height: Math.min(height, 40),
          fontSize,
          fontColor: "#333333",
          fontWeight: "normal",
          textAlign: "left",
          isEdited: false,
        });

        currentY += height + 1;
      } else if (node.type === "list") {
        const fontSizePt = 16;
        const fontSize = (fontSizePt / slideHeight) * 100; // convert pt to % of slide height
        const text = node.items.join("\n");
        const lineCount = node.items.length;
        const height = Math.max(fontSize * 1.3 * lineCount, 4);

        textElements.push({
          id: uuidv4(),
          text: text.normalize("NFC"),
          textKo: "",
          textJa: "",
          x: 7,
          y: currentY,
          width: 86,
          height: Math.min(height, 50),
          fontSize,
          fontColor: "#333333",
          fontWeight: "normal",
          textAlign: "left",
          isEdited: false,
        });

        currentY += height + 1;
      } else if (node.type === "image") {
        const imgIdx = node.imageIndex;
        if (imgIdx >= 0 && imgIdx < extractedImages.length) {
          const img = extractedImages[imgIdx];
          // Scale image to fit within slide
          const imgAspect = img.width / img.height;
          let imgWidth = 60; // % of slide width
          let imgHeight = imgWidth / imgAspect * (slideWidth / slideHeight);

          if (imgHeight > 50) {
            imgHeight = 50;
            imgWidth = imgHeight * imgAspect * (slideHeight / slideWidth);
          }

          imageElements.push({
            id: uuidv4(),
            imageUrl: img.blobUrl,
            imageBase64: img.base64,
            mimeType: img.mimeType,
            x: (100 - imgWidth) / 2, // center horizontally
            y: currentY,
            width: imgWidth,
            height: imgHeight,
            originalWidth: img.width,
            originalHeight: img.height,
          });

          currentY += imgHeight + 2;
        }
      }

      // If content exceeds page, start new slide
      if (currentY > 90 && i < sections.length - 1) {
        break;
      }
    }

    // Create a blank white background for the slide
    const bgCanvas = document.createElement("canvas");
    bgCanvas.width = slideWidth;
    bgCanvas.height = slideHeight;
    const bgCtx = bgCanvas.getContext("2d")!;
    bgCtx.fillStyle = "#ffffff";
    bgCtx.fillRect(0, 0, slideWidth, slideHeight);

    const bgBlob = await new Promise<Blob>((resolve) =>
      bgCanvas.toBlob((b) => resolve(b!), "image/png")
    );
    const backgroundImage = URL.createObjectURL(bgBlob);

    // Create thumbnail
    const thumbCanvas = document.createElement("canvas");
    thumbCanvas.width = Math.round(slideWidth * 0.3);
    thumbCanvas.height = Math.round(slideHeight * 0.3);
    const thumbCtx = thumbCanvas.getContext("2d")!;
    thumbCtx.fillStyle = "#ffffff";
    thumbCtx.fillRect(0, 0, thumbCanvas.width, thumbCanvas.height);

    const thumbBlob = await new Promise<Blob>((resolve) =>
      thumbCanvas.toBlob((b) => resolve(b!), "image/png")
    );
    const thumbnailImage = URL.createObjectURL(thumbBlob);

    slides.push({
      id: uuidv4(),
      pageIndex: i,
      backgroundImage,
      thumbnailImage,
      textElements,
      imageElements,
      width: slideWidth,
      height: slideHeight,
    });
  }

  // If no sections were found, create a single empty slide
  if (slides.length === 0) {
    const bgCanvas = document.createElement("canvas");
    bgCanvas.width = slideWidth;
    bgCanvas.height = slideHeight;
    const bgCtx = bgCanvas.getContext("2d")!;
    bgCtx.fillStyle = "#ffffff";
    bgCtx.fillRect(0, 0, slideWidth, slideHeight);

    const bgBlob = await new Promise<Blob>((resolve) =>
      bgCanvas.toBlob((b) => resolve(b!), "image/png")
    );

    slides.push({
      id: uuidv4(),
      pageIndex: 0,
      backgroundImage: URL.createObjectURL(bgBlob),
      thumbnailImage: URL.createObjectURL(bgBlob),
      textElements: [],
      imageElements: [],
      width: slideWidth,
      height: slideHeight,
    });
  }

  return { slides };
}

interface ContentNode {
  type: "heading" | "paragraph" | "list" | "image";
  text: string;
  level: number;
  items: string[];
  imageIndex: number;
}

interface Section {
  elements: ContentNode[];
}

function splitIntoSections(body: HTMLElement): Section[] {
  const sections: Section[] = [];
  let currentSection: Section = { elements: [] };
  let imageCounter = 0;

  const children = Array.from(body.children);

  for (const child of children) {
    const tag = child.tagName.toLowerCase();

    // Start new section on h1/h2
    if ((tag === "h1" || tag === "h2") && currentSection.elements.length > 0) {
      sections.push(currentSection);
      currentSection = { elements: [] };
    }

    if (tag.startsWith("h")) {
      const level = parseInt(tag[1]) || 3;
      currentSection.elements.push({
        type: "heading",
        text: child.textContent || "",
        level,
        items: [],
        imageIndex: -1,
      });
    } else if (tag === "p") {
      // Check for images inside paragraph
      const imgs = child.querySelectorAll("img");
      if (imgs.length > 0) {
        for (const img of imgs) {
          currentSection.elements.push({
            type: "image",
            text: "",
            level: 0,
            items: [],
            imageIndex: imageCounter++,
          });
          // Also add any text in the same paragraph
          const textContent = Array.from(child.childNodes)
            .filter((n) => n.nodeType === Node.TEXT_NODE)
            .map((n) => n.textContent)
            .join("")
            .trim();
          if (textContent) {
            currentSection.elements.push({
              type: "paragraph",
              text: textContent,
              level: 0,
              items: [],
              imageIndex: -1,
            });
          }
        }
      } else {
        currentSection.elements.push({
          type: "paragraph",
          text: child.textContent || "",
          level: 0,
          items: [],
          imageIndex: -1,
        });
      }
    } else if (tag === "ul" || tag === "ol") {
      const items = Array.from(child.querySelectorAll("li")).map(
        (li) => `• ${li.textContent?.trim() || ""}`
      );
      if (items.length > 0) {
        currentSection.elements.push({
          type: "list",
          text: items.join("\n"),
          level: 0,
          items,
          imageIndex: -1,
        });
      }
    } else if (tag === "table") {
      // Convert table to text
      const rows = Array.from(child.querySelectorAll("tr"));
      const tableText = rows
        .map((row) =>
          Array.from(row.querySelectorAll("td, th"))
            .map((cell) => cell.textContent?.trim() || "")
            .join(" | ")
        )
        .join("\n");
      if (tableText.trim()) {
        currentSection.elements.push({
          type: "paragraph",
          text: tableText,
          level: 0,
          items: [],
          imageIndex: -1,
        });
      }
    }
  }

  // Push last section
  if (currentSection.elements.length > 0) {
    sections.push(currentSection);
  }

  return sections;
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteString = atob(base64);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeType });
}

function getImageDimensions(
  dataUrl: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      resolve({ width: 200, height: 200 }); // fallback
    };
    img.src = dataUrl;
  });
}
