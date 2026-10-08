"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Crosshair, Layers3 } from "lucide-react";
import type { Item, Weather } from "@/lib/types";
import {
  DEFAULT_LAYERS,
  LAYERS,
  type Layers,
  type Layer,
  type Location,
} from "@/lib/commands";
import { PLACES, placeForArea } from "@/lib/geography";
export type MapSelection = { item: Item; kind: "events" | "transit" };
export default function CityMap({
  events,
  transit,
  weather,
  layers: controlled,
  onLayer,
  camera,
  onFocus,
  selection,
  onSelect,
  reduced = false,
}: {
  events: Item[];
  transit: Item[];
  weather?: Weather | null;
  layers?: Layers;
  onLayer?: (layer: Layer, enabled: boolean) => void;
  camera?: { location: Location; nonce: number };
  onFocus?: (location: Location) => void;
  selection?: MapSelection | null;
  onSelect?: (selection: MapSelection) => void;
  reduced?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null);
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
        zoom: 15.2,
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
              m.setPaintProperty(layer.id, "text-color", "#b7ccdf");
              m.setPaintProperty(layer.id, "text-halo-color", "#07111e");
              m.setPaintProperty(layer.id, "text-halo-width", 1.2);
            }
            if (layer.type === "fill" && layer.paint?.["fill-pattern"])
              m.setPaintProperty(layer.id, "fill-pattern", undefined);
            if (layer.type === "background")
              m.setPaintProperty(layer.id, "background-color", "#07111e");
            if (layer.type === "fill" && layer["source-layer"] === "water")
              m.setPaintProperty(layer.id, "fill-color", "#0b2338");
            if (layer.type === "fill" && layer["source-layer"] === "building")
              m.setPaintProperty(layer.id, "fill-color", "#142a3c");
            if (
              layer.type === "line" &&
              layer["source-layer"] === "transportation"
            ) {
              m.setPaintProperty(
                layer.id,
                "line-color",
                layer.id.includes("casing")
                  ? "#07111e"
                  : layer.id.includes("railway")
                    ? "#6d688a"
                    : layer.id.includes("major") ||
                        layer.id.includes("motorway")
                      ? "#49839d"
                      : "#27485b",
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
                  "fill-extrusion-color": "#234459",
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
          setReady((v) => v + 1);
          setError("");
        } catch {
          setError(
            "This map style does not support every geographic layer. Camera and signal controls remain available.",
          );
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
      instance?.remove();
    };
  }, [reduced, styleURL]);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
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
  }, [camera, ready, flat, reduced]);
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
    const p = placeForArea(selection.item.area);
    const center = selection.item.coordinates || p?.center;
    if (center)
      m.flyTo({
        center,
        zoom: selection.item.coordinates ? 16 : p!.zoom,
        duration: reduced ? 0 : 650,
      });
  }, [selection, ready, reduced]);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const area =
      selection && !selection.item.coordinates
        ? placeForArea(selection.item.area)
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
  }, [layers.boundaries, ready, selection, reduced, flat]);
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
  const p = PLACES.find((p) => p.id === camera?.location) || PLACES[0];
  return (
    <div className="geo-console">
      <div className="map-stage">
        <div
          ref={container}
          className="city-map"
          aria-label="Interactive Melbourne map"
        />
        {!ready && !error && (
          <div className="map-loading" role="status">
            <span className="dot" />
            Loading Melbourne geography…
          </div>
        )}
        <div className="map-coordinate">
          <Crosshair size={14} />
          <span>
            {p.label.toUpperCase()}
            <small>
              {p.center[1].toFixed(4)}° / {p.center[0].toFixed(4)}° · GEOGRAPHIC
              CONTEXT
            </small>
          </span>
        </div>
        {layers.weather && (
          <div className="weather-overlay">
            <strong>{weather?.temperature ?? "—"}°C</strong>
            <span>
              {weather?.condition || "No weather observation"}
              <small>
                Melbourne area · {weather?.metadata.status || "unavailable"} ·
                no station location supplied
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
        {LAYERS.map((layer) => (
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
        ))}
        <button onClick={() => setFlat((v) => !v)} aria-pressed={flat}>
          {flat ? "3D view" : "2D view"}
        </button>
        <button
          onClick={() => {
            if (onFocus) onFocus("cbd");
            else
              map.current?.flyTo({
                center: PLACES[0].center,
                zoom: 15.2,
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
