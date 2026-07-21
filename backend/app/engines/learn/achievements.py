"""Achievement unlock checks — server-computable conditions, idempotent awarding.

Evaluation never re-scores anything; it only reads durable progress state
(user_skill_progress / user_lesson_progress / user_concept_mastery / user_leaks)
and calls the existing `award_achievement` RPC (supabase_achievements_schema.sql),
which is itself idempotent via ON CONFLICT DO NOTHING. That means this function
is safe to call unconditionally after every progress write — re-checking an
already-earned achievement is a harmless no-op.
"""

import logging

import httpx

logger = logging.getLogger(__name__)

PATH_COMPLETE_ACHIEVEMENT: dict[str, str] = {
    "beginner": "path_complete_beginner",
    "intermediate": "path_complete_intermediate",
    "advanced": "path_complete_advanced",
    "pro": "path_complete_pro",
}


def _headers(settings) -> dict:
    return {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
    }


async def _count(client: httpx.AsyncClient, settings, table: str, query: str) -> int:
    """Exact row count for a filtered table, via PostgREST's Prefer: count=exact + HEAD."""
    headers = {**_headers(settings), "Prefer": "count=exact"}
    r = await client.head(f"{settings.supabase_url}/rest/v1/{table}?{query}", headers=headers)
    r.raise_for_status()
    content_range = r.headers.get("content-range", "*/0")
    total = content_range.split("/")[-1]
    return int(total) if total.isdigit() else 0


async def _get(client: httpx.AsyncClient, settings, table: str, query: str) -> list[dict]:
    r = await client.get(f"{settings.supabase_url}/rest/v1/{table}?{query}", headers=_headers(settings))
    r.raise_for_status()
    return r.json()


async def _award(client: httpx.AsyncClient, settings, user_id: str, achievement_id: str) -> bool:
    r = await client.post(
        f"{settings.supabase_url}/rest/v1/rpc/award_achievement",
        headers=_headers(settings),
        json={"p_user_id": user_id, "p_achievement_id": achievement_id},
    )
    r.raise_for_status()
    return bool(r.json())


async def check_and_award_achievements(
    user_id: str,
    settings,
    path_id: str | None = None,
    path_lesson_ids: list[str] | None = None,
) -> list[str]:
    """Evaluate every server-checkable achievement condition, award any newly met.

    `path_id`/`path_lesson_ids` (the full lesson-id list for the path the client
    computed from curriculum.ts) are optional and only used to verify path
    completion against real user_lesson_progress rows — never trusted as a bare
    boolean from the client.
    """
    newly_awarded: list[str] = []

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            skill_rows = await _get(
                client, settings, "user_skill_progress",
                f"user_id=eq.{user_id}&select=level,streak_days",
            )
            skill = skill_rows[0] if skill_rows else {}
            level = skill.get("level", 1)
            streak = skill.get("streak_days", 0)

            candidates: list[str] = []

            if streak >= 3:
                candidates.append("streak_3")
            if streak >= 7:
                candidates.append("streak_7")
            if streak >= 30:
                candidates.append("streak_30")
            if level >= 10:
                candidates.append("level_10")
            if level >= 20:
                candidates.append("level_20")

            completed_count = await _count(
                client, settings, "user_lesson_progress",
                f"user_id=eq.{user_id}&status=eq.completed",
            )
            if completed_count >= 1:
                candidates.append("first_lesson")
            if completed_count >= 10:
                candidates.append("ten_lessons")
            if completed_count >= 50:
                candidates.append("fifty_lessons")

            perfect_count = await _count(
                client, settings, "user_lesson_progress",
                f"user_id=eq.{user_id}&best_score=eq.100",
            )
            if perfect_count >= 1:
                candidates.append("perfect_lesson")
            if perfect_count >= 5:
                candidates.append("five_perfects")

            mastered_count = await _count(
                client, settings, "user_concept_mastery",
                f"user_id=eq.{user_id}&mastery_level=gte.5",
            )
            if mastered_count >= 1:
                candidates.append("concept_mastered")
            if mastered_count >= 10:
                candidates.append("ten_concepts_mastered")

            resolved_leaks = await _count(
                client, settings, "user_leaks",
                f"user_id=eq.{user_id}&resolved=eq.true",
            )
            if resolved_leaks >= 1:
                candidates.append("leak_resolved")

            if path_id and path_lesson_ids and path_id in PATH_COMPLETE_ACHIEVEMENT:
                id_list = ",".join(path_lesson_ids)
                done = await _count(
                    client, settings, "user_lesson_progress",
                    f"user_id=eq.{user_id}&status=eq.completed&lesson_id=in.({id_list})",
                )
                if done >= len(path_lesson_ids):
                    candidates.append(PATH_COMPLETE_ACHIEVEMENT[path_id])

            for achievement_id in candidates:
                try:
                    if await _award(client, settings, user_id, achievement_id):
                        newly_awarded.append(achievement_id)
                except httpx.HTTPError as e:
                    logger.warning("award_achievement failed user=%s achievement=%s: %s", user_id, achievement_id, e)

        except httpx.HTTPError as e:
            logger.error("Achievement check DB error user=%s: %s", user_id, e)

    return newly_awarded
