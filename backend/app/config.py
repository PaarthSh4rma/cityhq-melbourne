"""Environment-only settings. Provider credentials never enter API responses."""

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


@dataclass(frozen=True)
class Settings:
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./cityhq.db")
    weather_adapter: str = os.getenv("WEATHER_ADAPTER", "wttr")
    transport_adapter: str = os.getenv("TRANSPORT_ADAPTER", "demo")
    events_adapter: str = os.getenv("EVENTS_ADAPTER", "demo")
    ingestion_seconds: int = max(30, int(os.getenv("INGESTION_SECONDS", "60")))
    retention_days: int = max(1, int(os.getenv("RETENTION_DAYS", "90")))
    artifact_dir: str = os.getenv("MODEL_DIR", "./artifacts")
    cors_origins: tuple = tuple(
        os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
    )


settings = Settings()
