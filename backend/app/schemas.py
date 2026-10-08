from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.cities import CityId


class Provenance(BaseModel):
    city_id: CityId = "melbourne"
    source_id: str = "unknown"
    provider: str = "unknown"
    data_kind: Literal["observed", "modelled", "static", "demo", "unknown"] = "unknown"
    geographic_precision: str = "City-level context"
    value_kind: Literal["provider", "derived"] = "provider"
    units: dict[str, str] = Field(default_factory=dict)
    last_attempt_at: datetime | None = None
    latency_ms: float | None = None
    cache_age_seconds: float | None = None
    error_code: str | None = None
    authentication: str = "none"
    rate_limit: str | None = None
    attribution: str | None = None
    source: str
    status: Literal["live", "cached", "demo", "stale", "unavailable"]
    origin_status: Literal["live", "demo", "unavailable"]
    observed_at: datetime | None = None
    fetched_at: datetime | None = None
    age_seconds: float | None = None
    stale: bool = False
    ttl_seconds: int
    limitations: list[str] = Field(default_factory=list)
    error: str | None = None


class Signal(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    metadata: Provenance


class Weather(Signal):
    temperature: float | None = None
    condition: str | None = None
    description: str | None = None
    wind_speed: float | None = None
    humidity: float | None = None
    city: str = "Melbourne"
    apparent_temperature: float | None = None
    precipitation: float | None = None
    wind_direction: float | None = None
    weather_code: int | None = None
    hourly: list[dict] = Field(default_factory=list)
    forecast: list[dict] = Field(default_factory=list)


class AirQuality(Signal):
    pm2_5: float | None = Field(default=None, ge=0)
    pm10: float | None = Field(default=None, ge=0)
    nitrogen_dioxide: float | None = Field(default=None, ge=0)
    ozone: float | None = Field(default=None, ge=0)
    us_aqi: float | None = Field(default=None, ge=0)
    european_aqi: float | None = Field(default=None, ge=0)
    hourly: list[dict] = Field(default_factory=list)
    standards: dict[str, str] = Field(
        default_factory=lambda: {"us_aqi": "US AQI", "european_aqi": "European AQI"}
    )


class Item(BaseModel):
    id: str | None = None
    url: str | None = None
    start_at: str | None = None
    end_at: str | None = None
    disruption_type: str | None = None
    publication_status: str | None = None
    geographic_references: list[dict] = Field(default_factory=list)
    title: str
    area: str = "Melbourne"
    mode: str | None = None
    severity: str | None = None
    routes: list[str] = Field(default_factory=list)
    description: str | None = None
    venue: str | None = None
    category: str | None = None
    date: str | None = None
    time: str | None = None
    coordinates: tuple[float, float] | None = None
    precision: str | None = None


class Transport(Signal):
    network: dict | None = None
    operational_status_available: bool = True
    status: str = "Unavailable"
    minor_delays: int = 0
    major_disruptions: int = 0
    disruption_count: int = 0
    items: list[Item] = Field(default_factory=list)
    updated_at: str | None = None


class Events(Signal):
    status: str = "Unavailable"
    event_count: int = 0
    high_impact: int = 0
    medium_impact: int = 0
    items: list[Item] = Field(default_factory=list)
    updated_at: str | None = None


class Ask(BaseModel):
    model_config = ConfigDict(extra="forbid")
    city: CityId = "melbourne"
    question: str = Field(min_length=1, max_length=1000)


class OperatorAction(BaseModel):
    """Only declarative UI operations; never URLs, scripts or arbitrary coordinates."""

    model_config = ConfigDict(extra="forbid")
    type: Literal[
        "navigate_dashboard",
        "focus_map_location",
        "toggle_map_layer",
        "select_time_range",
        "switch_city",
        "compare_city_metric",
    ]
    view: (
        Literal[
            "overview", "transit", "weather", "air-quality", "events", "forecasting", "diagnostics"
        ]
        | None
    ) = None
    location: (
        Literal[
            "cbd",
            "flinders",
            "southern-cross",
            "melbourne-park",
            "docklands",
            "southbank",
            "st-kilda",
            "rajiv-chowk",
            "kashmere-gate",
            "new-delhi",
            "central-secretariat",
        ]
        | None
    ) = None
    layer: (
        Literal["events", "transit", "weather", "alerts", "boundaries", "metro", "air-quality"]
        | None
    ) = None
    city: CityId | None = None
    metric: Literal["us_aqi"] | None = None
    enabled: bool | None = None
    hours: Literal[6, 24, 168, 720] | None = None

    @model_validator(mode="after")
    def validate_shape(self):
        fields = {
            "switch_city": {"city"},
            "compare_city_metric": {"metric"},
            "navigate_dashboard": {"view"},
            "focus_map_location": {"location"},
            "toggle_map_layer": {"layer", "enabled"},
            "select_time_range": {"hours"},
        }[self.type]
        supplied = {
            key for key, value in self.model_dump().items() if key != "type" and value is not None
        }
        if supplied != fields:
            raise ValueError("Action fields must match its declared type")
        return self


class Scenario(BaseModel):
    model_config = ConfigDict(extra="forbid")
    events: float = Field(ge=0, le=40, allow_inf_nan=False)
    transport: float = Field(ge=0, le=25, allow_inf_nan=False)
    weather: float = Field(ge=0, le=15, allow_inf_nan=False)
