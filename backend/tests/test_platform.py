import asyncio
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from fastapi.testclient import TestClient

from app import adapters
from app import persistence as db
from app.analytics import activity_score
from app.ingestion import ingestion
from app.main import app


@pytest.mark.asyncio
async def test_demo_contracts_score_and_persistence():
    signals = await ingestion.all()
    assert all(s.metadata.status == "demo" for s in signals.values())
    a = activity_score(signals, datetime(2026, 1, 1, 1, tzinfo=timezone.utc))
    assert a["score"] == round(sum(c["contribution"] for c in a["components"]), 1)
    assert a["coverage"] == 1 and a["demo"]
    db.record_activity(a, signals)
    db.record_activity(a, signals)
    assert db.coverage()["activity"]["count"] == 1
    assert len(db.history()) == 1
    assert db.history()[0]["provenance"]["weather"]["origin_status"] == "demo"


@pytest.mark.asyncio
async def test_cache_singleflight(monkeypatch):
    count = 0
    original = adapters.fetch_weather

    async def counted(adapter):
        nonlocal count
        count += 1
        await asyncio.sleep(0.01)
        return await original(adapter)

    monkeypatch.setattr(adapters, "fetch_weather", counted)
    await asyncio.gather(*[ingestion.get("weather") for _ in range(8)])
    assert count == 1
    assert db.coverage()["weather"]["count"] == 1


@pytest.mark.asyncio
async def test_failure_does_not_leak_secrets(monkeypatch):
    async def failure(adapter):
        raise httpx.ReadTimeout("secret=DO_NOT_RETURN")

    monkeypatch.setattr(adapters, "fetch_weather", failure)
    result = await ingestion.get("weather")
    assert result.metadata.status == "unavailable"
    assert "DO_NOT_RETURN" not in result.model_dump_json()
    assert result.temperature is None


@pytest.mark.asyncio
async def test_failed_refresh_preserves_last_success(monkeypatch):
    saved = await ingestion.get("weather")
    ingestion.cache["weather"].metadata.fetched_at -= timedelta(hours=2)
    saved = ingestion.cache["weather"]

    async def failure(adapter):
        raise RuntimeError("private")

    monkeypatch.setattr(adapters, "fetch_weather", failure)
    result = await ingestion.get("weather")
    assert result.temperature == 18 and result.metadata.stale
    assert result.metadata.fetched_at == saved.metadata.fetched_at


@pytest.mark.asyncio
async def test_missing_components_not_filled():
    signals = await ingestion.all()
    for s in signals.values():
        s.metadata.status = "unavailable"
    assert activity_score(signals)["score"] is None
    assert activity_score(signals)["coverage"] == 0


@pytest.mark.asyncio
async def test_score_bounds_and_sensitivity():
    signals = await ingestion.all()
    low = activity_score(signals)["score"]
    signals["events"].event_count += 1
    assert activity_score(signals)["score"] == low + 4
    signals["events"].event_count = 10000
    signals["transport"].disruption_count = 10000
    assert activity_score(signals)["score"] <= 100


@pytest.mark.asyncio
async def test_openweather_units_and_timestamp(monkeypatch):
    monkeypatch.setenv("OPENWEATHER_API_KEY", "test")

    async def fixture(*args, **kwargs):
        return dict(
            main=dict(temp=20, humidity=50),
            weather=[dict(main="Clear", description="clear")],
            wind=dict(speed=10),
            dt=1700000000,
        )

    monkeypatch.setattr(adapters, "request_json", fixture)
    result, stamp, _ = await adapters.fetch_weather("openweather")
    assert result["wind_speed"] == 36
    assert stamp.tzinfo is not None


@pytest.mark.asyncio
async def test_ticketmaster_empty_and_coordinates(monkeypatch):
    monkeypatch.setenv("TICKETMASTER_API_KEY", "test")

    async def fixture(*args, **kwargs):
        return {
            "_embedded": {
                "events": [
                    {
                        "name": "Fixture",
                        "_embedded": {
                            "venues": [
                                {
                                    "name": "Venue",
                                    "location": {"longitude": "144.96", "latitude": "-37.81"},
                                }
                            ]
                        },
                    }
                ]
            }
        }

    monkeypatch.setattr(adapters, "request_json", fixture)
    result, _, _ = await adapters.fetch_events("ticketmaster")
    assert result["event_count"] == 1
    assert result["items"][0]["coordinates"] == (144.96, -37.81)


@pytest.mark.asyncio
async def test_ptv_no_truncation_or_inferred_severity(monkeypatch):
    monkeypatch.setenv("PTV_DEVID", "test")
    monkeypatch.setenv("PTV_API_KEY", "test")

    async def fixture(*args, **kwargs):
        return {
            "disruptions": {
                "metro_train": [{"title": f"Notice {i}", "routes": []} for i in range(12)]
            }
        }

    monkeypatch.setattr(adapters, "request_json", fixture)
    result, _, _ = await adapters.fetch_transport("ptv")
    assert result["disruption_count"] == 12
    assert result["items"][0]["severity"] == "unknown"
    assert result["items"][0]["mode"] == "train"


def test_api_and_operator():
    with TestClient(app) as client:
        for endpoint in ("weather", "transport", "events", "activity"):
            assert client.get("/" + endpoint).status_code == 200
            assert client.get("/api/v1/" + endpoint).status_code == 200
        assert client.get("/health").json()["storage"] == "ready"
        assert client.get("/api/v1/history?hours=999999").status_code == 422
        assert "provenance" in client.get("/api/v1/history.csv").text
        for question, intent in [
            ("Why is the score elevated?", "activity"),
            ("Weather outlook?", "weather"),
            ("Major disruptions?", "transport"),
            ("Upcoming CBD events?", "events"),
            ("Which sources are unavailable?", "source_health"),
            ("What is the forecast based on?", "forecast"),
        ]:
            result = client.post("/api/v1/operator", json={"question": question}).json()
            assert result["intent"] == intent
        assert client.post("/api/v1/operator", json={"question": ""}).status_code == 422
        assert client.get("/api/v1/forecast?model=unknown").status_code == 422
