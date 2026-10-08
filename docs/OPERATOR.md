# Operator tool reference

**Reality Engine update:** The [two-city delivery report](REALITY_ENGINE_DELIVERY.md) describes current city contexts, Open-Meteo/AQ defaults, static Delhi Metro, credentialed provider boundaries, city scoring and backtesting. Earlier examples below document the preserved Melbourne baseline.

Operator is a deterministic, local API router. It does not call an external language model, execute arbitrary code, infer attendance, or use city listings as instructions. Questions are limited to 1,000 characters; unknown JSON fields are rejected. Each response contains an answer, intent, source references, tool calls, structured supporting data and validated UI actions. History lasts only while this browser session/component remains mounted; at most 30 messages are retained in memory.

## Queries

| Capability | Example | Evidence |
|---|---|---|
| `get_city_overview` | “Give me a situation report” | Current source metadata and citywide index |
| `get_current_weather` | “What is the weather?” | Current normalized weather, including unknown observation age |
| `get_weather_forecast` | “Show weather forecast” | Provider daily outlook, distinct from the research model |
| `get_transport_disruptions` | “Show transport disruptions” | Current notices; unknown location/severity remains unknown |
| `get_upcoming_events` | “Upcoming events in CBD” | Captured listings; no attendance or crowd claims |
| `get_activity_score` | “Activity score” | Deterministic heuristic and input coverage |
| `explain_activity_score` | “Explain the activity score” | Actual component contributions and methodology |
| `get_historical_trends` | “Compare last six hours” | Current vs preceding stored period, grouped by provenance |
| `get_forecast` | “Show forecast” | Actual model artifact, synthetic/observed mode and predictions |
| `get_source_health` | “Which sources are unavailable?” | Source status and stale flags |
| `focus_map_location` | “Show Melbourne Park”, “Focus CBD” | Verified geographic preset; no activity assertion |
| `toggle_map_layer` | “Hide events layer”, “Show boundaries” | Fixed layer catalogue |

“Compare” selects six hours when the question contains “six” or “6”, otherwise 24 hours. It does not implement arbitrary natural-language date interpretation. Queries use current source state. The command-centre time machine separately inspects captured history; other workspaces are current. Map selection shares named geography only, never an implied causal relationship.

## Frontend action contract

```json
[
  {"type":"navigate_dashboard","view":"overview"},
  {"type":"focus_map_location","location":"melbourne-park"},
  {"type":"toggle_map_layer","layer":"transit","enabled":true},
  {"type":"select_time_range","hours":6}
]
```

Allowed views: `overview`, `transit`, `weather`, `events`, `forecasting`, `diagnostics`.

Allowed places: `cbd`, `flinders`, `southern-cross`, `melbourne-park`, `docklands`, `southbank`, `st-kilda`.

Allowed layers: `events`, `transit`, `weather`, `alerts`, `boundaries`. Alerts are major located transit notices, not a separate emergency feed. “Boundaries” is labelled **Area envelopes** in the UI because it displays approximate named-place extents, not authoritative administrative polygons. Weather is an area-level overlay because no station coordinate is supplied.

Allowed ranges: 6, 24, 168, 720 hours. Actions reject unknown fields/values on both sides. The frontend executes only explicit action objects; it never interprets answer text, URLs, HTML or scripts as commands. Source and supporting-data disclosures are rendered as text. The legacy navigation button also checks the view allowlist.

The visual core shows standby, querying, response ready or connection error. Its processing animation runs only during a request and stops under reduced effects or reduced-motion preferences. Suggestions, transcript, close/reset controls, keyboard input, source disclosures and retry by resubmission work without microphone access. Voice/LLM integration is not implemented.

## Local abuse limits

Operator allows 30 requests/minute/client address, four concurrent requests, a 250 ms queue admission timeout and a 28 s request deadline. The address table is in memory, bounded to 1,024 entries and not persisted. This is a single-process local guard, not distributed public-service protection. Public deployment still needs a gateway, authentication, request-body limits and trusted proxy configuration.
