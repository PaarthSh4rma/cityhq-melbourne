import asyncio
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app import persistence as db
from app.analytics import activity_score
from app.api import router
from app.config import settings
from app.ingestion import ingestion


async def ingest_loop():
    while True:
        try:
            signals = await ingestion.all()
            db.record_activity(activity_score(signals), signals)
            db.retain()
        except Exception:
            # Keep the loop alive; diagnostics/health expose storage or feed failures.
            import logging

            logging.getLogger("cityhq").error(
                "Ingestion cycle failed; check storage and source health."
            )
        await asyncio.sleep(settings.ingestion_seconds)


@asynccontextmanager
async def lifespan(app):
    # Schema managed through Alembic; fail startup if migrations were not applied.
    with db.engine.connect() as connection:
        connection.execute(text("SELECT id FROM ingestion_runs LIMIT 1"))
    task = asyncio.create_task(ingest_loop())
    yield
    task.cancel()
    with suppress(asyncio.CancelledError):
        await task


app = FastAPI(title="CITYHQ Melbourne API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)
app.include_router(router, prefix="/api/v1")
for path in ("weather", "transport", "events", "activity"):
    route = next(r for r in router.routes if r.path == "/" + path)
    app.add_api_route(
        "/" + path, route.endpoint, methods=["GET"], response_model=route.response_model
    )


@app.get("/")
def root():
    return {"message": "CityHQ backend running", "docs": "/docs"}


@app.get("/health")
def health():
    try:
        with db.engine.connect() as connection:
            connection.execute(text("SELECT id FROM ingestion_runs LIMIT 1"))
        return {
            "api": "reachable",
            "storage": "ready",
            "note": "Feed status is reported separately in /api/v1/diagnostics.",
        }
    except Exception:
        return JSONResponse(status_code=503, content={"api": "reachable", "storage": "unavailable"})


@app.exception_handler(Exception)
async def safe_error(request, exc):
    return JSONResponse(
        status_code=500, content={"detail": "Internal service failure. Check server diagnostics."}
    )
