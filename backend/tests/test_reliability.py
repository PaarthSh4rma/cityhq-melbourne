import asyncio
from datetime import timedelta

import httpx
import pytest

from app import adapters
from app import persistence as db
from app.analytics import activity_score
from app.ingestion import ingestion


@pytest.mark.asyncio
async def test_network_retry_backoff(monkeypatch):
    calls, delays = [], []

    class Client:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def get(self, url, params=None):
            calls.append(url)
            if len(calls) < 3:
                raise httpx.ReadTimeout("timeout")
            return httpx.Response(200, json={"ok": True}, request=httpx.Request("GET", url))

    async def sleep(seconds):
        delays.append(seconds)

    monkeypatch.setattr(adapters.httpx, "AsyncClient", Client)
    monkeypatch.setattr(adapters.asyncio, "sleep", sleep)
    assert await adapters.request_json("https://example.test") == {"ok": True}
    assert len(calls) == 3 and delays == [0.25, 0.5]


@pytest.mark.asyncio
async def test_auth_failures_do_not_retry(monkeypatch):
    calls = []

    class Client:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def get(self, url, params=None):
            calls.append(url)
            return httpx.Response(401, request=httpx.Request("GET", url))

    monkeypatch.setattr(adapters.httpx, "AsyncClient", Client)
    with pytest.raises(httpx.HTTPStatusError):
        await adapters.request_json("https://example.test")
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_unavailable_history_is_null():
    signals = await ingestion.all()
    signals["weather"].metadata.stale = True
    signals["transport"].metadata.status = "unavailable"
    db.record_activity(activity_score(signals), signals)
    row = db.history()[0]
    assert row["temperature"] is None and row["disruptions"] is None


@pytest.mark.asyncio
async def test_failure_cooldown(monkeypatch):
    calls = []

    async def fail(adapter):
        calls.append(adapter)
        raise asyncio.TimeoutError()

    monkeypatch.setattr(adapters, "fetch_weather", fail)
    await ingestion.get("weather")
    await ingestion.get("weather")
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_retention_removes_old_rows():
    from sqlalchemy.orm import Session

    await ingestion.all()
    with Session(db.engine) as session:
        session.add(
            db.IngestionRun(
                timestamp=(db.utcnow() - timedelta(days=365)).isoformat(),
                source="weather",
                status="success",
            )
        )
        session.commit()
    db.retain()
    assert all(
        r["timestamp"] > (db.utcnow() - timedelta(days=91)).isoformat() for r in db.recent_runs()
    )


@pytest.mark.asyncio
async def test_wttr_without_dated_observation(monkeypatch):
    async def fixture(*args, **kwargs):
        return {
            "current_condition": [
                {
                    "temp_C": "21",
                    "weatherDesc": [{"value": "Sunny"}],
                    "windspeedKmph": "18",
                    "humidity": "35",
                    "observation_time": "02:38 AM",
                }
            ],
            "weather": [],
        }

    monkeypatch.setattr(adapters, "request_json", fixture)
    data, observed, limitations = await adapters.fetch_weather("wttr")
    assert data["temperature"] == 21 and observed is None
    assert any("unknown" in text for text in limitations)


@pytest.mark.asyncio
async def test_wttr_with_dated_observation(monkeypatch):
    async def fixture(*args, **kwargs):
        return {
            "current_condition": [
                {
                    "temp_C": "21",
                    "weatherDesc": [{"value": "Sunny"}],
                    "windspeedKmph": "18",
                    "humidity": "35",
                    "localObsDateTime": "2026-10-08 02:00 PM",
                }
            ],
            "weather": [],
        }

    monkeypatch.setattr(adapters, "request_json", fixture)
    data, observed, _ = await adapters.fetch_weather("wttr")
    assert observed.hour == 3 and observed.tzinfo is not None
