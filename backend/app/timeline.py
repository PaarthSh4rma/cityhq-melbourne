"""Historical queries select captured records only, never future or synthetic backfills."""

import json
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import persistence as db
from app.analytics import activity_score
from app.cities import city_config
from app.schemas import AirQuality, Events, Provenance, Transport, Weather

MODELS = {"weather": Weather, "transport": Transport, "events": Events, "air_quality": AirQuality}
TTLS = {"weather": 600, "transport": 120, "events": 1800, "air_quality": 3600}


def snapshot(at, city="melbourne"):
    ttls = city_config(city)["ttls"]
    signals, captures, gaps = {}, {}, []
    with Session(db.engine) as session:
        for name, table in db.TABLES.items():
            row = session.scalar(
                select(table)
                .where(table.timestamp <= at.isoformat(), table.city_id == city)
                .order_by(table.timestamp.desc(), table.id.desc())
                .limit(1)
            )
            # Hourly sampling is intentionally distinct from the live-cache TTL.
            # Older captures remain inspectable, but cannot produce an activity score.
            if row is None:
                signals[name] = MODELS[name](
                    metadata=Provenance(
                        source="No stored capture",
                        status="unavailable",
                        origin_status="unavailable",
                        ttl_seconds=ttls[name],
                        city_id=city,
                        source_id=name,
                        limitations=["No capture exists at or before this time."],
                    )
                )
                captures[name] = None
                gaps.append(name) if name != "air_quality" else None
                continue
            signal = MODELS[name].model_validate(json.loads(row.payload))
            captured = datetime.fromisoformat(row.timestamp)
            age = max(0, (at - captured).total_seconds())
            signal.metadata.age_seconds = (
                max(0, (at - signal.metadata.observed_at).total_seconds())
                if signal.metadata.observed_at
                else None
            )
            signal.metadata.stale = age > signal.metadata.ttl_seconds or (
                signal.metadata.origin_status == "live"
                and (signal.metadata.age_seconds or 0)
                > city_config(city)["maximum_source_age_seconds"][name]
            )
            if signal.metadata.stale:
                gaps.append(name) if name != "air_quality" else None
            signals[name] = signal
            captures[name] = {"timestamp": row.timestamp, "age_seconds": age}
    return dict(
        at=at.isoformat(),
        signals={k: v.model_dump(mode="json") for k, v in signals.items()},
        city_id=city,
        activity=activity_score(signals, at, city),
        captures=captures,
        gaps=gaps,
        limitations=[
            "Historical index is recomputed from captured inputs using the reported methodology version, not the original stored score.",
            "Latest actual capture at or before the selected time; no interpolation or reconstruction.",
            "Capture age and source observation age differ. Expired captures are excluded from the score.",
            "Demo captures retain demo provenance. Unlocated records cannot be mapped precisely.",
        ],
    )


def compare(at, hours, city="melbourne"):
    end = at
    split, start = end - timedelta(hours=hours), end - timedelta(hours=hours * 2)
    with Session(db.engine) as session:
        rows = session.scalars(
            select(db.ActivityFeature)
            .where(
                db.ActivityFeature.city_id == city,
                db.ActivityFeature.timestamp >= start.isoformat(),
                db.ActivityFeature.timestamp <= end.isoformat(),
            )
            .order_by(db.ActivityFeature.timestamp)
        ).all()

    def period(low, high):
        values = [r for r in rows if low.isoformat() <= r.timestamp < high.isoformat()]
        # Compare only identical full input provenance/coverage, never blend demo and live.
        groups = {}
        for row in values:
            payload = json.loads(row.payload)["activity"]
            key = (
                payload.get("methodology_version", "legacy")
                + ": "
                + ", ".join(
                    f"{k}:{v.get('source', 'unknown')}:{v.get('data_kind', 'unknown')}:{v['origin_status']}:{'stale' if v['stale'] else 'fresh'}"
                    for k, v in sorted(payload["input_freshness"].items())
                )
            )
            groups.setdefault(key, []).append(row.score)
        return {
            "start": low.isoformat(),
            "end": high.isoformat(),
            "stored_hours": len(values),
            "expected_hours": hours,
            "groups": [
                {
                    "provenance": key,
                    "usable_hours": len(nums),
                    "mean_score": round(sum(nums) / len(nums), 2) if nums else None,
                }
                for key, scores in groups.items()
                if (nums := [s for s in scores if s is not None])
            ],
        }

    return {
        "previous": period(start, split),
        "current": period(split, end),
        "limitations": [
            "Stored hourly latest values; incomplete hours and gaps are not reconstructed.",
            "Compare only matching provenance groups. No causal interpretation.",
        ],
    }
