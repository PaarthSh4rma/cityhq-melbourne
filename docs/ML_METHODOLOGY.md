# Forecasting experiment: next-hour temperature

The activity index is deterministic. The ML target is **temperature one hour ahead**, an available component signal. No footfall, passenger or congestion ground truth exists in this repository.

## Dataset and features

The verified initial experiment uses a reproducible synthetic series: seed 42, 180 days × 24 hourly values from 2025-01-01 UTC. It combines a daily sinusoid, a slower 90-day sinusoid and autoregressive Gaussian noise. This tests engineering and evaluation mechanics; it does not validate real Melbourne forecast performance. Synthetic data is generated only at training time and never inserted as historical live observations.

`python -m app.ml.pipeline --mode observed` reads only live-origin stored weather and requires at least 240 complete feature rows. Cleaning converts timestamps to UTC, sorts/deduplicates, bins hourly, rejects temperatures outside −20 to 60°C and leaves missing hours missing. No future-filled interpolation. Features: current temperature, 1h and 24h lags, trailing 6h mean, sine/cosine of Melbourne hour. Labels shift temperature one hour forward. Incomplete rows are removed.

Chronological 60/20/20 train/validation/test splits purge one row at each boundary so training labels cannot enter the following split. Ridge's scaler is fit on training only. Random forest: 100 trees, depth 10, minimum leaf size 5, seed 42, single-threaded. Persistence predicts the latest temperature. Model selection uses validation MAE, never test MAE. All test scores are reported once, without refitting.

## Actual verified synthetic results

| Model | Validation MAE | Test MAE | Test RMSE |
|---|---:|---:|---:|
| Persistence | 1.164191 | 1.177857 | 1.404925 |
| Ridge | 0.690997 | 0.706572 | 0.880057 |
| Random forest (selected) | 0.684472 | 0.755448 | 0.938193 |

All errors are °C. Ridge generalizes better on this test partition despite random forest winning validation. We preserve this result; no post-test selection. 4,295 complete feature rows; train 2,576, validation 858, test 859, plus two purged boundaries. Full dates, dataset SHA-256, residual mean/std/quantiles and forest feature importances are in [model-evaluation.json](model-evaluation.json), produced by the executed training script.

## Reproduce

```sh
cd backend
venv/bin/python -m app.ml.pipeline --mode synthetic
# Once enough contiguous live hourly observations accumulate:
venv/bin/python -m app.ml.pipeline --mode observed
```

Artifacts are ignored under `backend/artifacts/`: `temperature.joblib` and `evaluation.json`. The API reloads when file modification time changes. Deploy only trusted server-created artifacts; joblib loading is not safe for untrusted files.

Synthetic inference continues the original research timeline. It must not be displayed as today's Melbourne forecast. Observed inference refuses sparse inputs or a latest observation older than two hours. One-hour metrics do not apply to recursively generated 3/6-hour horizons. No statistically calibrated intervals are presented. Residual quantiles are diagnostics, not prediction intervals; impurity importance is descriptive and biased toward correlated/high-variance features.

## Next research steps

Collect a real continuous weather series, retain provider observation timestamps, use expanding-window backtesting across seasons, compare with a provider forecast and seasonal persistence, evaluate drift, then calibrate intervals on separate data. Consider a licensed public historical dataset through a separately reviewed import pipeline. Never mix synthetic and observed evaluation claims.

## Research workspace additions

The Forecasting Lab now surfaces mode, model version, target, seed, dataset hash, complete row count and exact split periods alongside measured baseline/Ridge/forest results. The regenerated evaluation artifact adds a 12-bin histogram over all selected-model test residuals and a chronological error sample (approximately 72 points). Expand the diagnostics for exact bin boundaries/counts. Bins and samples are derived from actual held-out predictions; no hardcoded decorative distributions are used.

The error distribution always describes the validation-selected model; choosing another inference model does not relabel those diagnostics. Feature importances remain forest-specific. Synthetic residuals are not uncertainty bounds for current Melbourne weather. Real-data training capability exists, but there is not yet enough verified continuous dated live history to report a real-world evaluation. wttr's currently undated observations are correctly excluded.
