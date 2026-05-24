from functools import lru_cache
from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Stacked Poker"
    debug: bool = False

    # Docs/OpenAPI availability is decoupled from debug logging.
    # True by default so local dev always has Swagger UI.
    # Set DOCS_ENABLED=false in production to suppress /docs, /redoc, /openapi.json.
    docs_enabled: bool = True

    # DATABASE_URL is injected by Railway automatically in production.
    # Local dev uses .env or this default.
    # Railway provides postgresql:// or postgres:// — normalised to
    # postgresql+asyncpg:// by the validator below before engine creation.
    database_url: str = "postgresql+asyncpg://postgres:password@localhost:5432/stacked_poker"

    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_vision_model: str = "gpt-4o"

    allowed_origins: list[str] = ["http://localhost:3000"]

    # Supabase
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_jwt_secret: str = ""
    supabase_service_role_key: str = ""  # server-side only — never expose to frontend

    # Frontend origin — used for Stripe redirect URLs. Never read from request body.
    frontend_url: str = "http://localhost:3000"

    # Stripe  (server-side only — never expose secret key to frontend)
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_pro_price_id: str = ""
    stripe_premium_price_id: str = ""

    # ── Solver engine controls ────────────────────────────────────────────────
    # Master switch for solver-backed strategy retrieval in the analysis pipeline.
    # When False, the pipeline skips the strategy DB layer entirely.
    # Default: True — safe because the retrieval layer never crashes; it falls
    # back to deterministic heuristics if no solver data is available.
    enable_solver_engine: bool = True

    # ── Strategy debug controls ───────────────────────────────────────────────
    # Set DEBUG_STRATEGY_ENABLED=true in dev/staging to expose debug endpoints.
    # NEVER enable in production without also setting DEBUG_ADMIN_TOKEN.
    debug_strategy_enabled: bool = False
    # If non-empty, the X-Debug-Token header must match this value to access
    # debug endpoints. Leave empty to disable token protection (dev only).
    debug_admin_token: str = ""

    # Pydantic reads .env for local dev; real env vars always win over .env file.
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @field_validator("database_url", mode="before")
    @classmethod
    def _normalise_db_url(cls, v: object) -> object:
        """Rewrite postgresql:// / postgres:// → postgresql+asyncpg://

        Railway (and most PaaS providers) supply DATABASE_URL without the
        asyncpg driver specifier. SQLAlchemy's async engine requires it.
        """
        if not isinstance(v, str):
            return v
        if v.startswith("postgres://"):
            return "postgresql+asyncpg://" + v[len("postgres://"):]
        if v.startswith("postgresql://"):
            return "postgresql+asyncpg://" + v[len("postgresql://"):]
        return v


@lru_cache()
def get_settings() -> Settings:
    return Settings()
