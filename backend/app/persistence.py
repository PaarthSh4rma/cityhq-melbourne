"""UTC ISO timestamps retain explicit offsets across SQLite round trips."""

import hashlib
import json
from datetime import datetime, timedelta, timezone

from sqlalchemy import Float, String, Text, create_engine, delete, func, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

from app.config import settings


class Base(DeclarativeBase):
    pass


class SnapshotMixin:
    id: Mapped[int] = mapped_column(primary_key=True)
    timestamp: Mapped[str] = mapped_column(String, index=True)
    digest: Mapped[str] = mapped_column(String, index=True)
    payload: Mapped[str] = mapped_column(Text)


class WeatherObservation(SnapshotMixin, Base):
    __tablename__ = "weather_observations"


class TransportSnapshot(SnapshotMixin, Base):
    __tablename__ = "transport_snapshots"


class EventSnapshot(SnapshotMixin, Base):
    __tablename__ = "event_snapshots"


class ActivityFeature(Base):
    __tablename__ = "activity_features"
    id: Mapped[int] = mapped_column(primary_key=True)
    timestamp: Mapped[str] = mapped_column(String, unique=True, index=True)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    payload: Mapped[str] = mapped_column(Text)


class Prediction(SnapshotMixin, Base):
    __tablename__ = "model_predictions"


class IngestionRun(Base):
    __tablename__ = "ingestion_runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    timestamp: Mapped[str] = mapped_column(String, index=True)
    source: Mapped[str] = mapped_column(String, index=True)
    status: Mapped[str] = mapped_column(String)


engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False, "timeout": 15}
    if settings.database_url.startswith("sqlite")
    else {},
)
TABLES = {"weather": WeatherObservation, "transport": TransportSnapshot, "events": EventSnapshot}


def utcnow():
    return datetime.now(timezone.utc)


def record_source(source, signal):
    payload = signal.model_dump(mode="json")
    content = {k: v for k, v in payload.items() if k not in ("metadata", "updated_at")}
    content["origin"] = signal.metadata.origin_status
    # One unchanged snapshot per hour preserves sampling without request duplicates.
    stamp = utcnow().replace(minute=0, second=0, microsecond=0).isoformat()
    digest = hashlib.sha256((stamp + json.dumps(content, sort_keys=True)).encode()).hexdigest()
    table = TABLES[source]
    with Session(engine) as session:
        if not session.scalar(select(table.id).where(table.digest == digest)):
            session.add(
                table(timestamp=utcnow().isoformat(), digest=digest, payload=json.dumps(payload))
            )
        session.add(IngestionRun(timestamp=utcnow().isoformat(), source=source, status="success"))
        session.commit()


def record_failure(source):
    with Session(engine) as session:
        session.add(IngestionRun(timestamp=utcnow().isoformat(), source=source, status="failed"))
        session.commit()


def record_activity(activity, signals):
    stamp = utcnow().replace(minute=0, second=0, microsecond=0).isoformat()
    usable = {
        k: v.metadata.status != "unavailable" and not v.metadata.stale for k, v in signals.items()
    }
    payload = dict(
        activity=activity,
        temperature=signals["weather"].temperature if usable["weather"] else None,
        disruptions=signals["transport"].disruption_count if usable["transport"] else None,
        events=signals["events"].event_count if usable["events"] else None,
    )
    with Session(engine) as session:
        row = session.scalar(select(ActivityFeature).where(ActivityFeature.timestamp == stamp))
        if row is None:
            row = ActivityFeature(timestamp=stamp)
            session.add(row)
        row.score, row.payload = activity["score"], json.dumps(payload)
        session.commit()


def history(hours=24):
    cutoff = (utcnow() - timedelta(hours=hours)).isoformat()
    with Session(engine) as session:
        rows = session.scalars(
            select(ActivityFeature)
            .where(ActivityFeature.timestamp >= cutoff)
            .order_by(ActivityFeature.timestamp)
        ).all()
        return [
            dict(
                timestamp=r.timestamp,
                score=r.score,
                **{k: v for k, v in json.loads(r.payload).items() if k != "activity"},
                provenance=json.loads(r.payload)["activity"]["input_freshness"],
            )
            for r in rows
        ]


def coverage():
    with Session(engine) as session:
        return {
            name: dict(
                count=session.scalar(select(func.count()).select_from(table)),
                first=session.scalar(select(func.min(table.timestamp))),
                last=session.scalar(select(func.max(table.timestamp))),
            )
            for name, table in {**TABLES, "activity": ActivityFeature}.items()
        }


def recent_runs():
    with Session(engine) as session:
        return [
            dict(timestamp=r.timestamp, source=r.source, status=r.status)
            for r in session.scalars(
                select(IngestionRun).order_by(IngestionRun.id.desc()).limit(30)
            )
        ]


def retain():
    cutoff = (utcnow() - timedelta(days=settings.retention_days)).isoformat()
    with Session(engine) as session:
        for table in [*TABLES.values(), ActivityFeature, IngestionRun, Prediction]:
            session.execute(delete(table).where(table.timestamp < cutoff))
        session.commit()
