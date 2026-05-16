"""
Learning Integration Service
=============================
Bridges the hand analysis pipeline to the adaptive learning system.

After every analysis:
1. Maps findings → concept leaks via coaching_tags
2. Upserts user_leaks records in Supabase
3. Picks a recommended lesson and writes it to hand_analyses.lesson_recommended
4. Best-effort — never raises; analysis must always succeed even if this fails.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

import httpx

from app.config import get_settings
from app.engines.learn.leak_detector import detect_leaks_from_analysis_findings, LeakUpdate
from app.engines.learn.recommendation_engine import CONCEPT_TO_LESSON

logger = logging.getLogger(__name__)


def _headers() -> dict[str, str]:
    s = get_settings()
    return {
        "apikey": s.supabase_service_role_key,
        "Authorization": f"Bearer {s.supabase_service_role_key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }


def _base_url() -> str:
    return get_settings().supabase_url


# ── Map findings to serialisable dicts ───────────────────────────────────────

def _findings_to_dicts(findings: list) -> list[dict]:
    """Convert AnalysisFinding objects to plain dicts for leak detector."""
    result = []
    for f in findings:
        result.append({
            "quality": getattr(f, "severity", "good"),
            "coaching_tags": getattr(f, "coaching_tags", []) or [],
            "ev_loss_bb": getattr(f, "ev_loss_bb", 0.0) or 0.0,
            "node_type": getattr(f, "node_type", "unknown") or "unknown",
        })
    return result


# ── Supabase helpers ──────────────────────────────────────────────────────────

async def _get_existing_leaks(user_id: str, concept_ids: list[str]) -> list[dict]:
    """Fetch existing leak records for this user + concepts."""
    if not concept_ids:
        return []
    try:
        concept_filter = ",".join(f'"{c}"' for c in concept_ids)
        url = (
            f"{_base_url()}/rest/v1/user_leaks"
            f"?user_id=eq.{user_id}"
            f"&concept_id=in.({concept_filter})"
            f"&resolved=eq.false"
        )
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(url, headers=_headers())
            if r.status_code == 200:
                return r.json()
    except Exception as e:
        logger.debug("Could not fetch existing leaks: %s", e)
    return []


async def _upsert_leak(user_id: str, leak: LeakUpdate, existing_id: str | None, count: int) -> None:
    """Insert new leak or increment evidence_count on existing."""
    now = datetime.now(timezone.utc).isoformat()
    if existing_id:
        url = f"{_base_url()}/rest/v1/user_leaks?id=eq.{existing_id}"
        payload = {
            "evidence_count": count + 1,
            "last_seen": now,
            "severity": leak.severity,
        }
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.patch(url, headers=_headers(), json=payload)
    else:
        url = f"{_base_url()}/rest/v1/user_leaks"
        payload = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "concept_id": leak.concept_id,
            "node_type": leak.node_type,
            "leak_type": leak.leak_type,
            "severity": leak.severity,
            "evidence_count": 1,
            "last_seen": now,
            "resolved": False,
        }
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(url, headers=_headers(), json=payload)


async def _write_lesson_recommendation(analysis_id: str, lesson_slug: str) -> None:
    """Patch hand_analyses.lesson_recommended for the saved analysis."""
    url = f"{_base_url()}/rest/v1/hand_analyses?id=eq.{analysis_id}"
    payload = {"lesson_recommended": lesson_slug}
    async with httpx.AsyncClient(timeout=5.0) as client:
        await client.patch(url, headers=_headers(), json=payload)


# ── Public entry point ────────────────────────────────────────────────────────

async def process_analysis_for_learning(
    user_id: str,
    findings: list,
    analysis_id: str | None,
) -> str | None:
    """
    Called after a hand analysis completes. Detects leaks and writes a lesson
    recommendation. Returns the recommended lesson slug (or None).

    This is best-effort — never raises.
    """
    if not user_id:
        return None

    try:
        # 1. Detect leaks from findings
        finding_dicts = _findings_to_dicts(findings)
        leak_updates = detect_leaks_from_analysis_findings(finding_dicts)

        if not leak_updates:
            return None

        # 2. Fetch existing leaks for deduplication
        concept_ids = list({lu.concept_id for lu in leak_updates})
        existing = await _get_existing_leaks(user_id, concept_ids)
        existing_by_concept: dict[str, dict] = {e["concept_id"]: e for e in existing}

        # 3. Upsert each leak
        for lu in leak_updates:
            existing_record = existing_by_concept.get(lu.concept_id)
            existing_id = existing_record["id"] if existing_record else None
            existing_count = existing_record["evidence_count"] if existing_record else 0
            try:
                await _upsert_leak(user_id, lu, existing_id, existing_count)
            except Exception as e:
                logger.debug("Leak upsert failed for %s: %s", lu.concept_id, e)

        # 4. Pick recommended lesson (most severe leak)
        severe_first = sorted(
            leak_updates,
            key=lambda l: {"severe": 0, "moderate": 1, "mild": 2}.get(l.severity, 2)
        )
        lesson_slug: str | None = None
        for lu in severe_first:
            if lu.concept_id in CONCEPT_TO_LESSON:
                lesson_slug = CONCEPT_TO_LESSON[lu.concept_id]
                break

        # 5. Write lesson recommendation to the saved analysis
        if lesson_slug and analysis_id:
            try:
                await _write_lesson_recommendation(analysis_id, lesson_slug)
            except Exception as e:
                logger.debug("Lesson recommendation write failed: %s", e)

        logger.info(
            "Learning integration: %d leaks detected for user=%s, recommended=%s",
            len(leak_updates), user_id[:8], lesson_slug
        )
        return lesson_slug

    except Exception as e:
        logger.warning("Learning integration failed (best-effort): %s", e)
        return None
