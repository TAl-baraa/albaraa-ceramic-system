from functools import lru_cache

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL


class Settings(BaseSettings):
    APP_NAME: str = "Al-Baraa Ceramic Management API"
    APP_ENV: str = "development"
    API_PREFIX: str = "/api"
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD_HASH: str = ""
    AUTH_SECRET_KEY: str = ""
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    AUTH_COOKIE_SECURE: bool = False
    AUTH_COOKIE_NAME: str = "albaraa_session"

    POSTGRES_USER: str = "ceramic_user"
    POSTGRES_PASSWORD: str = "change_this_password"
    POSTGRES_DB: str = "ceramic_db"
    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: int = 5432
    DATABASE_URL: str | None = None

    ALLOWED_ORIGINS: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    @model_validator(mode="after")
    def build_database_url(self) -> "Settings":
        if not self.DATABASE_URL:
            self.DATABASE_URL = URL.create(
                drivername="postgresql+psycopg",
                username=self.POSTGRES_USER,
                password=self.POSTGRES_PASSWORD,
                host=self.POSTGRES_HOST,
                port=self.POSTGRES_PORT,
                database=self.POSTGRES_DB,
            ).render_as_string(hide_password=False)
        if self.APP_ENV.lower() in {"production", "prod"}:
            if not self.ADMIN_PASSWORD_HASH or self.ADMIN_PASSWORD_HASH == "replace_with_generated_hash":
                raise ValueError("ADMIN_PASSWORD_HASH must be configured in production")
            if len(self.AUTH_SECRET_KEY) < 32 or self.AUTH_SECRET_KEY == "replace_with_long_random_secret":
                raise ValueError("AUTH_SECRET_KEY must be a strong production secret")
            if not self.AUTH_COOKIE_SECURE:
                raise ValueError("AUTH_COOKIE_SECURE must be enabled in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
