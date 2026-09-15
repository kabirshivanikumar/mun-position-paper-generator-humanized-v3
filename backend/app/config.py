from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    secret_key: str = "change-me"
    admin_username: str = "admin"
    admin_password: str = "admin123"
    database_url: str = "sqlite:///./app.db"
    ai_api_key: str = ""
    ai_model: str = "gemini-2.5-flash"
    # Multi-provider humanizer keys (rotate across passes)
    humanizer_api_key: str = ""          # backward-compat
    humanizer_api_key_1: str = ""        # AIHumanizerAPI.com
    humanizer_api_key_2: str = ""        # ToHuman
    humanizer_api_key_3: str = ""        # Humanize AI Pro
    humanizer_api_key_4: str = ""        # WriteHuman
    humanizer_api_key_5: str = ""        # HumanizerAI.com
    detector_api_key: str = ""           # ZeroGPT
    detector_provider: str = "zerogpt"
    humanizer_max_passes: int = 6
    target_ai_score: float = 5.0
    max_upload_size_mb: int = 10
    allowed_extensions: str = ".pdf,.docx,.txt"
    upload_dir: str = "uploads"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def upload_root(self) -> Path:
        return Path(self.upload_dir)


@lru_cache()
def get_settings() -> Settings:
    return Settings()