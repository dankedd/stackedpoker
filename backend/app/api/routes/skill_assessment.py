"""New-user onboarding self-assessment routes.

Persists a single self-reported poker experience level (see
frontend/lib/learn/experienceLevel.ts for the level->recommendation mapping,
computed client-side and simply stored here — same "client computes, server
durably stores" split learn.py uses for step results). Also flips
profiles.assessment_completed, the flag middleware.ts gates the app on.

Changing the level later (Settings) re-POSTs to /submit — there is no
separate "retake" flow since there's no multi-step quiz to redo, and this
endpoint never touches course-progress tables, so it can't reset progress.
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

VALID_LEVELS = {"beginner", "recreational", "intermediate", "advanced"}


class SubmitAssessmentBody(BaseModel):
    experience_level: str
    recommended_module_id: str | None = None


# ── POST /learn/assessment/submit ─────────────────────────────────────────────

@router.post("/learn/assessment/submit")
async def submit_assessment(
    body: SubmitAssessmentBody,
    current_user: dict = Depends(get_current_user),
) -> dict:
    settings = get_settings()
    user_id: str = current_user.get("sub", "")

    # Defense-in-depth: never let a malformed/tampered level into a column
    # the dashboard widget and AI Coach both trust downstream.
    if body.experience_level not in VALID_LEVELS:
        raise HTTPException(status_code=422, detail=f"Invalid experience_level: {body.experience_level!r}")

    try:
        existing = await _supabase_get(
            "user_skill_assessment", f"user_id=eq.{user_id}&select=experience_level", settings,
        )
        level_before = existing[0].get("experience_level") if existing else None
        is_first_completion = not existing

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
        # completion/change, never read elsewhere in this delivery.
        await _supabase_post(
            "skill_check_history",
            {
                "user_id": user_id,
                "check_type": "initial_onboarding" if is_first_completion else "periodic_recheck",
                "league_before": level_before,
                "league_after": body.experience_level,
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
            f"user_id=eq.{user_id}&select=experience_level,recommended_module_id,completed_at",
            settings,
        )
        row = rows[0] if rows else None

        return {
            "assessment_completed": assessment_completed,
            "experience_level": row.get("experience_level") if row else None,
            "recommended_module_id": row.get("recommended_module_id") if row else None,
            "completed_at": row.get("completed_at") if row else None,
        }

    except httpx.HTTPError as e:
        logger.error("Assessment status DB error user=%s: %s", user_id, e)
        raise HTTPException(status_code=502, detail="Could not load assessment status.")
    except Exception:
        logger.exception("Assessment status error user=%s", user_id)
        raise HTTPException(status_code=500, detail="Assessment status unavailable.")
