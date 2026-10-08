"""Offline provider fixtures and city boundary regression coverage."""

import asyncio
import hashlib
import hmac
import importlib
import json
import os
import subprocess
import sys
from dataclasses import replace
from datetime import timedelta
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import adapters
from app import persistence as db
from app.analytics import activity_score
from app.cities import CITIES
from app.ingestion import Ingestion, ingestion
from app.main import app
from app.ml.pipeline import backtest, features, observed_frame, synthetic_data, train
from app.operator import answer, compare_air_quality, resolve_city
from app.services_transport import build_signed_url
from app.timeline import snapshot


@pytest.mark.parametrize("city", CITIES)
@pytest.mark.asyncio
async def test_real_weather_fixtures(city, monkeypatch):
    payload = json.loads((Path(__file__).parent / "fixtures" / f"{city}-weather.json").read_text())
    captured = []

    async def fixture(url, params):
        captured.append(params)
        return payload

    monkeypatch.setattr(adapters, "request_json", fixture)
    data, observed, limitations = await adapters.fetch_weather("open-meteo", city)
    assert data["temperature"] == payload["current"]["temperature_2m"]
    assert observed.timestamp() == payload["current"]["time"]
    assert data["city"] == CITIES[city]["name"] and data["hourly"] and data["forecast"]
    assert captured[0]["timezone"] == CITIES[city]["timezone"]
    assert "Modelled" in limitations[0]
    payload["current_units"]["wind_speed_10m"] = "m/s"
    with pytest.raises(ValueError):
        await adapters.fetch_weather("open-meteo", city)


@pytest.mark.parametrize("city", CITIES)
@pytest.mark.asyncio
async def test_air_quality_standards_and_nulls(city, monkeypatch):
    payload = json.loads(
        (Path(__file__).parent / "fixtures" / f"{city}-air-quality.json").read_text()
    )

    async def fixture(*args):
        return payload

    monkeypatch.setattr(adapters, "request_json", fixture)
    data, observed, limitations = await adapters.fetch_air_quality("open-meteo-aq", city)
    assert data["us_aqi"] == payload["current"]["us_aqi"]
    assert data["european_aqi"] == payload["current"]["european_aqi"]
    assert observed.tzinfo and "not station" in limitations[0]
    payload["current"]["pm2_5"] = None
    assert (await adapters.fetch_air_quality("open-meteo-aq", city))[0]["pm2_5"] is None
    payload["current"]["pm2_5"] = -5
    with pytest.raises(ValueError):
        await adapters.fetch_air_quality("open-meteo-aq", city)


def test_ptv_signature_matches_exact_repeated_query(monkeypatch):
    monkeypatch.setenv("PTV_DEVID", "test-id")
    monkeypatch.setenv("PTV_API_KEY", "fixture-secret")
    url = build_signed_url("/v3/disruptions", {"route_types": [0, 1, 2]})
    raw = url.removeprefix("https://timetableapi.ptv.vic.gov.au").split("&signature=")[0]
    assert url.endswith(hmac.new(b"fixture-secret", raw.encode(), hashlib.sha1).hexdigest().upper())
    assert parse_qs(urlsplit(url).query)["route_types"] == ["0", "1", "2"]


@pytest.mark.asyncio
async def test_ptv_rich_notice_and_no_invented_point(monkeypatch):
    monkeypatch.setenv("PTV_DEVID", "fixture")
    monkeypatch.setenv("PTV_API_KEY", "fixture")

    async def fixture(*args):
        return {
            "disruptions": {
                "metro_train": [
                    {
                        "disruption_id": 12,
                        "title": "Fixture notice",
                        "disruption_status": "Planned",
                        "disruption_type": "Works",
                        "from_date": "2026-10-09T01:00:00Z",
                        "to_date": None,
                        "routes": [{"route_name": "Fixture route"}],
                        "stops": [{"stop_id": 42}],
                    }
                ]
            }
        }

    monkeypatch.setattr(adapters, "request_json", fixture)
    data, _, _ = await adapters.fetch_transport("ptv")
    item = data["items"][0]
    assert item["severity"] == "unknown" and item["publication_status"] == "Planned"
    assert item["start_at"] and item["end_at"] is None and "coordinates" not in item
    assert item["geographic_references"] == [{"stop_id": 42}]


@pytest.mark.asyncio
async def test_ticketmaster_pagination_country_and_zero(monkeypatch):
    monkeypatch.setenv("TICKETMASTER_API_KEY", "fixture")
    calls = []

    async def fixture(url, params):
        calls.append(params.copy())
        return {
            "page": {"totalPages": 2},
            "_embedded": {
                "events": [
                    {
                        "id": str(params["page"]),
                        "name": "Fixture",
                        "url": "https://example.test/event",
                        "_embedded": {
                            "venues": [
                                {
                                    "name": "Fixture venue",
                                    "location": {"longitude": "77.2", "latitude": "28.6"},
                                }
                            ]
                        },
                    }
                ]
            },
        }

    async def sleep(*args):
        pass

    monkeypatch.setattr(adapters, "request_json", fixture)
    monkeypatch.setattr(adapters.asyncio, "sleep", sleep)
    data, _, _ = await adapters.fetch_events("ticketmaster", "delhi")
    assert data["event_count"] == 2 and data["items"][0]["url"]
    assert all(p["city"] == "Delhi" and p["countryCode"] == "IN" for p in calls)
    assert [p["page"] for p in calls] == [0, 1]

    async def empty(*args):
        return {"page": {"totalPages": 0, "totalElements": 0}}

    monkeypatch.setattr(adapters, "request_json", empty)
    data, _, _ = await adapters.fetch_events("ticketmaster", "delhi")
    assert data["event_count"] == 0 and data["status"] == "No listings"


@pytest.mark.asyncio
async def test_missing_credentials_are_unavailable_with_cooldown(monkeypatch):
    module = importlib.import_module("app.ingestion")
    monkeypatch.setattr(
        module,
        "settings",
        replace(module.settings, events_adapter="ticketmaster", transport_adapter="ptv"),
    )
    for key in ["TICKETMASTER_API_KEY", "PTV_DEVID", "PTV_API_KEY"]:
        monkeypatch.delenv(key, raising=False)
    for source in ["events", "transport"]:
        value = await ingestion.get(source)
        assert (
            value.metadata.status == "unavailable"
            and value.metadata.error_code == "credentials_required"
        )
        await ingestion.get(source)
    assert len(db.recent_runs()) == 2


@pytest.mark.asyncio
async def test_rate_limit_respects_retry_after_without_leaking(monkeypatch):
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
            return httpx.Response(
                429, headers={"Retry-After": "120"}, request=httpx.Request("GET", url)
            )

    monkeypatch.setattr(adapters.httpx, "AsyncClient", Client)
    with pytest.raises(adapters.RateLimited) as error:
        await adapters.request_json("https://example.test/?apikey=private")
    assert error.value.seconds == 120 and len(calls) == 1

    async def fail(adapter):
        raise adapters.RateLimited(120)

    monkeypatch.setattr(adapters, "fetch_weather", fail)
    value = await ingestion.get("weather")
    assert (
        value.metadata.error_code == "rate_limited"
        and ingestion.retry_after["weather"] - db.utcnow().timestamp() > 110
    )


@pytest.mark.asyncio
async def test_city_cache_storage_replay_and_restart_isolation():
    melb, delhi = await asyncio.gather(ingestion.all("melbourne"), ingestion.all("delhi"))
    assert melb["weather"].temperature == 18 and delhi["weather"].temperature == 27
    for city, signals in [("melbourne", melb), ("delhi", delhi)]:
        db.record_activity(activity_score(signals, city=city), signals, city)
        db.record_activity(activity_score(signals, city=city), signals, city)
        assert db.coverage(city)["activity"]["count"] == 1
        assert len(db.history(city=city)) == 1
        captured = snapshot(db.utcnow(), city)
        assert captured["signals"]["weather"]["metadata"]["city_id"] == city
    assert (await Ingestion().get("weather", "delhi")).temperature == 27
    assert db.history(city="melbourne")[0]["temperature"] == 18
    assert db.history(city="delhi")[0]["temperature"] == 27


@pytest.mark.asyncio
async def test_static_network_is_honest_and_pollution_not_activity():
    values = await ingestion.all("delhi")
    network = values["transport"].network
    assert len(network["stations"]) > 200 and len(network["lines"]) > 10
    assert all(
        s["source"].startswith("https://www.openstreetmap.org/node/") for s in network["stations"]
    )
    assert any(f["geometry"]["type"] == "MultiLineString" for f in network["features"])
    assert (
        values["transport"].metadata.data_kind == "static"
        and not values["transport"].operational_status_available
    )
    score = activity_score(values, city="delhi")
    values["air_quality"].us_aqi = 500
    assert activity_score(values, city="delhi")["score"] == score["score"]
    assert score["maximum"] == 75 and "Service notices" not in [
        c["name"] for c in score["components"]
    ]


@pytest.mark.asyncio
async def test_real_cache_stale_and_timeout(monkeypatch):
    saved = await ingestion.get("weather")
    saved.metadata.origin_status = "live"
    saved.metadata.data_kind = "modelled"
    ingestion.cache["weather"] = saved
    assert (await ingestion.get("weather")).metadata.status == "cached"
    saved.metadata.fetched_at -= timedelta(hours=3)

    async def fail(adapter):
        raise httpx.ReadTimeout("apikey=PRIVATE")

    monkeypatch.setattr(adapters, "fetch_weather", fail)
    value = await ingestion.get("weather")
    assert value.metadata.status == "stale" and value.metadata.error_code == "timeout"
    assert "PRIVATE" not in value.model_dump_json()


@pytest.mark.asyncio
async def test_operator_cities_and_comparisons():
    assert resolve_city("Weather in Delhi", "melbourne") == "delhi"
    signals = await ingestion.all("delhi")
    response = await answer("What's the AQI in Delhi?", signals, "delhi", "melbourne")
    assert response["actions"][0] == {"type": "switch_city", "city": "delhi"}
    assert response["references"][0]["city_id"] == "delhi"
    assert (await answer("Show Delhi Metro stations", signals, "delhi"))["intent"] == "metro"
    response = await answer("Which city has worse air quality right now?", signals, "delhi")
    assert response["actions"] == [{"type": "compare_city_metric", "metric": "us_aqi"}]
    result = await compare_air_quality()
    assert result["standard"] == "US AQI" and result["comparable"]
    ingestion.cache["air_quality"].metadata.observed_at -= timedelta(hours=5)
    assert not (await compare_air_quality())["comparable"]


@pytest.mark.asyncio
async def test_api_rejects_third_city_and_supports_city_posts():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        assert (await client.get("/api/v1/weather?city=sydney")).status_code == 422
        assert (
            await client.post("/api/v1/operator", json={"question": "weather", "city": "london"})
        ).status_code == 422
        result = await client.post(
            "/api/v1/operator", json={"question": "Switch to Delhi.", "city": "melbourne"}
        )
        assert result.json()["city_id"] == "delhi"
        for route in [
            "weather",
            "air-quality",
            "transport",
            "events",
            "activity",
            "history",
            "diagnostics",
            "timeline/captures",
            "forecast",
        ]:
            assert (await client.get(f"/api/v1/{route}?city=delhi")).status_code == 200


def test_raw_payloads_redact_credentials():
    db.record_raw(
        "events",
        "delhi",
        "ticketmaster",
        {
            "apikey": "PRIVATE",
            "_links": {"next": {"href": "https://example.test/events?apikey=PRIVATE&page=1"}},
        },
    )
    with Session(db.engine) as session:
        body = session.scalar(select(db.RawPayload.payload))
    assert "PRIVATE" not in body and "page=1" in body


def test_city_ml_features_artifacts_and_insufficient_observations(tmp_path, monkeypatch):
    frame = synthetic_data(days=15, city="delhi")
    assert not features(frame, "delhi").hour_sin.equals(features(frame, "melbourne").hour_sin)
    report = train(frame, output=tmp_path, city="delhi")
    assert report["city_id"] == "delhi" and report["backtesting"]["status"] == "synthetic_only"
    assert backtest(observed_frame("delhi"), "delhi")["status"] == "insufficient_coverage"
    evaluated = backtest(frame, "delhi")
    assert len(evaluated["folds"]) == 3 and all(
        f["train_end"] < f["test_start"] for f in evaluated["folds"]
    )
    from types import SimpleNamespace

    from app.ml import inference

    monkeypatch.setattr(inference, "settings", SimpleNamespace(artifact_dir=str(tmp_path)))
    assert inference.forecast(city="melbourne")["reason"] == "Model artifact city mismatch."
    assert not inference.forecast(city="delhi")["available"]


def test_registry_copy_identical():
    assert json.loads(Path("app/cities.json").read_text()) == json.loads(
        Path("../frontend/lib/cities.json").read_text()
    )


def test_migration_preserves_legacy_duplicate_records(tmp_path):
    path = tmp_path / "migration.db"
    env = {**os.environ, "DATABASE_URL": f"sqlite:///{path}"}

    def migrate(target):
        subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", target],
            env=env,
            check=True,
            capture_output=True,
        )

    migrate("0001")
    import sqlite3

    with sqlite3.connect(path) as con:
        for _ in range(2):
            con.execute(
                "INSERT INTO model_predictions(timestamp,digest,payload) VALUES('2026-01-01T00:00:00+00:00','legacy-duplicate','{}')"
            )
        con.execute(
            "INSERT INTO activity_features(timestamp,score,payload) VALUES('2026-01-01T00:00:00+00:00',42,'{}')"
        )
    migrate("head")
    migrate("head")
    with sqlite3.connect(path) as con:
        assert (
            con.execute(
                "SELECT COUNT(*) FROM model_predictions WHERE city_id='melbourne'"
            ).fetchone()[0]
            == 2
        )
        con.execute(
            "INSERT INTO activity_features(city_id,timestamp,score,payload) VALUES('delhi','2026-01-01T00:00:00+00:00',21,'{}')"
        )
        assert con.execute("SELECT COUNT(*) FROM activity_features").fetchone()[0] == 2
