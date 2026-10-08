# Data provenance and activity methodology

| Signal | Adapter | Default | Coverage and limitations |
|---|---|---|---|
| Weather | wttr.in | Live attempt | Existing credential-free service; area-level conditions, local observation timestamp, daily min/max when supplied; best-effort availability |
| Weather | OpenWeather | Optional key | Current conditions only; provider UTC timestamp; m/s converted to km/h |
| Weather | demo | Explicit opt-in | Fixed fictional 18°C, 14 km/h, 62%; never called live |
| Transport | demo | Default | Three fictional notices; route labels explicitly demo; no coordinates |
| Transport | PTV | Optional developer ID/key | Full returned disruption snapshot; publication status is not severity; no passenger counts or inferred coordinates |
| Events | demo | Default | Three fictional upcoming listings with illustrative venues; no exact coordinates |
| Events | Ticketmaster | Optional key | First 100 Melbourne/AU listings in next seven days; incomplete city coverage; venue coordinates only when supplied and valid |

No attendance, congestion, audience impact or inferred exact disruption coordinates are supplied. Legacy impact fields remain zero and mean **not assessed**. PTV severity is unknown where its response does not contain reliable severity. Event/transit `observed_at` is the snapshot retrieval time, not a claim about when each event or incident began. Demo timestamps are generation times.

Every signal carries provider, status, origin status, observed/fetched UTC timestamps, age, TTL, stale flag, safe error and limitations. Cached describes retrieval; `origin_status` retains whether data was actually live or demo. Live weather older than max(1h, 2×TTL) is marked stale. An unavailable payload uses null weather values and has no successful timestamps; clients must read metadata before interpreting empty arrays/counts.

## Activity proxy v1

This is a heuristic index of available urban signals. It is not measured foot traffic, congestion, predicted demand or an ML output.

- Events: `4 × min(upcoming listing count, 10)`; maximum 40.
- Transit: `2.5 × min(notice count, 10)`; maximum 25. Counts reflect notices, not severity or passengers.
- Weather: `15 × max(0, 1 - abs(temp - 20)/20) × max(0, 1 - wind_kmh/80)`; maximum 15.
- Time context: 20 between 07:00 inclusive and 22:00 exclusive in Australia/Melbourne, otherwise 5; maximum 20.

Total is rounded to one decimal. Quiet <35, Moderate 35–64.9, Elevated ≥65. Unavailable/stale components contribute zero without rescaling. If all external signals are unusable the score is null. Coverage is the fraction of usable sources, not statistical confidence; demo inputs set a separate demo flag. Partial/full coverage scores are not directly comparable.

Sensitivity: one additional listing contributes 4 points until saturation; one additional notice contributes 2.5. Temperature suitability peaks at 20°C. These weights and thresholds are design choices, not calibrated causal relationships. No holiday or attendance features are invented. `main_drivers` sorts absolute component contributions; it does not attribute changes since a prior observation.

## Map policy and sources

MapLibre uses real geographic coordinates and OpenStreetMap standard raster tiles for modest interactive local use. Attribution remains visible, browser caching and referrer are preserved, and there is no tile prefetch/offline feature. Automated browser tests intercept tile requests. Set `NEXT_PUBLIC_MAP_STYLE` to a provider whose terms cover your deployment or self-host before significant traffic. Availability is best-effort; do not assume a free hosting/tile SLA.

Primary references checked during implementation:
- [OSMF tile usage policy](https://operations.osmfoundation.org/policies/tiles/)
- [PTV official API reference](https://timetableapi.ptv.vic.gov.au/swagger/ui/index)
- [Ticketmaster Discovery API](https://developer.ticketmaster.com/products-and-docs/apis/discovery/v2/)
- [wttr.in source and JSON service](https://github.com/chubin/wttr.in)
- [OpenWeather current weather API](https://openweathermap.org/current)
