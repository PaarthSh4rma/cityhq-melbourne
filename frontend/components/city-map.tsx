"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Item } from "@/lib/types";
export default function CityMap({
  events,
  transit,
}: {
  events: Item[];
  transit: Item[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [eventLayer, setEventLayer] = useState(true);
  const [transitLayer, setTransitLayer] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!container.current) return;
    let instance: maplibregl.Map;
    try {
      maplibregl.setWorkerUrl(
        new URL(
          "maplibre-gl/dist/maplibre-gl-worker.mjs",
          import.meta.url,
        ).toString(),
      );
      instance = new maplibregl.Map({
        container: container.current,
        center: [144.9631, -37.8136],
        zoom: 12,
        attributionControl: { compact: false },
        maxZoom: 18,
        style: process.env.NEXT_PUBLIC_MAP_STYLE || {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution:
                '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
              maxzoom: 19,
            },
          },
          layers: [
            {
              id: "base",
              type: "raster",
              source: "osm",
              paint: {
                "raster-saturation": -0.7,
                "raster-brightness-max": 0.65,
                "raster-brightness-min": 0.06,
              },
            },
          ],
        },
      });
      instance.addControl(new maplibregl.NavigationControl(), "top-right");
      instance.on("error", () =>
        setError(
          "Some map tiles could not load. Check connectivity or configured tile provider.",
        ),
      );
      map.current = instance;
    } catch {
      queueMicrotask(() =>
        setError(
          "Interactive map unavailable: WebGL is not supported in this browser.",
        ),
      );
    }
    return () => {
      map.current = null;
      instance?.remove();
    };
  }, []);
  useEffect(() => {
    if (!map.current) return;
    const markers: maplibregl.Marker[] = [];
    for (const [items, enabled, color] of [
      [events, eventLayer, "#a995ff"],
      [transit, transitLayer, "#f5bc68"],
    ] as const) {
      if (!enabled) continue;
      for (const item of items) {
        if (!item.coordinates) continue;
        const content = document.createElement("div");
        content.textContent = `${item.title} · ${item.venue || item.area} · ${item.precision || "Provider coordinate"}`;
        markers.push(
          new maplibregl.Marker({ color })
            .setLngLat(item.coordinates)
            .setPopup(new maplibregl.Popup().setDOMContent(content))
            .addTo(map.current),
        );
      }
    }
    return () => markers.forEach((marker) => marker.remove());
  }, [events, transit, eventLayer, transitLayer]);
  return (
    <>
      <div className="map-toolbar">
        <label>
          <input
            type="checkbox"
            checked={eventLayer}
            onChange={(e) => setEventLayer(e.target.checked)}
          />{" "}
          <i className="dot violet" />
          Events
        </label>
        <label>
          <input
            type="checkbox"
            checked={transitLayer}
            onChange={(e) => setTransitLayer(e.target.checked)}
          />{" "}
          <i className="dot amber" />
          Transit
        </label>
        <button
          onClick={() =>
            map.current?.flyTo({
              center: [144.9631, -37.8136],
              zoom: 12,
              duration: window.matchMedia("(prefers-reduced-motion: reduce)")
                .matches
                ? 0
                : 700,
            })
          }
        >
          Recenter
        </button>
      </div>
      <div
        ref={container}
        className="city-map"
        aria-label="Interactive Melbourne map"
      />
      {error && (
        <p role="status" className="warning">
          {error}
        </p>
      )}
      <p className="caption">
        Only provider-supplied coordinates are mapped. Demo listings and
        unlocated notices have no markers.
      </p>
    </>
  );
}
