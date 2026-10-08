from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Provenance(BaseModel):
    source: str
    status: Literal["live", "cached", "demo", "unavailable"]
    origin_status: Literal["live", "demo", "unavailable"]
    observed_at: datetime | None = None
    fetched_at: datetime | None = None
    age_seconds: float | None = None
    stale: bool = False
    ttl_seconds: int
    limitations: list[str] = Field(default_factory=list)
    error: str | None = None


class Signal(BaseModel):
    metadata: Provenance


class Weather(Signal):
    temperature: float | None = None
    condition: str | None = None
    description: str | None = None
    wind_speed: float | None = None
    humidity: float | None = None
    city: str = "Melbourne"
    forecast: list[dict] = Field(default_factory=list)


class Item(BaseModel):
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
    question: str = Field(min_length=1, max_length=1000)


class OperatorAction(BaseModel):
    """Only declarative UI operations; never URLs, scripts or arbitrary coordinates."""

    model_config = ConfigDict(extra="forbid")
    type: Literal[
        "navigate_dashboard", "focus_map_location", "toggle_map_layer", "select_time_range"
    ]
    view: (
        Literal["overview", "transit", "weather", "events", "forecasting", "diagnostics"] | None
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
        ]
        | None
    ) = None
    layer: Literal["events", "transit", "weather", "alerts", "boundaries"] | None = None
    enabled: bool | None = None
    hours: Literal[6, 24, 168, 720] | None = None

    @model_validator(mode="after")
    def validate_shape(self):
        fields = {
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
