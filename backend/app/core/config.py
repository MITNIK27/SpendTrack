from decimal import Decimal

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

    # Frankfurter (ECB official daily reference rates) — free, keyless. Used only
    # as the last-resort fallback if fx_service has never had a successful fetch
    # since the process started (see app/services/fx_service.py).
    fx_rate_api_url: str = "https://api.frankfurter.dev/v1/latest"
    fx_fallback_usd_inr: Decimal = Decimal("83.0")

    # Email notifications (app/services/email_service.py) — off by default so
    # local/dev environments without SMTP credentials never attempt a send.
    # Flip on only once SMTP credentials are set AND the templates have been
    # signed off (see the notifications rollout plan).
    email_enabled: bool = False
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    # STARTTLS (upgrade a plaintext connection) — the standard port 587/25 mode.
    smtp_use_tls: bool = True
    # Implicit TLS (encrypted from the first byte) — needed for port 465.
    # Mutually exclusive with smtp_use_tls in practice: a 465 server doesn't
    # expect a STARTTLS command at all.
    smtp_use_ssl: bool = False

    # Canonical frontend URL used to build "view this" links inside emails —
    # no frontend URL is tracked anywhere else (CORS only lists dev origins).
    frontend_base_url: str = "http://localhost:5173"

    # Who gets emailed when the API hits a genuine server-side failure — an
    # unhandled exception or a 5xx response. Ordinary 4xx responses (a 401
    # from an expired session, a validation 400, etc.) never alert; those are
    # expected user-side conditions, not incidents (app/main.py's _alert_task,
    # app/services/error_alert_service.py).
    error_alert_email: str = "paarthp.sahni@infobeans.com"

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]


settings = Settings()
