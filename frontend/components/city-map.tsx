"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Crosshair, Layers3 } from "lucide-react";
import { useCity } from "@/lib/city-context";
import type { AirQuality, MetroNetwork, Item, Weather } from "@/lib/types";
import {
  DEFAULT_LAYERS,
  LAYERS,
  type Layers,
  type Layer,
  type Location,
} from "@/lib/commands";
import { placeForArea } from "@/lib/geography";
export type MapSelection = { item: Item; kind: "events" | "transit" };
export default function CityMap({
  events,
  transit,
  weather,
  airQuality,
  network,
  layers: controlled,
  onLayer,
  camera,
  onFocus,
  selection,
  onSelect,
  reduced = false,
  sonar = true,
}: {
  events: Item[];
  transit: Item[];
  weather?: Weather | null;
  airQuality?: AirQuality | null;
  network?: MetroNetwork | null;
  layers?: Layers;
  onLayer?: (layer: Layer, enabled: boolean) => void;
  camera?: { location: Location; nonce: number };
  onFocus?: (location: Location) => void;
  selection?: MapSelection | null;
  onSelect?: (selection: MapSelection) => void;
  reduced?: boolean;
  sonar?: boolean;
}) {
  const { city, config, places: PLACES } = useCity();
  const container = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null);
  const styledMap = useRef<maplibregl.Map | null>(null);
  const selectRef = useRef(onSelect);
  const markerEntries = useRef<{ marker: maplibregl.Marker; area: string }[]>(
    [],
  );
  useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);
  const [localLayers, setLocalLayers] = useState(DEFAULT_LAYERS),
    [ready, setReady] = useState(0),
    [error, setError] = useState("");
  const [flat, setFlat] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [position, setPosition] = useState({
    lng: PLACES[0].center[0],
    lat: PLACES[0].center[1],
    zoom: PLACES[0].zoom,
  });
  useEffect(() => {
    if (
      !ready ||
      !sonar ||
      reduced ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const start = requestAnimationFrame(() => setScanning(true));
    const end = setTimeout(() => setScanning(false), 850);
    return () => {
      cancelAnimationFrame(start);
      clearTimeout(end);
    };
  }, [ready, camera?.nonce, sonar, reduced]);
  const layers = controlled || localLayers;
  const styleURL =
    process.env.NEXT_PUBLIC_MAP_STYLE ||
    "https://tiles.openfreemap.org/styles/dark";
  function toggle(layer: Layer, enabled: boolean) {
    if (onLayer) onLayer(layer, enabled);
    else setLocalLayers((v) => ({ ...v, [layer]: enabled }));
  }
  useEffect(() => {
    if (!container.current) return;
    let instance: maplibregl.Map | undefined;
    let disposed = false;
    try {
      maplibregl.setWorkerUrl(
        new URL(
          "maplibre-gl/dist/maplibre-gl-worker.mjs",
          import.meta.url,
        ).toString(),
      );
      const small = window.matchMedia("(max-width: 768px)").matches;
      instance = new maplibregl.Map({
        container: container.current,
        style: styleURL,
        center: PLACES[0].center,
        zoom: city === "delhi" ? 12 : 15.2,
        pitch: small || reduced ? 0 : 54,
        bearing: small || reduced ? 0 : -22,
        maxZoom: 18,
        maxPitch: 65,
        attributionControl: { compact: false },
        pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
        maxTileCacheSize: 128,
        canvasContextAttributes: { antialias: !reduced },
        fadeDuration: reduced ? 0 : 200,
      });
      const m = instance;
      map.current = m;
      m.on("moveend", () => {
        if (!disposed) {
          const point = m.getCenter();
          setPosition({ lng: point.lng, lat: point.lat, zoom: m.getZoom() });
        }
      });
      styledMap.current = null;
      m.addControl(new maplibregl.NavigationControl(), "top-right");
      m.addControl(
        new maplibregl.ScaleControl({ maxWidth: 90 }),
        "bottom-left",
      );
      m.on("style.load", () => {
        if (disposed) return;
        try {
          for (const layer of m.getStyle().layers) {
            if (layer.type === "symbol" && layer.layout?.["text-field"]) {
              m.setPaintProperty(layer.id, "text-color", "#91a4b6");
              m.setPaintProperty(layer.id, "text-halo-color", "#07090d");
              m.setPaintProperty(layer.id, "text-halo-width", 1.2);
            }
            if (layer.type === "fill" && layer.paint?.["fill-pattern"])
              m.setPaintProperty(layer.id, "fill-pattern", undefined);
            if (layer.type === "background")
              m.setPaintProperty(layer.id, "background-color", "#07090d");
            if (layer.type === "fill" && layer["source-layer"] === "water")
              m.setPaintProperty(layer.id, "fill-color", "#0b161f");
            if (layer.type === "fill" && layer["source-layer"] === "building")
              m.setPaintProperty(layer.id, "fill-color", "#111c26");
            if (
              layer.type === "line" &&
              layer["source-layer"] === "transportation"
            ) {
              m.setPaintProperty(
                layer.id,
                "line-color",
                layer.id.includes("casing")
                  ? "#07090d"
                  : layer.id.includes("railway")
                    ? "#526b77"
                    : layer.id.includes("major") ||
                        layer.id.includes("motorway")
                      ? "#36505e"
                      : "#22313e",
              );
            }
          }
          const building = m
            .getStyle()
            .layers.find(
              (l) => l.type === "fill" && l["source-layer"] === "building",
            );
          if (building && "source" in building && building.source) {
            const before = m
              .getStyle()
              .layers.find((l) => l.type === "symbol")?.id;
            m.addLayer(
              {
                id: "cityhq-buildings",
                type: "fill-extrusion",
                source: building.source,
                "source-layer": "building",
                minzoom: 14,
                filter: ["has", "render_height"],
                paint: {
                  "fill-extrusion-color": "#223c4a",
                  "fill-extrusion-height": ["get", "render_height"],
                  "fill-extrusion-base": [
                    "coalesce",
                    ["get", "render_min_height"],
                    0,
                  ],
                  "fill-extrusion-opacity": 0.82,
                  "fill-extrusion-vertical-gradient": true,
                },
              },
              before,
            );
          }
          if (building && "source" in building && building.source)
            m.addLayer({
              id: "cityhq-building-edges",
              type: "line",
              source: building.source,
              "source-layer": "building",
              minzoom: 15,
              filter: ["has", "render_height"],
              paint: {
                "line-color": "#7fa7bc",
                "line-width": 0.45,
                "line-opacity": 0.28,
              },
            });
          m.addSource("cityhq-context", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: PLACES.filter((p) => p.bounds).map((p) => {
                const [west, south, east, north] = p.bounds!;
                return {
                  type: "Feature",
                  properties: { label: p.label },
                  geometry: {
                    type: "Polygon",
                    coordinates: [
                      [
                        [west, south],
                        [east, south],
                        [east, north],
                        [west, north],
                        [west, south],
                      ],
                    ],
                  },
                };
              }),
            },
          });
          m.addLayer({
            id: "cityhq-context-fill",
            type: "fill",
            source: "cityhq-context",
            paint: { "fill-color": "#96b7ff", "fill-opacity": 0.04 },
            layout: { visibility: "none" },
          });
          m.addLayer({
            id: "cityhq-context-line",
            type: "line",
            source: "cityhq-context",
            paint: {
              "line-color": "#94aef2",
              "line-width": 1.4,
              "line-dasharray": [3, 3],
            },
            layout: { visibility: "none" },
          });
          styledMap.current = m;
          setReady((v) => v + 1);
          setError("");
        } catch {
          setError(
            "This map style does not support every geographic layer. Camera and signal controls remain available.",
          );
          styledMap.current = m;
          setReady((v) => v + 1);
        }
      });
      m.on("error", () => {
        if (!disposed)
          setError(
            "Some map tiles could not load. Check connectivity or configured tile provider.",
          );
      });
      const resize = new ResizeObserver(() => m.resize());
      resize.observe(container.current);
      return () => {
        disposed = true;
        resize.disconnect();
        map.current = null;
        styledMap.current = null;
        m.remove();
      };
    } catch {
      queueMicrotask(() => {
        if (!disposed)
          setError(
            "Interactive map unavailable: WebGL is not supported. Use the place presets and signal list below.",
          );
      });
    }
    return () => {
      disposed = true;
      map.current = null;
      styledMap.current = null;
      instance?.remove();
    };
  }, [reduced, styleURL, PLACES, city]);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || styledMap.current !== m) return;
    const p = PLACES.find((p) => p.id === camera?.location) || PLACES[0];
    m.flyTo({
      center: p.center,
      zoom: p.zoom,
      pitch:
        flat || reduced || window.matchMedia("(max-width:768px)").matches
          ? 0
          : 54,
      bearing: flat || reduced ? 0 : -22,
      duration:
        reduced || window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 850,
    });
  }, [camera, ready, flat, reduced, PLACES]);
  useEffect(() => {
    const narrow = window.matchMedia("(max-width:768px)");
    const sync = () =>
      map.current?.easeTo({
        pitch: narrow.matches || flat || reduced ? 0 : 54,
        bearing: narrow.matches || flat || reduced ? 0 : -22,
        duration: 0,
      });
    sync();
    narrow.addEventListener("change", sync);
    return () => narrow.removeEventListener("change", sync);
  }, [flat, reduced, ready]);
  useEffect(() => {
    const m = map.current;
    if (!m || !selection) return;
    const p = placeForArea(selection.item.area, PLACES);
    const center = selection.item.coordinates || p?.center;
    if (center)
      m.flyTo({
        center,
        zoom: selection.item.coordinates ? 16 : p!.zoom,
        duration: reduced ? 0 : 650,
      });
  }, [selection, ready, reduced, PLACES]);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || styledMap.current !== m) return;
    const area =
      selection && !selection.item.coordinates
        ? placeForArea(selection.item.area, PLACES)
        : null;
    for (const id of ["cityhq-context-fill", "cityhq-context-line"])
      if (m.getLayer(id)) {
        m.setLayoutProperty(
          id,
          "visibility",
          layers.boundaries || area?.bounds ? "visible" : "none",
        );
        m.setFilter(
          id,
          area?.bounds && !layers.boundaries
            ? ["==", ["get", "label"], area.label]
            : null,
        );
      }
    if (m.getLayer("cityhq-buildings"))
      m.setLayoutProperty(
        "cityhq-buildings",
        "visibility",
        reduced || flat ? "none" : "visible",
      );
  }, [layers.boundaries, ready, selection, reduced, flat, PLACES]);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const markers: maplibregl.Marker[] = [];
    for (const [items, kind, color] of [
      [events, "events", "#b5a4ff"],
      [transit, "transit", "#f7bd6a"],
    ] as const) {
      for (const item of items) {
        if (
          !item.coordinates ||
          (!layers[kind] &&
            !(kind === "transit" && layers.alerts && item.severity === "major"))
        )
          continue;
        if (
          kind === "transit" &&
          layers.alerts &&
          !layers.transit &&
          item.severity !== "major"
        )
          continue;
        if (!item.coordinates.every(Number.isFinite)) continue;
        const content = document.createElement("div");
        content.textContent = `${item.title} · ${item.venue || item.area} · ${item.precision || "Provider coordinate"}`;
        const marker = new maplibregl.Marker({ color })
          .setLngLat(item.coordinates)
          .setPopup(new maplibregl.Popup().setDOMContent(content))
          .addTo(m);
        const element = marker.getElement();
        element.setAttribute("role", "button");
        element.setAttribute("tabindex", "0");
        element.setAttribute("aria-label", item.title);
        element.style.opacity = "1";
        element.addEventListener("click", () =>
          selectRef.current?.({ item, kind }),
        );
        element.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            marker.togglePopup();
            selectRef.current?.({ item, kind });
          }
        });
        markers.push(marker);
        markerEntries.current.push({ marker, area: item.area });
      }
    }
    return () => {
      markers.forEach((marker) => marker.remove());
      markerEntries.current = [];
    };
  }, [events, transit, layers, ready]);
  useEffect(() => {
    for (const entry of markerEntries.current)
      entry.marker.getElement().style.opacity =
        selection && entry.area !== selection.item.area ? "0.3" : "1";
  }, [selection, events, transit, layers, ready]);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || styledMap.current !== m) return;
    if (!network) {
      for (const id of ["cityhq-metro-routes", "cityhq-metro-stations"])
        if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", "none");
      return;
    }
    const source = m.getSource("cityhq-metro") as
      maplibregl.GeoJSONSource | undefined;
    if (source) source.setData(network);
    else {
      m.addSource("cityhq-metro", {
        type: "geojson",
        data: network,
        attribution: "© OpenStreetMap contributors · ODbL 1.0 · Static network",
      });
      m.addLayer({
        id: "cityhq-metro-routes",
        type: "line",
        source: "cityhq-metro",
        filter: ["==", ["geometry-type"], "LineString"],
        paint: {
          "line-color": ["coalesce", ["get", "colour"], "#65d8cb"],
          "line-width": 3,
          "line-opacity": 0.7,
        },
      });
      m.addLayer({
        id: "cityhq-metro-stations",
        type: "circle",
        source: "cityhq-metro",
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-color": "#d9fff7",
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 2, 15, 5],
          "circle-stroke-color": "#16392f",
          "circle-stroke-width": 1,
        },
      });
    }
    for (const id of ["cityhq-metro-routes", "cityhq-metro-stations"])
      if (m.getLayer(id))
        m.setLayoutProperty(
          id,
          "visibility",
          layers.metro ? "visible" : "none",
        );
  }, [network, ready, layers.metro]);
  useEffect(() => {
    const m = map.current;
    if (
      !m ||
      !ready ||
      styledMap.current !== m ||
      !m.getLayer("cityhq-metro-stations")
    )
      return;
    const selectStation = (event: maplibregl.MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;
      const content = document.createElement("div");
      content.textContent = `${feature.properties?.name || "Station"} · OSM static station · no live service status`;
      new maplibregl.Popup()
        .setLngLat(feature.geometry.coordinates as [number, number])
        .setDOMContent(content)
        .addTo(m);
    };
    m.on("click", "cityhq-metro-stations", selectStation);
    return () => {
      m.off("click", "cityhq-metro-stations", selectStation);
    };
  }, [ready, network]);
  const p = PLACES.find((p) => p.id === camera?.location) || PLACES[0];
  return (
    <div className="geo-console">
      <div
        className="map-purpose-controls"
        aria-label="Map investigation modes"
      >
        <button
          onClick={() =>
            map.current?.flyTo({
              center: config.center as [number, number],
              zoom: city === "delhi" ? 11.5 : 13.2,
              duration: reduced ? 0 : 650,
            })
          }
        >
          City overview
        </button>
        <button
          onClick={() => {
            const target =
              PLACES.find(
                (p) => p.id === (city === "delhi" ? "new-delhi" : "flinders"),
              ) || PLACES[0];
            if (onFocus) onFocus(target.id);
            else
              map.current?.flyTo({
                center: target.center,
                zoom: target.zoom,
                duration: reduced ? 0 : 650,
              });
          }}
        >
          Transport focus
        </button>
        <button
          aria-pressed={layers["air-quality"]}
          onClick={() => toggle("air-quality", !layers["air-quality"])}
        >
          Environmental focus
        </button>
      </div>
      <div
        className="map-stage"
        onPointerDownCapture={() => {
          setScanning(false);
          map.current?.stop();
        }}
      >
        {scanning && sonar && !reduced && (
          <div className="spatial-transition" key={`${ready}-${camera?.nonce}`}>
            <div className="spatial-sweep" aria-hidden="true" />
            <button onClick={() => setScanning(false)}>
              Skip visual transition
            </button>
            <span>VIEW TRANSITION · PRESENTATION ONLY</span>
          </div>
        )}
        <div className="map-corner-label" aria-hidden="true">
          {config.country} / GEOGRAPHIC CONTEXT
        </div>
        <div
          ref={container}
          className="city-map"
          aria-label={`Interactive ${config.name} map`}
        />
        {!ready && !error && (
          <div className="map-loading" role="status">
            <span className="dot" />
            Loading {config.name} geography…
          </div>
        )}
        <div className="map-coordinate">
          <Crosshair size={14} />
          <span>
            {p.label.toUpperCase()}
            <small>
              {position.lat.toFixed(4)}° / {position.lng.toFixed(4)}° · Z{" "}
              {position.zoom.toFixed(1)} · VIEW CENTRE
            </small>
          </span>
        </div>
        {layers["air-quality"] && (
          <div className="aq-map-overlay">
            <strong>{airQuality?.us_aqi ?? "—"} US AQI</strong>
            <span>
              {config.name}{" "}
              {airQuality?.metadata.data_kind === "demo"
                ? "demo fixture"
                : airQuality?.metadata.data_kind === "modelled"
                  ? "modelled area estimate"
                  : "area context unavailable"}{" "}
              · {airQuality?.metadata.status || "unavailable"}
            </span>
            <small>
              {airQuality?.metadata.geographic_precision ||
                "Geographic precision unavailable"}
              . No street-level heatmap.
            </small>
          </div>
        )}
        {network && layers.metro && (
          <span className="metro-map-credit">
            OSM STATIC METRO · no live delay feed · {network.as_of.slice(0, 10)}
          </span>
        )}
        {layers.weather && (
          <div className="weather-overlay">
            <strong>{weather?.temperature ?? "—"}°C</strong>
            <span>
              {weather?.condition || "No weather observation"}
              <small>
                {config.name} area · {weather?.metadata.status || "unavailable"}{" "}
                · no station location supplied
              </small>
            </span>
          </div>
        )}
        {error && (
          <div className="map-error" role="status">
            {error}
            <button
              onClick={() => {
                setError("");
                map.current?.setStyle(styleURL);
              }}
            >
              Retry map
            </button>
          </div>
        )}
      </div>
      <div className="map-toolbar">
        <Layers3 size={16} />
        {LAYERS.filter((layer) => layer !== "metro" || city === "delhi").map(
          (layer) => (
            <label key={layer}>
              <input
                type="checkbox"
                checked={layers[layer]}
                onChange={(e) => toggle(layer, e.target.checked)}
              />
              {layer === "boundaries"
                ? "Area envelopes"
                : layer[0].toUpperCase() + layer.slice(1)}
            </label>
          ),
        )}
        <button onClick={() => setFlat((v) => !v)} aria-pressed={flat}>
          {flat ? "3D view" : "2D view"}
        </button>
        <button
          onClick={() => {
            if (onFocus) onFocus(PLACES[0].id);
            else
              map.current?.flyTo({
                center: PLACES[0].center,
                zoom: PLACES[0].zoom,
                duration: reduced ? 0 : 650,
              });
          }}
        >
          Recenter
        </button>
      </div>
      <div className="camera-presets" aria-label="Map camera presets">
        {PLACES.map((place) => (
          <button
            key={place.id}
            aria-pressed={camera?.location === place.id}
            onClick={() => {
              if (onFocus) onFocus(place.id);
              else
                map.current?.flyTo({
                  center: place.center,
                  zoom: place.zoom,
                  duration: reduced ? 0 : 650,
                });
            }}
          >
            {place.label}
          </button>
        ))}
      </div>
      <p className="caption map-caption">
        Real geography · building heights from the vector dataset. Only supplied
        coordinates become markers; unlocated notices remain in the list. Area
        envelopes are approximate extents, not administrative boundaries.
        Regional activity data is unavailable.
      </p>
    </div>
  );
}
