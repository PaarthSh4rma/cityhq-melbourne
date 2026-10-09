# CITYHQ · Operation NOCTURNE

Implemented 9 October 2026, Melbourne. This is an original visual and interaction overhaul of the existing two-city application. Backend contracts, provider adapters, storage, scoring and model mathematics are retained. No push, deployment, account creation or paid resource was performed.

## Delivered experience

CITYHQ now uses a restrained instrument system: near-black geography, steel surfaces, frost text, ice-blue interaction and amber research/hypothetical states. An original catalogue-point SVG identifies the system. Typography uses installed system sans-serif and monospace faces, with no redistributed font files, network fonts or franchise assets.

The map precedes the condensed metric ribbon. Contextual intelligence can collapse; analytics reveal trends, discrete historical captures or scenarios through keyboard-operated tabs. Desktop has a compact navigation rail and an environmental/Operator/source inspector. Mobile has its own scrolling bottom navigation, persistent Operator access, wrapped city/settings controls and a compact local clock. At short mobile heights the overview title is condensed to preserve map space.

The design prioritises real geography, legibility, progressive disclosure and source truth. Status colours always have text. No fictional sensor network, continuous scan, decorative AI orb or fabricated operational feed was introduced.

## Before and after

The before captures belong to the completed Reality Engine implementation; their source times differ from the new captures. Metrics are snapshots, not a controlled data comparison.

| City      | Before                                                       | Nocturne production                                       |
| --------- | ------------------------------------------------------------ | --------------------------------------------------------- |
| Melbourne | [Reality Engine](screenshots/reality-melbourne-overview.png) | [1440 × 900](screenshots/nocturne-melbourne-1440x900.jpg) |
| Delhi     | [Reality Engine](screenshots/reality-delhi-overview.png)     | [1440 × 900](screenshots/nocturne-delhi-1440x900.jpg)     |

![Nocturne Melbourne command centre](screenshots/nocturne-melbourne-1440x900.jpg)

Additional production evidence: [environment](screenshots/nocturne-delhi-air-quality.jpg), [mobile environment](screenshots/nocturne-delhi-air-quality-mobile.jpg), [Operator](screenshots/nocturne-operator.jpg), [provenance](screenshots/nocturne-provenance.jpg), [time machine](screenshots/nocturne-history.jpg), [scenario](screenshots/nocturne-scenario.jpg), [forecasting](screenshots/nocturne-forecasting.jpg), [Metro inspector](screenshots/nocturne-metro.jpg), [diagnostics](screenshots/nocturne-diagnostics.jpg).

## Architecture and interaction changes

- `app/nocturne.css` defines the scoped design tokens, instruments, map hierarchy, responsive layouts, focus treatment and reduced-motion rules. The existing stylesheet layers remain to preserve unmodified functionality.
- `intelligence-primitives.tsx` supplies the original identity mark, source disclosure and recorded-capture scrubber. Provenance includes city, source, data kind, source/retrieval times, age, errors, limitations and attribution; Escape closes the disclosure and restores its summary focus.
- `dashboard.tsx` composes the new shell, actual source availability summary, compact city-local clock, presentation settings and explicit synthetic research banner. Its city-keyed lifecycle and cancellation contracts are preserved.
- `command-centre.tsx` places the map first, supplies a truthful environmental readout and makes analytical tabs operable with arrows, Home and End. The scrubber selects actual stored timestamps, deduplicates capture times and never fills gaps. Existing capture select, exact UTC input, comparisons and exports remain.
- `reality-intelligence.tsx` adds an accessible AQ time-series plot from supplied provider forecast samples and an expandable exact-value table. Missing samples break the line. US and European AQI remain separate. Demo, modelled and unavailable states have distinct language. Selected static Metro stations expose supplied coordinates and their operational-status limitation.
- `research-tools.tsx` retains scenario arithmetic while making hypothetical results visually separate. Delhi’s displayed maximum is correctly 75; Melbourne’s is 100.

No API endpoint, database migration, credential handling, action schema, new dependency or backend service was needed.

## Geographic reconstruction and presentation

The existing dynamically loaded MapLibre pipeline remains. Cartographic paint now uses near-black land, subdued roads, muted rail, structural outlines and low-contrast building depth. One additional footprint-outline layer appears from zoom 15 and uses the same supplied building source/positive-height filter as the extrusions. Heights are never invented; geographic coverage varies with the tiles. [Geographic sources and limitations](GEOGRAPHY.md).

City overview, transport focus, environmental focus and eleven existing documented landmark presets use the canonical city registry. Recenter now selects the current city’s first preset. The coordinate readout follows actual `moveend` centre/zoom values. Pointer interaction stops an in-flight camera movement. Environmental focus enables a labelled area estimate; it does not paint a street-level heatmap.

A bounded spatial transition lasts at most 850 ms. It is explicitly presentation-only, can be skipped and stops on map interaction. It has no polling, continuous animation loop, sensor claim or new tile requests. OS reduced motion and the explicit reduced-effects mode disable it; Presentation settings persist its preference locally. Reduced effects also retain the existing flat camera/no-extrusion treatment.

## Operator and city parity

Operator is a compact deterministic command console with immediate keyboard input focus, contextual suggestions, structured replies, source references and validated action confirmations. It retains request cancellation/timeouts, session-only transcript, clear/reset, Escape close and focus return. No arbitrary actions, unsafe HTML, LLM claims or external language-model service were added.

Melbourne and Delhi share the same shell and instruments while retaining different geography, time zones, provider coverage and activity maxima. Delhi’s supplied static Metro routes retain their line identities; Melbourne retains its verified landmarks and available provider-coordinate records. City changes remount the workspace and abort obsolete requests. No old-city readings are reused in the destination. An Operator-initiated city change can transfer its grounded reply into the destination console.

Weather remains provider model output where indicated. CAMS AQ remains modelled area context. Static Metro never becomes live disruption data. Missing PTV/Ticketmaster credentials, stale history, unavailable comparisons and synthetic evaluation remain visible.

## Responsive and visual verification

The deterministic acceptance matrix navigates **both cities through all seven views at every size** below, exercises Operator actions and Settings/Escape/focus return, checks document overflow and captures actual browser screenshots. It uses demo sources and an intercepted empty map style; these tests do not depend on public API/tile availability. Real vector geography and configured public-provider states are reviewed separately in the native production browser.

| CSS viewport | Melbourne production                                    | Delhi production                                    |
| ------------ | ------------------------------------------------------- | --------------------------------------------------- |
| 1920 × 1080  | [Capture](screenshots/nocturne-melbourne-1920x1080.jpg) | [Capture](screenshots/nocturne-delhi-1920x1080.jpg) |
| 1440 × 900   | [Capture](screenshots/nocturne-melbourne-1440x900.jpg)  | [Capture](screenshots/nocturne-delhi-1440x900.jpg)  |
| 1024 × 768   | [Capture](screenshots/nocturne-melbourne-1024x768.jpg)  | [Capture](screenshots/nocturne-delhi-1024x768.jpg)  |
| 768 × 1024   | [Capture](screenshots/nocturne-melbourne-768x1024.jpg)  | [Capture](screenshots/nocturne-delhi-768x1024.jpg)  |
| 430 × 932    | [Capture](screenshots/nocturne-melbourne-430x932.jpg)   | [Capture](screenshots/nocturne-delhi-430x932.jpg)   |
| 390 × 844    | [Capture](screenshots/nocturne-melbourne-390x844.jpg)   | [Capture](screenshots/nocturne-delhi-390x844.jpg)   |
| 320 × 568    | [Capture](screenshots/nocturne-melbourne-320x568.jpg)   | [Capture](screenshots/nocturne-delhi-320x568.jpg)   |

[Native geometry checks and acceptance scope](nocturne-responsive-verification.json). Screenshots were visually inspected. Review fixes included a wrapping AQ number, inherited mobile panel padding, a hidden Settings button, fixed-height header overflow, oversized mobile command entry, narrow-screen control wrapping, a partly off-screen mobile Operator target and text-enlargement navigation reflow. Small screens retain vertical scrolling and horizontal scrolling inside the bottom navigation; no view is deleted. Safe-area insets protect the bottom navigation and Operator. The temporary native viewport override is reset after verification.

## Accessibility

Semantic navigation, labelled city/actions/inputs, visible keyboard focus, native modal dialogs, Escape close, focus restoration, keyboard tabs and a labelled discrete range input are implemented. Operator is a nonmodal labelled region with a polite transcript; it focuses command entry without trapping navigation. Charts expose text summaries, units and source limitations, with exact AQ samples available beyond colour/geometry. Forecast history and predictions use solid/dashed lines and explicit labels; scenario output is explicitly hypothetical.

Axe WCAG 2 A/AA checks pass on overview and the AQ workspace with an explicit synthetic forecast fixture. OS reduced motion, local effect preference persistence, dialog focus return and keyboard historical selection are tested. An additional test doubles computed text sizes independently of geometry at 1440 and 390 CSS pixels, checks reflow and executes a keyboard command. The responsive matrix additionally requires the complete Operator target to be inside the viewport. Enlarged navigation labels are checked against their button bounds; the bottom navigation scrolls rather than overlapping labels. [Desktop text fixture](screenshots/nocturne-text-200-fixture-1440.png) · [Mobile text fixture](screenshots/nocturne-text-200-fixture-390.png). Primary mobile navigation/Operator targets are at least 44 px; compact secondary controls remain at least 36 px. This is browser-based engineering verification, not a claim of a formal accessibility certification or assistive-technology audit.

## Performance

[Raw measurements and conditions](nocturne-performance.json) retain the prior production baseline at `a57e1f6` and the final production build. Assets include **all** emitted JS/CSS chunks, not only initial-route transfers. Gzip is calculated locally from emitted files.

| Measurement                   | Before (`a57e1f6`) | Final Nocturne |
| ----------------------------- | -----------------: | -------------: |
| Emitted JavaScript (21 files) |        2,413,452 B |    2,426,808 B |
| JavaScript gzip               |          696,389 B |      699,971 B |
| Emitted CSS (2 files)         |          135,238 B |      168,676 B |
| CSS gzip                      |           22,570 B |       28,448 B |
| Combined JS/CSS gzip          |          718,959 B |      728,419 B |
| Warm HTML HTTP median         |          14.290 ms |       1.905 ms |
| Warm HTML HTTP p95            |          48.919 ms |       2.879 ms |

Combined emitted gzip increased **9,460 B (1.32%)**. The final measurement was collected at 04:21 UTC on 9 October 2026. The baseline timestamp records asset measurement; its HTTP sample was collected later in the same session.

Warm HTML retrieval uses 3 warmups and 20 sequential localhost requests against standalone Node builds. Shared host load was uncontrolled and differed between runs; these figures do not establish a rendering speedup. No FPS, Lighthouse, paint/hydration or provider-latency result is inferred.

Map audit: one optional outline layer, no new geographic source/tiles or heavyweight renderer, no continuous presentation frame loop. The bounded sweep uses one animation frame to start and one timeout to stop; cleanup cancels both. Map removal disconnects ResizeObserver and MapLibre resources; source effects verify the current map’s style readiness. Polling cadence, city-scoped deduplication/cancellation and visibility awareness are unchanged. Charts disable interpolation across missing samples and entrance animation. No runtime dependency or network font was added. Operator blur and continuous decorative motion were removed.

## Verification results

Baseline confirmed before changes: **44 backend, 11 frontend, 9 browser tests**.

Final verification: **44 backend tests, 15 frontend tests, 20 browser tests**; Ruff lint/format, ESLint, Prettier, TypeScript, production build and diff-whitespace checks pass. The browser suite adds all seven exact viewports, provenance/Escape, discrete capture selection, keyboard tabs, presentation persistence, OS reduced motion, AQ chart accessibility, real camera-state assertions, rapid switching and 200% text enlargement. Existing map/provider failure recovery, action validation, historical replay, scenario validation/reset, forecast controls and city-aware Metro/AQ flows remain covered.

The offline AQ adapter intentionally supplies no hourly forecast. The dedicated chart test adds a clearly synthetic six-sample series including a gap; the product’s empty state stays intact. The original city-action browser test now uses the already-open destination console after a transferred reply, rather than trying to click a background trigger covered by that console.

Tests run with a single browser worker. Concurrent workers encountered browser/server startup failures on a heavily memory-constrained shared host; sequential execution passed. Existing non-failing warnings concern Starlette’s test-client httpx deprecation, Vite configuration loading and Node module registration. A deliberate failed-style recovery test logs a MapLibre style rebuild message and passes.

## Known limitations

- Public vector tiles and providers have their existing coverage, licensing and connectivity limits. A supplied building height is cartographic data, not a surveyed digital-twin guarantee.
- PTV and Ticketmaster remain unavailable until credentials are configured; static Delhi Metro has no live operational feed. Official CPCB station observations are not connected.
- AQ is approximately 45 km model context, not a measured street network. Comparisons require compatible fresh source times and may be unavailable.
- History remains sparse, source-specific and gap-aware. The basemap is geographic context during replay, not reconstructed historical buildings or movement.
- Synthetic temperature evaluation remains synthetic. Recursive horizons are not newly validated and no confidence interval is fabricated. Scenarios are deterministic hypothetical index calculations, not causal forecasts.
- No mobile hardware/GPU frame-rate benchmark or formal screen-reader audit was performed. The resource-constrained host limits interpretation of runtime timing.
- Existing single-worker SQLite, authentication and deployment limitations remain in the [Reality Engine report](REALITY_ENGINE_DELIVERY.md).

## Files and local commits

Implementation: `frontend/app/layout.tsx`, `frontend/app/nocturne.css`, `frontend/components/{dashboard,city-map,command-centre,operator,reality-intelligence,research-tools,workspace-controls,intelligence-primitives}.tsx`.

Verification: `frontend/tests/intelligence.test.tsx`, `frontend/tests/operator.test.tsx`, `frontend/e2e/{platform,nocturne}.spec.ts`, `frontend/playwright.config.ts`, `frontend/tsconfig.json`, `frontend/scripts/measure-performance.py`.

Documentation/evidence: `README.md`, `docs/GEOGRAPHY.md`, this report, `docs/nocturne-performance.json`, `docs/nocturne-responsive-verification.json` and the `docs/screenshots/nocturne-*` captures.

1. `655ee4e` — `feat(ui): introduce Nocturne command centre and instrument system`
2. `3ca3813` — `test(ui): cover Nocturne replay provenance and responsive operations`
3. `docs: record Nocturne visual accessibility and performance delivery` — this report, reproduction script, measurements and inspected screenshots are included in the documentation commit. Its hash is available in `git log -3 --oneline` after creation.

All three commits are local. No push or deployment was performed.

## Local reproduction

Existing environment files and model/history artifacts are preserved. Use the existing virtual environment and installed npm dependencies, or follow the README setup if absent. In separate terminals:

```sh
cd backend
CORS_ORIGINS=http://127.0.0.1:3105 WEATHER_ADAPTER=open-meteo AIR_QUALITY_ADAPTER=open-meteo-aq TRANSPORT_ADAPTER=ptv DELHI_TRANSPORT_ADAPTER=delhi-metro-static EVENTS_ADAPTER=ticketmaster venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8105
```

```sh
cd frontend
NEXT_PUBLIC_API_URL=http://127.0.0.1:8105 npm run build
# Normal local production preview; no deployment:
npm run start -- --hostname 127.0.0.1 --port 3105
```

The delivered local preview uses the equivalent standalone server with `public` and `.next/static` copied into the standalone output, `HOSTNAME=127.0.0.1`, `PORT=3105`. Open [CITYHQ](http://127.0.0.1:3105/#overview). For development use `NEXT_PUBLIC_API_URL=http://127.0.0.1:8105 NEXT_DIST_DIR=.next-reality npm run dev -- --hostname 127.0.0.1 --port 3105` after stopping the production process on that port.

```sh
cd backend
venv/bin/ruff check app tests migrations scripts
venv/bin/ruff format --check app tests migrations scripts
venv/bin/pytest -q
cd ../frontend
npm test
npm run typecheck
npm run lint
npm run format:check
npm run test:e2e
NEXT_PUBLIC_API_URL=http://127.0.0.1:8105 npm run build
# With the production preview running, return to repository root:
cd ..
python3 frontend/scripts/measure-performance.py --phase after --output /tmp/nocturne-performance.json
```

Acceptance uses isolated ports 3115/8115, an ignored `.next-e2e` directory, demo adapters and a temporary SQLite database. It does not reuse the real-provider preview. Test screenshots and traces are written under ignored `frontend/test-results/`. Reproducing the old baseline requires its separate checkout/build; the recorded baseline is retained to avoid modifying or resetting the current workspace.
