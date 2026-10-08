import asyncio
import csv
import io
import time
from collections import OrderedDict, deque
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import Response

from app import persistence as db
from app.analytics import activity_score, total_score
from app.cities import CITIES, CityId, model_directory
from app.ingestion import ingestion
from app.operator import answer
from app.schemas import AirQuality, Ask, Events, Scenario, Transport, Weather
from app.timeline import compare, snapshot

router = APIRouter()
operator_clients = OrderedDict()
operator_slots = asyncio.Semaphore(4)


@router.get("/weather", response_model=Weather)
async def weather(city: CityId = "melbourne"):
    return await ingestion.get("weather", city)


@router.get("/transport", response_model=Transport)
async def transport(city: CityId = "melbourne"):
    return await ingestion.get("transport", city)


@router.get("/events", response_model=Events)
async def events(city: CityId = "melbourne"):
    return await ingestion.get("events", city)


@router.get("/activity")
async def activity(city: CityId = "melbourne"):
    return activity_score(await ingestion.all(city), city=city)


@router.get("/history")
def history(hours: int = Query(24, ge=1, le=2160), city: CityId = "melbourne"):
    return dict(
        items=db.history(hours, city),
        aggregation="hourly latest snapshot",
        limitations=[
            "Includes explicitly tagged demo sources; sparse history is not interpolated."
        ],
    )


@router.get("/history.csv")
def export(hours: int = Query(24, ge=1, le=2160), city: CityId = "melbourne"):
    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=[
            "timestamp",
            "score",
            "temperature",
            "disruptions",
            "events",
            "us_aqi",
            "provenance",
        ],
    )
    writer.writeheader()
    writer.writerows(db.history(hours, city))
    return Response(
        output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=cityhq-history.csv"},
    )


@router.get("/forecast")
def forecast(
    model: Literal["selected", "baseline", "ridge", "random_forest"] = "selected",
    horizon: int = Query(1, ge=1, le=6),
    city: CityId = "melbourne",
):
    from app.ml.inference import forecast as predict

    return predict(model, horizon, city)


@router.get("/diagnostics")
async def diagnostics(city: CityId = "melbourne"):
    signals = await ingestion.all(city)
    return dict(
        city_id=city,
        api="reachable",
        sources={k: v.metadata for k, v in signals.items()},
        coverage=db.coverage(city),
        ingestion_runs=db.recent_runs(city),
        model_version="temperature-v1"
        if (model_directory(city) / "temperature.joblib").exists()
        else None,
    )


@router.post("/operator")
async def operator(body: Ask, request: Request):
    key = request.client.host if request.client else "local"
    now = time.monotonic()
    calls = operator_clients.setdefault(key, deque())
    operator_clients.move_to_end(key)
    while calls and now - calls[0] > 60:
        calls.popleft()
    if len(calls) >= 30:
        raise HTTPException(429, "Operator request limit reached. Retry in one minute.")
    calls.append(now)
    if len(operator_clients) > 1024:
        operator_clients.popitem(last=False)
    try:
        await asyncio.wait_for(operator_slots.acquire(), timeout=0.25)
    except TimeoutError:
        raise HTTPException(429, "Operator is busy. Please retry.") from None
    try:

        async def run():
            from app.operator import resolve_city

            selected = resolve_city(body.question, body.city)
            return await answer(body.question, await ingestion.all(selected), selected, body.city)

        return await asyncio.wait_for(run(), timeout=28)
    except TimeoutError:
        raise HTTPException(504, "City signals did not respond in time.") from None
    finally:
        operator_slots.release()


def historical_time(at: str):
    try:
        parsed = datetime.fromisoformat(at.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            raise ValueError("Timezone required")
        parsed = parsed.astimezone(timezone.utc)
        if parsed > db.utcnow():
            raise ValueError("Future timestamp")
        return parsed
    except ValueError:
        raise HTTPException(422, "Supply a past ISO timestamp with timezone.") from None


@router.get("/timeline")
def timeline(at: str = Query(max_length=40), city: CityId = "melbourne"):
    return snapshot(historical_time(at), city)


@router.get("/timeline/captures")
def timeline_captures(city: CityId = "melbourne"):
    from sqlalchemy import select
    from sqlalchemy.orm import Session

    with Session(db.engine) as session:
        items = [
            dict(source=name, timestamp=stamp)
            for name, table in db.TABLES.items()
            for stamp in session.scalars(
                select(table.timestamp)
                .where(table.city_id == city)
                .order_by(table.timestamp.desc())
                .limit(96)
            )
        ]
    return {
        "items": sorted(items, key=lambda x: x["timestamp"], reverse=True),
        "limitations": [
            "Latest 96 captures per source. Historical queries can use any earlier retained timestamp."
        ],
    }


@router.get("/history/compare")
def history_compare(hours: int = Query(6, ge=1, le=720), city: CityId = "melbourne"):
    return compare(db.utcnow(), hours, city)


@router.post("/scenario")
async def scenario(body: Scenario, city: CityId = "melbourne"):
    if city == "delhi" and body.transport != 0:
        raise HTTPException(
            422,
            "Static Delhi Metro is not a measured disruption component; transport override must be zero.",
        )
    current = activity_score(await ingestion.all(city), city=city)
    time_context = next(
        c["contribution"] for c in current["components"] if c["name"] == "Time context"
    )
    return {
        "label": "Scenario simulation — not a real-world causal forecast",
        "before": current,
        "after": total_score([time_context, body.events, body.transport, body.weather]),
        "assumptions": body.model_dump(),
        "methodology_version": current["methodology_version"],
        "limitations": [
            "Manual contribution overrides, not a trained forecast.",
            "Time context is held fixed. Simulated inputs do not change stored observations.",
        ],
    }


@router.get("/cities")
def cities():
    return CITIES


@router.get("/air-quality", response_model=AirQuality)
async def air_quality(city: CityId = "melbourne"):
    return await ingestion.get("air_quality", city)


@router.get("/compare/air-quality")
async def compare_air_quality():
    from app.operator import compare_air_quality as comparison

    return await comparison()


@router.get("/metro")
async def metro(city: CityId = "delhi"):
    signal = await ingestion.get("transport", city)
    return {
        "city_id": city,
        "metadata": signal.metadata,
        "network": signal.network,
        "operational_status_available": signal.operational_status_available,
    }
