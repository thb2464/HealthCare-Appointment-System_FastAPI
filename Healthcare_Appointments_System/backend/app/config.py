from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def email_configured(self) -> bool:
        """True when SMTP credentials are present and emails will actually be sent."""
        return bool(self.MAIL_FROM and self.MAIL_USERNAME and self.MAIL_PASSWORD)

    # ── Database ───────────────────────────────────────────────────────────
    DATABASE_URL: str = (
        "postgresql+asyncpg://postgres:password@localhost:5432/healthcare_db"
    )

    # ── JWT ────────────────────────────────────────────────────────────────
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── Email (SMTP) ───────────────────────────────────────────────────────
    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""
    MAIL_FROM: str = ""
    MAIL_SERVER: str = "smtp.gmail.com"
    MAIL_PORT: int = 587

    # ── CORS ───────────────────────────────────────────────────────────────
    BACKEND_CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    # ── App ────────────────────────────────────────────────────────────────
    APP_TITLE: str = "Healthcare Appointments API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False


settings = Settings()
