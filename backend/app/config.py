from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Core
    secret_key: str = "change-me"

    # Database. Prefer the discrete POSTGRES_* parts: the URL is assembled with
    # URL.create(), which safely escapes passwords containing @ / : # etc.
    # (a hand-built DATABASE_URL string would corrupt on those characters).
    # An explicit DATABASE_URL, if set, overrides the parts.
    database_url: str = ""
    postgres_user: str = "cvh"
    postgres_password: str = "cvh_password"
    postgres_db: str = "cvh_dashboards"
    postgres_host: str = "db"
    postgres_port: int = 5432

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

    @property
    def db_url(self) -> str | URL:
        """SQLAlchemy URL: an explicit DATABASE_URL if given, else assembled
        from the POSTGRES_* parts with proper escaping."""
        if self.database_url:
            return self.database_url
        return URL.create(
            "postgresql+asyncpg",
            username=self.postgres_user,
            password=self.postgres_password,
            host=self.postgres_host,
            port=self.postgres_port,
            database=self.postgres_db,
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
