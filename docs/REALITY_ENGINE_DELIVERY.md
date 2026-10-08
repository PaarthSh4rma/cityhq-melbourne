# CITYHQ · Reality Engine delivery

Implemented 9 October 2026 (Melbourne). Scope is exactly `melbourne` and `delhi`. No deployment, push, paid resource, account creation or terms submission was performed. Existing environment files and Melbourne history were preserved.

## Delivered behaviour

The cinematic Overdrive workspace now has a Melbourne / Delhi selector, city-local clock, city-scoped requests and a separate lifecycle for each city. Weather, modelled air quality, map cameras, provider status, event/transport information, history, forecasts, Operator and diagnostics all use that context. The selector cancels pending work and resets prior-city transient data. Operator dispatches validated action batches so a city switch preserves its intended destination/layers and the grounded answer.

Both cities use verified real Open-Meteo weather and CAMS air-quality responses. The [redacted adapter smoke evidence](provider-verification.json) records actual verification times, sample times, fields and response hashes. On 2026-10-08 at approximately 14:06 UTC, the implemented adapters returned Melbourne 12.8°C and Delhi 29.3°C, with respective modelled US AQI values 51 and 173. These are verification snapshots, not permanently current readings or ground-station observations.

Delhi has a static Metro explorer with 245 OSM station nodes, 24 directional route relations, station search, route selection, map focus and supplied geometry. Interchange nodes may be duplicated; relation count is not a count of unique Metro lines. Operational status remains unknown. PTV and Ticketmaster require keys that were absent during verification; their adapters report `credentials_required`, with no automatic demo substitution.

## Source matrix

| Provider / city | Documentation and endpoint | Authentication | Licence / permitted use | Actual verification and runtime status | Limits and coverage |
|---|---|---|---|---|---|
| Open-Meteo weather / both | [Forecast docs](https://open-meteo.com/en/docs); `https://api.open-meteo.com/v1/forecast` | None for public noncommercial API | [Pricing/usage](https://open-meteo.com/en/pricing); CC BY 4.0 attribution. Commercial API usage needs an appropriate agreement | Real requests and normalized adapter smoke passed for both; `live`, `cached` or `stale` according to freshness; `data_kind=modelled` | Public limits: 600/min, 5000/hour, 10000/day, 300000/month; no uptime guarantee. Numerical model grid, not a station reading |
| Open-Meteo AQ / both | [AQ docs](https://open-meteo.com/en/docs/air-quality-api); `https://air-quality-api.open-meteo.com/v1/air-quality` | None on public tier | Open-Meteo / CAMS attribution and CC BY 4.0; public API noncommercial restrictions | Both real requests passed, including PM2.5, PM10, NO₂, O₃, US AQI, European AQI and hourly samples; `data_kind=modelled` | CAMS global coverage outside Europe, approximately 45 km grid. Model/interpolated fields do not establish neighbourhood or station conditions. US, European and Indian AQI are distinct |
| PTV / Melbourne | [Official API access](https://www.ptv.vic.gov.au/footer/data-and-reporting/datasets/ptv-timetable-api/), [Swagger](https://timetableapi.ptv.vic.gov.au/swagger/ui/index), [verified schema](https://timetableapi.ptv.vic.gov.au/swagger/docs/v3); `/v3/disruptions` | Developer ID plus HMAC-SHA1 signed query, environment only | Source: Licensed from Public Transport Victoria under a Creative Commons Attribution 4.0 International Licence | Official Swagger JSON fetched successfully; signing and rich normalization tested offline. Real account request blocked by absent keys; `unavailable` with `error_code=credentials_required` | Published rate allowance not verified; bounded retries and 429 handling. Modes/routes/type/status/start/end/stop references retained. Severity unknown unless supplied; no invented coordinates or congestion inference |
| Official OTD / DMRC / Delhi | [Static DMRC page](https://otd.delhi.gov.in/data/staticDMRC/), [documentation](https://otd.delhi.gov.in/documentation/), [terms](https://otd.delhi.gov.in/terms) | Identity/purpose form and terms agreement for download | Access conditions must be reviewed by the user before obtaining a feed | Page and terms investigated; advertised static feed last updated August 2023. No identity supplied, terms accepted or protected download accessed. No official feed falsely claimed | Official static download boundary respected. Delhi OTD vehicle-position feed documentation concerns buses and does not establish live Metro delays |
| OpenStreetMap / Delhi Metro | [Network mapping](https://wiki.openstreetmap.org/wiki/Delhi_Metro), [licence](https://www.openstreetmap.org/copyright); bounded public Overpass extract | None | © OpenStreetMap contributors, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/); derived database distributed with source/attribution | Real extract obtained; base timestamp `2026-10-08T13:47:50Z`. Bundled file is `cached`, `data_kind=static`, never labelled live operations | No runtime Overpass polling. Daily local reload; source currency threshold 30 days. Community completeness uncertain; geographic station/route subset, no schedules, fares, live delays or route availability |
| Ticketmaster / Melbourne and Delhi | [Discovery v2](https://developer.ticketmaster.com/products-and-docs/apis/discovery/v2/); `https://app.ticketmaster.com/discovery/v2/events.json` | `TICKETMASTER_API_KEY` on server | [Developer terms](https://developer.ticketmaster.com/support/terms-of-use/); not treated as an unrestricted open-data licence | Documented adapter implemented and fixture-tested, including paging, venues, categories, URLs, dates and supplied coordinates. Keys absent: both cities return `credentials_required`; actual account coverage unverified | Documentation says 5 requests/s, [FAQ](https://developer.ticketmaster.com/support/faq/) says 2/s; conservatively space pages ≥0.5s, max 10×100 listings and default 5000/day account quota. Delhi coverage incomplete and may be zero. Empty results differ from failure; no attendance or impact estimate |
| CPCB / India observations / Delhi | [Official public catalogue](https://data.gov.in/catalog/real-time-air-quality-index), [CPCB AQI](https://airquality.cpcb.gov.in/AQI_India/), [Indian AQI report](https://airquality.cpcb.gov.in/ccr_docs/FINAL-REPORT_AQI_.pdf) | Public catalogue/API access conditions and credentials require verification | Do not assume a protected dashboard permits scraping | Investigated; catalogue access/schema/permissions could not be reliably verified in this session. No station adapter, protected scrape or invented official readings. Delhi uses clearly labelled CAMS estimates | India National AQI is not inferred from US or European AQI. Station coverage and cadence remain unverified |
| OpenFreeMap / both | [Setup](https://openfreemap.org/quick_start/); public dark vector style | None for configured public style | Visible OpenFreeMap/OpenMapTiles/OSM attribution; underlying geographic data licences apply | Existing real MapLibre basemap retained and visually verified for both cities; offline browser tests substitute an empty style fixture | Public tiles have no promised SLA. Building heights only from supplied dataset fields; no fabricated signal heatmaps |

Legacy `wttr` and `openweather` adapters remain available for Melbourne only. Their geographic restriction is explicit; the preferred two-city weather source is Open-Meteo. Offline `demo` adapters remain explicitly selectable and always carry demo provenance.

## City architecture and contracts

`backend/app/cities.json` is canonical. It defines exactly two IDs, country codes, IANA zones, verified camera coordinates/source links, supported layers/providers, cache TTLs, maximum source ages, separate scoring versions and model directories. `backend/scripts/sync_city_registry.py` generates the small frontend JSON copy; backend tests/CI check semantic equality. No page or application is duplicated.

Existing APIs without city context retain Melbourne defaults. City-bound routes validate `?city=melbourne|delhi` and reject unsupported values with 422. Operator uses a typed city field and resolves explicit supported-city names before querying data. New endpoints:

- `GET /api/v1/cities`
- `GET /api/v1/air-quality?city=delhi`
- `GET /api/v1/metro?city=delhi` (static network with operational-status flag)
- `GET /api/v1/compare/air-quality` (both supported cities, US AQI only)

Provenance records source ID/provider/city, data kind (`modelled`, `observed`, `static`, `demo`, `unknown`), provider-versus-derived value kind, source sample and fetch times, last attempt, latency, cache/source ages, precision, units, authentication needs, safe error codes, rate headers/policy, limitations and attribution. `live` means a recent successful real-provider retrieval; it never implies measured ground truth. Static Metro has separate static provenance and never a live operational label.

Status behaviour: successful real fetch → live; reused success → cached; expired or failed-refresh real data → stale; no usable source → unavailable; explicit fixture → demo. Missing keys use unavailable plus `credentials_required`. No exception URL/body is returned to the frontend. Authentication echoed in raw response links/fields is redacted before storage.

Open-Meteo Unix sample times are UTC instants. The request explicitly sets the city IANA zone; daily dates are normalized in that zone. Celsius, km/h, mm, percent and μg/m³ are checked/declared. Weather labels map documented WMO codes. Missing fields remain null; missing wind/temperature excludes weather suitability instead of implying calm weather.

## Persistence, migration and resilience

Alembic `0002` assigns all existing rows to Melbourne, adds city/time lookup indexes, city/hour uniqueness, new AQ/raw tables and audit details. Legacy duplicate prediction hashes are preserved. Nullable legacy dedup keys permit preservation; new snapshots/predictions/raw payloads use city-scoped dedup keys and atomic conflict handling. Hourly features use atomic upsert. A concurrent-prediction regression confirms one stored result under simultaneous requests.

Before migration, SQLite’s backup API saved the local database in ignored `backend/tmp/backups/`. Preserved row counts were: weather 14, transit 11, events 10, activity 11, predictions 2, ingestion audit 177. The migration was checked against this real history and against a fixture containing legacy duplicate prediction hashes. SQLite migration DDL now runs in an explicit transaction to avoid partial schemas on failure. A downgrade refuses to discard Delhi history. Routine future retention remains configured at 90 days; migration itself deletes no history.

Weather, AQ, transit, events, ingestion successes/failures, hourly derived features and predictions are city scoped. Raw provider JSON is separate from normalized data and has no public endpoint. History/replay/CSV query city first; old missing AQ fields remain null. Historical charts break across gaps, provider/data-kind/coverage/methodology changes. Period comparisons group compatible provenance and methodology only. Static network is not turned into disruption counts in history.

Per-city/source locks collapse concurrent fetches. Successful cache state survives restart via persisted normalized snapshots; a changed adapter does not reuse a different provider. TTLs: weather 10 minutes, AQ 60 minutes, PTV 2 minutes, static Metro 24 hours, events 30 minutes. Source-age thresholds are independent: weather/PTV/events 1 hour, AQ 2 hours, static Metro 30 days. HTTP calls have 8-second timeouts, at most 3 network/5xx attempts with exponential delay, and a 26-second source budget. 429 stops retrying immediately and opens a bounded cooldown using Retry-After. Repeated failures expand the circuit cooldown up to 15 minutes; missing/auth credentials wait 5 minutes. Partial source failure never takes down the remaining city signals. Frontend polling is visibility-aware, deduplicated and cancelled on city changes.

The server remains a single-worker SQLite application; provider circuits/rate-client tracking are process-local. Do not multiply workers and assume a shared quota coordinator. Ticketmaster paging is bounded; a mid-page failure retains the last complete cached snapshot rather than pretending the partial result is complete. Public APIs, provider coverage and static cartography have no completeness guarantee.

## Scoring and ML

Melbourne retains events 40 + notices 25 + weather 15 + local time prior 20 (maximum 100), version `activity-proxy-melbourne-2.0`. Delhi uses events 40 + weather 15 + local time prior 20 (maximum 75), version `activity-proxy-delhi-2.0`; static Metro contributes no measured availability/disruption component. Weather’s design temperature prior is 20°C/span 20 for Melbourne and 26°C/span 24 for Delhi; these are transparent design choices, not calibrated city behaviour. Missing/stale components contribute zero and coverage is reported. City scores with different maxima/providers are not directly comparable. Neither score measures foot traffic or congestion.

Air pollution stays outside activity. Environmental context reports the supplied US AQI estimate with its standard/data kind; operational context reports actual notice count only when available. No health diagnosis, crowd-size estimate or invented event-impact category is generated.

ML feature hours use each city’s IANA zone. City artifacts/dataset hashes/baselines/evaluations/predictions are separate (`artifacts/` for legacy Melbourne, `artifacts/delhi/` for Delhi). Inference rejects an artifact from the wrong city. Synthetic continuations retain synthetic labels and research dates; [Delhi synthetic evaluation](model-evaluation-delhi.json) is an actual separately executed experiment.

Real backtesting uses expanding chronological windows with a one-hour purged boundary and persistence/Ridge metrics. It requires at least 240 complete feature hours from genuine observed city weather; synthetic/modelled/unknown records are excluded by the observed-history loader. Current real-data coverage is insufficient in [Melbourne](backtest-melbourne.json) and [Delhi](backtest-delhi.json), both zero suitable feature hours. Open-Meteo model output is never silently promoted to ground truth or used to claim real-world accuracy.

## Operator and UI

Supported queries include weather/AQI in Delhi, Melbourne disruptions, Delhi Metro stations, switching city, situation reports and city AQ comparisons. Actions are schema-validated, declarative and allowlisted: switch city, navigate a supported view, focus a verified preset, toggle a supported layer, select a permitted range, compare US AQI. No executable code, arbitrary coordinates, URLs or unsupported city actions are interpreted.

Comparisons retain both source times, data kinds/statuses and common units. Current samples must be fresh, within two hours and from the same provider/data kind. Missing or stale data yields no current ranking. European and Indian AQI are never substituted into a US AQI comparison.

The new air-quality workspace has an explicit US/European standard selector, pollutant units, model forecast samples and a two-city comparison. Its map overlay is a labelled city grid estimate, never an invented neighbourhood heatmap. Metro is a static route/station layer with attribution and a visible no-live-status notice. Provider-coordinate event markers, Melbourne area envelopes, real building heights, timeline, scenario lab, forecasting workspaces, command palette, reduced effects and map failure recovery remain.

Diagnostics expose provider/city/kind, source/cache ages, successful fetch/attempt times, latency, authentication/error codes, rate details, coverage and ingestion audit. A healthy fixture is still demo; API reachability is not provider health.

## Verification and reproduction

- Backend: 44 passing tests; Ruff lint/format; fresh/legacy duplicate migration upgrade tests; `alembic check` clean.
- Frontend: 11 passing unit tests; TypeScript, ESLint and Prettier checks.
- Browser: 9 passing Playwright tests, including all existing Overdrive flows, provider/map failure recovery, accessibility, city transitions, AQ standards, Metro search and city Operator actions. Deterministic suite uses demo providers/static OSM and intercepted map tiles, with no public provider calls. Responsive checks cover 1920, 1440, 768 and 390 widths across the applicable views.
- Production build and actual local browser verification are recorded with the final screenshots below. Live preview uses public modelled feeds; automated tests use fixtures.
- [Dependency and secret scan](reality-audits.json): 0 npm production findings, 0 OSV advisories across 38 pinned Python packages, no detected secret patterns in tracked/non-ignored text. The full npm audit retains 5 high findings through development-only Next ESLint → fast-glob → micromatch → braces (`GHSA-vfj7-8cjw-p6xm`). npm’s suggested downgrade to Next 14 lint tooling is incompatible with the retained Next 16 stack; no forced downgrade was applied. Audit results are a point-in-time database check, not a guarantee of absence of vulnerabilities.

```sh
cd backend
venv/bin/alembic upgrade head
venv/bin/alembic check
venv/bin/ruff check app tests migrations scripts
venv/bin/ruff format --check app tests migrations scripts
venv/bin/pytest -q
venv/bin/python scripts/sync_city_registry.py --check
# Optional external requests, intentionally excluded from CI:
PYTHONPATH=. venv/bin/python scripts/verify_providers.py --credentialed
# Genuine observed backtest coverage:
venv/bin/python -m app.ml.pipeline --city delhi --mode observed --backtest
cd ../frontend
npm test
npm run typecheck
npm run lint
npm run format:check
npm run build
npm run test:e2e
```

PTV activation: obtain authorized developer access and set `PTV_DEVID`, `PTV_API_KEY`, `TRANSPORT_ADAPTER=ptv`, then restart and run the credentialed smoke script. Ticketmaster activation: set `TICKETMASTER_API_KEY` and `EVENTS_ADAPTER=ticketmaster`, review account terms/quota, restart and verify both cities’ actual coverage. CPCB/official DMRC integration requires verified permissions and accessible schema/data before activation; the current truthful CAMS/static OSM boundaries remain usable.

## Final local production verification

The standalone production build is running at `http://127.0.0.1:3105` against the real-provider backend at `http://127.0.0.1:8105`. Native browser verification at approximately 14:29 UTC on 8 October 2026 (9 October in Melbourne) confirmed the city selector, Delhi's local clock, both real basemaps, the static Metro geometry/search and modelled AQ comparison. The comparison displayed Melbourne 51 and Delhi 173 US AQI, both source times 14:00 UTC and explicitly modelled/cached. Delhi weather had refreshed to 29.1°C. These captures record that moment, not a promise of future readings.

The mobile AQ view at a 390 × 844 viewport had no horizontal overflow; the temporary viewport override was reset afterward. The final production tab reported no console errors. During final log review, map recreation with an already-ready Metro layer exposed a style-loading race; layer effects now verify that readiness belongs to the current map instance. The browser regression recreates the Delhi map through both reduced-effects states and asserts no uncaught errors. The complete nine-test browser suite passed again in 51.8 seconds after this fix.

Saved native-browser evidence:

- [Melbourne overview](screenshots/reality-melbourne-overview.png)
- [Delhi overview and static Metro layer](screenshots/reality-delhi-overview.png)
- [Delhi modelled AQ and aligned comparison](screenshots/reality-delhi-air-quality.png)
- [Delhi mobile AQ](screenshots/reality-delhi-air-quality-mobile.png)
- [Metro station search](screenshots/reality-delhi-metro.png)
- [Final preview](screenshots/reality-final-preview.png)

Focused local milestones: `48c7691` (providers, city-scoped storage and migration) and `060ba77` (city-aware workspaces, Operator, history and map lifecycle). Documentation, configuration and evidence are recorded in the subsequent local delivery commit. No commits were pushed and no site was deployed.
