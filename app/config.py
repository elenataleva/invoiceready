from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    anthropic_api_key: str
    database_url: str
    env: str = "development"
    # Comma-separated. Defaults cover local dev only - a deployed instance
    # must set this explicitly, since a JSON API with a public write path
    # (LLM calls cost money) should never default to a wildcard origin.
    allowed_origins: str = "http://localhost:5173,http://localhost:8000"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]
