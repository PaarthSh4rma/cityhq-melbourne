# System design

**Reality Engine update:** The [two-city delivery report](REALITY_ENGINE_DELIVERY.md) describes current city contexts, Open-Meteo/AQ defaults, static Delhi Metro, credentialed provider boundaries, city scoring and backtesting. Earlier examples below document the preserved Melbourne baseline.

```mermaid
flowchart LR
  Browser[Next.js / React dashboard] -->|typed polling| API[FastAPI /api/v1]
  Browser -->|visible viewport only| Tiles[MapLibre / permitted tile provider]
  API --> Ingest[Source cache + per-source locks]
  Worker[Single-process ingestion loop] --> Ingest
  Ingest --> Adapters[wttr / OpenWeather / PTV / Ticketmaster / demo]
  Ingest --> DB[(SQLite / SQLAlchemy)]
  Worker --> Score[Deterministic activity proxy]
  Score --> DB
  API --> Operator[Deterministic query router]
  Operator --> Ingest
  API --> ML[Temperature inference]
  Train[Offline chronological experiment] --> Artifact[Trusted joblib + evaluation JSON]
  DB --> Train
  Artifact --> ML
  ML --> DB
```

## Boundaries and contracts

The browser accesses CityHQ for all city signals. Only map tiles go directly to a map provider. Secrets stay in backend environment variables. Original `/weather`, `/transport`, `/events` paths remain compatible; the old service imports delegate to the new ingestion boundary. Wind is consistently km/h.

`app/config.py` loads backend-local environment configuration. `schemas.py` validates normalized signals. `adapters.py` handles provider formats. `ingestion.py` owns timeouts, retries, cache freshness and safe failures. `persistence.py` owns six tables. `analytics.py` computes the heuristic. `ml/` handles reproducible training and inference. `operator.py` maps questions to bounded internal queries. `api.py` exposes routes; `main.py` runs the ingestion lifespan and health checks.

## Storage and process model

Run one backend worker with SQLite. Cache locks and ingestion scheduling are process-local. Multiple workers would multiply external requests and can race on deduplication. For scale, move ingestion into a separate scheduled worker, use a shared cache and PostgreSQL, and add unique idempotency constraints.

Alembic owns schema creation. Startup fails if migrations are absent. UTC offset-bearing ISO timestamps sort chronologically. Separate weather, transport and event tables retain normalized payloads and provenance. Identical source payloads within an hour are deduplicated; one unchanged sample per subsequent hour supports honest sampling. Hourly activity rows use the latest sample within that hour, not an arithmetic mean. Missing or stale signals are null in history. Charts must not treat unavailable counts as zero.

Retention defaults to 90 days and is applied to all six tables. Make a SQLite backup before migration/retention changes. Use durable disk; ephemeral hosting loses history. Demo observations remain explicitly labelled and are excluded from observed ML training.

## Reliability

Each provider request has an 8-second timeout, at most three attempts for network errors/429/selected 5xx, exponential backoff, and a 26-second overall limit. Source-specific TTLs: weather 600s, transit 120s, events 1800s. Failed sources retry no sooner than 60s. Failed refreshes retain last successful data and timestamps with stale/error flags; no live-to-demo fallback occurs silently.

Frontend requests time out at 30s, abort on unmount, never overlap within a poller, back off on failures and pause new polls while hidden. Manual refresh re-queries CityHQ without bypassing server TTLs. The Melbourne clock is isolated from source timestamps. API errors override the sidebar status; /health describes API/storage readiness, not feed health.

The Operator is deliberately deterministic, with no shell, file or external-action tools. Forecast artifact loading accepts only the server-configured trusted path; never load untrusted joblib files. The Operator has process-local rate and concurrency bounds; this local portfolio application has no authentication or shared rate-limiting gateway. Add those before an internet-facing production release.

## Trade-offs

JSON payloads preserve provider flexibility while the indexed timestamps enable local histories. SQLite and one worker make zero-cost setup simple. Hash-based navigation provides shareable six-view state without duplicating polling lifecycles. The map is code-split; charts and animations disable unnecessary transitions. System fonts avoid remote font downloads during builds. Webpack mode avoids a sandbox-specific Turbopack process/port restriction.

## Overdrive implementation boundaries

`dashboard.tsx` retains six hash-addressable views and owns the validated action executor, geographic focus and layer state. `command-centre.tsx` composes the map, selected-record context, captured-history workspace and collapsible analytics. `city-map.tsx` loads MapLibre lazily, uses OpenFreeMap vector geography, resizes with its container and removes its WebGL resources on unmount. `geography.ts` is the fixed, sourced camera catalogue; approximate envelopes are separate from provider-coordinate markers.

`workspace-controls.tsx` supplies a native modal command dialog with focus restoration and an optional first-session briefing driven by actual source states. `operator.tsx` holds at most 30 messages in memory and reacts to actual pending/error/completion states. API actions are treated as unknown input until exact-key runtime validation succeeds in `lib/commands.ts`; backend Pydantic schemas independently enforce the same allowlist. External titles are plain React text / DOM text content, never instructions or HTML.

`lib/api.ts` shares simultaneous GETs by path. Each subscriber can abort independently; the upstream request aborts only after its last subscriber leaves. POST requests are never deduplicated. `use-poll.ts` keys results and errors to the current query, retains the last successful response for that query, pauses while hidden, backs off and cancels on cleanup. The browser refresh cadence and server source TTL are distinct.

`timeline.py` selects the latest retained source capture at or before a requested UTC timestamp. No future capture or current-data fallback enters replay. Expired captures remain inspectable but are excluded from the recomputed activity proxy. Overview metrics, map and selected-record list share this captured context; other workspaces and Operator queries remain current, as the banner states. Comparison uses two equal periods anchored to now, grouped by provenance; it does not assert a causal change.

Scenario inputs are bounded component contributions. Local preview gives immediate deterministic feedback; `/scenario` independently validates and recalculates against current source context. Neither writes observations. Rate limits are per process/client address (30 Operator requests/minute, four concurrent queries, bounded client map), with queue and total-query timeouts. Reverse-proxy deployments need a shared gateway and deliberate client-address policy.
