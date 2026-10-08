# CITYHQ implementation journal

## A — Audit and architecture
- Clean starting tree at `7e45519`; no user edits to preserve.
- Next 16.2 / React 19 / Tailwind 4; single client page, repeated timers, no tests.
- FastAPI exposes /weather (wttr.in), /transport and /events (fixtures).
- Dormant PTV, Ticketmaster and OpenWeather adapters exist; error bodies can leak provider details; no persistence.
- Hardcoded activity, charts, forecasts and green online badge must be removed.
- Retain legacy paths and field names; add provenance and typed /api/v1 routes.
- SQLite + SQLAlchemy/Alembic; bounded source cache, ingestion loop, hourly aggregates.
- Forecast target: next-hour temperature, with a reproducible synthetic research demonstration until enough real observations accumulate. Keep heuristic activity entirely separate.
- No deployment, push or paid resources. Existing .env inspected by names only if needed; never copied into artifacts.
- Validation: inspected tracked source, dependencies, Git history and Next's installed server/client and routing guides.

Subsequent phases record implementation and actual validation below.
