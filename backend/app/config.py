from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Core
    secret_key: str = "change-me"
    database_url: str = "postgresql+asyncpg://cvh:cvh_password@db:5432/cvh_dashboards"

    # Tokens
    access_token_ttl_min: int = 15
    refresh_token_ttl_days: int = 14
    content_token_ttl_sec: int = 300

    # Uploads
    upload_dir: str = "/data/uploads"
    max_upload_mb: int = 50

    # Admin bootstrap
    admin_email: str = "admin@example.com"
    admin_password: str = "change-this-password"
    admin_name: str = "Administrator"

    # SMTP (optional)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "no-reply@example.com"
    smtp_tls: bool = True

    app_base_url: str = "http://localhost:8080"

    # Observability
    app_env: str = "production"
    sentry_dsn: str = ""

    @property
    def smtp_enabled(self) -> bool:
        return bool(self.smtp_host)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
