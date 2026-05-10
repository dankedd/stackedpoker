"""
OpenCV-based image preprocessing pipeline.

Enhances screenshot quality before OCR and AI extraction.
Soft dependency: if opencv-python-headless is not installed, returns the
original image bytes unchanged (passthrough mode).

Install: pip install opencv-python-headless
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

try:
    import cv2
    import numpy as np
    _CV2_OK = True
except ImportError:
    _CV2_OK = False
    logger.info("opencv-python-headless not installed — image preprocessing disabled (passthrough)")


@dataclass
class ProcessedImage:
    data: bytes
    mime_type: str
    width: int
    height: int
    applied: list[str] = field(default_factory=list)
    original_size: tuple[int, int] = (0, 0)


def preprocess_screenshot(image_bytes: bytes, mime_type: str = "image/png") -> ProcessedImage:
    """
    Preprocess a poker screenshot for better AI + OCR accuracy.

    Applied operations (when OpenCV is available):
      1. Decode image
      2. Resize to ≤1920px wide (API-friendly, preserves aspect ratio)
      3. CLAHE contrast enhancement in LAB color space
      4. Mild fast denoising
      5. Re-encode as PNG

    Falls back to passthrough if OpenCV is not available or if decoding fails.
    """
    if not _CV2_OK:
        return ProcessedImage(data=image_bytes, mime_type=mime_type, width=0, height=0,
                              applied=["passthrough_no_opencv"])

    applied: list[str] = []

    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)

    if img is None:
        logger.warning("OpenCV could not decode image — using original bytes")
        return ProcessedImage(data=image_bytes, mime_type=mime_type, width=0, height=0,
                              applied=["passthrough_decode_failed"])

    h, w = img.shape[:2]
    original_size = (w, h)

    # Step 1: Resize if wider than 1920px
    if w > 1920:
        scale = 1920 / w
        new_w, new_h = 1920, int(h * scale)
        img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)
        applied.append(f"resize_{w}x{h}→{new_w}x{new_h}")
        h, w = new_h, new_w
    else:
        applied.append(f"original_{w}x{h}")

    # Step 2: CLAHE contrast enhancement
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l_ch, a_ch, b_ch = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l_ch = clahe.apply(l_ch)
    img = cv2.cvtColor(cv2.merge([l_ch, a_ch, b_ch]), cv2.COLOR_LAB2BGR)
    applied.append("clahe_contrast")

    # Step 3: Fast denoising (h=5 is mild, keeps text sharp)
    img = cv2.fastNlMeansDenoisingColored(img, None, h=5, hColor=5,
                                          templateWindowSize=7, searchWindowSize=21)
    applied.append("fast_denoise")

    # Re-encode as PNG for lossless quality
    ok, encoded = cv2.imencode(".png", img)
    if not ok:
        logger.warning("OpenCV re-encoding failed — using original bytes")
        return ProcessedImage(data=image_bytes, mime_type=mime_type, width=w, height=h,
                              applied=["passthrough_encode_failed"])

    applied.append("encode_png")
    logger.debug("Preprocessing applied: %s", ", ".join(applied))

    return ProcessedImage(
        data=encoded.tobytes(),
        mime_type="image/png",
        width=w,
        height=h,
        applied=applied,
        original_size=original_size,
    )
