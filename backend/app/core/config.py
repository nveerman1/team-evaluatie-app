# app/core/config.py
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AnyUrl, field_validator


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Team Evaluatie App"
    APP_ENV: str = "dev"
    API_V1_PREFIX: str = "/api/v1"
    NODE_ENV: str = "development"  # "development" | "production" | "test"

    # Security / JWT
    SECRET_KEY: str = "CHANGE_ME"  # overschrijven via env
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    JWT_ALGORITHM: str = "HS256"
    
    # Azure AD OAuth Configuration
    AZURE_AD_CLIENT_ID: str = ""
    AZURE_AD_TENANT_ID: str = ""
    AZURE_AD_CLIENT_SECRET: str = ""
    AZURE_AD_REDIRECT_URI: str = "http://localhost:8000/api/v1/auth/azure/callback"
    AZURE_AD_AUTHORITY: str = ""  # Will be constructed from tenant_id if empty
    AZURE_AD_SCOPES: List[str] = ["User.Read"]
    AZURE_AD_ALLOWED_DOMAINS: List[str] = []  # e.g., ["school.nl", "example.edu"]

    # Infra
    DATABASE_URL: str = "postgresql+psycopg2://app:app@localhost:5432/tea"

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # Cookies
    SECURE_COOKIES: bool = False

    # pydantic-settings v2 configuratie
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # Handige parsing: sta toe dat CORS_ORIGINS als komma-gescheiden string in env staat
    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def split_cors(cls, v):
        if isinstance(v, str):
            # Voorbeeld: "http://localhost:3000,https://example.com"
            return [item.strip() for item in v.split(",") if item.strip()]
        return v
    
    @field_validator("AZURE_AD_SCOPES", mode="before")
    @classmethod
    def split_scopes(cls, v):
        if isinstance(v, str):
            return [item.strip() for item in v.split(",") if item.strip()]
        return v
    
    @field_validator("AZURE_AD_ALLOWED_DOMAINS", mode="before")
    @classmethod
    def split_domains(cls, v):
        if isinstance(v, str):
            return [item.strip() for item in v.split(",") if item.strip()]
        return v
    
    @field_validator("AZURE_AD_AUTHORITY", mode="before")
    @classmethod
    def set_authority(cls, v, info):
        # If authority is not set, construct it from tenant_id
        if not v and info.data.get("AZURE_AD_TENANT_ID"):
            return f"https://login.microsoftonline.com/{info.data['AZURE_AD_TENANT_ID']}"
        return v

    # Ollama instellingen
    OLLAMA_BASE_URL: AnyUrl = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.1"
    OLLAMA_TIMEOUT: float = 60.0


settings = Settings()
