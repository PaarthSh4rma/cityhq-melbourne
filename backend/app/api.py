import csv
import io
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Query
from fastapi.responses import Response

from app import persistence as db
from app.analytics import activity_score
from app.config import settings
from app.ingestion import ingestion
from app.operator import answer
from app.schemas import Ask, Events, Transport, Weather

router = APIRouter()


@router.get("/weather", response_model=Weather)
async def weather():
    return await ingestion.get("weather")


@router.get("/transport", response_model=Transport)
async def transport():
    return await ingestion.get("transport")


@router.get("/events", response_model=Events)
async def events():
    return await ingestion.get("events")


@router.get("/activity")
async def activity():
    return activity_score(await ingestion.all())


@router.get("/history")
def history(hours: int = Query(24, ge=1, le=2160)):
    return dict(
        items=db.history(hours),
        aggregation="hourly latest snapshot",
        limitations=[
            "Includes explicitly tagged demo sources; sparse history is not interpolated."
        ],
    )


@router.get("/history.csv")
def export(hours: int = Query(24, ge=1, le=2160)):
    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=["timestamp", "score", "temperature", "disruptions", "events", "provenance"],
    )
    writer.writeheader()
    writer.writerows(db.history(hours))
    return Response(
        output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=cityhq-history.csv"},
    )


@router.get("/forecast")
def forecast(
    model: Literal["selected", "baseline", "ridge", "random_forest"] = "selected",
    horizon: int = Query(1, ge=1, le=6),
):
    from app.ml.inference import forecast as predict

    return predict(model, horizon)


@router.get("/diagnostics")
async def diagnostics():
    signals = await ingestion.all()
    return dict(
        api="reachable",
        sources={k: v.metadata for k, v in signals.items()},
        coverage=db.coverage(),
        ingestion_runs=db.recent_runs(),
        model_version="temperature-v1"
        if Path(settings.artifact_dir, "temperature.joblib").exists()
        else None,
    )


@router.post("/operator")
async def operator(body: Ask):
    return await answer(body.question, await ingestion.all())
