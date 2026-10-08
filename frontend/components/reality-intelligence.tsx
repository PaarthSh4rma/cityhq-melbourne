"use client";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useCity } from "@/lib/city-context";
import { usePoll } from "@/lib/use-poll";
import type { AirQuality, AirComparison, Transit, Item } from "@/lib/types";
import { DEFAULT_LAYERS } from "@/lib/commands";
const CityMap = dynamic(() => import("./city-map"), { ssr: false });
export function AirQualityWorkspace({
  data,
  error,
}: {
  data: AirQuality | null;
  error: string | null;
}) {
  const { config, formatTime } = useCity();
  const [standard, setStandard] = useState<"us_aqi" | "european_aqi">("us_aqi");
  const comparison = usePoll<AirComparison>("/compare/air-quality", 3600000);
  const label = standard === "us_aqi" ? "US AQI" : "European AQI";
  return (
    <div className="reality-workspace">
      <section className="panel aq-hero">
        <div>
          <span className="eyebrow">
            {config.name.toUpperCase()} / AIR QUALITY
          </span>
          <h2>
            {data?.metadata.data_kind === "demo"
              ? "Demo air quality."
              : "Modelled air quality."}
          </h2>
          <p className="caption">
            {data?.metadata.data_kind === "demo"
              ? "Synthetic offline fixture · not an observation or model estimate."
              : "CAMS global estimates via Open-Meteo · approximately 45 km grid · not ground-station measurements."}
          </p>
          <label className="aq-standard">
            Index standard{" "}
            <select
              aria-label="Air quality index standard"
              value={standard}
              onChange={(e) => setStandard(e.target.value as typeof standard)}
            >
              <option value="us_aqi">US AQI</option>
              <option value="european_aqi">European AQI</option>
            </select>
          </label>
        </div>
        <div className="aq-reading">
          <strong>{data?.[standard] ?? "—"}</strong>
          <span>{label}</span>
          <span className={`badge ${data?.metadata.status || "unavailable"}`}>
            {data?.metadata.status || "connecting"}
          </span>
        </div>
      </section>
      {error && (
        <p role="alert" className="warning">
          {error}
        </p>
      )}
      {data?.metadata.error && <p className="warning">{data.metadata.error}</p>}
      <div className="two-columns spaced">
        <section className="panel">
          <h2>Pollutant estimates</h2>
          {(
            [
              ["pm2_5", "PM2.5"],
              ["pm10", "PM10"],
              ["nitrogen_dioxide", "Nitrogen dioxide"],
              ["ozone", "Ozone"],
            ] as const
          ).map(([key, name]) => (
            <div className="data-row" key={key}>
              <span>{name}</span>
              <strong>{data?.[key] ?? "—"} μg/m³</strong>
            </div>
          ))}
          <p className="caption">
            Model time {formatTime(data?.metadata.observed_at)} · fetched{" "}
            {formatTime(data?.metadata.fetched_at)} · {config.timezone}.
            European, US and Indian National AQI are distinct standards.
            Pollution is excluded from the activity proxy.
          </p>
          <p className="caption">{data?.metadata.attribution}</p>
        </section>
        <section className="panel">
          <h2>Across the two cities</h2>
          <p className="caption">
            Aligned standard: US AQI. Same model provider; current sample times
            must be within two hours. Both readings must be fresh to compare.
          </p>
          {Object.entries(comparison.data?.items || {}).map(([city, v]) => (
            <div className="data-row" key={city}>
              <span>
                {city === "delhi" ? "Delhi" : "Melbourne"}
                <small>
                  {v.metadata.data_kind} · {v.metadata.status} · UTC{" "}
                  {v.metadata.observed_at || "unknown"}
                </small>
              </span>
              <strong>{v.value ?? "—"} US AQI</strong>
            </div>
          ))}
          <p className="caption">
            {comparison.data?.comparable
              ? comparison.data.higher_city
                ? `Higher US AQI: ${comparison.data.higher_city} by ${comparison.data.difference} points.`
                : "Equal index values at the reported model times."
              : "Insufficient fresh, aligned coverage for a current comparison."}
          </p>
          <p className="caption">
            Delhi official CPCB station observations are not connected.
            Ticketmaster and transit coverage also differ, so city activity
            scores are not directly comparable.
          </p>
        </section>
      </div>
      <section className="panel spaced">
        <h2>Provider forecast / {label}</h2>
        <div
          className="aq-series"
          role="list"
          aria-label="Air quality forecast"
        >
          {(data?.hourly || [])
            .filter(
              (v) =>
                !data?.metadata.observed_at ||
                new Date(v.timestamp) >= new Date(data.metadata.observed_at),
            )
            .slice(0, 18)
            .map((v) => (
              <div key={v.timestamp} role="listitem">
                <span>{formatTime(v.timestamp)}</span>
                <strong>{v[standard] ?? "—"}</strong>
                <small>PM2.5 {v.pm2_5 ?? "—"} μg/m³</small>
              </div>
            ))}
        </div>
        {!data?.hourly.length && (
          <p className="caption">
            Forecast series unavailable for this adapter.
          </p>
        )}
        <p className="caption">
          Forecast values are model predictions, not future observations. No
          neighbourhood heatmap is inferred from one city grid cell.
        </p>
      </section>
    </div>
  );
}
export function MetroExplorer({ transit }: { transit: Transit | null }) {
  const [query, setQuery] = useState("");
  const [line, setLine] = useState("all");
  const [selected, setSelected] = useState<Item | null>(null);
  const network = transit?.network;
  const filtered = useMemo(
    () =>
      network
        ? {
            ...network,
            features: network.features.filter(
              (f) =>
                f.geometry.type === "Point" ||
                line === "all" ||
                f.properties?.id === line,
            ),
          }
        : null,
    [network, line],
  );
  const stations = (network?.stations || []).filter((s) =>
    s.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="reality-workspace">
      <section className="panel">
        <span className="eyebrow">DELHI / STATIC NETWORK EXPLORER</span>
        <h2>Delhi Metro, mapped.</h2>
        <p className="caption">
          {network?.stations.length ?? "—"} station nodes ·{" "}
          {network?.lines.length ?? "—"} directional route relations · community
          OSM extract {network?.as_of || "unavailable"}. Interchanges may have
          multiple nodes. This is a static map, with no live delay or service
          availability feed.
        </p>
        {transit?.metadata.error && (
          <p className="warning">{transit.metadata.error}</p>
        )}
        <div className="filters">
          <input
            aria-label="Search Metro stations"
            placeholder="Search Metro stations…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            aria-label="Metro route"
            value={line}
            onChange={(e) => setLine(e.target.value)}
          >
            <option value="all">All route geometry</option>
            {network?.lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <CityMap
          events={[]}
          transit={[]}
          network={filtered}
          layers={{ ...DEFAULT_LAYERS, metro: true }}
          selection={selected ? { kind: "transit", item: selected } : null}
        />
        <p className="caption">
          {network?.attribution}. Static geometry remains static in historical
          replay; it is not reconstructed operational history.
        </p>
      </section>
      <section className="panel spaced">
        <h2>Station search / {stations.length} nodes</h2>
        <div className="metro-stations">
          {stations.map((s) => (
            <button
              key={s.id}
              onClick={() =>
                setSelected({
                  title: s.name,
                  area: "Delhi",
                  mode: "Metro",
                  routes: [],
                  coordinates: s.coordinates,
                  precision: "OSM static station node",
                })
              }
            >
              <strong>{s.name}</strong>
              <small>OSM {s.id} · focus verified station</small>
            </button>
          ))}
        </div>
        {!stations.length && (
          <p className="caption">No matching stations in this extract.</p>
        )}
      </section>
    </div>
  );
}
