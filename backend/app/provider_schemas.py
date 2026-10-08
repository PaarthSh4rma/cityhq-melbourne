"""Validate public provider envelopes before mapping to the shared city contract."""

from pydantic import BaseModel, ConfigDict, Field


class WeatherCurrent(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    time: int
    temperature_2m: float | None = Field(default=None, ge=-100, le=70)
    relative_humidity_2m: float | None = Field(default=None, ge=0, le=100)
    apparent_temperature: float | None = None
    precipitation: float | None = Field(default=None, ge=0)
    weather_code: int | None = None
    wind_speed_10m: float | None = Field(default=None, ge=0)
    wind_direction_10m: float | None = Field(default=None, ge=0, le=360)


class AQCurrent(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    time: int
    pm2_5: float | None = Field(default=None, ge=0)
    pm10: float | None = Field(default=None, ge=0)
    nitrogen_dioxide: float | None = Field(default=None, ge=0)
    ozone: float | None = Field(default=None, ge=0)
    us_aqi: float | None = Field(default=None, ge=0)
    european_aqi: float | None = Field(default=None, ge=0)


class WeatherEnvelope(BaseModel):
    current: WeatherCurrent
    current_units: dict[str, str]
    hourly: dict[str, list] = Field(default_factory=dict)
    daily: dict[str, list] = Field(default_factory=dict)


class AQEnvelope(BaseModel):
    current: AQCurrent
    current_units: dict[str, str]
    hourly: dict[str, list] = Field(default_factory=dict)


class PTVNotice(BaseModel):
    disruption_id: int | None = None
    title: str | None = None
    description: str | None = None
    disruption_status: str | None = None
    disruption_type: str | None = None
    from_date: str | None = None
    to_date: str | None = None
    routes: list[dict] = Field(default_factory=list)
    stops: list[dict] = Field(default_factory=list)
    url: str | None = None


class TicketmasterEvent(BaseModel):
    id: str | None = None
    name: str
    url: str | None = None
    dates: dict = Field(default_factory=dict)
    classifications: list[dict] = Field(default_factory=list)
