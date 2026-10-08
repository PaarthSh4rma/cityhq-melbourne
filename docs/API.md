# API reference

Interactive OpenAPI: `http://127.0.0.1:8000/docs`. Versioned prefix: `/api/v1`.

| Method / path | Purpose |
|---|---|
| GET /weather | Normalized temperature, wind km/h, humidity, provider daily outlook, provenance |
| GET /transport | Notice count, legacy status/minor/major fields, items, provenance |
| GET /events | Event listing count/items, legacy unassessed impact fields, provenance |
| GET /activity | Heuristic score, contributions, drivers, coverage, source context |
| GET /history?hours=24 | Latest snapshot in each hour; range 1–2160 hours; null missing signals |
| GET /history.csv?hours=24 | CSV export including provenance |
| GET /forecast?model=selected&horizon=1 | Temperature predictions; models selected/baseline/ridge/random_forest; horizon 1–6 |
| GET /diagnostics | Sources, row counts/date coverage, 30 latest ingestion runs, installed model version |
| POST /operator | `{ "question": "Why is the activity score elevated?" }`; max 1000 characters |

`/weather`, `/transport`, `/events`, `/activity` also work without the prefix. `/health` checks API/storage readiness and returns 503 on storage failure.

Signal requests with provider failure return a valid typed payload and `metadata.status=unavailable` (or stale retained data), rather than an unhandled exception. Requests with invalid parameters return 422. Internal failures return a generic 500 without upstream bodies or credentials. A missing model returns `available=false` with an actionable reason.

Example metadata:
```json
{"source":"demo","status":"demo","origin_status":"demo","observed_at":"2026-10-08T00:00:00Z","fetched_at":"2026-10-08T00:00:00Z","age_seconds":0,"stale":false,"ttl_seconds":600,"limitations":["Illustrative data"],"error":null}
```
This snippet is a contract example, not a recorded observation. Forecast responses carry actual model metadata, held-out evaluation, observed history and separate predictions. Horizons >1 are recursive and explicitly unevaluated.
