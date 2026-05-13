"""
Two-step poker hand extraction + confirmation endpoints.

POST /api/extract-hand
  Input:  multipart image upload
  Output: ExtractionResult — raw extracted state with confidence scores
  Purpose: Phase 1+2. Returns data for user to review/edit in the frontend.

POST /api/confirm-hand
  Input:  ConfirmedPokerState (user-validated JSON)
  Output: VisionAnalysisResponse — full replay + coaching
  Purpose: Phase 3+4. Coaching runs against user-confirmed clean data.
"""
from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.middleware.auth import get_optional_user
from app.services.supabase_persistence import save_image_analysis
from app.models.schemas import (
    BoardCards,
    ConfirmedPokerState,
    ExtractionResult,
    ExtractedAction,
    ExtractedCard,
    ExtractedPlayer,
    ValidationInfo,
    VisionAnalysisResponse,
)
from app.services.hand_reconstructor import (
    POSITIONS_6MAX,
    identify_hero,
    normalize_card,
    normalize_pos,
)
from app.services.money_normalizer import (
    parse_amount,
    parse_stakes,
    validate_stack_bb,
)
from app.services.image_preprocessor import preprocess_screenshot
from app.services.ocr_extractor import extract_text
from app.services.vision_extractor import extract_raw
from app.services.vision_coach import coach_confirmed

logger = logging.getLogger(__name__)
router = APIRouter()

_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
_MAX_BYTES = 10 * 1024 * 1024


# ── POST /api/extract-hand ─────────────────────────────────────────────────

@router.post("/extract-hand", response_model=ExtractionResult, tags=["extraction"])
async def extract_hand(file: UploadFile = File(...)) -> ExtractionResult:
    """
    Phase 1+2: extract raw poker state from screenshot.
    Returns ExtractionResult for frontend review — NO coaching yet.
    """
    if file.content_type not in _ALLOWED_TYPES:
        raise HTTPException(415, f"Unsupported file type '{file.content_type}'")

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(400, "Uploaded file is empty")
    if len(image_bytes) > _MAX_BYTES:
        raise HTTPException(413, "File exceeds 10 MB limit")

    logger.info(
        "extract-hand: file=%s type=%s size=%d",
        file.filename, file.content_type, len(image_bytes),
    )

    try:
        # Phase 1a: OpenCV preprocessing (optional)
        processed = preprocess_screenshot(image_bytes, file.content_type or "image/png")

        # Phase 1b: OCR text extraction (optional)
        ocr = extract_text(processed.data)

        # Phase 1c: AI raw extraction
        raw = await extract_raw(processed.data, processed.mime_type, ocr.context_snippet)

        # Phase 2: deterministic reconstruction into ExtractionResult
        warnings: list[str] = []
        errors: list[str] = []
        confidence = raw.extraction_confidence

        # ── Parse stakes first — everything else depends on this ──────────
        stakes = parse_stakes(raw.stakes_text)
        if stakes:
            logger.info(
                "Stakes: SB=%.4f BB=%.4f currency=%s",
                stakes.small_blind, stakes.big_blind, stakes.currency or "unitless",
            )
        elif raw.stakes_text:
            warnings.append(
                f"Could not parse stakes '{raw.stakes_text}' — "
                "currency amounts will be treated as bb values"
            )
            confidence -= 0.05

        # ── Normalize positions ──────────────────────────────────────────
        norm_positions: list[str] = []
        for p in raw.players:
            norm = normalize_pos(p.position_label)
            if norm not in POSITIONS_6MAX:
                warnings.append(f"Unknown position '{p.position_label}' for '{p.label}'")
                confidence -= 0.05
            norm_positions.append(norm)

        if len(norm_positions) != len(set(norm_positions)) and norm_positions:
            warnings.append("Duplicate seat positions detected — screenshot may be ambiguous")
            confidence -= 0.10

        # ── Identify hero ────────────────────────────────────────────────
        hero_idx, hero_method = identify_hero(raw.players)

        # ── Build ExtractedPlayer list ───────────────────────────────────
        extracted_players: list[ExtractedPlayer] = []
        for i, (p, norm_pos) in enumerate(zip(raw.players, norm_positions)):
            is_hero = (i == hero_idx)

            cards = [
                ExtractedCard(card=nc, confidence=0.9)
                for c in p.cards
                if (nc := normalize_card(c)) is not None
            ]

            hero_sigs: list[str] = []
            if p.hero_signal:
                hero_sigs.append("hero_badge")
            if "hero" in p.label.lower():
                hero_sigs.append("hero_label")
            if len(p.cards) == 2:
                hero_sigs.append("has_cards")

            # Stakes-aware stack parsing
            stack_pa = parse_amount(p.stack_text, stakes) if p.stack_text else None
            stack_bb = stack_pa.amount_bb if stack_pa else None

            if is_hero and stack_bb is not None:
                validate_stack_bb(stack_bb, warnings, label=f"Player '{p.label}' stack")

            extracted_players.append(ExtractedPlayer(
                name=p.label,
                position_raw=p.position_label,
                position=norm_pos,
                position_confidence=0.9 if norm_pos in POSITIONS_6MAX else 0.4,
                cards=cards,
                stack_text=p.stack_text,
                stack_bb=stack_bb,
                is_hero=is_hero,
                hero_confidence=(
                    0.95 if p.hero_signal
                    else 0.75 if "hero" in p.label.lower()
                    else 0.5
                ),
                hero_signals=hero_sigs,
            ))

        # ── Normalize board ──────────────────────────────────────────────
        flop  = [nc for c in raw.flop  if (nc := normalize_card(c))]
        turn  = [nc for c in raw.turn  if (nc := normalize_card(c))]
        river = [nc for c in raw.river if (nc := normalize_card(c))]

        # ── Duplicate card check ─────────────────────────────────────────
        all_hero_cards    = [ec.card for ep in extracted_players if ep.is_hero     for ec in ep.cards]
        all_villain_cards = [ec.card for ep in extracted_players if not ep.is_hero for ec in ep.cards]
        seen: set[str] = set()
        for c in all_hero_cards + all_villain_cards + flop + turn + river:
            if c in seen:
                errors.append(f"Duplicate card: {c}")
                confidence -= 0.15
            seen.add(c)

        # ── Build extracted actions with stakes-aware amounts ────────────
        extracted_actions: list[ExtractedAction] = []
        for idx, a in enumerate(raw.actions):
            pa = parse_amount(a.amount_text, stakes) if a.amount_text else None
            extracted_actions.append(ExtractedAction(
                player_name=a.player_label,
                action=a.action,
                amount_text=a.amount_text,
                amount_usd=pa.amount_usd if pa else None,
                amount_bb=pa.amount_bb if pa else None,
                street=a.street,
                sequence_idx=idx,
            ))

        # ── Hero effective stack ─────────────────────────────────────────
        hero_player = next((ep for ep in extracted_players if ep.is_hero), None)
        hero_stack = hero_player.stack_bb if hero_player and hero_player.stack_bb else 100.0

        confidence = round(max(0.05, min(1.0, confidence - len(errors) * 0.1)), 2)

        logger.info(
            "extract-hand complete: %d players, hero=%s, BB=%s, "
            "confidence=%.2f, warnings=%d, errors=%d",
            len(extracted_players), hero_method,
            f"{stakes.big_blind}" if stakes else "unknown",
            confidence, len(warnings), len(errors),
        )

        return ExtractionResult(
            players=extracted_players,
            actions=extracted_actions,
            board=BoardCards(flop=flop, turn=turn, river=river),
            pot_text=raw.pot_text,
            stakes=raw.stakes_text,
            big_blind=stakes.big_blind if stakes else None,
            currency=stakes.currency if stakes else "",
            effective_stack_bb=hero_stack,
            overall_confidence=confidence,
            hero_detected_by=hero_method,
            warnings=warnings,
            errors=errors,
            ocr_available=ocr.available,
            preprocessing_applied=processed.applied,
        )

    except ValueError as exc:
        logger.error("extract-hand error: %s", exc)
        raise HTTPException(503, str(exc))
    except Exception:
        logger.exception("extract-hand unexpected failure for '%s'", file.filename)
        raise HTTPException(500, "Extraction failed. Please try again.")


# ── POST /api/confirm-hand ─────────────────────────────────────────────────

@router.post("/confirm-hand", response_model=VisionAnalysisResponse, tags=["extraction"])
async def confirm_hand(
    state: ConfirmedPokerState,
    current_user: Annotated[dict | None, Depends(get_optional_user)] = None,
) -> VisionAnalysisResponse:
    """
    Phase 3+4: coaching + replay from user-confirmed poker state.
    Data is treated as ground truth — confidence = 1.0.
    """
    logger.info(
        "confirm-hand: hero=%s %s %s, villain=%s %s, actions=%d",
        state.hero_name, state.hero_position, state.hero_cards,
        state.villain_name, state.villain_position, len(state.actions),
    )

    try:
        analysis, validation = await coach_confirmed(state)
        logger.info(
            "confirm-hand complete: %d replay actions, score=%d",
            len(analysis.actions), analysis.overall_verdict.score,
        )
    except ValueError as exc:
        logger.error("confirm-hand error: %s", exc)
        raise HTTPException(503, str(exc))
    except Exception:
        logger.exception("confirm-hand unexpected failure")
        raise HTTPException(500, "Coaching failed. Please try again.")

    response = VisionAnalysisResponse(
        filename="confirmed",
        mime_type="application/json",
        file_size_bytes=0,
        analysis=analysis,
        validation=validation,
    )

    # Persist if the user is authenticated (best-effort)
    if current_user:
        user_id: str = current_user.get("sub", "")
        try:
            await save_image_analysis(user_id, response)
        except Exception:
            logger.warning("Image analysis Supabase persist failed for user %s", user_id)

    return response
