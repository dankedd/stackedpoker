"""New-user onboarding skill-assessment routes.

Persists the one-time adaptive assessment result (see
frontend/lib/learn/assessmentEngine.ts for the scoring/league logic, which is
computed client-side and simply stored here — same "client computes, server
durably stores" split learn.py uses for step results). Also flips
profiles.assessment_completed, the flag middleware.ts gates /learn on.
"""

import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.config import get_settings
from app.middleware.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(tags=["skill_assessment"])


# ── Supabase REST helpers (mirrors learn.py's local helpers) ─────────────────

def _sb_headers(settings) -> dict:
    return {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
    }


async def _supabase_get(table: str, query: str, settings) -> list[dict]:
    url = f"{settings.supabase_url}/rest/v1/{table}?{query}"
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(url, headers=_sb_headers(settings))
        r.raise_for_status()
        return r.json()


async def _supabase_patch(table: str, query: str, data: dict, settings) -> list[dict]:
    url = f"{settings.supabase_url}/rest/v1/{table}?{query}"
    headers = {**_sb_headers(settings), "Prefer": "return=representation"}
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.patch(url, headers=headers, json=data)
        r.raise_for_status()
        return r.json()


async def _supabase_upsert(table: str, data: dict, settings, on_conflict: str = "") -> dict:
    url = f"{settings.supabase_url}/rest/v1/{table}"
    prefer = "return=representation,resolution=merge-duplicates"
    if on_conflict:
        prefer += f"&on_conflict={on_conflict}"
    headers = {**_sb_headers(settings), "Prefer": prefer}
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(url, headers=headers, json=data)
        r.raise_for_status()
        result = r.json()
        return result[0] if isinstance(result, list) and result else result


async def _supabase_post(table: str, data: dict, settings) -> dict:
    url = f"{settings.supabase_url}/rest/v1/{table}"
    headers = {**_sb_headers(settings), "Prefer": "return=representation"}
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(url, headers=headers, json=data)
        r.raise_for_status()
        result = r.json()
        return result[0] if isinstance(result, list) and result else result


# ── Request/response models ───────────────────────────────────────────────────

class SubmitAssessmentBody(BaseModel):
    self_experience: str | None = None
    self_stakes: str | None = None
    self_confidence: int = 5
    questions_answered: int = 0
    correct_count: int = 0
    assessment_score: int = 0
    final_challenge_offered: bool = False
    final_challenge_passed: bool | None = None
    answer_trace: list[dict] = []
    estimated_league: str = "foundation"
    recommended_league: str = "foundation"
    chosen_start_league: str = "foundation"
    fast_track_taken: bool = False
    fast_track_passed: bool | None = None
    recommended_module_id: str | None = None
    strongest_topics: list[str] = []
    weakest_topics: list[str] = []
    estimated_study_hours: float = 0.0


VALID_LEAGUES = {"foundation", "intermediate", "advanced", "expert", "master"}


# ── POST /learn/assessment/submit ─────────────────────────────────────────────

@router.post("/learn/assessment/submit")
async def submit_assessment(
    body: SubmitAssessmentBody,
    current_user: dict = Depends(get_current_user),
) -> dict:
    settings = get_settings()
    user_id: str = current_user.get("sub", "")

    # Defense-in-depth: never let a malformed/tampered league value into a
    # column the dashboard widget and AI Coach both trust downstream.
    for field_name, value in (
        ("estimated_league", body.estimated_league),
        ("recommended_league", body.recommended_league),
        ("chosen_start_league", body.chosen_start_league),
    ):
        if value not in VALID_LEAGUES:
            raise HTTPException(status_code=422, detail=f"Invalid {field_name}: {value!r}")

    try:
        existing = await _supabase_get(
            "user_skill_assessment", f"user_id=eq.{user_id}&select=estimated_league", settings,
        )
        league_before = existing[0].get("estimated_league") if existing else None

        await _supabase_upsert(
            "user_skill_assessment",
            {"user_id": user_id, **body.model_dump()},
            settings,
            on_conflict="user_id",
        )

        await _supabase_patch(
            "profiles", f"id=eq.{user_id}", {"assessment_completed": True}, settings,
        )

        # Stub table for the deferred reassessment phase — one row per
        # completion, never read elsewhere in this delivery.
        await _supabase_post(
            "skill_check_history",
            {
                "user_id": user_id,
                "check_type": "initial_onboarding",
                "league_before": league_before,
                "league_after": body.estimated_league,
            },
            settings,
        )

        return {"ok": True}

    except HTTPException:
        raise
    except httpx.HTTPError as e:
        logger.error("Submit assessment DB error user=%s: %s", user_id, e)
        raise HTTPException(status_code=502, detail="Could not save assessment.")
    except Exception:
        logger.exception("Submit assessment error user=%s", user_id)
        raise HTTPException(status_code=500, detail="Assessment submission failed.")


# ── GET /learn/assessment/status ──────────────────────────────────────────────

@router.get("/learn/assessment/status")
async def get_assessment_status(current_user: dict = Depends(get_current_user)) -> dict:
    settings = get_settings()
    user_id: str = current_user.get("sub", "")

    try:
        profile_rows = await _supabase_get(
            "profiles", f"id=eq.{user_id}&select=assessment_completed", settings,
        )
        assessment_completed = bool(profile_rows[0].get("assessment_completed")) if profile_rows else False

        rows = await _supabase_get(
            "user_skill_assessment",
            f"user_id=eq.{user_id}&select=estimated_league,recommended_module_id,weakest_topics,completed_at",
            settings,
        )
        row = rows[0] if rows else None

        return {
            "assessment_completed": assessment_completed,
            "estimated_league": row.get("estimated_league") if row else None,
            "recommended_module_id": row.get("recommended_module_id") if row else None,
            "weakest_topics": row.get("weakest_topics", []) if row else [],
            "completed_at": row.get("completed_at") if row else None,
        }

    except httpx.HTTPError as e:
        logger.error("Assessment status DB error user=%s: %s", user_id, e)
        raise HTTPException(status_code=502, detail="Could not load assessment status.")
    except Exception:
        logger.exception("Assessment status error user=%s", user_id)
        raise HTTPException(status_code=500, detail="Assessment status unavailable.")


# ── POST /learn/assessment/retake ─────────────────────────────────────────────

@router.post("/learn/assessment/retake")
async def retake_assessment(current_user: dict = Depends(get_current_user)) -> dict:
    """Flips assessment_completed back to false so the existing middleware
    gate re-triggers naturally on the learner's next /learn visit — no
    separate retake route/middleware path needed. The prior result row in
    user_skill_assessment is left in place (overwritten on next submit)."""
    settings = get_settings()
    user_id: str = current_user.get("sub", "")

    try:
        await _supabase_patch(
            "profiles", f"id=eq.{user_id}", {"assessment_completed": False}, settings,
        )
        return {"ok": True}
    except httpx.HTTPError as e:
        logger.error("Retake assessment DB error user=%s: %s", user_id, e)
        raise HTTPException(status_code=502, detail="Could not start retake.")
    except Exception:
        logger.exception("Retake assessment error user=%s", user_id)
        raise HTTPException(status_code=500, detail="Retake failed.")
