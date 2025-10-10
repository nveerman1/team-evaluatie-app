# app/core/config.py
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Team Evaluatie App"
    APP_ENV: str = "dev"
    API_V1_PREFIX: str = "/api/v1"

    # Security / JWT
    SECRET_KEY: str = "CHANGE_ME"  # overschrijven via env
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    JWT_ALGORITHM: str = "HS256"

    # Infra
    DATABASE_URL: str = "postgresql+psycopg2://app:app@localhost:5432/tea"

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    # Cookies
    SECURE_COOKIES: bool = False

    # pydantic-settings v2 configuratie
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Handige parsing: sta toe dat CORS_ORIGINS als komma-gescheiden string in env staat
    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def split_cors(cls, v):
        if isinstance(v, str):
            # Voorbeeld: "http://localhost:3000,https://example.com"
            return [item.strip() for item in v.split(",") if item.strip()]
        return v


settings = Settings()
