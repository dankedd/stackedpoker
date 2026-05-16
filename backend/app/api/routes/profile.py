"""
Player Profile API — GET /api/player-profile

Aggregates all stored hand analyses for the authenticated user and returns
a fully-computed PlayerProfile including stats, leaks, coaching advice,
and study recommendations.

Endpoints:
  GET  /api/player-profile           — full profile computation
  POST /api/player-profile/puzzle-complete  — track puzzle completion
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import get_settings
from app.middleware.auth import get_current_user
from app.models.schemas import (
    PlayerProfile,
    PlayerStats,
    PuzzleCompletionRequest,
)
from app.services import profile_service, leak_detector, coaching_engine, recommendation_engine

router = APIRouter()
logger = logging.getLogger(__name__)
_bearer = HTTPBearer(auto_error=False)


# ── GET /api/player-profile ────────────────────────────────────────────────────

@router.get("/player-profile", response_model=PlayerProfile, tags=["profile"])
async def get_player_profile(
    current_user: Annotated[dict, Depends(get_current_user)],
) -> PlayerProfile:
    """
    Compute and return the full player profile for the authenticated user.

    Steps:
      1. Fetch all hand_analyses from Supabase
      2. Compute aggregate PlayerStats
      3. Detect leaks from findings
      4. Derive stat-based leaks (VPIP/PFR/position gaps)
      5. Classify playing style and skill level
      6. Generate coaching advice
      7. Build study recommendations
      8. Identify strengths, weaknesses, tilt indicators
      9. Build AI summary text
    """
    user_id: str = current_user.get("sub", "")

    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user")

    logger.info("Computing player profile for user=%s", user_id)

    # ── 1. Fetch analyses ──────────────────────────────────────────────────────
    rows = await profile_service.fetch_analyses(user_id, limit=500)
    hand_rows = [r for r in rows if profile_service._is_hand_analysis(r)]

    sample_size = len(hand_rows)
    data_quality = coaching_engine.determine_data_quality(sample_size)

    # Insufficient data → return minimal profile with guidance
    if sample_size < 3:
        return PlayerProfile(
            user_id=user_id,
            generated_at=datetime.now(timezone.utc).isoformat(),
            style="Unknown",
            style_description=(
                "Analyse at least 5 hands to unlock your player profile. "
                "Paste hand histories or upload screenshots to get started."
            ),
            skill_level="beginner",
            overall_score=0.0,
            sample_size=sample_size,
            data_quality="insufficient",
            stats=PlayerStats(),
            ai_summary=(
                f"You have {sample_size} analysed hand(s) so far. Analyse at least 5 hands "
                "to generate your personalised profile, leaks, and coaching plan."
            ),
        )

    # ── 2. Compute stats ───────────────────────────────────────────────────────
    stats = profile_service.compute_stats(rows)

    # ── 3 & 4. Detect leaks ────────────────────────────────────────────────────
    finding_leaks = leak_detector.detect_leaks(hand_rows)
    stat_leaks    = leak_detector.derive_stat_leaks(stats)
    leaks         = leak_detector.merge_and_rank_leaks(finding_leaks, stat_leaks)

    # ── 5. Classify style & skill ──────────────────────────────────────────────
    style, style_desc = coaching_engine.classify_style(stats.vpip_pct, stats.pfr_pct)
    skill_level       = coaching_engine.determine_skill_level(stats.avg_score, stats.avg_mistakes_per_hand)

    # ── 6. Coaching advice ─────────────────────────────────────────────────────
    coaching_advice = coaching_engine.generate_coaching_advice(leaks, stats, style, skill_level)

    # ── 7. Study recommendations ───────────────────────────────────────────────
    study_recs = recommendation_engine.build_study_recommendations(leaks)

    # ── 8. Strengths / weaknesses / tilt ──────────────────────────────────────
    strengths, weaknesses = coaching_engine.identify_strengths_weaknesses(stats, leaks)
    tilt_indicators       = coaching_engine.detect_tilt_indicators(stats.score_trend)

    # ── 9. AI summary ─────────────────────────────────────────────────────────
    ai_summary = coaching_engine.build_ai_summary(style, style_desc, skill_level, stats, leaks)

    logger.info(
        "Profile computed: user=%s hands=%d leaks=%d style=%s skill=%s",
        user_id, sample_size, len(leaks), style, skill_level,
    )

    return PlayerProfile(
        user_id=user_id,
        generated_at=datetime.now(timezone.utc).isoformat(),
        style=style,
        style_description=style_desc,
        skill_level=skill_level,
        overall_score=stats.avg_score,
        sample_size=sample_size,
        data_quality=data_quality,
        stats=stats,
        leaks=leaks,
        coaching_advice=coaching_advice,
        study_recommendations=study_recs,
        strengths=strengths,
        weaknesses=weaknesses,
        tilt_indicators=tilt_indicators,
        ai_summary=ai_summary,
    )


# ── POST /api/player-profile/puzzle-complete ──────────────────────────────────

@router.post("/player-profile/puzzle-complete", tags=["profile"])
async def record_puzzle_completion(
    body: PuzzleCompletionRequest,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    """
    Record a completed puzzle attempt to Supabase puzzle_completions table.
    Used to track study progress and feed back into future profile calculations.
    """
    user_id: str = current_user.get("sub", "")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user")

    s = get_settings()
    if not s.supabase_url or not s.supabase_service_role_key:
        # Graceful degradation if table not yet created
        logger.warning("puzzle_completions save skipped — Supabase not configured")
        return {"saved": False, "reason": "not_configured"}

    headers = {
        "apikey": s.supabase_service_role_key,
        "Authorization": f"Bearer {s.supabase_service_role_key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }

    payload = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "puzzle_id": body.puzzle_id,
        "difficulty": body.difficulty,
        "category": body.category,
        "score": body.score,
        "ev_loss_bb": body.ev_loss_bb,
        "tags": body.tags,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{s.supabase_url}/rest/v1/puzzle_completions",
                headers=headers,
                json=payload,
            )
        if resp.status_code in (200, 201):
            return {"saved": True}
        logger.warning("puzzle_completions insert failed: %s %s", resp.status_code, resp.text[:200])
        return {"saved": False, "reason": f"status={resp.status_code}"}
    except Exception as exc:
        logger.error("puzzle_completions network error: %s", exc)
        return {"saved": False, "reason": str(exc)}
