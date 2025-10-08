from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "Team Evaluatie App"
    APP_ENV: str = "dev"
    API_V1_PREFIX: str = "/api/v1"
    SECRET_KEY: str = "CHANGE_ME"  # overschrijven via env
    DATABASE_URL: str = "postgresql+psycopg2://app:app@localhost:5432/tea"
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]
    SECURE_COOKIES: bool = False

    class Config:
        env_file = ".env"

settings = Settings()
