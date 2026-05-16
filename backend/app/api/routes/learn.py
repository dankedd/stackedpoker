"""Learning API routes — curriculum, lessons, step evaluation, XP, leaks."""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.config import get_settings
from app.middleware.auth import get_current_user
from app.engines.learn.step_evaluator import evaluate_step
from app.engines.learn.xp_calculator import calculate_step_xp, apply_xp_to_user
from app.engines.learn.srs_engine import compute_next_review
from app.engines.learn.leak_detector import detect_leaks_from_step
from app.engines.learn.recommendation_engine import recommend_next_lesson, get_review_concepts

logger = logging.getLogger(__name__)
router = APIRouter(tags=["learn"])


# ── Supabase REST helpers ─────────────────────────────────────────────────────

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


async def _supabase_post(table: str, data: dict, settings) -> dict:
    url = f"{settings.supabase_url}/rest/v1/{table}"
    headers = {**_sb_headers(settings), "Prefer": "return=representation"}
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(url, headers=headers, json=data)
        r.raise_for_status()
        result = r.json()
        return result[0] if result else {}


async def _supabase_patch(table: str, query: str, data: dict, settings) -> None:
    url = f"{settings.supabase_url}/rest/v1/{table}?{query}"
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.patch(url, headers=_sb_headers(settings), json=data)
        r.raise_for_status()


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
        return result[0] if result else {}


# ── Request / response bodies ─────────────────────────────────────────────────

class StepResponseBody(BaseModel):
    user_response: Any
    time_ms: int = 5000
    node_type: str = "unknown"


class LessonCompleteBody(BaseModel):
    score: int
    time_spent_sec: int = 0


# ── Helper: fetch user record ─────────────────────────────────────────────────

async def _get_user_row(user_id: str, settings) -> dict:
    """Return the user_progress row, creating it if missing."""
    rows = await _supabase_get(
        "user_progress",
        f"user_id=eq.{user_id}&select=*",
        settings,
    )
    if rows:
        return rows[0]
    # First-time user — seed a progress record
    new_row = {
        "user_id": user_id,
        "total_xp": 0,
        "level": 1,
        "streak_days": 0,
        "completed_lessons": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    return await _supabase_post("user_progress", new_row, settings)


# ── GET /learn/dashboard ──────────────────────────────────────────────────────

@router.get("/learn/dashboard")
async def get_dashboard(
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Personalised learning dashboard: progress, next lesson, review queue."""
    settings = get_settings()
    user_id: str = current_user.get("sub", "")

    try:
        user_row = await _get_user_row(user_id, settings)

        # Active leaks
        leaks = await _supabase_get(
            "user_leaks",
            f"user_id=eq.{user_id}&resolved=eq.false&select=*&order=severity.asc",
            settings,
        )

        # Concept masteries (weak = mastery_level < 3)
        masteries = await _supabase_get(
            "user_concept_mastery",
            f"user_id=eq.{user_id}&select=*&order=mastery_level.asc",
            settings,
        )

        weak_concepts = [m for m in masteries if m.get("mastery_level", 0) < 3]
        review_due = get_review_concepts(masteries)
        completed = user_row.get("completed_lessons", []) or []

        rec = recommend_next_lesson(leaks, weak_concepts, completed)

        return {
            "user_id": user_id,
            "total_xp": user_row.get("total_xp", 0),
            "level": user_row.get("level", 1),
            "streak_days": user_row.get("streak_days", 0),
            "completed_lessons_count": len(completed),
            "active_leaks": len(leaks),
            "concepts_due_for_review": len(review_due),
            "next_lesson": {
                "slug": rec.lesson_slug,
                "reason": rec.reason,
                "concept_id": rec.concept_id,
            },
            "review_concepts": [
                {"concept_id": c.get("concept_id"), "mastery_level": c.get("mastery_level")}
                for c in review_due
            ],
        }
    except httpx.HTTPError as e:
        logger.error("Dashboard DB error for user=%s: %s", user_id, e)
        raise HTTPException(status_code=502, detail="Could not load dashboard data.")
    except Exception:
        logger.exception("Dashboard error for user=%s", user_id)
        raise HTTPException(status_code=500, detail="Dashboard unavailable.")


# ── GET /learn/paths ──────────────────────────────────────────────────────────

@router.get("/learn/paths")
async def get_learning_paths(
    current_user: dict = Depends(get_current_user),
) -> list[dict]:
    """Return all learning paths with their modules."""
    settings = get_settings()
    user_id: str = current_user.get("sub", "")

    try:
        paths = await _supabase_get(
            "learning_paths",
            "select=*,learning_modules(id,slug,title,description,lesson_count,order_index)"
            "&order=order_index.asc",
            settings,
        )

        # Enrich with user completion data
        user_row = await _get_user_row(user_id, settings)
        completed = set(user_row.get("completed_lessons", []) or [])

        for path in paths:
            modules = path.get("learning_modules") or []
            for mod in modules:
                mod["completed"] = mod.get("slug") in completed

        return paths
    except httpx.HTTPError as e:
        logger.error("Paths DB error: %s", e)
        raise HTTPException(status_code=502, detail="Could not load learning paths.")
    except Exception:
        logger.exception("Paths error")
        raise HTTPException(status_code=500, detail="Learning paths unavailable.")


# ── GET /learn/module/{slug} ──────────────────────────────────────────────────

@router.get("/learn/module/{slug}")
async def get_module(
    slug: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Module detail including its lessons ordered by position."""
    settings = get_settings()
    user_id: str = current_user.get("sub", "")

    try:
        rows = await _supabase_get(
            "learning_modules",
            f"slug=eq.{slug}&select=*,lessons(id,slug,title,description,difficulty,"
            "estimated_minutes,concept_ids,order_index)&order=lessons.order_index.asc",
            settings,
        )
        if not rows:
            raise HTTPException(status_code=404, detail=f"Module '{slug}' not found.")

        module = rows[0]

        # Mark lessons completed
        user_row = await _get_user_row(user_id, settings)
        completed = set(user_row.get("completed_lessons", []) or [])
        for lesson in module.get("lessons") or []:
            lesson["completed"] = lesson.get("slug") in completed

        return module
    except HTTPException:
        raise
    except httpx.HTTPError as e:
        logger.error("Module DB error slug=%s: %s", slug, e)
        raise HTTPException(status_code=502, detail="Could not load module.")
    except Exception:
        logger.exception("Module error slug=%s", slug)
        raise HTTPException(status_code=500, detail="Module unavailable.")


# ── GET /learn/lesson/{slug} ──────────────────────────────────────────────────

@router.get("/learn/lesson/{slug}")
async def get_lesson(
    slug: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Lesson detail with all steps ordered by position."""
    settings = get_settings()
    _user_id: str = current_user.get("sub", "")

    try:
        rows = await _supabase_get(
            "lessons",
            f"slug=eq.{slug}&select=*,lesson_steps(*)&order=lesson_steps.order_index.asc",
            settings,
        )
        if not rows:
            raise HTTPException(status_code=404, detail=f"Lesson '{slug}' not found.")

        return rows[0]
    except HTTPException:
        raise
    except httpx.HTTPError as e:
        logger.error("Lesson DB error slug=%s: %s", slug, e)
        raise HTTPException(status_code=502, detail="Could not load lesson.")
    except Exception:
        logger.exception("Lesson error slug=%s", slug)
        raise HTTPException(status_code=500, detail="Lesson unavailable.")


# ── POST /learn/lesson/{lesson_id}/step/{step_id} ─────────────────────────────

@router.post("/learn/lesson/{lesson_id}/step/{step_id}")
async def evaluate_lesson_step(
    lesson_id: str,
    step_id: str,
    body: StepResponseBody,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Evaluate a step response, compute XP, update SRS, detect leaks."""
    settings = get_settings()
    user_id: str = current_user.get("sub", "")

    try:
        # 1. Load the step definition
        step_rows = await _supabase_get(
            "lesson_steps",
            f"id=eq.{step_id}&lesson_id=eq.{lesson_id}&select=*",
            settings,
        )
        if not step_rows:
            raise HTTPException(status_code=404, detail="Step not found.")
        step = step_rows[0]

        # 2. Evaluate response
        eval_result = evaluate_step(step, body.user_response)

        # 3. Load user progress for streak and XP
        user_row = await _get_user_row(user_id, settings)
        current_xp = user_row.get("total_xp", 0)
        streak = user_row.get("streak_days", 0)

        # 4. Calculate XP
        xp_result = calculate_step_xp(eval_result.xp_base, eval_result.score, body.time_ms, streak)
        new_total_xp, new_level, leveled_up = apply_xp_to_user(current_xp, xp_result.total_xp)

        # 5. Update user XP
        await _supabase_patch(
            "user_progress",
            f"user_id=eq.{user_id}",
            {"total_xp": new_total_xp, "level": new_level},
            settings,
        )

        # 6. Update SRS for each concept in this step
        concept_ids: list[str] = step.get("concept_ids") or []
        srs_updates = []
        for cid in concept_ids:
            mastery_rows = await _supabase_get(
                "user_concept_mastery",
                f"user_id=eq.{user_id}&concept_id=eq.{cid}&select=*",
                settings,
            )
            current_ease = 2.5
            current_interval = 1.0
            current_mastery = 0
            if mastery_rows:
                cm = mastery_rows[0]
                current_ease = cm.get("ease_factor", 2.5)
                current_interval = cm.get("interval_days", 1.0)
                current_mastery = cm.get("mastery_level", 0)

            next_review, new_ease, new_interval, new_mastery = compute_next_review(
                eval_result.score, current_ease, current_interval, current_mastery
            )

            await _supabase_upsert(
                "user_concept_mastery",
                {
                    "user_id": user_id,
                    "concept_id": cid,
                    "mastery_level": new_mastery,
                    "ease_factor": round(new_ease, 4),
                    "interval_days": round(new_interval, 4),
                    "next_review": next_review.isoformat(),
                    "last_seen": datetime.now(timezone.utc).isoformat(),
                },
                settings,
                on_conflict="user_id,concept_id",
            )
            srs_updates.append({"concept_id": cid, "mastery_level": new_mastery})

        # 7. Detect and persist leaks on wrong answers
        leak_updates = detect_leaks_from_step(
            concept_ids, eval_result.quality, eval_result.ev_loss_bb, body.node_type
        )
        for lu in leak_updates:
            # Upsert leak — increment occurrence_count
            existing = await _supabase_get(
                "user_leaks",
                f"user_id=eq.{user_id}&concept_id=eq.{lu.concept_id}&resolved=eq.false&select=*",
                settings,
            )
            if existing:
                leak_id = existing[0]["id"]
                new_count = existing[0].get("occurrence_count", 1) + 1
                await _supabase_patch(
                    "user_leaks",
                    f"id=eq.{leak_id}",
                    {
                        "occurrence_count": new_count,
                        "severity": lu.severity,
                        "last_seen": datetime.now(timezone.utc).isoformat(),
                    },
                    settings,
                )
            else:
                await _supabase_post(
                    "user_leaks",
                    {
                        "user_id": user_id,
                        "concept_id": lu.concept_id,
                        "node_type": lu.node_type,
                        "leak_type": lu.leak_type,
                        "severity": lu.severity,
                        "occurrence_count": 1,
                        "resolved": False,
                        "last_seen": datetime.now(timezone.utc).isoformat(),
                    },
                    settings,
                )

        # 8. Log the step attempt for analytics
        await _supabase_post(
            "step_attempts",
            {
                "user_id": user_id,
                "lesson_id": lesson_id,
                "step_id": step_id,
                "score": eval_result.score,
                "quality": eval_result.quality,
                "ev_loss_bb": eval_result.ev_loss_bb,
                "time_ms": body.time_ms,
                "xp_earned": xp_result.total_xp,
                "attempted_at": datetime.now(timezone.utc).isoformat(),
            },
            settings,
        )

        return {
            "score": eval_result.score,
            "quality": eval_result.quality,
            "feedback": eval_result.feedback,
            "ev_loss_bb": eval_result.ev_loss_bb,
            "concept_triggered": eval_result.concept_triggered,
            "xp": {
                "base_xp": xp_result.base_xp,
                "speed_bonus": xp_result.speed_bonus,
                "streak_bonus": xp_result.streak_bonus,
                "total_xp_earned": xp_result.total_xp,
                "new_total_xp": new_total_xp,
                "new_level": new_level,
                "leveled_up": leveled_up,
            },
            "srs_updates": srs_updates,
            "leaks_detected": len(leak_updates),
        }

    except HTTPException:
        raise
    except httpx.HTTPError as e:
        logger.error("Step eval DB error lesson=%s step=%s user=%s: %s", lesson_id, step_id, user_id, e)
        raise HTTPException(status_code=502, detail="Could not save step result.")
    except Exception:
        logger.exception("Step eval error lesson=%s step=%s user=%s", lesson_id, step_id, user_id)
        raise HTTPException(status_code=500, detail="Step evaluation failed.")


# ── POST /learn/lesson/{lesson_id}/complete ───────────────────────────────────

@router.post("/learn/lesson/{lesson_id}/complete")
async def complete_lesson(
    lesson_id: str,
    body: LessonCompleteBody,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Mark a lesson as complete and award completion XP bonus."""
    settings = get_settings()
    user_id: str = current_user.get("sub", "")

    try:
        # Fetch lesson for its slug and base XP value
        lesson_rows = await _supabase_get(
            "lessons",
            f"id=eq.{lesson_id}&select=id,slug,title,completion_xp",
            settings,
        )
        if not lesson_rows:
            raise HTTPException(status_code=404, detail="Lesson not found.")
        lesson = lesson_rows[0]
        lesson_slug = lesson.get("slug", lesson_id)
        completion_xp = lesson.get("completion_xp", 100)

        # Load user progress
        user_row = await _get_user_row(user_id, settings)
        completed = list(user_row.get("completed_lessons", []) or [])
        already_done = lesson_slug in completed

        # Apply score modifier to XP (scale completion_xp by score/100)
        score_pct = max(0, min(100, body.score)) / 100
        earned_xp = int(completion_xp * score_pct)

        current_xp = user_row.get("total_xp", 0)
        new_total_xp, new_level, leveled_up = apply_xp_to_user(current_xp, earned_xp)

        # Add to completed lessons list (idempotent)
        if lesson_slug not in completed:
            completed.append(lesson_slug)

        # Persist
        await _supabase_patch(
            "user_progress",
            f"user_id=eq.{user_id}",
            {
                "total_xp": new_total_xp,
                "level": new_level,
                "completed_lessons": completed,
            },
            settings,
        )

        # Log lesson completion
        await _supabase_post(
            "lesson_completions",
            {
                "user_id": user_id,
                "lesson_id": lesson_id,
                "lesson_slug": lesson_slug,
                "score": body.score,
                "time_spent_sec": body.time_spent_sec,
                "xp_earned": earned_xp,
                "already_completed": already_done,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            },
            settings,
        )

        return {
            "lesson_id": lesson_id,
            "lesson_slug": lesson_slug,
            "score": body.score,
            "xp_earned": earned_xp,
            "new_total_xp": new_total_xp,
            "new_level": new_level,
            "leveled_up": leveled_up,
            "already_completed": already_done,
        }

    except HTTPException:
        raise
    except httpx.HTTPError as e:
        logger.error("Lesson complete DB error lesson=%s user=%s: %s", lesson_id, user_id, e)
        raise HTTPException(status_code=502, detail="Could not record lesson completion.")
    except Exception:
        logger.exception("Lesson complete error lesson=%s user=%s", lesson_id, user_id)
        raise HTTPException(status_code=500, detail="Lesson completion failed.")


# ── GET /learn/progress ───────────────────────────────────────────────────────

@router.get("/learn/progress")
async def get_progress(
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Full user skill progress: XP, level, completed lessons, streak."""
    settings = get_settings()
    user_id: str = current_user.get("sub", "")

    try:
        user_row = await _get_user_row(user_id, settings)

        # Recent completions (last 10)
        recent = await _supabase_get(
            "lesson_completions",
            f"user_id=eq.{user_id}&select=lesson_slug,score,xp_earned,completed_at"
            "&order=completed_at.desc&limit=10",
            settings,
        )

        return {
            "user_id": user_id,
            "total_xp": user_row.get("total_xp", 0),
            "level": user_row.get("level", 1),
            "streak_days": user_row.get("streak_days", 0),
            "completed_lessons": user_row.get("completed_lessons", []),
            "completed_lessons_count": len(user_row.get("completed_lessons", []) or []),
            "recent_completions": recent,
        }

    except httpx.HTTPError as e:
        logger.error("Progress DB error user=%s: %s", user_id, e)
        raise HTTPException(status_code=502, detail="Could not load progress.")
    except Exception:
        logger.exception("Progress error user=%s", user_id)
        raise HTTPException(status_code=500, detail="Progress unavailable.")


# ── GET /learn/concepts ───────────────────────────────────────────────────────

@router.get("/learn/concepts")
async def get_concepts(
    current_user: dict = Depends(get_current_user),
) -> list[dict]:
    """All concept mastery records for the user, ordered by mastery level."""
    settings = get_settings()
    user_id: str = current_user.get("sub", "")

    try:
        masteries = await _supabase_get(
            "user_concept_mastery",
            f"user_id=eq.{user_id}&select=*&order=mastery_level.asc",
            settings,
        )
        return masteries
    except httpx.HTTPError as e:
        logger.error("Concepts DB error user=%s: %s", user_id, e)
        raise HTTPException(status_code=502, detail="Could not load concept mastery.")
    except Exception:
        logger.exception("Concepts error user=%s", user_id)
        raise HTTPException(status_code=500, detail="Concept mastery unavailable.")


# ── GET /learn/leaks ──────────────────────────────────────────────────────────

@router.get("/learn/leaks")
async def get_leaks(
    current_user: dict = Depends(get_current_user),
) -> list[dict]:
    """Active (unresolved) leaks for the user, sorted by severity."""
    settings = get_settings()
    user_id: str = current_user.get("sub", "")

    try:
        leaks = await _supabase_get(
            "user_leaks",
            f"user_id=eq.{user_id}&resolved=eq.false&select=*&order=occurrence_count.desc",
            settings,
        )
        return leaks
    except httpx.HTTPError as e:
        logger.error("Leaks DB error user=%s: %s", user_id, e)
        raise HTTPException(status_code=502, detail="Could not load leaks.")
    except Exception:
        logger.exception("Leaks error user=%s", user_id)
        raise HTTPException(status_code=500, detail="Leaks unavailable.")


# ── POST /learn/leaks/{leak_id}/resolve ──────────────────────────────────────

@router.post("/learn/leaks/{leak_id}/resolve")
async def resolve_leak(
    leak_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Mark a leak as resolved. Only the owning user can resolve their own leaks."""
    settings = get_settings()
    user_id: str = current_user.get("sub", "")

    try:
        # Verify ownership before patching
        rows = await _supabase_get(
            "user_leaks",
            f"id=eq.{leak_id}&user_id=eq.{user_id}&select=id,concept_id,resolved",
            settings,
        )
        if not rows:
            raise HTTPException(status_code=404, detail="Leak not found.")
        if rows[0].get("resolved"):
            return {"leak_id": leak_id, "resolved": True, "message": "Already resolved."}

        await _supabase_patch(
            "user_leaks",
            f"id=eq.{leak_id}&user_id=eq.{user_id}",
            {"resolved": True, "resolved_at": datetime.now(timezone.utc).isoformat()},
            settings,
        )
        return {"leak_id": leak_id, "resolved": True, "concept_id": rows[0].get("concept_id")}

    except HTTPException:
        raise
    except httpx.HTTPError as e:
        logger.error("Resolve leak DB error leak=%s user=%s: %s", leak_id, user_id, e)
        raise HTTPException(status_code=502, detail="Could not resolve leak.")
    except Exception:
        logger.exception("Resolve leak error leak=%s user=%s", leak_id, user_id)
        raise HTTPException(status_code=500, detail="Leak resolution failed.")
