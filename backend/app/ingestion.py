import asyncio
from datetime import datetime, timezone

from app import adapters
from app.config import settings
from app.schemas import Events, Transport, Weather


class Ingestion:
    def __init__(self):
        self.cache = {}
        self.locks = {s: asyncio.Lock() for s in ("weather", "transport", "events")}
        self.retry_after = {}

    async def get(self, source):
        schema, fetcher, adapter, ttl = {
            "weather": (Weather, adapters.fetch_weather, settings.weather_adapter, 600),
            "transport": (Transport, adapters.fetch_transport, settings.transport_adapter, 120),
            "events": (Events, adapters.fetch_events, settings.events_adapter, 1800),
        }[source]
        async with self.locks[source]:
            now = datetime.now(timezone.utc)
            saved = self.cache.get(source)
            if saved:
                age = (
                    (now - saved.metadata.fetched_at).total_seconds()
                    if saved.metadata.fetched_at
                    else float("inf")
                )
                if age < ttl or now.timestamp() < self.retry_after.get(source, 0):
                    return self._view(saved, now, ttl)
            try:
                data, observed, limitations = await asyncio.wait_for(fetcher(adapter), timeout=26)
                now = datetime.now(timezone.utc)
                origin = "demo" if adapter == "demo" else "live"
                result = schema(
                    **data,
                    metadata=dict(
                        source=adapter,
                        status=origin,
                        origin_status=origin,
                        observed_at=observed,
                        fetched_at=now,
                        age_seconds=max(0, (now - observed).total_seconds()) if observed else None,
                        ttl_seconds=ttl,
                        limitations=limitations,
                    ),
                )
                self.cache[source] = result
                from app.persistence import record_source

                record_source(source, result)
                return self._view(result, now, ttl, fresh=True)
            except Exception:
                # Deliberately do not return/log exception bodies: URLs can carry keys.
                from app.persistence import record_failure

                record_failure(source)
                self.retry_after[source] = now.timestamp() + 60
                if saved:
                    saved = saved.model_copy(deep=True)
                    saved.metadata.error = "Provider refresh failed; last successful data retained."
                    saved.metadata.stale = True
                    self.cache[source] = saved
                    return self._view(saved, now, ttl)
                result = schema(
                    metadata=dict(
                        source=adapter,
                        status="unavailable",
                        origin_status="unavailable",
                        ttl_seconds=ttl,
                        error="Source unavailable. Check server configuration or provider connectivity.",
                    )
                )
                self.cache[source] = result
                return result

    def _view(self, saved, now, ttl, fresh=False):
        result = saved.model_copy(deep=True)
        meta = result.metadata
        if meta.observed_at:
            meta.age_seconds = max(0, (now - meta.observed_at).total_seconds())
        expired = meta.fetched_at is None or (now - meta.fetched_at).total_seconds() > ttl
        meta.stale = (
            bool(meta.error)
            or expired
            or (meta.origin_status == "live" and (meta.age_seconds or 0) > max(3600, ttl * 2))
        )
        if meta.origin_status == "live" and not fresh:
            meta.status = "cached"
        return result

    async def all(self):
        values = await asyncio.gather(*(self.get(s) for s in self.locks))
        return dict(zip(self.locks, values))


ingestion = Ingestion()
