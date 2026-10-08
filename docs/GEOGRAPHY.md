# Geographic provenance

The default map uses MapLibre GL JS and OpenFreeMap’s public dark vector style. Custom paint changes provide navy land, cyan roads, violet rail and readable labels. Attribution remains visible. Building extrusions use the OpenMapTiles `building` layer’s `render_height` and `render_min_height`; missing heights are not invented. Dataset heights are cartographic data, not a guarantee of surveyed building dimensions. Custom styles lacking the expected source/layer retain their compatible basemap and controls.

Verified on 2026-10-08 using OpenStreetMap Nominatim records, with Southern Cross corrected against its Wikidata station record after geocoding returned ambiguous nearby amenities:

| Preset | Longitude, latitude | Record |
|---|---|---|
| CBD camera | 144.9655616, -37.8141705 | [Melbourne suburb label point](https://www.openstreetmap.org/relation/2383266); camera context, not a CBD polygon |
| Flinders Street | 144.9664779, -37.8184161 | [OSM station node](https://www.openstreetmap.org/node/4936370201) |
| Southern Cross | 144.9525, -37.8183333333 | [Wikidata station coordinates](https://www.wikidata.org/wiki/Q801455), 37°49′6″S 144°57′9″E |
| Melbourne Park | 144.9790884, -37.8213608 | [OSM sports-centre way](https://www.openstreetmap.org/way/220550128) |
| Docklands | 144.9394923, -37.8175423 | [OSM suburb relation](https://www.openstreetmap.org/relation/2397613) |
| Southbank | 144.9640203, -37.8253618 | [OSM suburb relation](https://www.openstreetmap.org/relation/2395850) |
| St Kilda | 144.981637, -37.8638261 | [OSM suburb relation](https://www.openstreetmap.org/relation/2397474) |

Docklands, Southbank, St Kilda and Melbourne Park use the returned geographic bounding boxes as optional **approximate area envelopes**. They are not administrative boundaries or an inferred incident footprint. Selecting an unlocated listing focuses a matching named place and, if available, outlines that envelope. No matching verified place means no map movement. Demo venues are not geocoded.

Only provider-supplied coordinates create event/transit markers. Labels and popup content use text rendering, never provider HTML. Selecting a located signal highlights its context and dims unrelated geographic markers. Related records share their supplied area name; no causal connection is asserted.

There is no regional activity heatmap, passenger-density layer, weather radar, emergency-alert feed or fabricated intensity surface. The citywide activity proxy is not projected onto neighbourhoods. Alerts toggle located major transit notices only. Weather is a labelled city-area reading without a pin.

## Performance and failure behaviour

The map is loaded dynamically on map-bearing views, cleans up its instance, markers and ResizeObserver, and handles WebGL/style/tile failures with a visible message and retry. Mobile uses a flat camera; reduced effects removes extrusions and animation. Camera presets and the textual signal list remain usable when map rendering fails. No screenshot is used as a fake interactive fallback.

OpenFreeMap resources load directly in the browser; these requests expose ordinary connection/referrer information to that tile provider. No CityHQ geolocation, analytics or telemetry is requested. `NEXT_PUBLIC_MAP_STYLE` can select an approved provider style. Review third-party terms and anticipated traffic before public deployment; no guaranteed public SLA is implied.

References: [OpenFreeMap setup](https://openfreemap.org/quick_start/), [MapLibre 3D buildings example](https://maplibre.org/maplibre-gl-js/docs/examples/display-buildings-in-3d/), [OSM attribution/licensing](https://www.openstreetmap.org/copyright).

## Delhi / Reality Engine

Delhi camera presets and reference centre are actual OSM station nodes: Rajiv Chowk (77.2193123, 28.6327062; node 6539894851), Kashmere Gate (77.2282488, 28.6674493; node 268381477), New Delhi (77.2227421, 28.6434826; node 554257841), Central Secretariat (77.2122822, 28.6158794; node 5453646586). The canonical registry retains each source URL. The reference centre is a camera/query reference point, not an asserted city centroid.

The bundled [Delhi Metro derived database](../backend/app/data/delhi-metro.json) contains 245 station nodes tagged Delhi Metro and 24 directional route relations, from the public OSM extract dated 2026-10-08T13:47:50Z. [Source, query and ODbL attribution](../backend/app/data/README.md). Supplied MultiLineStrings retain gaps rather than inventing connections. Other networks are excluded. This supports static exploration, not live service status, schedules or route availability.

Air quality is a labelled CAMS city-grid estimate (~45 km), with no invented neighbourhood heatmap. Actual model time, standard and status stay visible. Official DMRC download form/terms were not bypassed; details and limitations appear in the [source matrix](REALITY_ENGINE_DELIVERY.md).
