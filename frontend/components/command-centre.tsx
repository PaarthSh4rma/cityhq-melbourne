"use client";
import { useCity } from "@/lib/city-context";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Activity as ActivityIcon,
  ArrowUpRight,
  ChevronDown,
  Clock3,
  Crosshair,
  Sparkles,
  TrainFront,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { usePoll } from "@/lib/use-poll";
import { gappedHistory } from "@/lib/history";
import { placeForArea } from "@/lib/geography";
import type { Layers, Layer, Location } from "@/lib/commands";
import type {
  AirQuality,
  Activity,
  Comparison,
  Diagnostics,
  Events,
  History,
  Timeline,
  Transit,
  View,
  Weather,
} from "@/lib/types";
import type { MapSelection } from "./city-map";
import { OperatorCore } from "./operator";
import { ScenarioLab } from "./research-tools";
const CityMap = dynamic(() => import("./city-map"), {
  ssr: false,
  loading: () => (
    <div className="city-map skeleton" role="status">
      Loading map workspace…
    </div>
  ),
});
export default function CommandCentre({
  airQuality,
  weather,
  transit,
  events,
  activity,
  history,
  diagnostics,
  layers,
  onLayer,
  camera,
  onFocus,
  hours,
  onHours,
  navigate,
  onOperator,
  reduced,
  area,
  compareNonce,
  sourceErrors,
}: {
  airQuality: AirQuality | null;
  weather: Weather | null;
  transit: Transit | null;
  events: Events | null;
  activity: Activity | null;
  history: History | null;
  diagnostics: Diagnostics | null;
  layers: Layers;
  onLayer: (layer: Layer, enabled: boolean) => void;
  camera: { location: Location; nonce: number };
  onFocus: (location: Location) => void;
  hours: number;
  onHours: (hours: number) => void;
  navigate: (view: View) => void;
  onOperator: () => void;
  reduced: boolean;
  area: string;
  compareNonce: number;
  sourceErrors: Record<string, string | null>;
}) {
  const { config, places, formatTime: melbourneTime } = useCity();
  const [selected, setSelected] = useState<MapSelection | null>(null),
    [at, setAt] = useState<string | null>(null),
    [inputTime, setInputTime] = useState(""),
    [panel, setPanel] = useState<"trends" | "history" | "scenario">("trends");
  const [collapsed, setCollapsed] = useState(false),
    [rail, setRail] = useState(true);
  const capture = usePoll<Timeline>(
    at ? `/timeline?at=${encodeURIComponent(at)}` : null,
    3600000,
  );
  const captures = usePoll<{ items: { source: string; timestamp: string }[] }>(
    "/timeline/captures",
    60000,
  );
  const comparison = usePoll<Comparison>(
    `/history/compare?hours=${hours}`,
    60000,
  );
  // Historical mode replaces every command-centre signal, including its map. Never retain live values while loading.
  const aq = at ? capture.data?.signals.air_quality || null : airQuality;
  const w = at ? capture.data?.signals.weather || null : weather;
  const t = at ? capture.data?.signals.transport || null : transit;
  const e = at ? capture.data?.signals.events || null : events;
  const a = at ? capture.data?.activity || null : activity;
  const eventItems = useMemo(
    () => (e?.items || []).filter((i) => area === "all" || i.area === area),
    [e, area],
  );
  const transitItems = useMemo(
    () => (t?.items || []).filter((i) => area === "all" || i.area === area),
    [t, area],
  );
  const context = selected ? placeForArea(selected.item.area, places) : null;
  const related = selected
    ? [
        ...eventItems.map((item) => ({ item, kind: "events" as const })),
        ...transitItems.map((item) => ({ item, kind: "transit" as const })),
      ].filter(
        (v) =>
          v.item.area === selected.item.area &&
          v.item.title !== selected.item.title,
      )
    : [];
  useEffect(() => {
    const timer = setTimeout(() => setSelected(null), 0);
    return () => clearTimeout(timer);
  }, [at, area]);
  useEffect(() => {
    if (!compareNonce) return;
    const timer = setTimeout(() => {
      setPanel("history");
      setCollapsed(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [compareNonce]);
  function select(selection: MapSelection) {
    setSelected(selection);
    setRail(true);
  }
  return (
    <>
      <div className="command-status">
        <span>
          <i className="dot" />
          {at ? "HISTORICAL CAPTURE MODE" : "CURRENT SIGNAL WORKSPACE"}
        </span>
        <div>
          <button
            className="text-button"
            onClick={() => {
              setPanel("history");
              setCollapsed(false);
            }}
          >
            {" "}
            <Clock3 size={14} /> Time machine
          </button>
          <button className="text-button" onClick={() => setRail((v) => !v)}>
            {rail ? "Collapse" : "Expand"} intelligence
          </button>
        </div>
      </div>
      {at && (
        <div className="historical-banner" role="status">
          <Clock3 size={17} />
          <span>
            Stored context at {melbourneTime(at)} ·{" "}
            {capture.loading
              ? "Loading captured signals…"
              : capture.error
                ? "Capture unavailable"
                : `${capture.data?.gaps.length ?? 0} missing or expired source captures`}
            . Other workspaces use current signals.
          </span>
          <button
            onClick={() => {
              setAt(null);
              setSelected(null);
            }}
          >
            Return to current
          </button>
        </div>
      )}
      <section className="signal-ribbon" aria-label="City signals">
        {[
          {
            label: "Activity proxy",
            value: a?.score ?? "—",
            unit: `/ ${a?.maximum || (config.id === "delhi" ? 75 : 100)}`,
            detail: a
              ? `${a.category} · ${Math.round(a.coverage * 100)}% coverage`
              : "No available index",
            status: a?.demo ? "DEMO INPUTS" : "HEURISTIC",
            color: "cyan",
          },
          {
            label:
              t?.operational_status_available === false
                ? "Metro network"
                : "Service notices",
            value:
              t?.metadata.status === "unavailable" ||
              t?.operational_status_available === false
                ? "—"
                : (t?.disruption_count ?? "—"),
            unit:
              t?.operational_status_available === false
                ? "live status unknown"
                : "notices",
            detail:
              t?.operational_status_available === false
                ? "Static map · live service status unknown"
                : "Not passenger congestion",
            status: t?.metadata.stale
              ? "STALE"
              : t?.metadata.origin_status === "demo"
                ? "DEMO"
                : t?.metadata.status || "CHECKING",
            color: "amber",
          },
          {
            label: "Current weather",
            value: w?.temperature ?? "—",
            unit: "°C",
            detail: w?.condition || "No observation",
            status: w?.metadata.stale
              ? "STALE"
              : w?.metadata.origin_status === "demo"
                ? "DEMO"
                : w?.metadata.status || "CHECKING",
            color: "cyan",
          },
          {
            label: "Upcoming events",
            value:
              e?.metadata.status === "unavailable"
                ? "—"
                : (e?.event_count ?? "—"),
            unit: "listings",
            detail: "Attendance unknown",
            status: e?.metadata.stale
              ? "STALE"
              : e?.metadata.origin_status === "demo"
                ? "DEMO"
                : e?.metadata.status || "CHECKING",
            color: "violet",
          },
        ].map((m) => (
          <article className={`ribbon-metric ${m.color}`} key={m.label}>
            <div>
              <span>{m.label}</span>
              <span className="metric-status">{m.status}</span>
            </div>
            <strong>
              {m.value}
              <small>{m.unit}</small>
            </strong>
            <p>{m.detail}</p>
          </article>
        ))}
      </section>
      <div className={`command-grid ${rail ? "" : "rail-collapsed"}`}>
        <section className="panel command-map">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">GEOSPATIAL INTELLIGENCE</span>
              <h2>{config.name}, in focus.</h2>
            </div>
            <span className="map-mode">
              <Crosshair size={14} />{" "}
              {reduced ? "REDUCED EFFECTS" : "VECTOR / 3D"}
            </span>
          </div>
          <CityMap
            events={eventItems}
            transit={transitItems}
            weather={w}
            airQuality={aq}
            network={t?.network}
            layers={layers}
            onLayer={onLayer}
            camera={camera}
            onFocus={onFocus}
            selection={selected}
            onSelect={select}
            reduced={reduced}
          />
        </section>
        {rail && (
          <aside
            className="intelligence-rail"
            aria-label="Contextual intelligence"
          >
            <button className="operator-dock" onClick={onOperator}>
              <OperatorCore />
              <div>
                <span className="eyebrow">CITYHQ OPERATOR</span>
                <h2>Ask. Focus. Understand.</h2>
                <p>Explore your city through its signals.</p>
              </div>
              <ArrowUpRight size={18} />
            </button>
            {selected ? (
              <section className="panel context-detail">
                <div className="panel-heading">
                  <span className="eyebrow">
                    SELECTED {selected.kind === "events" ? "EVENT" : "NOTICE"}
                  </span>
                  <button
                    onClick={() => setSelected(null)}
                    aria-label="Clear selected signal"
                  >
                    <X size={16} />
                  </button>
                </div>
                <h2>{selected.item.title}</h2>
                <p>
                  {selected.item.description ||
                    "No additional description supplied."}
                </p>
                <div className="data-row">
                  <span>Area</span>
                  <strong>{selected.item.area}</strong>
                </div>
                <p className="caption">
                  {selected.item.coordinates
                    ? `Provider coordinate · ${selected.item.precision || "precision unspecified"}`
                    : context?.bounds
                      ? "Approximate named-area envelope highlighted. Exact incident or venue location unknown."
                      : context
                        ? "Camera focused on named place. Exact incident or venue location unknown."
                        : "No verified location for this record; map stays in its current view."}
                </p>
                <p className="caption">
                  Source:{" "}
                  {(selected.kind === "events" ? e : t)?.metadata.source} ·{" "}
                  {(selected.kind === "events" ? e : t)?.metadata.origin_status}
                  {(selected.kind === "events" ? e : t)?.metadata.stale
                    ? " · STALE"
                    : ""}
                </p>
                <h3>Other listings in this area</h3>
                <p className="caption">
                  Shared geography does not imply a causal relationship.
                </p>
                {related.length ? (
                  related.slice(0, 4).map((r, i) => (
                    <button
                      className="signal-row"
                      key={i}
                      onClick={() => select(r)}
                    >
                      {r.item.title}
                    </button>
                  ))
                ) : (
                  <p>No related captured listings.</p>
                )}
              </section>
            ) : (
              <section className="panel situation">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow amber-text">NETWORK WATCH</span>
                    <h2>Signals worth inspecting</h2>
                  </div>
                  <TrainFront size={17} />
                </div>
                <p className="caption">
                  Select a record for geographic context.{" "}
                  {t?.metadata.origin_status === "demo"
                    ? "Transit records are illustrative demos."
                    : ""}
                </p>
                <div className="signal-list">
                  {[
                    ...transitItems
                      .slice(0, 3)
                      .map((item) => ({ item, kind: "transit" as const })),
                    ...eventItems
                      .slice(0, 2)
                      .map((item) => ({ item, kind: "events" as const })),
                  ].map((v, i) => (
                    <button
                      className={`signal-row ${v.kind}`}
                      key={i}
                      onClick={() => select(v)}
                    >
                      <i
                        className={`dot ${v.kind === "events" ? "violet" : "amber"}`}
                      />
                      <span>
                        <strong>{v.item.title}</strong>
                        <small>
                          {v.item.area} ·{" "}
                          {v.item.coordinates
                            ? "provider location"
                            : "unlocated"}{" "}
                          ·{" "}
                          {
                            (v.kind === "events" ? e : t)?.metadata
                              .origin_status
                          }
                        </small>
                      </span>
                      <ArrowUpRight size={14} />
                    </button>
                  ))}
                  {!transitItems.length && !eventItems.length && (
                    <p className="empty">
                      No captured listings. Check source health before
                      interpreting this as a quiet city.
                    </p>
                  )}
                </div>
                <button
                  className="text-button"
                  onClick={() => navigate("transit")}
                >
                  Inspect all transit notices <ArrowUpRight size={14} />
                </button>
              </section>
            )}
            <section className="panel source-pulse">
              <span className="eyebrow">SOURCE PULSE</span>
              {Object.entries(
                at
                  ? capture.data?.signals || {}
                  : { weather: w, air_quality: aq, transport: t, events: e },
              ).map(([name, signal]) => (
                <div className="data-row" key={name}>
                  <span>{name}</span>
                  <strong>
                    {!at && sourceErrors[name]
                      ? "API error"
                      : signal?.metadata.stale
                        ? "stale"
                        : signal?.metadata.status || "checking"}
                  </strong>
                </div>
              ))}
              <button
                className="text-button"
                onClick={() => navigate("diagnostics")}
              >
                Inspect provenance →
              </button>
            </section>
          </aside>
        )}
      </div>
      <section className="panel analytics-drawer">
        <div className="analytics-header">
          <div
            className="analytics-tabs"
            role="tablist"
            aria-label="Analytical workspace"
          >
            {(["trends", "history", "scenario"] as const).map((id) => (
              <button
                role="tab"
                aria-selected={panel === id}
                aria-controls={`workspace-${id}`}
                id={`tab-${id}`}
                key={id}
                onClick={() => {
                  setPanel(id);
                  setCollapsed(false);
                }}
              >
                {id === "trends" ? (
                  <ActivityIcon size={15} />
                ) : id === "history" ? (
                  <Clock3 size={15} />
                ) : (
                  <Sparkles size={15} />
                )}{" "}
                {id === "trends"
                  ? "Signal analytics"
                  : id === "history"
                    ? "Time machine"
                    : "Scenario lab"}
              </button>
            ))}
          </div>
          <button
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand analytics" : "Collapse analytics"}
            aria-expanded={!collapsed}
          >
            <ChevronDown
              size={17}
              style={{ transform: collapsed ? "rotate(180deg)" : undefined }}
            />
          </button>
        </div>
        {!collapsed && (
          <div
            id={`workspace-${panel}`}
            role="tabpanel"
            aria-labelledby={`tab-${panel}`}
            className="analytics-content"
          >
            {panel === "trends" && (
              <div className="analytics-grid">
                <div>
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">
                        STORED HOURLY OBSERVATIONS
                      </span>
                      <h2>The city leaves a signal.</h2>
                    </div>
                    <select
                      aria-label="Historical range"
                      value={hours}
                      onChange={(ev) => onHours(Number(ev.target.value))}
                    >
                      {[
                        [6, "6 hours"],
                        [24, "24 hours"],
                        [168, "7 days"],
                        [720, "30 days"],
                      ].map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {(history?.items.length || 0) > 1 ? (
                    <div
                      className="chart"
                      role="img"
                      aria-label="Stored activity trend"
                    >
                      <ResponsiveContainer
                        width="100%"
                        height="100%"
                        minWidth={0}
                        initialDimension={{ width: 500, height: 200 }}
                      >
                        <AreaChart data={gappedHistory(history!.items)}>
                          <defs>
                            <linearGradient
                              id="commandTrend"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="#7edcff"
                                stopOpacity={0.3}
                              />
                              <stop
                                offset="100%"
                                stopColor="#7edcff"
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="#ffffff0a" vertical={false} />
                          <XAxis
                            dataKey="timestamp"
                            tickFormatter={melbourneTime}
                            stroke="#96aabb"
                            minTickGap={80}
                          />
                          <YAxis
                            domain={[0, 100]}
                            stroke="#96aabb"
                            width={32}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "#102133",
                              border: "1px solid #375064",
                            }}
                            labelFormatter={(v) => melbourneTime(String(v))}
                          />
                          <Area
                            type="linear"
                            dataKey="score"
                            stroke="#7edcff"
                            fill="url(#commandTrend)"
                            connectNulls={false}
                            isAnimationActive={!reduced}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="sparse-history">
                      <ActivityIcon size={28} />
                      <h3>A timeline starts with observations.</h3>
                      <p>
                        {history?.items.length ?? 0} stored hourly values in
                        this range. At least two are needed for a trend. No
                        backfilled curve.
                      </p>
                    </div>
                  )}
                  <p className="caption">
                    Citywide index · mixed provenance is tagged in the export ·
                    partial coverage scores are not comparable. Gaps and
                    provenance changes break the line. Historical mode does not
                    reconstruct this series.
                  </p>
                </div>
                <div>
                  <span className="eyebrow">
                    CONTRIBUTIONS / {a?.methodology_version || "PENDING"}
                  </span>
                  <h2>Behind the index</h2>
                  {a?.components.map((c) => (
                    <details className="contribution" key={c.name}>
                      <summary>
                        <span>{c.name}</span>
                        <strong>
                          {c.contribution.toFixed(1)}
                          <small> / {c.maximum}</small>
                        </strong>
                      </summary>
                      <progress
                        aria-label={`${c.name} contribution`}
                        value={c.contribution}
                        max={c.maximum}
                      />
                      <p className="caption">{c.explanation}</p>
                    </details>
                  ))}
                  <p className="caption">
                    Heuristic, not measured movement. Missing or expired
                    components contribute zero.
                  </p>
                </div>
              </div>
            )}
            {panel === "history" && (
              <div className="time-machine">
                <div>
                  <span className="eyebrow">REPLAY ACTUAL CAPTURES</span>
                  <h2>Explore what was stored.</h2>
                  <p>
                    No synthetic historical reconstruction. Missing captures
                    stay missing.
                  </p>
                  <label>
                    Recent source captures
                    <select
                      aria-label="Historical capture"
                      value={at || ""}
                      onChange={(ev) => {
                        setAt(ev.target.value || null);
                        setSelected(null);
                      }}
                    >
                      <option value="">Current signals</option>
                      {captures.data?.items.map((c, i) => (
                        <option key={i} value={c.timestamp}>
                          {melbourneTime(c.timestamp)} · {c.source}
                        </option>
                      ))}
                    </select>
                  </label>
                  <form
                    onSubmit={(ev) => {
                      ev.preventDefault();
                      if (inputTime) setAt(`${inputTime}:00Z`);
                    }}
                  >
                    <label>
                      Custom capture time (UTC)
                      <input
                        aria-label="Historical UTC time"
                        type="datetime-local"
                        value={inputTime}
                        onChange={(ev) => setInputTime(ev.target.value)}
                        required
                      />
                    </label>
                    <button>Inspect stored time</button>
                  </form>
                  {at && (
                    <button onClick={() => setAt(null)}>
                      Return to current
                    </button>
                  )}
                  {capture.error && (
                    <p role="alert">
                      Historical query failed. Use a valid past UTC time.
                      Current data has not been substituted.
                    </p>
                  )}
                  {capture.data &&
                    Object.entries(capture.data.captures).map(([name, c]) => (
                      <p className="caption" key={name}>
                        {name}:{" "}
                        {c
                          ? `${melbourneTime(c.timestamp)} · capture age ${Math.round(c.age_seconds / 60)} min`
                          : "no capture"}
                      </p>
                    ))}
                </div>
                <div className="period-comparison">
                  <span className="eyebrow">
                    PREVIOUS VS CURRENT / {hours} HOURS
                  </span>
                  <h2>Compare stored periods</h2>
                  <p>
                    Anchored to current time. Matching provenance groups only.
                  </p>
                  {comparison.data &&
                    ["previous", "current"].map((key) => {
                      const period =
                        comparison.data![key as "previous" | "current"];
                      return (
                        <div className="period-card" key={key}>
                          <strong>
                            {key} · {period.stored_hours} /{" "}
                            {period.expected_hours} stored hours
                          </strong>
                          <p className="caption">
                            {melbourneTime(period.start)} →{" "}
                            {melbourneTime(period.end)}
                          </p>
                          {period.groups.map((g) => (
                            <p key={g.provenance}>
                              {g.mean_score ?? "—"} average index ·{" "}
                              {g.usable_hours} values
                              <small className="caption">{g.provenance}</small>
                            </p>
                          ))}
                          {!period.groups.length && (
                            <p className="caption">
                              No usable values in this period.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  <p className="caption">
                    No causal claim. Missing periods cannot establish a change.
                  </p>
                </div>
              </div>
            )}
            {panel === "scenario" && <ScenarioLab activity={activity} />}
          </div>
        )}
      </section>
      <div className="workspace-footnote">
        <span>GEOGRAPHY: OPENSTREETMAP / OPENFREEMAP</span>
        <span>
          {diagnostics?.model_version || "MODEL UNAVAILABLE"} · PROVENANCE FIRST
        </span>
      </div>
    </>
  );
}
