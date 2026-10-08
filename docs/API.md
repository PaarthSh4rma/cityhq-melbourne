# API reference

**Reality Engine update:** The [two-city delivery report](REALITY_ENGINE_DELIVERY.md) describes current city contexts, Open-Meteo/AQ defaults, static Delhi Metro, credentialed provider boundaries, city scoring and backtesting. Earlier examples below document the preserved Melbourne baseline.

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
| POST /operator | `{ "question": "Why is the activity score elevated?" }`; 1–1000 characters; grounded result and allowlisted actions |
| GET /timeline?at=2026-10-08T10:00:00Z | Latest retained captures at/before a past timezone-bearing timestamp; missing and expired sources explicit |
| GET /timeline/captures | Latest 96 retained capture timestamps per source, descending; no invented clock ticks |
| GET /history/compare?hours=6 | Previous/current equal periods anchored to now; 1–720 hours; provenance-grouped coverage and means |
| POST /scenario | `{ "events": 12, "transport": 7.5, "weather": 8.65 }`; deterministic contribution override, no observation writes |

`/weather`, `/transport`, `/events`, `/activity` also work without the prefix. `/health` checks API/storage readiness and returns 503 on storage failure.

Signal requests with provider failure return a valid typed payload and `metadata.status=unavailable` (or stale retained data), rather than an unhandled exception. Requests with invalid parameters return 422. Internal failures return a generic 500 without upstream bodies or credentials. A missing model returns `available=false` with an actionable reason.

Example metadata:
```json
{"source":"demo","status":"demo","origin_status":"demo","observed_at":"2026-10-08T00:00:00Z","fetched_at":"2026-10-08T00:00:00Z","age_seconds":0,"stale":false,"ttl_seconds":600,"limitations":["Illustrative data"],"error":null}
```
This snippet is a contract example, not a recorded observation. Forecast responses carry actual model metadata, held-out evaluation, observed history and separate predictions. Horizons >1 are recursive and explicitly unevaluated.

## Validated actions and bounded requests

Operator responses add `tool_calls`, `supporting_data` and `actions` while retaining `answer`, `references`, legacy `navigation` and `intent`. The four action types are `navigate_dashboard`, `focus_map_location`, `toggle_map_layer` and `select_time_range`. Exact field names and values are allowlisted on both sides; extra properties are rejected. See [Operator reference](OPERATOR.md).

The Operator enforces 30 requests per client address/minute, four concurrent queries, a 250ms queue bound and a 28-second query timeout. Excess load returns 429; query timeout returns 504. These process-local controls do not replace public authentication or a gateway/body-size limit. Input schemas reject unknown properties.

Scenario values must be finite: events 0–40, transport 0–25, weather 0–15. Time context is held at the current activity calculation. The response supplies the current `before`, numeric `after`, assumptions, methodology version and the explicit non-causal label. Historical timestamps require an offset, cannot be in the future and are limited to 40 characters; invalid inputs return 422. Historical activity is recomputed with the current methodology, not presented as the original stored score.
