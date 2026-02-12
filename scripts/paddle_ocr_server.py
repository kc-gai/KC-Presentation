"""
PaddleOCR Local Server
======================
로컬에서 무료 OCR 처리를 위한 FastAPI 서버.
Gemini API 호출 없이 무제한 OCR 가능.

설치:
  pip install paddlepaddle paddleocr fastapi uvicorn python-multipart pillow

실행:
  python scripts/paddle_ocr_server.py

또는:
  uvicorn scripts.paddle_ocr_server:app --host 0.0.0.0 --port 8765
"""

import base64
import io
import json
import sys
from typing import List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image

app = FastAPI(title="PaddleOCR Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Lazy-load PaddleOCR (heavy import)
_ocr_engine = None


def get_ocr_engine():
    global _ocr_engine
    if _ocr_engine is None:
        from paddleocr import PaddleOCR

        _ocr_engine = PaddleOCR(
            use_angle_cls=True,
            lang="japan",  # japan covers CJK (Korean + Japanese + Chinese + English)
            show_log=False,
            use_gpu=False,  # CPU mode for compatibility; set True if CUDA available
        )
        print("[PaddleOCR] Engine initialized (lang=japan, CJK support)")
    return _ocr_engine


class OcrRequest(BaseModel):
    image: str  # base64 encoded JPEG


class TextBlock(BaseModel):
    text: str
    x: float
    y: float
    width: float
    height: float
    fontSize: float


class OcrResponse(BaseModel):
    textElements: List[TextBlock]
    engine: str = "paddleocr"


@app.get("/health")
def health():
    return {"status": "ok", "engine": "paddleocr"}


@app.post("/ocr", response_model=OcrResponse)
def ocr(req: OcrRequest):
    try:
        # Decode base64 image
        img_bytes = base64.b64decode(req.image)
        img = Image.open(io.BytesIO(img_bytes))
        img_width, img_height = img.size

        # Run PaddleOCR
        ocr_engine = get_ocr_engine()
        # Convert to RGB if needed (PaddleOCR expects RGB)
        if img.mode != "RGB":
            img = img.convert("RGB")

        import numpy as np

        img_array = np.array(img)
        results = ocr_engine.ocr(img_array, cls=True)

        text_elements: List[TextBlock] = []

        if not results or not results[0]:
            return OcrResponse(textElements=[])

        for line in results[0]:
            box = line[0]  # [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]
            text_info = line[1]  # (text, confidence)
            text = text_info[0]
            confidence = text_info[1]

            if confidence < 0.3 or not text.strip():
                continue

            # Convert box coordinates to percentage
            xs = [p[0] for p in box]
            ys = [p[1] for p in box]
            x_min, x_max = min(xs), max(xs)
            y_min, y_max = min(ys), max(ys)

            x_pct = (x_min / img_width) * 100
            y_pct = (y_min / img_height) * 100
            w_pct = ((x_max - x_min) / img_width) * 100
            h_pct = ((y_max - y_min) / img_height) * 100

            # Estimate font size from box height (relative to image)
            box_height_px = y_max - y_min
            font_size = max(8, min(72, round(box_height_px * 0.8)))

            text_elements.append(
                TextBlock(
                    text=text,
                    x=round(x_pct, 1),
                    y=round(y_pct, 1),
                    width=round(w_pct, 1),
                    height=round(h_pct, 1),
                    fontSize=font_size,
                )
            )

        # Merge nearby text blocks on same line
        text_elements = _merge_nearby_blocks(text_elements)

        return OcrResponse(textElements=text_elements)

    except Exception as e:
        print(f"[PaddleOCR] Error: {e}", file=sys.stderr)
        raise HTTPException(status_code=500, detail=str(e))


def _merge_nearby_blocks(blocks: List[TextBlock]) -> List[TextBlock]:
    """Merge text blocks that are on the same line and close together."""
    if len(blocks) <= 1:
        return blocks

    # Sort by y, then x
    sorted_blocks = sorted(blocks, key=lambda b: (b.y, b.x))
    merged = []
    cur = sorted_blocks[0].model_copy()

    for i in range(1, len(sorted_blocks)):
        blk = sorted_blocks[i]
        y_tol = max(cur.height, blk.height) * 0.7
        x_gap = blk.x - (cur.x + cur.width)

        if abs(blk.y - cur.y) <= y_tol and x_gap < 3:
            # Same line, merge
            space = " " if x_gap > 0.5 else ""
            cur.text += space + blk.text
            cur.width = max(cur.width, blk.x + blk.width - cur.x)
            cur.height = max(cur.height, blk.height)
            cur.fontSize = max(cur.fontSize, blk.fontSize)
        else:
            merged.append(cur)
            cur = blk.model_copy()

    merged.append(cur)
    return merged


if __name__ == "__main__":
    import uvicorn

    print("=" * 50)
    print("  PaddleOCR Server Starting...")
    print("  http://localhost:8765")
    print("  GET  /health  - Health check")
    print("  POST /ocr     - OCR processing")
    print("=" * 50)

    # Pre-load engine
    get_ocr_engine()

    uvicorn.run(app, host="0.0.0.0", port=8765)
