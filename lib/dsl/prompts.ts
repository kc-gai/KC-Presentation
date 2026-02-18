/**
 * Claude DSL Generation Prompts
 *
 * SlideIR → SlideDSL 변환을 위한 Claude 프롬프트 템플릿.
 */

import type { SlideIR } from "@/types/slide-ir";

/**
 * 시스템 프롬프트 (고정)
 */
export const SYSTEM_PROMPT = `You are "Slide Compiler" — an expert system that converts document analysis data into PowerPoint-ready JSON DSL.

Your input is a SlideIR (intermediate representation) of a single presentation slide.
Your output is a SlideDSL JSON that a PPT/DOC generator can directly consume.

GOAL: Produce output that looks like a "professionally designed PPT" — same meaning, similar layout, consistent design system.

NEVER try to inpaint or restore original images. Rebuild everything as PPT components (shapes, text boxes, tables, icons, images).

CONSTRAINTS:
- Output ONLY valid JSON (no markdown, no explanation, no code blocks)
- Coordinates are in pt units (0 to widthPt/heightPt)
- Text must always be in "text" elements (never embedded in shapes)
- Tables must use "table" elements with proper row/column structure
- Icons use "iconName" (Lucide icon names) — actual SVG mapping happens separately
- Layer order: elements array order = rendering order (background first, text last)

DSL SCHEMA:
{
  "pageIndex": number,
  "size": { "widthPt": number, "heightPt": number },
  "theme": {
    "palette": { "primary": "#hex", "accent": "#hex", "danger": "#hex", "text": "#hex", "mutedText": "#hex", "bg": "#hex" },
    "fonts": { "title": "font name", "body": "font name" },
    "defaults": { "titleSize": number, "bodySize": number, "lineHeight": number }
  },
  "elements": [
    { "type": "background", "fill": { "kind": "solid"|"linearGradient", "color": "#hex", "gradient": { "from": [x,y], "to": [x,y], "stops": [{"pos":0,"color":"#hex"},...] } } },
    { "type": "panel", "id": "str", "bbox": {"x":n,"y":n,"w":n,"h":n}, "style": { "radius":n, "stroke":"#hex", "strokeWidth":n, "fill":"#hex", "shadow":bool } },
    { "type": "text", "id": "str", "bbox": {"x":n,"y":n,"w":n,"h":n}, "text": "str", "style": { "font":"title"|"body", "size":n, "bold":bool, "italic":bool, "color":"#hex", "align":"left"|"center"|"right", "valign":"top"|"middle"|"bottom", "lineHeight":n }, "listItems": ["str",...] },
    { "type": "table", "id": "str", "bbox": {"x":n,"y":n,"w":n,"h":n}, "rows": [[{"text":"str","style":{...}},...]], "style": { "grid":"#hex", "headerFill":"#hex", "cellPadding":n, "fontSize":n } },
    { "type": "icon", "id": "str", "bbox": {"x":n,"y":n,"w":n,"h":n}, "iconName": "str", "style": { "color":"#hex" } },
    { "type": "image", "id": "str", "bbox": {"x":n,"y":n,"w":n,"h":n}, "ref": "asset://..." },
    { "type": "divider", "id": "str", "bbox": {"x":n,"y":n,"w":n,"h":n}, "style": { "color":"#hex", "width":n, "direction":"horizontal"|"vertical" } }
  ],
  "notes": { "uncertain": [{ "reason": "str", "bbox": {...}, "suggestion": "str" }] }
}`;

/**
 * 작업 프롬프트 생성 (페이지별)
 */
export function buildTaskPrompt(slideIR: SlideIR): string {
  // SlideIR을 간결한 JSON으로 직렬화
  const input = {
    pageIndex: slideIR.pageIndex,
    size: slideIR.size,
    background: slideIR.background,
    layoutPattern: slideIR.layoutPattern,
    theme: {
      palette: slideIR.theme.palette,
      fonts: slideIR.theme.fonts,
      defaults: slideIR.theme.defaults,
    },
    textBlocks: slideIR.textBlocks.map((b) => ({
      id: b.id,
      role: b.role,
      text: b.text,
      bbox: b.bbox,
      style: b.style,
      listItems: b.listItems,
      parentId: b.parentId,
    })),
    tables: slideIR.tables.map((t) => ({
      id: t.id,
      bbox: t.bbox,
      rows: t.rows,
    })),
    shapes: slideIR.shapes.map((s) => ({
      id: s.id,
      type: s.type,
      bbox: s.bbox,
      style: s.style,
      containedElements: s.containedElements,
    })),
    icons: slideIR.icons.map((i) => ({
      id: i.id,
      bbox: i.bbox,
      description: i.description,
      suggestedName: i.suggestedName,
      color: i.color,
    })),
    figures: slideIR.figures.map((f) => ({
      id: f.id,
      bbox: f.bbox,
      description: f.description,
      type: f.type,
    })),
  };

  return `[INPUT]
${JSON.stringify(input, null, 2)}
[/INPUT]

[TASK]
1. Convert this slide analysis into a PPT-ready DSL following the schema exactly.
2. Order elements as: background → panels/cards/shapes → tables → icons → images → text (front-to-back layering).
3. Distinguish title (large, bold) from body text. Merge body text that belongs together into paragraphs.
4. For bullet lists, use the "listItems" field in text elements.
5. If something looks like a table, output it as a "table" element. If uncertain, add to notes.uncertain.
6. Map icons to Lucide icon names (e.g., "alert-triangle", "bar-chart-2", "shield", "clock", "users").
7. Ensure no text overflows its bbox — adjust size if needed.
8. Preserve the design system: use theme colors, consistent spacing, proper alignment.

[OUTPUT]`;
}

/**
 * 리페어 프롬프트 (QA 실패 시)
 */
export function buildRepairPrompt(
  originalDSL: string,
  issues: { type: string; elementIds: string[]; details: string }[]
): string {
  const issueText = issues
    .map((i) => `- ${i.type}: elements [${i.elementIds.join(", ")}] — ${i.details}`)
    .join("\n");

  return `The following quality issues were detected in this slide DSL:

${issueText}

Fix rules:
- Text overflow: reduce fontSize by 1-2pt OR increase bbox height (minimize layout disruption)
- Overlapping elements: nudge panels/images by up to 12pt → if still overlapping, adjust text wrapping/size
- Alignment issues: snap to nearest grid (multiples of 6pt)

Return the COMPLETE fixed JSON DSL (not just the changed parts).

Original DSL:
${originalDSL}`;
}
