from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://spend:spend@localhost:5432/marketing_spend"
    cors_allowed_origins: str = "http://localhost:5173"
    env: str = "local"
    uploads_dir: str = "./uploads"

    firebase_project_id: str = ""
    google_application_credentials: str = "./firebase-service-account.json"
    google_allowed_domain: str = "infobeans.com"
    jwt_secret: str = ""
    jwt_expires_minutes: int = 60

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]


settings = Settings()
