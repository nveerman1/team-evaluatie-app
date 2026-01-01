# app/core/config.py
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AnyUrl, field_validator, Field


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
    # Store as strings to avoid JSON parsing issues
    azure_ad_scopes_str: str = Field(
        default="User.Read", validation_alias="AZURE_AD_SCOPES"
    )
    azure_ad_allowed_domains_str: str = Field(
        default="", validation_alias="AZURE_AD_ALLOWED_DOMAINS"
    )

    # Infra
    DATABASE_URL: str = "postgresql+psycopg2://app:app@localhost:5432/tea"

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # Frontend & Backend URLs
    FRONTEND_URL: str = "http://localhost:3000"
    BACKEND_URL: str = "http://localhost:8000"

    # Cookie settings
    COOKIE_SECURE: bool = False  # Set to True in production
    COOKIE_DOMAIN: str = ""  # e.g., ".technasiummbh.nl" in production
    COOKIE_SAMESITE: str = "Lax"  # Allow OAuth redirects
    COOKIE_MAX_AGE: int = 604800  # 7 days in seconds

    # pydantic-settings v2 configuratie
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,  # Allow field name or alias
    )

    # Computed properties that return lists
    @property
    def AZURE_AD_SCOPES(self) -> List[str]:
        """Parse AZURE_AD_SCOPES from comma-separated string to list"""
        if not self.azure_ad_scopes_str or self.azure_ad_scopes_str.strip() == "":
            return ["User.Read"]
        return [s.strip() for s in self.azure_ad_scopes_str.split(",") if s.strip()]

    @property
    def AZURE_AD_ALLOWED_DOMAINS(self) -> List[str]:
        """Parse AZURE_AD_ALLOWED_DOMAINS from comma-separated string to list"""
        if (
            not self.azure_ad_allowed_domains_str
            or self.azure_ad_allowed_domains_str.strip() == ""
        ):
            return []
        return [
            d.strip() for d in self.azure_ad_allowed_domains_str.split(",") if d.strip()
        ]

    # Handige parsing: sta toe dat CORS_ORIGINS als komma-gescheiden string in env staat
    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def split_cors(cls, v):
        if isinstance(v, str):
            # Voorbeeld: "http://localhost:3000,https://example.com"
            return [item.strip() for item in v.split(",") if item.strip()]
        return v

    @field_validator("AZURE_AD_AUTHORITY", mode="before")
    @classmethod
    def set_authority(cls, v, info):
        # If authority is not set, construct it from tenant_id
        if not v and info.data.get("AZURE_AD_TENANT_ID"):
            return (
                f"https://login.microsoftonline.com/{info.data['AZURE_AD_TENANT_ID']}"
            )
        return v

    @field_validator("NODE_ENV", mode="after")
    @classmethod
    def validate_node_env(cls, v):
        """Validate NODE_ENV is one of the allowed values"""
        allowed = ["development", "production", "test"]
        if v not in allowed:
            import logging

            logger = logging.getLogger(__name__)
            logger.warning(
                f"Invalid NODE_ENV='{v}'. Must be one of {allowed}. "
                f"Defaulting to 'production' for safety."
            )
            return "production"
        return v

    # Ollama instellingen
    OLLAMA_BASE_URL: AnyUrl = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.1"
    OLLAMA_TIMEOUT: float = 60.0

    # Redis settings for queue
    REDIS_URL: str = "redis://localhost:6379/0"


settings = Settings()
