"""City/source single-flight caches, bounded retries and an explicit failure circuit."""

import asyncio
import time
from datetime import datetime, timezone

import httpx

from app import adapters
from app.cities import city_config
from app.config import settings
from app.schemas import AirQuality, Events, Transport, Weather

SCHEMAS = {"weather": Weather, "transport": Transport, "events": Events, "air_quality": AirQuality}


def adapter_for(source, city):
    return {
        "weather": settings.weather_adapter,
        "transport": settings.transport_adapter
        if city == "melbourne"
        else settings.delhi_transport_adapter,
        "events": settings.events_adapter,
        "air_quality": settings.air_quality_adapter,
    }[source]


def details(source, adapter, city):
    static = adapter == "delhi-metro-static"
    return dict(
        city_id=city,
        source_id=source,
        provider=adapter,
        data_kind="demo"
        if adapter == "demo"
        else "modelled"
        if adapter.startswith("open-meteo")
        else "static"
        if static
        else "unknown"
        if adapter in ("wttr", "openweather")
        else "observed",
        geographic_precision="CAMS global grid (~45 km), city context only"
        if source == "air_quality"
        else "Provider venue coordinates where supplied"
        if source == "events"
        else "OSM station nodes and route geometry"
        if static
        else "City-level context",
        authentication="PTV developer ID + HMAC key"
        if adapter == "ptv"
        else "API key"
        if adapter in ("ticketmaster", "openweather")
        else "none",
        units={"temperature": "°C", "wind_speed": "km/h", "precipitation": "mm", "humidity": "%"}
        if source == "weather"
        else {
            "pm2_5": "μg/m³",
            "pm10": "μg/m³",
            "nitrogen_dioxide": "μg/m³",
            "ozone": "μg/m³",
            "us_aqi": "US AQI",
            "european_aqi": "European AQI",
        }
        if source == "air_quality"
        else {},
        attribution="Open-Meteo · CAMS · CC BY 4.0"
        if source == "air_quality"
        else "Open-Meteo · CC BY 4.0"
        if adapter == "open-meteo"
        else "© OpenStreetMap contributors · ODbL 1.0"
        if static
        else None,
        rate_limit="Conservative ≤2 requests/s; default 5000/day; account limits may differ"
        if adapter == "ticketmaster"
        else "Public noncommercial API: 600/min, 5000/hour, 10000/day"
        if adapter.startswith("open-meteo")
        else "No published limit verified; honour 429 Retry-After"
        if adapter == "ptv"
        else None,
    )


class Ingestion:
    def __init__(self):
        self.cache = {}
        self.locks = {}
        self.retry_after = {}
        self.failures = {}

    async def get(self, source, city="melbourne"):
        from app import persistence as db

        c = city_config(city)
        schema, adapter, ttl = SCHEMAS[source], adapter_for(source, city), c["ttls"][source]
        key = source if city == "melbourne" else f"{city}:{source}"
        async with self.locks.setdefault(key, asyncio.Lock()):
            now = datetime.now(timezone.utc)
            saved = self.cache.get(key)
            if saved is None:
                saved = db.latest_source(source, schema, city)
                # Configuration changes never silently preserve a different provider.
                if saved and saved.metadata.source != adapter:
                    saved = None
            if saved:
                age = (
                    (now - saved.metadata.fetched_at).total_seconds()
                    if saved.metadata.fetched_at
                    else float("inf")
                )
                if age < ttl or now.timestamp() < self.retry_after.get(key, 0):
                    self.cache[key] = saved
                    return self._view(saved, now, ttl)
            fetcher = getattr(adapters, "fetch_" + source)
            attempt, started = now, time.monotonic()
            raw = []
            token = adapters.raw_payloads.set(raw)
            headers = {}
            rate_token = adapters.rate_headers.set(headers)
            try:
                result_tuple = fetcher(adapter) if city == "melbourne" else fetcher(adapter, city)
                data, observed, limitations = await asyncio.wait_for(result_tuple, timeout=26)
                now = datetime.now(timezone.utc)
                origin = "demo" if adapter == "demo" else "live"
                latency = round((time.monotonic() - started) * 1000, 1)
                result = schema(
                    **data,
                    metadata=dict(
                        source=adapter,
                        status="cached" if adapter == "delhi-metro-static" else origin,
                        origin_status=origin,
                        observed_at=observed,
                        fetched_at=now,
                        last_attempt_at=attempt,
                        latency_ms=latency,
                        ttl_seconds=ttl,
                        limitations=limitations,
                        **details(source, adapter, city),
                    ),
                )
                if headers:
                    result.metadata.rate_limit = "; ".join(f"{k}: {v}" for k, v in headers.items())
                db.record_source(source, result, city, latency)
                for payload in raw:
                    db.record_raw(source, city, adapter, payload)
                self.cache[key] = result
                self.failures.pop(key, None)
                self.retry_after.pop(key, None)
                return self._view(result, now, ttl, fresh=True)
            except Exception as exc:
                # Never return exception messages/URLs: provider credentials can appear there.
                code = (
                    "credentials_required"
                    if isinstance(exc, adapters.CredentialsRequired)
                    else "rate_limited"
                    if isinstance(exc, adapters.RateLimited)
                    else "timeout"
                    if isinstance(exc, (TimeoutError, httpx.TimeoutException))
                    else "authentication_failed"
                    if isinstance(exc, httpx.HTTPStatusError)
                    and exc.response.status_code in (401, 403)
                    else "provider_error"
                )
                self.failures[key] = self.failures.get(key, 0) + 1
                cooldown = (
                    exc.seconds
                    if isinstance(exc, adapters.RateLimited)
                    else 300
                    if code in ("credentials_required", "authentication_failed")
                    else min(900, 60 * 2 ** min(self.failures[key] - 1, 4))
                )
                self.retry_after[key] = now.timestamp() + cooldown
                latency = round((time.monotonic() - started) * 1000, 1)
                db.record_failure(source, city, code, latency)
                error = (
                    "Credentials required. Configure the server adapter or explicitly select demo mode."
                    if code == "credentials_required"
                    else "Provider refresh failed; last successful data retained where available."
                )
                if saved:
                    result = saved.model_copy(deep=True)
                    result.metadata.error = error
                    result.metadata.error_code = code
                    result.metadata.last_attempt_at = attempt
                    result.metadata.latency_ms = latency
                else:
                    result = schema(
                        metadata=dict(
                            source=adapter,
                            status="unavailable",
                            origin_status="unavailable",
                            ttl_seconds=ttl,
                            error=error,
                            error_code=code,
                            last_attempt_at=attempt,
                            latency_ms=latency,
                            **details(source, adapter, city),
                        )
                    )
                if headers:
                    result.metadata.rate_limit = "; ".join(f"{k}: {v}" for k, v in headers.items())
                self.cache[key] = result
                return self._view(result, now, ttl)
            finally:
                adapters.raw_payloads.reset(token)
                adapters.rate_headers.reset(rate_token)

    def _view(self, saved, now, ttl, fresh=False):
        result = saved.model_copy(deep=True)
        meta = result.metadata
        meta.age_seconds = (
            max(0, (now - meta.observed_at).total_seconds()) if meta.observed_at else None
        )
        meta.cache_age_seconds = (
            max(0, (now - meta.fetched_at).total_seconds()) if meta.fetched_at else None
        )
        if meta.origin_status == "unavailable":
            return result
        meta.stale = (
            bool(meta.error)
            or (meta.cache_age_seconds or 0) > ttl
            or (
                meta.data_kind != "static"
                and meta.origin_status == "live"
                and (meta.age_seconds or 0) > max(3600, ttl * 2)
            )
        )
        if meta.origin_status == "live":
            meta.status = (
                "stale"
                if meta.stale
                else "live"
                if fresh and meta.data_kind != "static"
                else "cached"
            )
        return result

    async def all(self, city="melbourne"):
        values = await asyncio.gather(*(self.get(s, city) for s in SCHEMAS))
        return dict(zip(SCHEMAS, values))


ingestion = Ingestion()
