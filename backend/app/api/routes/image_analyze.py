"""
Image upload endpoint — accepts a poker screenshot and returns structured replay analysis.
"""
from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.middleware.auth import get_current_user
from app.models.schemas import VisionAnalysisResponse
from app.services.usage_service import assert_usage_allowed, get_user_profile
from app.services.vision_coach import analyze_image

logger = logging.getLogger(__name__)
router = APIRouter()

_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
_MAX_BYTES = 10 * 1024 * 1024  # 10 MB


@router.post("/analyze-image", response_model=VisionAnalysisResponse, tags=["analysis"])
async def analyze_hand_image(
    file: UploadFile = File(...),
    current_user: Annotated[dict, Depends(get_current_user)] = None,
) -> VisionAnalysisResponse:
    """
    Upload a poker hand screenshot (JPEG / PNG / WebP / GIF, max 10 MB).
    Requires authentication — usage quota is enforced server-side.
    """
    user_id: str = current_user.get("sub", "")
    profile = await get_user_profile(user_id)
    assert_usage_allowed(profile)

    if file.content_type not in _ALLOWED_TYPES:
        raise HTTPException(
            status_code=415,
            detail=(
                f"Unsupported file type '{file.content_type}'. "
                "Please upload a JPEG, PNG, WebP, or GIF image."
            ),
        )

    image_bytes = await file.read()

    if not image_bytes:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    if len(image_bytes) > _MAX_BYTES:
        raise HTTPException(
            status_code=413,
            detail="File exceeds the 10 MB limit. Please upload a smaller screenshot.",
        )

    logger.info(
        "analyze-image: user=%s file=%s type=%s size=%d bytes",
        user_id, file.filename, file.content_type, len(image_bytes),
    )

    try:
        analysis, validation = await analyze_image(image_bytes, file.content_type)
        logger.info(
            "analyze-image: %d actions, score=%d, confidence=%.2f, valid=%s, warnings=%d",
            len(analysis.actions), analysis.overall_verdict.score,
            validation.confidence, validation.is_valid, len(validation.warnings),
        )
        if validation.warnings:
            logger.warning("Reconstruction warnings: %s", "; ".join(validation.warnings))
        if validation.errors:
            logger.error("Reconstruction errors: %s", "; ".join(validation.errors))
    except ValueError as exc:
        logger.error("analyze-image error for user=%s: %s", user_id, exc)
        raise HTTPException(status_code=503, detail="Vision analysis unavailable. Please try again.")
    except Exception:
        logger.exception("Vision analysis failed for user=%s file='%s'", user_id, file.filename)
        raise HTTPException(
            status_code=500,
            detail="Vision analysis failed. Please try again or paste the hand history manually.",
        )

    return VisionAnalysisResponse(
        filename=file.filename or "screenshot",
        mime_type=file.content_type,
        file_size_bytes=len(image_bytes),
        analysis=analysis,
        validation=validation,
    )
