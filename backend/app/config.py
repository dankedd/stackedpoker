from functools import lru_cache
from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Stacked Poker"
    debug: bool = False

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
