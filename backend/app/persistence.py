"""UTC ISO timestamps retain explicit offsets across SQLite round trips."""

import hashlib
import json
from datetime import datetime, timedelta, timezone

from sqlalchemy import Float, Index, String, Text, create_engine, delete, func, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

from app.config import settings


class Base(DeclarativeBase):
    pass


class SnapshotMixin:
    city_id: Mapped[str] = mapped_column(
        String, default="melbourne", server_default="melbourne", index=True
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    timestamp: Mapped[str] = mapped_column(String, index=True)
    digest: Mapped[str] = mapped_column(String, index=True)
    dedup_key: Mapped[str | None] = mapped_column(String, nullable=True)
    payload: Mapped[str] = mapped_column(Text)


class WeatherObservation(SnapshotMixin, Base):
    __tablename__ = "weather_observations"
    __table_args__ = (
        Index("ix_weather_observations_city_dedup", "city_id", "dedup_key", unique=True),
        Index("ix_weather_observations_city_timestamp", "city_id", "timestamp"),
        Index("ix_weather_observations_city_digest", "city_id", "digest"),
    )


class TransportSnapshot(SnapshotMixin, Base):
    __tablename__ = "transport_snapshots"
    __table_args__ = (
        Index("ix_transport_snapshots_city_dedup", "city_id", "dedup_key", unique=True),
        Index("ix_transport_snapshots_city_timestamp", "city_id", "timestamp"),
        Index("ix_transport_snapshots_city_digest", "city_id", "digest"),
    )


class AirQualityObservation(SnapshotMixin, Base):
    __tablename__ = "air_quality_observations"
    __table_args__ = (
        Index("ix_air_quality_observations_city_dedup", "city_id", "dedup_key", unique=True),
        Index("ix_air_quality_observations_city_timestamp", "city_id", "timestamp"),
        Index("ix_air_quality_observations_city_digest", "city_id", "digest"),
    )


class RawPayload(SnapshotMixin, Base):
    __tablename__ = "provider_raw_payloads"
    __table_args__ = (
        Index("ix_provider_raw_payloads_city_dedup", "city_id", "dedup_key", unique=True),
        Index("ix_provider_raw_payloads_city_timestamp", "city_id", "timestamp"),
        Index("ix_provider_raw_payloads_city_digest", "city_id", "digest"),
    )
    source: Mapped[str] = mapped_column(String)
    provider: Mapped[str] = mapped_column(String)


class EventSnapshot(SnapshotMixin, Base):
    __tablename__ = "event_snapshots"
    __table_args__ = (
        Index("ix_event_snapshots_city_dedup", "city_id", "dedup_key", unique=True),
        Index("ix_event_snapshots_city_timestamp", "city_id", "timestamp"),
        Index("ix_event_snapshots_city_digest", "city_id", "digest"),
    )


class ActivityFeature(Base):
    __tablename__ = "activity_features"
    __table_args__ = (Index("ix_activity_city_timestamp", "city_id", "timestamp", unique=True),)
    city_id: Mapped[str] = mapped_column(
        String, default="melbourne", server_default="melbourne", index=True
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    timestamp: Mapped[str] = mapped_column(String, index=True)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    payload: Mapped[str] = mapped_column(Text)


class Prediction(SnapshotMixin, Base):
    __tablename__ = "model_predictions"
    __table_args__ = (
        Index("ix_model_predictions_city_dedup", "city_id", "dedup_key", unique=True),
        Index("ix_model_predictions_city_timestamp", "city_id", "timestamp"),
        Index("ix_model_predictions_city_digest", "city_id", "digest"),
    )


class IngestionRun(Base):
    __tablename__ = "ingestion_runs"
    city_id: Mapped[str] = mapped_column(
        String, default="melbourne", server_default="melbourne", index=True
    )
    error_code: Mapped[str | None] = mapped_column(String, nullable=True)
    latency_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
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
TABLES = {
    "weather": WeatherObservation,
    "transport": TransportSnapshot,
    "events": EventSnapshot,
    "air_quality": AirQualityObservation,
}


def utcnow():
    return datetime.now(timezone.utc)


def record_source(source, signal, city="melbourne", latency_ms=None):
    payload = signal.model_dump(mode="json")
    content = {k: v for k, v in payload.items() if k not in ("metadata", "updated_at")}
    content["origin"] = signal.metadata.origin_status
    # One unchanged snapshot per hour preserves sampling without request duplicates.
    stamp = utcnow().replace(minute=0, second=0, microsecond=0).isoformat()
    digest = hashlib.sha256(
        (city + stamp + json.dumps(content, sort_keys=True)).encode()
    ).hexdigest()
    table = TABLES[source]
    with Session(engine) as session:
        if not session.scalar(
            select(table.id).where(table.digest == digest, table.city_id == city)
        ):
            session.add(
                table(
                    city_id=city,
                    timestamp=utcnow().isoformat(),
                    digest=digest,
                    dedup_key=digest,
                    payload=json.dumps(payload),
                )
            )
        session.add(
            IngestionRun(
                city_id=city,
                timestamp=utcnow().isoformat(),
                source=source,
                status="success",
                latency_ms=latency_ms,
            )
        )
        session.commit()


def record_failure(source, city="melbourne", error_code="provider_error", latency_ms=None):
    with Session(engine) as session:
        session.add(
            IngestionRun(
                city_id=city,
                timestamp=utcnow().isoformat(),
                source=source,
                status="failed",
                error_code=error_code,
                latency_ms=latency_ms,
            )
        )
        session.commit()


def record_activity(activity, signals, city="melbourne"):
    stamp = utcnow().replace(minute=0, second=0, microsecond=0).isoformat()
    usable = {
        k: v.metadata.status != "unavailable" and not v.metadata.stale for k, v in signals.items()
    }
    payload = dict(
        activity=activity,
        temperature=signals["weather"].temperature if usable["weather"] else None,
        disruptions=signals["transport"].disruption_count if usable["transport"] else None,
        events=signals["events"].event_count if usable["events"] else None,
        us_aqi=signals["air_quality"].us_aqi if usable.get("air_quality") else None,
    )
    with Session(engine) as session:
        row = session.scalar(
            select(ActivityFeature).where(
                ActivityFeature.timestamp == stamp, ActivityFeature.city_id == city
            )
        )
        if row is None:
            row = ActivityFeature(timestamp=stamp, city_id=city)
            session.add(row)
        row.score, row.payload = activity["score"], json.dumps(payload)
        session.commit()


def history(hours=24, city="melbourne"):
    cutoff = (utcnow() - timedelta(hours=hours)).isoformat()
    with Session(engine) as session:
        rows = session.scalars(
            select(ActivityFeature)
            .where(ActivityFeature.timestamp >= cutoff, ActivityFeature.city_id == city)
            .order_by(ActivityFeature.timestamp)
        ).all()
        return [
            dict(
                timestamp=r.timestamp,
                score=r.score,
                **{
                    k: v
                    for k, v in json.loads(r.payload).items()
                    if k not in ("activity", "us_aqi")
                },
                us_aqi=json.loads(r.payload).get("us_aqi"),
                provenance=json.loads(r.payload)["activity"]["input_freshness"],
            )
            for r in rows
        ]


def coverage(city="melbourne"):
    with Session(engine) as session:
        return {
            name: dict(
                count=session.scalar(
                    select(func.count()).select_from(table).where(table.city_id == city)
                ),
                first=session.scalar(
                    select(func.min(table.timestamp)).where(table.city_id == city)
                ),
                last=session.scalar(select(func.max(table.timestamp)).where(table.city_id == city)),
            )
            for name, table in {**TABLES, "activity": ActivityFeature}.items()
        }


def recent_runs(city="melbourne"):
    with Session(engine) as session:
        return [
            dict(
                city_id=r.city_id,
                timestamp=r.timestamp,
                source=r.source,
                status=r.status,
                error_code=r.error_code,
                latency_ms=r.latency_ms,
            )
            for r in session.scalars(
                select(IngestionRun)
                .where(IngestionRun.city_id == city)
                .order_by(IngestionRun.id.desc())
                .limit(30)
            )
        ]


def retain():
    cutoff = (utcnow() - timedelta(days=settings.retention_days)).isoformat()
    with Session(engine) as session:
        for table in [*TABLES.values(), ActivityFeature, IngestionRun, Prediction, RawPayload]:
            session.execute(delete(table).where(table.timestamp < cutoff))
        session.commit()


def latest_source(source, schema, city="melbourne"):
    table = TABLES[source]
    with Session(engine) as session:
        row = session.scalar(
            select(table)
            .where(table.city_id == city)
            .order_by(table.timestamp.desc(), table.id.desc())
            .limit(1)
        )
        return schema.model_validate_json(row.payload) if row else None


def sanitize_raw(value):
    """Retain provider data, never authentication echoed inside links or fields."""
    from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

    secret_keys = {
        "apikey",
        "api_key",
        "key",
        "token",
        "access_token",
        "signature",
        "devid",
        "authorization",
    }
    if isinstance(value, dict):
        return {
            k: "[redacted]" if k.lower() in secret_keys else sanitize_raw(v)
            for k, v in value.items()
        }
    if isinstance(value, list):
        return [sanitize_raw(v) for v in value]
    if isinstance(value, str) and value.startswith(("http://", "https://")):
        parts = urlsplit(value)
        return urlunsplit(
            parts._replace(
                query=urlencode(
                    [
                        (k, "[redacted]" if k.lower() in secret_keys else v)
                        for k, v in parse_qsl(parts.query, keep_blank_values=True)
                    ]
                )
            )
        )
    return value


def record_raw(source, city, provider, payload):
    body = json.dumps(sanitize_raw(payload), sort_keys=True)
    digest = hashlib.sha256((city + source + provider + body).encode()).hexdigest()
    with Session(engine) as session:
        if not session.scalar(
            select(RawPayload.id).where(RawPayload.digest == digest, RawPayload.city_id == city)
        ):
            session.add(
                RawPayload(
                    city_id=city,
                    source=source,
                    provider=provider,
                    timestamp=utcnow().isoformat(),
                    digest=digest,
                    dedup_key=digest,
                    payload=body,
                )
            )
            session.commit()
