"""
History debug endpoint — verifies persistence pipeline end-to-end.
GET /api/history/debug  →  count of saved analyses + INSERT capability test.
"""
from __future__ import annotations

import logging
import uuid
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import get_settings
from app.middleware.auth import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)


@router.get("/history/debug", tags=["history"])
async def history_debug(
    current_user: Annotated[dict, Depends(get_current_user)],
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    """Return full persistence diagnostics: config, SELECT count, and INSERT test."""
    user_id: str = current_user.get("sub", "")
    s = get_settings()

    if not s.supabase_url:
        return {"user_id": user_id, "error": "SUPABASE_URL not configured", "total_saved": 0}

    # ── Determine auth method ──────────────────────────────────────────────
    if s.supabase_service_role_key:
        read_headers = {
            "apikey": s.supabase_service_role_key,
            "Authorization": f"Bearer {s.supabase_service_role_key}",
        }
        write_headers = {**read_headers, "Content-Type": "application/json", "Prefer": "return=representation"}
        auth_method = "service_role"
    else:
        user_jwt = credentials.credentials if credentials else None
        if user_jwt and s.supabase_anon_key:
            read_headers = {
                "apikey": s.supabase_anon_key,
                "Authorization": f"Bearer {user_jwt}",
            }
            write_headers = {**read_headers, "Content-Type": "application/json", "Prefer": "return=representation"}
            auth_method = "user_jwt"
        else:
            return {
                "user_id": user_id,
                "error": "no_credentials: SUPABASE_SERVICE_ROLE_KEY not set and no user JWT",
                "total_saved": 0,
                "auth_method": "none",
            }

    base_url = f"{s.supabase_url}/rest/v1/hand_analyses"

    # ── SELECT: count existing rows ────────────────────────────────────────
    select_result: dict = {}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                base_url,
                headers=read_headers,
                params={
                    "user_id": f"eq.{user_id}",
                    "select": "id,analysis_type,stakes,overall_score,analyzed_at",
                    "order": "analyzed_at.desc",
                    "limit": "5",
                },
            )
        rows = resp.json() if resp.status_code == 200 else []
        select_result = {
            "status": resp.status_code,
            "total_saved": len(rows) if isinstance(rows, list) else 0,
            "latest": rows[:3] if isinstance(rows, list) else [],
            "error": None if resp.status_code == 200 else resp.text[:300],
        }
        logger.info("history/debug SELECT: user=%s count=%s status=%d", user_id, select_result["total_saved"], resp.status_code)
    except Exception as exc:
        select_result = {"status": 0, "total_saved": 0, "error": str(exc)}

    # ── INSERT test: write a probe row then delete it ──────────────────────
    insert_result: dict = {}
    probe_id = str(uuid.uuid4())
    from datetime import datetime, timezone
    probe_payload = {
        "id": probe_id,
        "user_id": user_id,
        "input_type": "text",
        "overall_score": 0,
        "ai_coaching": "__debug_probe__",
        "mistakes_count": 0,
        "analyzed_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            ins = await client.post(base_url, headers=write_headers, json=probe_payload)
            insert_ok = ins.status_code in (200, 201)
            insert_result = {
                "status": ins.status_code,
                "ok": insert_ok,
                "error": None if insert_ok else ins.text[:400],
            }
            logger.info("history/debug INSERT probe: user=%s status=%d ok=%s", user_id, ins.status_code, insert_ok)

            # Clean up probe row
            if insert_ok:
                await client.delete(
                    base_url,
                    headers=read_headers,
                    params={"id": f"eq.{probe_id}"},
                )
    except Exception as exc:
        insert_result = {"status": 0, "ok": False, "error": str(exc)}

    return {
        "user_id": user_id,
        "auth_method": auth_method,
        "supabase_url_configured": bool(s.supabase_url),
        "service_role_configured": bool(s.supabase_service_role_key),
        "anon_key_configured": bool(s.supabase_anon_key),
        "select": select_result,
        "insert_test": insert_result,
    }
