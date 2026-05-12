from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Stacked Poker"
    debug: bool = False

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

    # Stripe  (server-side only — never expose secret key to frontend)
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_pro_price_id: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()
