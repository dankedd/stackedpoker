import io
import logging
import zipfile as _zipfile
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.models.schemas import TournamentAnalysisRequest, TournamentAnalysisResponse
from app.services.tournament_service import (
    analyze_tournament, analyze_tournament_from_upload,
    _try_decode, _looks_like_hh, _is_skip_entry,
)
from app.services.session_service import split_hands
from app.services.supabase_persistence import save_tournament_analysis
from app.services.usage_service import get_user_profile, assert_usage_allowed
from app.middleware.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

_bearer = HTTPBearer(auto_error=False)

_ALLOWED_EXTENSIONS = (".zip", ".txt")
_MAX_BYTES = 50 * 1024 * 1024  # 50 MB


@router.post("/analyze-tournament", response_model=TournamentAnalysisResponse, tags=["analysis"])
async def analyze_tournament_endpoint(
    request: TournamentAnalysisRequest,
    current_user: dict = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> TournamentAnalysisResponse:
    """Parse a full tournament history (text), score every hand by ICM importance."""
    user_id: str = current_user.get("sub", "")
    user_jwt: str | None = credentials.credentials if credentials else None

    profile = await get_user_profile(user_id)
    assert_usage_allowed(profile)

    try:
        result = await analyze_tournament(request)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception:
        logger.exception("Tournament analyze error")
        raise HTTPException(
            status_code=500,
            detail="Tournament analysis failed. Check your hand history format.",
        )

    saved_id, save_error = await save_tournament_analysis(
        user_id, request.tournament_text, result, user_jwt=user_jwt
    )
    result.saved_id = saved_id or None
    result.save_error = save_error or None
    if save_error:
        logger.warning("Tournament Supabase persist failed for user=%s: %s", user_id, save_error)

    return result


@router.post("/analyze-tournament-upload", response_model=TournamentAnalysisResponse, tags=["analysis"])
async def analyze_tournament_upload_endpoint(
    file: UploadFile = File(...),
    tournament_type: str = Form(""),
    buy_in: str = Form(""),
    current_user: dict = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> TournamentAnalysisResponse:
    """Accept a .zip or .txt tournament export, auto-detect metadata, return analysis."""
    user_id: str = current_user.get("sub", "")
    user_jwt: str | None = credentials.credentials if credentials else None

    fname = (file.filename or "upload.txt").lower()
    if not any(fname.endswith(ext) for ext in _ALLOWED_EXTENSIONS):
        raise HTTPException(
            status_code=422,
            detail="Unsupported file format. Upload a .zip or .txt tournament export.",
        )

    profile = await get_user_profile(user_id)
    assert_usage_allowed(profile)

    try:
        file_bytes = await file.read()
        if not file_bytes:
            raise ValueError("Uploaded file is empty")
        if len(file_bytes) > _MAX_BYTES:
            raise ValueError("File too large (max 50 MB)")
        result = await analyze_tournament_from_upload(
            file_bytes,
            file.filename or "upload.txt",
            tournament_type=tournament_type,
            buy_in=buy_in,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception:
        logger.exception("Tournament upload analyze error")
        raise HTTPException(
            status_code=500,
            detail="Tournament analysis failed. Check your export format.",
        )

    saved_id, save_error = await save_tournament_analysis(
        user_id, f"[file:{file.filename}]", result, user_jwt=user_jwt
    )
    result.saved_id = saved_id or None
    result.save_error = save_error or None
    if save_error:
        logger.warning("Tournament upload persist failed for user=%s: %s", user_id, save_error)

    return result


@router.post("/tournament-debug", tags=["debug"])
async def tournament_debug_endpoint(
    file: UploadFile = File(...),
    _current_user: dict = Depends(get_current_user),
) -> dict:
    """Diagnostic: inspect ZIP contents without running analysis.
    Returns entry list, encoding detection, HH signal matches, and hand count.
    Remove this endpoint before going to production."""
    file_bytes = await file.read()
    fname = file.filename or "upload"
    result: dict = {
        "filename": fname,
        "file_size_bytes": len(file_bytes),
        "entries": [],
        "accepted_files": [],
        "total_chars": 0,
        "hands_split": 0,
        "text_preview": "",
        "error": None,
    }

    if not fname.lower().endswith(".zip"):
        text = _try_decode(file_bytes)
        result["total_chars"] = len(text)
        result["has_hh_signals"] = _looks_like_hh(text)
        result["hands_split"] = len(split_hands(text))
        result["text_preview"] = text[:500]
        return result

    try:
        with _zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
            all_names = zf.namelist()
            result["entries"] = all_names

            accepted_texts: list[str] = []
            for name in sorted(all_names):
                entry_info: dict = {"name": name, "skipped": False, "reason": "", "hh": False, "bytes": 0, "encoding": "", "preview": ""}

                if _is_skip_entry(name):
                    entry_info["skipped"] = True
                    entry_info["reason"] = "skip rule"
                    result["entries_detail"] = result.get("entries_detail", []) + [entry_info]
                    continue

                try:
                    with zf.open(name) as f:
                        raw = f.read()
                except Exception as exc:
                    entry_info["skipped"] = True
                    entry_info["reason"] = f"read error: {exc}"
                    result.setdefault("entries_detail", []).append(entry_info)
                    continue

                entry_info["bytes"] = len(raw)
                if len(raw) < 50:
                    entry_info["skipped"] = True
                    entry_info["reason"] = "too small"
                    result.setdefault("entries_detail", []).append(entry_info)
                    continue

                # Detect encoding
                from app.services.tournament_service import _ENCODINGS
                decoded_with = "utf-8(replace)"
                text = raw.decode("utf-8", errors="replace")
                for enc in _ENCODINGS:
                    try:
                        text = raw.decode(enc)
                        decoded_with = enc
                        break
                    except (UnicodeDecodeError, LookupError):
                        continue

                entry_info["encoding"] = decoded_with
                entry_info["hh"] = _looks_like_hh(text)
                entry_info["preview"] = text[:300]
                result.setdefault("entries_detail", []).append(entry_info)

                if entry_info["hh"]:
                    accepted_texts.append(text)
                    result["accepted_files"].append(name)

            if accepted_texts:
                combined = "\n\n".join(accepted_texts)
                result["total_chars"] = len(combined)
                result["hands_split"] = len(split_hands(combined))
                result["text_preview"] = combined[:500]

    except _zipfile.BadZipFile as exc:
        result["error"] = f"BadZipFile: {exc}"

    return result
