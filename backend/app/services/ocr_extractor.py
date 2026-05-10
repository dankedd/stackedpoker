"""
EasyOCR-based text extraction from poker screenshots.

Extracts all visible text regions with bounding boxes and confidence scores.
The OCR output is passed as context to the AI extraction prompt, reducing
hallucination and improving positional accuracy.

Soft dependency: if easyocr is not installed, returns an empty OCRResult
(the pipeline falls back to AI-only extraction).

Install: pip install easyocr
Note: first run downloads ~500MB of model weights.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

try:
    import easyocr
    import numpy as np
    _EASYOCR_OK = True
except ImportError:
    _EASYOCR_OK = False
    logger.info("easyocr not installed — OCR text extraction disabled")

_reader: "easyocr.Reader | None" = None  # lazy singleton


def _get_reader() -> "easyocr.Reader | None":
    global _reader
    if not _EASYOCR_OK:
        return None
    if _reader is None:
        logger.info("Initializing EasyOCR (first call loads model weights — may take ~5s)")
        _reader = easyocr.Reader(["en"], gpu=False, verbose=False)
    return _reader


@dataclass
class TextRegion:
    text: str
    confidence: float
    center_x: float
    center_y: float
    width_px: float
    height_px: float


@dataclass
class OCRResult:
    regions: list[TextRegion] = field(default_factory=list)
    available: bool = False
    context_snippet: str = ""   # ≤500 chars of high-confidence text for AI prompt


def extract_text(image_bytes: bytes) -> OCRResult:
    """
    Extract all text regions from a poker screenshot.

    Returns OCRResult with:
    - regions: sorted top-to-bottom, left-to-right
    - context_snippet: high-confidence text joined for use in AI prompt
    """
    reader = _get_reader()
    if reader is None:
        return OCRResult(available=False)

    try:
        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        raw_results = reader.readtext(arr, detail=1, paragraph=False)

        regions: list[TextRegion] = []
        high_conf_texts: list[str] = []

        for bbox, text, conf in raw_results:
            text = text.strip()
            if not text or conf < 0.25:
                continue

            xs = [pt[0] for pt in bbox]
            ys = [pt[1] for pt in bbox]
            cx = sum(xs) / 4
            cy = sum(ys) / 4
            w = max(xs) - min(xs)
            h = max(ys) - min(ys)

            regions.append(TextRegion(
                text=text,
                confidence=round(conf, 3),
                center_x=cx,
                center_y=cy,
                width_px=w,
                height_px=h,
            ))

            if conf >= 0.6:
                high_conf_texts.append(text)

        # Sort top-to-bottom, left-to-right
        regions.sort(key=lambda r: (round(r.center_y / 20) * 20, r.center_x))

        context = " | ".join(high_conf_texts)[:500]
        logger.info("OCR extracted %d regions, %d high-conf", len(regions), len(high_conf_texts))

        return OCRResult(regions=regions, available=True, context_snippet=context)

    except Exception as exc:
        logger.error("OCR extraction error: %s", exc)
        return OCRResult(available=False)
