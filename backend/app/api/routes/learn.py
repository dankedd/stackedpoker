"""Learning API routes — progress persistence, XP, mastery, leaks, achievements.

ARCHITECTURE RULE: answer evaluation (score/quality/xp_earned) happens entirely
client-side in frontend/lib/learn/evaluator.ts (evaluateStepLocally). Nothing
here re-scores an answer. This module's job is durable storage of that result
plus bookkeeping that depends on server-held state: aggregate XP/level totals,
SM-2 spaced-repetition scheduling, leak aggregation, streaks, and idempotent
achievement unlocking.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.config import get_settings
from app.middleware.auth import get_current_user
from app.engines.learn.xp_calculator import apply_xp_to_user, level_for_xp
from app.engines.learn.srs_engine import compute_next_review
from app.engines.learn.leak_detector import detect_leaks_from_step
from app.engines.learn.achievements import check_and_award_achievements

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


# ── Request bodies ────────────────────────────────────────────────────────────

class StepResultBody(BaseModel):
    score: int
    quality: str
    xp_earned: int
    ev_loss_bb: float = 0.0
    concept_ids: list[str] = []
    response: Any = None
    time_ms: int = 0
    node_type: str = "unknown"
    module_id: str | None = None
    path_id: str | None = None
    step_index: int = 0
    total_steps: int | None = None


class LessonCompleteBody(BaseModel):
    score: int
    time_spent_sec: int = 0
    module_id: str | None = None
    path_id: str | None = None
    # Known client-side from curriculum.ts — the value being bonus-ified, and the
    # id lists used to *verify* (not trust) module/path completion server-side.
    lesson_xp_reward: int = 0
    path_lesson_ids: list[str] = []


class ModuleCompleteBody(BaseModel):
    path_id: str | None = None
    # Known client-side from curriculum.ts — the value being awarded, and the
    # full lesson-id list for this module used to *verify* (not trust) that
    # every lesson is actually completed server-side.
    module_xp_reward: int = 0
    lesson_ids: list[str] = []


class GuestStepEvent(BaseModel):
    step_id: str
    score: int
    quality: str
    xp_earned: int
    ev_loss_bb: float = 0.0
    concept_ids: list[str] = []
    response: Any = None


class GuestLessonEvent(BaseModel):
    lesson_id: str
    module_id: str | None = None
    path_id: str | None = None
    status: str
    last_score: int = 0
    best_score: int = 0
    current_step_index: int = 0
    current_step_id: str | None = None
    total_steps: int = 0
    steps: list[GuestStepEvent] = []


class MergeGuestProgressBody(BaseModel):
    lessons: list[GuestLessonEvent] = []


# ── Helpers: user_skill_progress / user_lesson_progress rows ──────────────────

async def _get_skill_row(user_id: str, settings) -> dict:
    """Return the user_skill_progress row, creating it if missing."""
    rows = await _supabase_get(
        "user_skill_progress", f"user_id=eq.{user_id}&select=*", settings,
    )
    if rows:
        return rows[0]
    new_row = {
        "user_id": user_id,
        "total_xp": 0,
        "level": 1,
        "streak_days": 0,
        "unlocked_paths": ["beginner"],
        "achievements": [],
    }
    return await _supabase_post("user_skill_progress", new_row, settings)


async def _get_lesson_row(user_id: str, lesson_id: str, settings) -> dict | None:
    rows = await _supabase_get(
        "user_lesson_progress",
        f"user_id=eq.{user_id}&lesson_id=eq.{lesson_id}&select=*",
        settings,
    )
    return rows[0] if rows else None


async def _get_module_row(user_id: str, module_id: str, settings) -> dict | None:
    rows = await _supabase_get(
        "user_module_progress",
        f"user_id=eq.{user_id}&module_id=eq.{module_id}&select=*",
        settings,
    )
    return rows[0] if rows else None


def _apply_streak(last_active_raw: str | None, streak_days: int) -> tuple[int, str, bool]:
    """Returns (new_streak_days, today_iso, changed). Idempotent per calendar day."""
    today = datetime.now(timezone.utc).date()
    last_active = None
    if last_active_raw:
        try:
            last_active = datetime.fromisoformat(last_active_raw).date()
        except ValueError:
            last_active = None

    if last_active == today:
        return streak_days, today.isoformat(), False
    if last_active == today - timedelta(days=1):
        return streak_days + 1, today.isoformat(), True
    return 1, today.isoformat(), True


async def _upsert_concept_mastery(user_id: str, concept_id: str, score: int, quality: str, settings) -> int:
    """Runs SM-2 scheduling for one concept; returns the new mastery level."""
    mastery_rows = await _supabase_get(
        "user_concept_mastery",
        f"user_id=eq.{user_id}&concept_id=eq.{concept_id}&select=*",
        settings,
    )
    current_ease, current_interval, current_mastery = 2.5, 1.0, 0
    exposures, correct_streak = 0, 0
    if mastery_rows:
        cm = mastery_rows[0]
        current_ease = cm.get("ease_factor", 2.5)
        current_interval = cm.get("interval_days", 1.0)
        current_mastery = cm.get("mastery_level", 0)
        exposures = cm.get("exposures", 0)
        correct_streak = cm.get("correct_streak", 0)

    next_review, new_ease, new_interval, new_mastery = compute_next_review(
        score, current_ease, current_interval, current_mastery,
    )
    new_correct_streak = correct_streak + 1 if quality in ("perfect", "good") else 0

    await _supabase_upsert(
        "user_concept_mastery",
        {
            "user_id": user_id,
            "concept_id": concept_id,
            "mastery_level": new_mastery,
            "exposures": exposures + 1,
            "correct_streak": new_correct_streak,
            "ease_factor": round(new_ease, 4),
            "interval_days": round(new_interval, 4),
            "next_review": next_review.isoformat(),
            "last_tested": datetime.now(timezone.utc).isoformat(),
        },
        settings,
        on_conflict="user_id,concept_id",
    )
    return new_mastery


async def _upsert_leak(user_id: str, concept_id: str, node_type: str, leak_type: str, severity: str, settings) -> None:
    existing = await _supabase_get(
        "user_leaks",
        f"user_id=eq.{user_id}&concept_id=eq.{concept_id}&resolved=eq.false&select=id,evidence_count",
        settings,
    )
    if existing:
        await _supabase_patch(
            "user_leaks",
            f"id=eq.{existing[0]['id']}",
            {
                "evidence_count": existing[0].get("evidence_count", 1) + 1,
                "severity": severity,
                "last_seen": datetime.now(timezone.utc).isoformat(),
            },
            settings,
        )
    else:
        await _supabase_post(
            "user_leaks",
            {
                "user_id": user_id,
                "concept_id": concept_id,
                "node_type": node_type,
                "leak_type": leak_type,
                "severity": severity,
                "evidence_count": 1,
                "resolved": False,
                "last_seen": datetime.now(timezone.utc).isoformat(),
            },
            settings,
        )


# ── GET /learn/progress — full hydration bundle ───────────────────────────────

@router.get("/learn/progress")
async def get_full_progress(current_user: dict = Depends(get_current_user)) -> dict:
    """Everything needed to restore Learn state on open: XP/level/streak, every
    lesson's status + resume position, completed step ids, concept mastery,
    active leaks, unlocked achievements, and the Continue Learning target."""
    settings = get_settings()
    user_id: str = current_user.get("sub", "")

    try:
        skill = await _get_skill_row(user_id, settings)
        lesson_rows = await _supabase_get("user_lesson_progress", f"user_id=eq.{user_id}&select=*", settings)
        step_rows = await _supabase_get(
            "user_step_progress", f"user_id=eq.{user_id}&select=lesson_id,step_id", settings,
        )
        concept_rows = await _supabase_get("user_concept_mastery", f"user_id=eq.{user_id}&select=*", settings)
        leak_rows = await _supabase_get(
            "user_leaks", f"user_id=eq.{user_id}&resolved=eq.false&select=*&order=severity.asc", settings,
        )
        achievement_rows = await _supabase_get(
            "user_achievements", f"user_id=eq.{user_id}&select=achievement_id,earned_at", settings,
        )
        module_rows = await _supabase_get(
            "user_module_progress", f"user_id=eq.{user_id}&select=module_id", settings,
        )

        lessons = {
            lr["lesson_id"]: {
                "status": lr.get("status", "locked"),
                "attempts": lr.get("attempts", 0),
                "best_score": lr.get("best_score", 0),
                "last_score": lr.get("last_score", 0),
                "current_step_index": lr.get("current_step_index", 0),
                "current_step_id": lr.get("current_step_id"),
                "total_steps": lr.get("total_steps"),
                "completed_at": lr.get("completed_at"),
                "module_id": lr.get("module_id"),
                "path_id": lr.get("path_id"),
                "updated_at": lr.get("updated_at"),
            }
            for lr in lesson_rows
        }

        completed_steps: dict[str, list[str]] = {}
        for sr in step_rows:
            completed_steps.setdefault(sr["lesson_id"], []).append(sr["step_id"])

        concepts = {
            cr["concept_id"]: {
                "mastery_level": cr.get("mastery_level", 0),
                "exposures": cr.get("exposures", 0),
                "correct_streak": cr.get("correct_streak", 0),
                "ease_factor": cr.get("ease_factor", 2.5),
                "interval_days": cr.get("interval_days", 1.0),
                "next_review": cr.get("next_review"),
                "last_tested": cr.get("last_tested"),
            }
            for cr in concept_rows
        }

        in_progress = [lr for lr in lesson_rows if lr.get("status") == "in_progress"]
        continue_target = None
        if in_progress:
            latest = max(in_progress, key=lambda lr: lr.get("updated_at") or "")
            continue_target = {
                "lesson_id": latest["lesson_id"],
                "module_id": latest.get("module_id"),
                "path_id": latest.get("path_id"),
                "step_index": latest.get("current_step_index", 0),
                "total_steps": latest.get("total_steps"),
            }

        return {
            "skill": {
                "total_xp": skill.get("total_xp", 0),
                "level": skill.get("level", 1),
                "streak_days": skill.get("streak_days", 0),
                "last_active": skill.get("last_active"),
            },
            "lessons": lessons,
            "completed_steps": completed_steps,
            "concepts": concepts,
            "leaks": leak_rows,
            "achievements": [{"id": a["achievement_id"], "earned_at": a["earned_at"]} for a in achievement_rows],
            "completed_modules": [mr["module_id"] for mr in module_rows],
            "continue": continue_target,
        }
    except httpx.HTTPError as e:
        logger.error("Progress DB error user=%s: %s", user_id, e)
        raise HTTPException(status_code=502, detail="Could not load progress.")
    except Exception:
        logger.exception("Progress error user=%s", user_id)
        raise HTTPException(status_code=500, detail="Progress unavailable.")


# ── POST /learn/steps/{lesson_id}/{step_id} ───────────────────────────────────

@router.post("/learn/steps/{lesson_id}/{step_id}")
async def submit_step_result(
    lesson_id: str,
    step_id: str,
    body: StepResultBody,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Persist a client-evaluated step result. XP is credited only the first
    time this (user, lesson, step) triple is seen — replays never re-award it."""
    settings = get_settings()
    user_id: str = current_user.get("sub", "")

    try:
        existing_step_rows = await _supabase_get(
            "user_step_progress",
            f"user_id=eq.{user_id}&lesson_id=eq.{lesson_id}&step_id=eq.{step_id}&select=*",
            settings,
        )
        is_first_completion = not existing_step_rows

        skill = await _get_skill_row(user_id, settings)
        current_xp = skill.get("total_xp", 0)
        xp_awarded_this_call = body.xp_earned if is_first_completion else 0
        new_total_xp, new_level, leveled_up = apply_xp_to_user(current_xp, xp_awarded_this_call)

        if is_first_completion:
            await _supabase_post(
                "user_step_progress",
                {
                    "user_id": user_id,
                    "lesson_id": lesson_id,
                    "step_id": step_id,
                    "attempts": 1,
                    "best_score": body.score,
                    "last_score": body.score,
                    "last_quality": body.quality,
                    "xp_awarded": body.xp_earned,
                    "last_response": body.response,
                    "concept_ids": body.concept_ids,
                },
                settings,
            )
        else:
            prev = existing_step_rows[0]
            await _supabase_patch(
                "user_step_progress",
                f"user_id=eq.{user_id}&lesson_id=eq.{lesson_id}&step_id=eq.{step_id}",
                {
                    "attempts": prev.get("attempts", 1) + 1,
                    "best_score": max(prev.get("best_score", 0), body.score),
                    "last_score": body.score,
                    "last_quality": body.quality,
                    "last_response": body.response,
                    "last_attempted_at": datetime.now(timezone.utc).isoformat(),
                },
                settings,
            )

        new_streak, today_str, streak_changed = _apply_streak(
            skill.get("last_active"), skill.get("streak_days", 0),
        )
        skill_patch: dict = {}
        if xp_awarded_this_call > 0:
            skill_patch.update(total_xp=new_total_xp, level=new_level)
        if streak_changed:
            skill_patch.update(streak_days=new_streak, last_active=today_str)
        if skill_patch:
            await _supabase_patch("user_skill_progress", f"user_id=eq.{user_id}", skill_patch, settings)

        existing_lesson = await _get_lesson_row(user_id, lesson_id, settings)
        lesson_patch: dict = {
            "module_id": body.module_id,
            "path_id": body.path_id,
        }
        if body.total_steps is not None:
            lesson_patch["total_steps"] = body.total_steps
        if existing_lesson:
            # Resume position must never move backward. Two rapid step saves can
            # reach the server out of order (a slower earlier request completing
            # after a faster later one) — without this guard, the later request's
            # correct forward position would be regressed by the earlier one.
            if body.step_index >= existing_lesson.get("current_step_index", 0):
                lesson_patch["current_step_index"] = body.step_index
                lesson_patch["current_step_id"] = step_id
            if existing_lesson.get("status") != "completed":
                lesson_patch["status"] = "in_progress"
            await _supabase_patch(
                "user_lesson_progress", f"user_id=eq.{user_id}&lesson_id=eq.{lesson_id}", lesson_patch, settings,
            )
        else:
            lesson_patch["current_step_index"] = body.step_index
            lesson_patch["current_step_id"] = step_id
            await _supabase_post(
                "user_lesson_progress",
                {
                    "user_id": user_id,
                    "lesson_id": lesson_id,
                    "status": "in_progress",
                    "started_at": datetime.now(timezone.utc).isoformat(),
                    **lesson_patch,
                },
                settings,
            )

        mastery_updates = []
        for cid in body.concept_ids:
            new_mastery = await _upsert_concept_mastery(user_id, cid, body.score, body.quality, settings)
            mastery_updates.append({"concept_id": cid, "mastery_level": new_mastery})

        leak_updates = detect_leaks_from_step(body.concept_ids, body.quality, body.ev_loss_bb, body.node_type)
        for lu in leak_updates:
            await _upsert_leak(user_id, lu.concept_id, lu.node_type, lu.leak_type, lu.severity, settings)

        newly_unlocked = await check_and_award_achievements(user_id, settings)
        if newly_unlocked:
            # Achievement XP was credited synchronously above — reflect the true
            # total immediately rather than leaving the client with a stale number
            # until its next full-progress fetch.
            refreshed = await _get_skill_row(user_id, settings)
            new_total_xp = refreshed.get("total_xp", new_total_xp)
            new_level = refreshed.get("level", new_level)

        return {
            "new_total_xp": new_total_xp,
            "new_level": new_level,
            "leveled_up": leveled_up,
            "xp_awarded_this_call": xp_awarded_this_call,
            "mastery_updates": mastery_updates,
            "newly_unlocked_achievement_ids": newly_unlocked,
        }

    except HTTPException:
        raise
    except httpx.HTTPError as e:
        logger.error("Step result DB error lesson=%s step=%s user=%s: %s", lesson_id, step_id, user_id, e)
        raise HTTPException(status_code=502, detail="Could not save step result.")
    except Exception:
        logger.exception("Step result error lesson=%s step=%s user=%s", lesson_id, step_id, user_id)
        raise HTTPException(status_code=500, detail="Could not save step result.")


# ── POST /learn/lessons/{lesson_id}/complete ──────────────────────────────────

@router.post("/learn/lessons/{lesson_id}/complete")
async def complete_lesson(
    lesson_id: str,
    body: LessonCompleteBody,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Mark a lesson complete and award the one-time completion bonus (on top
    of per-step XP already earned). Replays only update best/last score."""
    settings = get_settings()
    user_id: str = current_user.get("sub", "")

    try:
        existing = await _get_lesson_row(user_id, lesson_id, settings)
        already_completed = bool(existing and existing.get("status") == "completed")

        skill = await _get_skill_row(user_id, settings)
        current_xp = skill.get("total_xp", 0)

        bonus_xp = 0
        if not already_completed:
            score_pct = max(0, min(100, body.score)) / 100
            bonus_xp = int(round(body.lesson_xp_reward * score_pct))

        new_total_xp, new_level, leveled_up = apply_xp_to_user(current_xp, bonus_xp)

        lesson_patch: dict = {
            "status": "completed",
            "last_score": body.score,
            "best_score": max(body.score, existing.get("best_score", 0) if existing else 0),
            "attempts": (existing.get("attempts", 0) if existing else 0) + 1,
            "time_spent_sec": (existing.get("time_spent_sec", 0) if existing else 0) + body.time_spent_sec,
            "module_id": body.module_id,
            "path_id": body.path_id,
        }
        if not already_completed:
            lesson_patch["completed_at"] = datetime.now(timezone.utc).isoformat()
            lesson_patch["completion_xp_awarded"] = True

        if existing:
            await _supabase_patch(
                "user_lesson_progress", f"user_id=eq.{user_id}&lesson_id=eq.{lesson_id}", lesson_patch, settings,
            )
        else:
            await _supabase_post(
                "user_lesson_progress", {"user_id": user_id, "lesson_id": lesson_id, **lesson_patch}, settings,
            )

        if bonus_xp > 0:
            await _supabase_patch(
                "user_skill_progress", f"user_id=eq.{user_id}",
                {"total_xp": new_total_xp, "level": new_level}, settings,
            )

        newly_unlocked = await check_and_award_achievements(
            user_id, settings, path_id=body.path_id, path_lesson_ids=body.path_lesson_ids or None,
        )
        if newly_unlocked:
            refreshed = await _get_skill_row(user_id, settings)
            new_total_xp = refreshed.get("total_xp", new_total_xp)
            new_level = refreshed.get("level", new_level)

        return {
            "lesson_id": lesson_id,
            "score": body.score,
            "bonus_xp_earned": bonus_xp,
            "new_total_xp": new_total_xp,
            "new_level": new_level,
            "leveled_up": leveled_up,
            "already_completed": already_completed,
            "newly_unlocked_achievement_ids": newly_unlocked,
        }

    except HTTPException:
        raise
    except httpx.HTTPError as e:
        logger.error("Lesson complete DB error lesson=%s user=%s: %s", lesson_id, user_id, e)
        raise HTTPException(status_code=502, detail="Could not record lesson completion.")
    except Exception:
        logger.exception("Lesson complete error lesson=%s user=%s", lesson_id, user_id)
        raise HTTPException(status_code=500, detail="Lesson completion failed.")


# ── POST /learn/modules/{module_id}/complete ──────────────────────────────────

@router.post("/learn/modules/{module_id}/complete")
async def complete_module(
    module_id: str,
    body: ModuleCompleteBody,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Award the one-time module/theme completion bonus once every lesson in
    the module is verifiably completed server-side. `lesson_ids` is the
    client-computed lesson-id list for this module (curriculum.ts) — used only
    to VERIFY completion against real user_lesson_progress rows, never trusted
    as a bare boolean. Replaying an already-awarded module is a no-op."""
    settings = get_settings()
    user_id: str = current_user.get("sub", "")

    try:
        existing = await _get_module_row(user_id, module_id, settings)
        already_completed = existing is not None

        eligible = already_completed
        if not already_completed and body.lesson_ids:
            id_list = ",".join(body.lesson_ids)
            done_rows = await _supabase_get(
                "user_lesson_progress",
                f"user_id=eq.{user_id}&status=eq.completed&lesson_id=in.({id_list})&select=lesson_id",
                settings,
            )
            eligible = len(done_rows) >= len(body.lesson_ids)

        skill = await _get_skill_row(user_id, settings)
        current_xp = skill.get("total_xp", 0)
        new_total_xp, new_level, leveled_up = current_xp, skill.get("level", 1), False

        bonus_xp = 0
        if not already_completed and eligible:
            bonus_xp = max(0, body.module_xp_reward)
            new_total_xp, new_level, leveled_up = apply_xp_to_user(current_xp, bonus_xp)

            await _supabase_post(
                "user_module_progress",
                {
                    "user_id": user_id,
                    "module_id": module_id,
                    "path_id": body.path_id,
                    "xp_awarded": bonus_xp,
                },
                settings,
            )
            if bonus_xp > 0:
                await _supabase_patch(
                    "user_skill_progress", f"user_id=eq.{user_id}",
                    {"total_xp": new_total_xp, "level": new_level}, settings,
                )

        newly_unlocked = await check_and_award_achievements(user_id, settings)
        if newly_unlocked:
            refreshed = await _get_skill_row(user_id, settings)
            new_total_xp = refreshed.get("total_xp", new_total_xp)
            new_level = refreshed.get("level", new_level)

        return {
            "module_id": module_id,
            "bonus_xp_earned": bonus_xp,
            "new_total_xp": new_total_xp,
            "new_level": new_level,
            "leveled_up": leveled_up,
            "already_completed": already_completed,
            "eligible": eligible,
            "newly_unlocked_achievement_ids": newly_unlocked,
        }

    except HTTPException:
        raise
    except httpx.HTTPError as e:
        logger.error("Module complete DB error module=%s user=%s: %s", module_id, user_id, e)
        raise HTTPException(status_code=502, detail="Could not record module completion.")
    except Exception:
        logger.exception("Module complete error module=%s user=%s", module_id, user_id)
        raise HTTPException(status_code=500, detail="Module completion failed.")


# ── POST /learn/leaks/{leak_id}/resolve ───────────────────────────────────────

@router.post("/learn/leaks/{leak_id}/resolve")
async def resolve_leak(
    leak_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Mark a leak resolved. Only the owning user can resolve their own leaks."""
    settings = get_settings()
    user_id: str = current_user.get("sub", "")

    try:
        rows = await _supabase_get(
            "user_leaks", f"id=eq.{leak_id}&user_id=eq.{user_id}&select=id,concept_id,resolved", settings,
        )
        if not rows:
            raise HTTPException(status_code=404, detail="Leak not found.")
        if rows[0].get("resolved"):
            return {"leak_id": leak_id, "resolved": True, "message": "Already resolved.", "newly_unlocked_achievement_ids": []}

        await _supabase_patch(
            "user_leaks", f"id=eq.{leak_id}&user_id=eq.{user_id}", {"resolved": True}, settings,
        )
        newly_unlocked = await check_and_award_achievements(user_id, settings)
        return {
            "leak_id": leak_id,
            "resolved": True,
            "concept_id": rows[0].get("concept_id"),
            "newly_unlocked_achievement_ids": newly_unlocked,
        }

    except HTTPException:
        raise
    except httpx.HTTPError as e:
        logger.error("Resolve leak DB error leak=%s user=%s: %s", leak_id, user_id, e)
        raise HTTPException(status_code=502, detail="Could not resolve leak.")
    except Exception:
        logger.exception("Resolve leak error leak=%s user=%s", leak_id, user_id)
        raise HTTPException(status_code=500, detail="Leak resolution failed.")


# ── POST /learn/merge-guest-progress ──────────────────────────────────────────

@router.post("/learn/merge-guest-progress")
async def merge_guest_progress(
    body: MergeGuestProgressBody,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Import guest (localStorage) progress into a freshly authenticated
    account. Per lesson, keeps whichever side (account vs guest) has the
    higher completion percentage — never overwrites better account progress
    with worse guest progress. Steps that already exist on the account are
    skipped during import so overlapping steps never get double-credited XP."""
    settings = get_settings()
    user_id: str = current_user.get("sub", "")
    imported_lessons: list[str] = []

    def _pct(status: str, step_count: int, total: int) -> float:
        if status == "completed":
            return 100.0
        if total <= 0:
            return 0.0
        return 100.0 * step_count / total

    try:
        skill = await _get_skill_row(user_id, settings)
        total_xp = skill.get("total_xp", 0)

        for guest_lesson in body.lessons:
            existing = await _get_lesson_row(user_id, guest_lesson.lesson_id, settings)

            account_pct = 0.0
            if existing:
                account_step_rows = await _supabase_get(
                    "user_step_progress",
                    f"user_id=eq.{user_id}&lesson_id=eq.{guest_lesson.lesson_id}&select=step_id",
                    settings,
                )
                account_pct = _pct(
                    existing.get("status", "locked"),
                    len(account_step_rows),
                    existing.get("total_steps") or guest_lesson.total_steps,
                )

            guest_pct = _pct(guest_lesson.status, len(guest_lesson.steps), guest_lesson.total_steps)
            if guest_pct <= account_pct:
                continue  # account progress is already as good or better — leave it untouched

            for step in guest_lesson.steps:
                already = await _supabase_get(
                    "user_step_progress",
                    f"user_id=eq.{user_id}&lesson_id=eq.{guest_lesson.lesson_id}&step_id=eq.{step.step_id}&select=step_id",
                    settings,
                )
                if already:
                    continue  # account already has this exact step recorded — never double-credit XP
                await _supabase_post(
                    "user_step_progress",
                    {
                        "user_id": user_id,
                        "lesson_id": guest_lesson.lesson_id,
                        "step_id": step.step_id,
                        "attempts": 1,
                        "best_score": step.score,
                        "last_score": step.score,
                        "last_quality": step.quality,
                        "xp_awarded": step.xp_earned,
                        "last_response": step.response,
                        "concept_ids": step.concept_ids,
                    },
                    settings,
                )
                total_xp += step.xp_earned
                for cid in step.concept_ids:
                    await _upsert_concept_mastery(user_id, cid, step.score, step.quality, settings)

            lesson_patch: dict = {
                "status": guest_lesson.status if guest_lesson.status in ("in_progress", "completed") else "in_progress",
                "current_step_index": guest_lesson.current_step_index,
                "current_step_id": guest_lesson.current_step_id,
                "total_steps": guest_lesson.total_steps,
                "module_id": guest_lesson.module_id,
                "path_id": guest_lesson.path_id,
                "last_score": guest_lesson.last_score,
                "best_score": max(guest_lesson.best_score, existing.get("best_score", 0) if existing else 0),
            }
            if guest_lesson.status == "completed":
                lesson_patch["completed_at"] = datetime.now(timezone.utc).isoformat()

            if existing:
                await _supabase_patch(
                    "user_lesson_progress",
                    f"user_id=eq.{user_id}&lesson_id=eq.{guest_lesson.lesson_id}",
                    lesson_patch,
                    settings,
                )
            else:
                await _supabase_post(
                    "user_lesson_progress",
                    {
                        "user_id": user_id,
                        "lesson_id": guest_lesson.lesson_id,
                        "started_at": datetime.now(timezone.utc).isoformat(),
                        **lesson_patch,
                    },
                    settings,
                )

            imported_lessons.append(guest_lesson.lesson_id)

        if total_xp != skill.get("total_xp", 0):
            new_level = level_for_xp(total_xp)
            await _supabase_patch(
                "user_skill_progress", f"user_id=eq.{user_id}",
                {"total_xp": total_xp, "level": new_level}, settings,
            )

        newly_unlocked = await check_and_award_achievements(user_id, settings)
        return {
            "imported_lessons": imported_lessons,
            "new_total_xp": total_xp,
            "newly_unlocked_achievement_ids": newly_unlocked,
        }

    except HTTPException:
        raise
    except httpx.HTTPError as e:
        logger.error("Guest merge DB error user=%s: %s", user_id, e)
        raise HTTPException(status_code=502, detail="Could not merge guest progress.")
    except Exception:
        logger.exception("Guest merge error user=%s", user_id)
        raise HTTPException(status_code=500, detail="Guest progress merge failed.")
