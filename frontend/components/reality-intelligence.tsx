"use client";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useCity } from "@/lib/city-context";
import { usePoll } from "@/lib/use-poll";
import type { AirQuality, AirComparison, Transit, Item } from "@/lib/types";
import { SourceBadge } from "./intelligence-primitives";
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
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
  const samples = (data?.hourly || [])
    .filter(
      (v) =>
        !data?.metadata.observed_at ||
        new Date(v.timestamp) >= new Date(data.metadata.observed_at),
    )
    .slice(0, 18);
  const values = samples.flatMap((v) =>
    v[standard] == null ? [] : [v[standard] as number],
  );
  return (
    <div className="reality-workspace environment-workspace">
      <section className="panel aq-hero">
        <div>
          <span className="eyebrow">
            {config.name.toUpperCase()} / AIR QUALITY
          </span>
          <h2>
            {data?.metadata.data_kind === "demo"
              ? "Demo air quality."
              : data?.metadata.data_kind === "modelled"
                ? "Modelled air quality."
                : "Air quality unavailable."}
          </h2>
          <p className="caption">
            {data?.metadata.data_kind === "demo"
              ? "Synthetic offline fixture · not an observation or model estimate."
              : data?.metadata.data_kind === "modelled"
                ? "CAMS global estimates via Open-Meteo · approximately 45 km grid · not ground-station measurements."
                : "No air-quality estimate is available. Inspect source provenance for the provider state."}
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
          <SourceBadge meta={data?.metadata} label="air quality" />
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
        <h2>
          {data?.metadata.data_kind === "demo"
            ? "Demo forecast"
            : "Provider forecast"}{" "}
          / {label}
        </h2>
        <p className="caption">
          {values.length} supplied forecast samples
          {values.length
            ? ` · range ${Math.min(...values)}–${Math.max(...values)} ${label}`
            : ""}
          . Line gaps indicate missing samples.
        </p>
        {values.length > 1 && (
          <div
            className="chart aq-forecast-chart"
            role="img"
            aria-label={`${config.name} ${label} ${data?.metadata.data_kind === "demo" ? "synthetic fixture" : "model forecast"}: ${values.length} supplied samples, range ${Math.min(...values)} to ${Math.max(...values)}`}
          >
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              initialDimension={{ width: 650, height: 240 }}
            >
              <AreaChart data={samples}>
                <defs>
                  <linearGradient id="aqTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8ccbeb" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#8ccbeb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#253241" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(v) => formatTime(v)}
                  minTickGap={70}
                  stroke="#91a4b6"
                  tick={{ fontSize: 11 }}
                />
                <YAxis width={38} stroke="#91a4b6" tick={{ fontSize: 11 }} />
                <Tooltip
                  labelFormatter={(v) => formatTime(String(v))}
                  contentStyle={{
                    background: "#111820",
                    border: "1px solid #253241",
                  }}
                />
                <Area
                  dataKey={standard}
                  name={label}
                  stroke="#8ccbeb"
                  fill="url(#aqTrend)"
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        <details className="forecast-samples">
          <summary>Inspect exact forecast samples</summary>
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
        </details>
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
export function MetroExplorer({
  transit,
  reduced = false,
  sonar = true,
}: {
  transit: Transit | null;
  reduced?: boolean;
  sonar?: boolean;
}) {
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
    <div className="reality-workspace metro-workspace">
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
          reduced={reduced}
          sonar={sonar}
          layers={{ ...DEFAULT_LAYERS, metro: true }}
          selection={selected ? { kind: "transit", item: selected } : null}
        />
        <p className="caption">
          {network?.attribution}. Static geometry remains static in historical
          replay; it is not reconstructed operational history.
        </p>
      </section>
      <section className="panel station-dossier">
        {selected && (
          <div className="station-selection">
            <span className="eyebrow">SELECTED STATION / STATIC OSM</span>
            <h2>{selected.title}</h2>
            <p className="caption">
              {selected.coordinates?.[1].toFixed(5)}° N /{" "}
              {selected.coordinates?.[0].toFixed(5)}° E. Camera focus only. Live
              operational status unavailable.
            </p>
          </div>
        )}
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
