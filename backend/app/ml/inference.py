import json
from functools import lru_cache
from pathlib import Path

import joblib
import pandas as pd

from app.config import settings
from app.ml.pipeline import FEATURES, features, observed_frame


@lru_cache(maxsize=2)
def _load(path, mtime):
    # Load only the trusted server-owned artifact path, never a user-uploaded pickle.
    return joblib.load(path)


def forecast(model="selected", horizon=1):
    path = Path(settings.artifact_dir) / "temperature.joblib"
    if not path.exists():
        return dict(
            available=False,
            reason="No trained model. Run python -m app.ml.pipeline --mode synthetic.",
            predictions=[],
            observed=[],
        )
    artifact = _load(str(path), path.stat().st_mtime_ns)
    meta = artifact["metadata"]
    selected = meta["selected_model"] if model == "selected" else model
    frame = artifact["tail"].copy() if meta["mode"] == "synthetic" else observed_frame().tail(72)
    if len(frame) < 25:
        return dict(
            available=False,
            reason="Insufficient recent observed weather.",
            predictions=[],
            observed=[],
            metadata=meta,
        )
    frame["timestamp"] = pd.to_datetime(frame.timestamp, utc=True)
    if (
        meta["mode"] != "synthetic"
        and (pd.Timestamp.now(tz="UTC") - frame.timestamp.max()).total_seconds() > 7200
    ):
        return dict(
            available=False,
            reason="Latest observation is older than two hours.",
            predictions=[],
            observed=[],
            metadata=meta,
        )
    observed = [
        {"timestamp": row.timestamp.isoformat(), "temperature": float(row.temperature)}
        for row in frame.tail(24).itertuples()
    ]
    predictions = []
    for step in range(horizon):
        vector = features(frame).iloc[-1:][FEATURES]
        if vector.isna().any().any():
            return dict(
                available=False,
                reason="Recent observations contain gaps.",
                predictions=[],
                observed=observed,
                metadata=meta,
            )
        value = float(
            vector.temperature.iloc[0]
            if selected == "baseline"
            else artifact["models"][selected].predict(vector)[0]
        )
        stamp = frame.timestamp.max() + pd.Timedelta(hours=1)
        predictions.append(dict(timestamp=stamp.isoformat(), temperature=round(value, 2)))
        frame = pd.concat(
            [frame, pd.DataFrame([dict(timestamp=stamp, temperature=value)])], ignore_index=True
        )
    result = dict(
        available=True,
        model=selected,
        horizon=horizon,
        metadata=meta,
        observed=observed,
        predictions=predictions,
        explanation="Uses current temperature, 1h/24h lags, trailing 6h mean and cyclical Melbourne hour. Synthetic forecasts continue the research timeline."
        if meta["mode"] == "synthetic"
        else "Uses only observed temperature lags and calendar features.",
    )
    import hashlib

    from sqlalchemy import select
    from sqlalchemy.orm import Session

    from app.persistence import Prediction, engine, utcnow

    digest = hashlib.sha256(
        json.dumps([meta["dataset_sha256"], selected, predictions], sort_keys=True).encode()
    ).hexdigest()
    with Session(engine) as session:
        if not session.scalar(select(Prediction.id).where(Prediction.digest == digest)):
            session.add(
                Prediction(
                    timestamp=utcnow().isoformat(), digest=digest, payload=json.dumps(result)
                )
            )
            session.commit()
    return result
