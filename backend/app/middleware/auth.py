import logging
from functools import lru_cache
from typing import Annotated

import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import get_settings

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)


@lru_cache(maxsize=1)
def _jwks_client() -> PyJWKClient | None:
    """Return a cached JWKS client pointed at Supabase's public-key endpoint.

    Supabase new projects (2024+) sign JWTs with ES256 (asymmetric ECDSA).
    The public key is at /auth/v1/.well-known/jwks.json — no secret needed.
    PyJWKClient fetches and caches the key set internally.
    """
    settings = get_settings()
    if not settings.supabase_url:
        return None
    return PyJWKClient(f"{settings.supabase_url}/auth/v1/.well-known/jwks.json")


def _decode_token(token: str) -> dict:
    settings = get_settings()

    # ── Primary: JWKS (ES256 / RS256 / HS256 — whatever Supabase uses) ──
    client = _jwks_client()
    if client is not None:
        try:
            signing_key = client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256", "RS256", "HS256"],
                options={"verify_aud": False},
            )
            return payload
        except jwt.ExpiredSignatureError:
            logger.warning("JWT validation failed: token expired")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired"
            )
        except jwt.InvalidTokenError as exc:
            logger.warning("JWT JWKS validation failed: %s (%s)", type(exc).__name__, exc)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
            )
        except Exception as exc:
            # JWKS fetch failed (network) — fall through to HS256 below
            logger.warning("JWKS client error, trying HS256 fallback: %s", exc)

    # ── Fallback: HS256 with symmetric secret (older Supabase projects) ──
    if not settings.supabase_jwt_secret:
        logger.error(
            "JWT validation failed — SUPABASE_URL (for JWKS) and "
            "SUPABASE_JWT_SECRET (HS256 fallback) are both unset"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )

    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("JWT HS256 validation failed: token expired")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired"
        )
    except jwt.InvalidTokenError as exc:
        logger.warning("JWT HS256 validation failed: %s (%s)", type(exc).__name__, exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> dict:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )
    return _decode_token(credentials.credentials)


async def get_optional_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> dict | None:
    if not credentials:
        return None
    try:
        return _decode_token(credentials.credentials)
    except HTTPException:
        return None
