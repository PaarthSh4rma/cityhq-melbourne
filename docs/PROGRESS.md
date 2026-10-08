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

## B — Schemas and provenance
- Typed weather/transport/events envelopes preserve legacy top-level fields.
- Explicit adapter configuration; wttr/OpenWeather, PTV and Ticketmaster normalization.
- 8-second provider timeouts, 3 bounded attempts, per-source locks, cache TTLs and 60-second failure cooldown.
- No provider errors or credential-bearing URLs exposed. Demo fixtures make no attendance claims.
- Validation: Python compilation; detailed adapter contract tests follow in J.

## C — Persistence and ingestion
- SQLAlchemy tables for all six requested record types; Alembic initial migration.
- UTC timestamps, timestamp indexes, hourly unchanged-snapshot deduplication, configurable retention.
- Hourly activity aggregates update in place; source status remains in every historical record.

## D — Activity score
- Deterministic 40 event / 25 notice / 15 weather / 20 time-context weighting.
- Missing or stale source contributions omitted without rescaling; explicit coverage and demo flag.
- All unavailable sources yield null rather than a misleading score.

## E — Historical analytics
- Bounded hourly history, source coverage, ingestion audit records and CSV export support.
- Empty/sparse histories remain honest; no generated history is inserted into observations.

## F — ML training and inference
- Reproducible seed-42 synthetic temperature series; separately supports persisted live observations.
- Causal lag features; chronological 60/20/20 split with one-row boundary purge; persistence, Ridge and random forest.
- Completed training: validation selected random forest; test MAE 0.755448°C and RMSE 0.938193°C. Baseline MAE 1.177857°C. Ridge test MAE 0.706572°C, transparently reported despite validation selection.
- Trusted local model persistence, metadata, dataset hash, residual analysis and impurity importance. No uncalibrated intervals advertised.
- Predictions use their original research timestamps, not fabricated current dates.

## G — CITYHQ Operator
- Deterministic intent-to-query router over the same ingestion and analytics services.
- Source references, demo/stale context, navigation targets and bounded input; no external actions.
- Session chat UI with suggested questions, cancellation, reset and API error handling.

## H — Map
- MapLibre raster map with real Melbourne centre, pan/zoom/recenter, attribution, layer controls and safe text popups.
- Only provider-supplied validated coordinates are rendered; demo and unlocated notices have no invented pins.
- Configurable style; low-volume OSM standard tiles default, no prefetch/offline downloads.

## I — Frontend
- Six working navigation views, responsive dark operations design, source badges, separate Melbourne clock and refresh timestamps.
- Typed visibility-aware polling, abort/cleanup, no overlap, backoff and last-success retention.
- Filters, details, score explanations, historical range/signal controls, forecast models/horizons and CSV export.

## J — Validation in progress
- Backend: 13 tests pass; Ruff checks/format pass. Fixtures cover source contracts, unavailable/stale cache behaviour, scoring, causal features, chronology, reproducibility, inference and Operator routes.
- Frontend: lint, TypeScript and 5 component/polling tests pass. Production webpack build passes; Turbopack failed on environment process binding.
- Browser tests use dedicated ports 3105/8105 after detecting unrelated applications on 3000/8000; those applications were not stopped or modified.
- Initial axe WCAG A/AA scan passed. Browser testing found MapLibre 6 needs explicit worker URL; fixed using upstream installation guidance. Navigation numbering is now hidden from accessible names.
- Next upgraded from 16.2.2 to 16.4.0 following npm audit. Five high development-only lint dependency advisories remain; incompatible forced downgrade declined.
- Extended validation: 20 backend tests pass; 5 browser tests pass, including forecast controls, session chat persistence and map marker/layer controls against test fixtures. Desktop/mobile screenshots visually inspected; no horizontal mobile overflow.
- Live wttr verification returned 21°C and 3 daily outlook entries. This response omitted dated observation time; adapter now preserves conditions with null observed_at/age and explicit limitation. Both dated and undated variants tested.
- Production npm audit: zero reported vulnerabilities. Five remaining development advisories stem from braces → micromatch → fast-glob → Next ESLint tooling.
- Query changes now clear the displayed old result while loading (e.g. a selected Ridge forecast cannot temporarily show persistence predictions).

## K — Deployment and portfolio
- Backend/frontend env examples, non-root Dockerfiles, persistent-volume Compose, health checks and GitHub Actions added.
- README, architecture, API, source/scoring and ML methodology documents include concrete limitations and actual evaluation artifact.
- Docker credential helper stalled on public-image metadata. Retried with an isolated anonymous Docker config, leaving user credentials untouched.
