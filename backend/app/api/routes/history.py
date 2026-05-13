"""
History debug endpoint — verifies persistence pipeline end-to-end.
GET /api/history/debug  →  count of saved analyses for the authenticated user.
"""
from __future__ import annotations

import logging
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends

from app.config import get_settings
from app.middleware.auth import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/history/debug", tags=["history"])
async def history_debug(
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    """Return save-pipeline diagnostics for the authenticated user."""
    user_id: str = current_user.get("sub", "")
    s = get_settings()

    if not s.supabase_url or not s.supabase_service_role_key:
        return {
            "user_id": user_id,
            "error": "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured",
            "total_saved": 0,
            "latest": [],
        }

    headers = {
        "apikey": s.supabase_service_role_key,
        "Authorization": f"Bearer {s.supabase_service_role_key}",
    }
    url = f"{s.supabase_url}/rest/v1/hand_analyses"
    params = {
        "user_id": f"eq.{user_id}",
        "select": "id,analysis_type,stakes,hero_position,overall_score,analyzed_at",
        "order": "analyzed_at.desc",
        "limit": "5",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=headers, params=params)

        rows = resp.json() if resp.status_code == 200 else []
        logger.info(
            "history/debug: user=%s count=%s supabase_status=%d",
            user_id, len(rows) if isinstance(rows, list) else "?", resp.status_code,
        )
        return {
            "user_id": user_id,
            "total_saved": len(rows) if isinstance(rows, list) else 0,
            "latest": rows[:3] if isinstance(rows, list) else [],
            "supabase_status": resp.status_code,
            "supabase_url_configured": bool(s.supabase_url),
            "service_role_configured": bool(s.supabase_service_role_key),
        }
    except Exception as exc:
        logger.error("history/debug error for user %s: %s", user_id, exc)
        return {
            "user_id": user_id,
            "error": str(exc),
            "total_saved": 0,
            "latest": [],
        }
