"""Chronological next-hour temperature experiment, isolated from the activity heuristic."""

import argparse
import hashlib
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from app.config import settings

FEATURES = ["temperature", "lag1", "lag24", "mean6", "hour_sin", "hour_cos"]
VERSION = "temperature-v1"


def synthetic_data(seed=42, days=180):
    rng = np.random.default_rng(seed)
    dates = pd.date_range("2025-01-01", periods=days * 24, freq="h", tz="UTC")
    t = np.arange(len(dates))
    noise = np.zeros(len(t))
    for i in range(1, len(t)):
        noise[i] = 0.7 * noise[i - 1] + rng.normal(0, 0.8)
    return pd.DataFrame(
        {
            "timestamp": dates,
            "temperature": 17
            + 6 * np.sin(2 * np.pi * (t - 5) / 24)
            + 3 * np.sin(2 * np.pi * t / (24 * 90))
            + noise,
        }
    )


def features(frame):
    f = frame.copy()
    f["timestamp"] = pd.to_datetime(f["timestamp"], utc=True, errors="coerce")
    f["temperature"] = pd.to_numeric(f["temperature"], errors="coerce")
    f = (
        f.dropna()
        .sort_values("timestamp")
        .drop_duplicates("timestamp")
        .set_index("timestamp")
        .resample("h")
        .mean(numeric_only=True)
    )
    f.loc[~f.temperature.between(-20, 60), "temperature"] = np.nan
    f["lag1"] = f.temperature.shift(1)
    f["lag24"] = f.temperature.shift(24)
    f["mean6"] = f.temperature.rolling(6, min_periods=6).mean()
    hour = f.index.tz_convert("Australia/Melbourne").hour
    f["hour_sin"] = np.sin(2 * np.pi * hour / 24)
    f["hour_cos"] = np.cos(2 * np.pi * hour / 24)
    f["target"] = f.temperature.shift(-1)
    return f


def metrics(y, p):
    return {
        "mae": float(mean_absolute_error(y, p)),
        "rmse": float(np.sqrt(mean_squared_error(y, p))),
    }


def train(frame, mode="synthetic", output=None):
    clean = features(frame).dropna()
    if len(clean) < 240:
        raise ValueError(
            "At least 240 complete hourly feature rows required; collect more contiguous observations."
        )
    a, b = int(len(clean) * 0.6), int(len(clean) * 0.8)
    # Purge one row at each boundary: training labels cannot cross a split.
    training, validation, test = clean.iloc[: a - 1], clean.iloc[a : b - 1], clean.iloc[b:]
    candidates = {
        "ridge": make_pipeline(StandardScaler(), Ridge(alpha=10)),
        "random_forest": RandomForestRegressor(
            n_estimators=100, max_depth=10, min_samples_leaf=5, random_state=42, n_jobs=1
        ),
    }
    report = {
        "baseline": {
            "validation": metrics(validation.target, validation.temperature),
            "test": metrics(test.target, test.temperature),
        }
    }
    for name, model in candidates.items():
        model.fit(training[FEATURES], training.target)
        report[name] = {
            "validation": metrics(validation.target, model.predict(validation[FEATURES])),
            "test": metrics(test.target, model.predict(test[FEATURES])),
        }
    best = min(report, key=lambda name: report[name]["validation"]["mae"])
    residual = test.target.to_numpy() - (
        test.temperature.to_numpy()
        if best == "baseline"
        else candidates[best].predict(test[FEATURES])
    )
    importance = dict(zip(FEATURES, candidates["random_forest"].feature_importances_.tolist()))
    counts, edges = np.histogram(residual, bins=12)
    metadata = dict(
        version=VERSION,
        mode=mode,
        target="Next-hour temperature (°C)",
        seed=42,
        selected_model=best,
        selection="Minimum validation MAE; test untouched for model selection",
        dataset_sha256=hashlib.sha256(frame.to_csv(index=False).encode()).hexdigest(),
        rows=len(clean),
        metrics=report,
        splits={
            name: dict(
                rows=len(data), start=data.index[0].isoformat(), end=data.index[-1].isoformat()
            )
            for name, data in [("train", training), ("validation", validation), ("test", test)]
        },
        feature_importance=importance,
        importance_note="Random forest impurity importance, descriptive and not causal; correlated features can share importance.",
        residuals=dict(
            mean=float(residual.mean()),
            std=float(residual.std()),
            p05=float(np.quantile(residual, 0.05)),
            p95=float(np.quantile(residual, 0.95)),
            histogram=[
                dict(low=float(edges[i]), high=float(edges[i + 1]), count=int(n))
                for i, n in enumerate(counts)
            ],
            timeline=[
                dict(timestamp=test.index[i].isoformat(), error=float(residual[i]))
                for i in range(0, len(test), max(1, len(test) // 72))
            ],
        ),
        limitations=[
            "Synthetic research demonstration; metrics do not establish Melbourne forecast skill."
            if mode == "synthetic"
            else "Local station proxy; limited coverage, no external validation.",
            "One chronological split; weather regime changes may reduce performance.",
            "No calibrated prediction intervals. Residual quantiles are diagnostics only.",
            "Recursive horizons beyond one hour have not been evaluated.",
        ],
    )
    artifact = dict(metadata=metadata, models=candidates, tail=frame.tail(72))
    path = Path(output or settings.artifact_dir)
    path.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, path / "temperature.joblib")
    (path / "evaluation.json").write_text(json.dumps(metadata, indent=2))
    return metadata


def observed_frame():
    from sqlalchemy import select
    from sqlalchemy.orm import Session

    from app.persistence import WeatherObservation, engine

    with Session(engine) as session:
        rows = session.scalars(
            select(WeatherObservation).order_by(WeatherObservation.timestamp)
        ).all()
        points = []
        for row in rows:
            payload = json.loads(row.payload)
            if (
                payload["metadata"]["origin_status"] == "live"
                and payload.get("temperature") is not None
                and payload["metadata"].get("observed_at")
            ):
                points.append(
                    dict(
                        timestamp=payload["metadata"]["observed_at"],
                        temperature=payload["temperature"],
                    )
                )
    return pd.DataFrame(points, columns=["timestamp", "temperature"])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=["synthetic", "observed"], default="synthetic")
    parser.add_argument("--output", default=settings.artifact_dir)
    args = parser.parse_args()
    print(
        json.dumps(
            train(
                synthetic_data() if args.mode == "synthetic" else observed_frame(),
                args.mode,
                args.output,
            ),
            indent=2,
        )
    )
