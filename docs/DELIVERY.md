# CITYHQ delivery report

Implementation and local validation: 8 October 2026 (Australia/Melbourne).

## Implemented features

Six responsive operational views; live Melbourne clock; source-aware weather/transit/events; deterministic activity proxy and contributions; MapLibre map with controls, attribution, safe provider-coordinate popups and layer toggles; persistent hourly analytics and CSV export; reproducible temperature training/inference; grounded Operator with in-session history and navigation; source diagnostics and ingestion audit.

## Architecture and changed files

Next.js/React/TypeScript/Tailwind/Framer Motion/Recharts retained; Next updated to 16.4.0. FastAPI retained with backwards-compatible legacy endpoints and `/api/v1` routes.

- Backend: `app/{config,schemas,adapters,ingestion,persistence,analytics,api,operator,main}.py`, `app/ml/{pipeline,inference}.py`; legacy service wrappers preserved.
- Persistence: six SQLAlchemy tables and `migrations/versions/0001_initial.py`, Alembic configuration.
- Frontend: `components/{dashboard,city-map,operator}.tsx`, `lib/{api,types,use-poll}.ts`, redesigned app layout/page/styles.
- Tests: backend platform/ML/reliability suites; frontend polling/Operator unit tests; browser platform tests with axe.
- Delivery: env examples, Dockerfiles/ignore files, Compose, CI workflow, README and architecture/API/data/ML/deployment documents.
- Evidence: actual `docs/model-evaluation.json`, screenshot `docs/screenshots/live-preview.jpg` (real base map, explicitly demo transit).

No existing user edits were present at the start. No secrets, local databases, model binaries, virtual environments, generated datasets or build outputs were committed. Next itself refreshed its managed AGENTS.md block during the version upgrade.

## Data sources

- wttr.in: **live adapter verified** against the public service, returning 21°C and three daily outlook entries during the check. Provider omitted a dated observation time; response now retains conditions and reports timestamp/age unknown. This is a point-in-time integration check, not an uptime claim.
- OpenWeather: optional credentialed alternative, tested with normalized fixtures; no live credentialed verification claimed.
- Transit: clearly labelled **demo** by default; PTV adapter fixture-tested, needs developer ID/key and live verification.
- Events: clearly labelled **demo** by default; Ticketmaster adapter fixture-tested, needs key and live verification.
- Forecasts: **synthetic research** until an observed model is explicitly trained. Demo/undated weather excluded from observed training.

## ML methodology and actual results

Seed-42 synthetic 180-day hourly temperature series, causal current/lag/rolling/calendar features, chronological 60/20/20 split, one-row boundary purge, train-only scaling, validation-only selection. 4,295 complete rows. Actual test MAE/RMSE (°C): persistence 1.177857/1.404925; Ridge 0.706572/0.880057; validation-selected forest 0.755448/0.938193. Ridge's better test result is reported without post-test reselection.

No Melbourne accuracy claim, no fabricated confidence intervals, no conflation with the activity heuristic. See ML_METHODOLOGY.md and model-evaluation.json.

## Verified tests and checks

| Check | Result |
|---|---|
| Backend pytest | 20 passed |
| Frontend Vitest | 6 passed |
| Playwright | 5 passed |
| axe WCAG 2 A/AA overview scan | No violations in tested overview |
| Desktop/mobile layout | Screenshots inspected; 390px viewport has no horizontal document overflow |
| Ruff lint/format | Passed |
| ESLint / TypeScript / Prettier | Passed |
| Next production webpack build | Passed |
| Alembic initial migration | Passed |
| Live wttr parser | Passed, including explicit unknown observation timestamp |
| Production npm audit | 0 reported vulnerabilities |
| Full npm audit | 5 high development-only transitive lint advisories remain |
| Compose configuration | Validated |
| Backend and frontend Docker image builds | Passed |
| Backend container smoke test | Storage ready; migration, synthetic training and inference passed |
| Frontend container smoke test | Standalone server returned HTTP 200 with CITYHQ markup |

Browser coverage includes navigation, transit mode filters, API-offline states, Operator interaction/reset/session persistence, forecast models/horizons and map markers/layers/zoom/recenter. Public tile requests are intercepted in automated tests; the actual map was separately inspected in the visible local preview. This is not a claim of exhaustive accessibility or multi-browser certification.

Turbopack failed due to local subprocess port restrictions. Supported webpack builds pass. No test failure is hidden or ignored. Docker's normal credential helper stalled; anonymous public-image builds used a temporary configuration without changing stored user credentials. Both images built successfully. Disposable-container checks verified database migration, synthetic training/inference, storage health, and the standalone frontend HTTP response. The initial smoke-test attempt was temporarily blocked by the approval review service's usage limit; the resumed checks succeeded.

## Local operation

The review preview is at http://127.0.0.1:3105 with backend at http://127.0.0.1:8105. Existing unrelated apps on 3000/8000 were left untouched. Preview processes stop when their local execution sessions are terminated.

From `backend/`, after installing requirements, migrating and training as in README:

```sh
CORS_ORIGINS=http://127.0.0.1:3105,http://localhost:3105 WEATHER_ADAPTER=wttr TRANSPORT_ADAPTER=demo EVENTS_ADAPTER=demo venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8105
```

From `frontend/`:

```sh
NEXT_PUBLIC_API_URL=http://127.0.0.1:8105 npm run dev -- --hostname 127.0.0.1 --port 3105
```

Use `WEATHER_ADAPTER=demo` for deterministic offline presentation. `docker compose up --build` is the standard-port alternative; stop or remap existing listeners first.

## Limitations, credentials and readiness

Historical charts initially show a sparse-data empty state. Keep a single ingestion process running to accumulate observations. Unknown provider observation dates remain unknown and cannot train the observed model. Model horizons beyond one hour are recursive and unevaluated. No crowd/footfall ground truth, attendance estimates or exact PTV coordinates are invented.

PTV: `PTV_DEVID` and `PTV_API_KEY`. Ticketmaster: `TICKETMASTER_API_KEY`. Optional OpenWeather: `OPENWEATHER_API_KEY`. No paid LLM, map key or service is mandatory for local operation.

Prepared for deployment review, not declared production-ready for public traffic: add authentication/rate limits, durable storage/backups, HTTPS/CORS configuration and a tile-provider usage review. SQLite ingestion currently assumes one process. Five remaining dev-tool advisories have no compatible nonbreaking fix from the audit; production tree is clear. CI workflow is supplied but has not run on GitHub. No push, deployment, cloud provisioning or paid resource creation occurred.

## Local commit summary

- `e688259` repository audit and architecture journal.
- `944e1c7` provenance, ingestion, persistence, scoring, forecasting and backend documentation.
- `b97188d` verified wttr compatibility fix and reliability tests.
- `0eb9dca` responsive dashboard, MapLibre, Operator, typed polling and frontend/browser tests.
- Final delivery commit: CI, Compose, portfolio documentation, env-example tracking and verification evidence.

## Recommended next improvements

1. Verify credentialed PTV/Ticketmaster contracts against real accounts.
2. Accumulate or import licensed dated weather observations; perform expanding-window seasonal backtests.
3. Calibrate prediction intervals on a separate holdout and evaluate multiple horizons explicitly.
4. Extract ingestion into a shared worker/cache and move to PostgreSQL if replicas or larger histories are needed.
5. Resolve upstream lint-chain advisories and perform a public deployment review.
