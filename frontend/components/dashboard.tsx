"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowDownToLine,
  ArrowUpRight,
  CloudSun,
  Command,
  Compass,
  Database,
  FlaskConical,
  MapPin,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TrainFront,
  Wind,
} from "lucide-react";
import { MotionConfig } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { usePoll } from "@/lib/use-poll";
import { gappedHistory } from "@/lib/history";
import { API, melbourneTime } from "@/lib/api";
import type {
  Activity,
  Diagnostics,
  Events,
  Forecast,
  History,
  Item,
  Meta,
  Transit,
  View,
  Weather,
} from "@/lib/types";
import Operator from "./operator";
import CommandCentre from "./command-centre";
import { BootSequence, CommandPalette } from "./workspace-controls";
import { ResidualDiagnostics } from "./research-tools";
import { DEFAULT_LAYERS, type Action, type Location } from "@/lib/commands";
const CityMap = dynamic(() => import("./city-map"), {
  ssr: false,
  loading: () => <div className="city-map skeleton" />,
});
const NAV = [
  { id: "overview", label: "Overview", icon: Compass },
  { id: "transit", label: "Transit intelligence", icon: TrainFront },
  { id: "weather", label: "Weather intelligence", icon: CloudSun },
  { id: "events", label: "Event intelligence", icon: MapPin },
  { id: "forecasting", label: "Forecasting lab", icon: FlaskConical },
  { id: "diagnostics", label: "System diagnostics", icon: Database },
] as const;
const TITLES: Record<View, [string, string]> = {
  overview: [
    "The city, in perspective.",
    "An operational view of Melbourne’s urban signals.",
  ],
  transit: [
    "Transit intelligence.",
    "Service notices, affected routes and network context.",
  ],
  weather: [
    "Weather intelligence.",
    "Conditions shaping the city, with transparent source coverage.",
  ],
  events: [
    "The city’s calendar.",
    "Upcoming listings and their geographic context.",
  ],
  forecasting: [
    "Look one step ahead.",
    "Reproducible temperature forecasting. Evidence before inference.",
  ],
  diagnostics: [
    "Trust is observable.",
    "Source provenance, ingestion health and dataset coverage.",
  ],
};
function Badge({ meta }: { meta?: Meta }) {
  return (
    <span className={`badge ${meta?.stale ? "warning" : meta?.status || ""}`}>
      {meta?.stale ? "stale · " : ""}
      {meta?.status || "connecting"}
    </span>
  );
}
function Freshness({ meta }: { meta?: Meta }) {
  return (
    <div className="freshness">
      <Badge meta={meta} />
      <span>
        {meta?.source || "Awaiting source"} · {melbourneTime(meta?.observed_at)}
      </span>
      {meta?.error && <p className="warning">{meta.error}</p>}
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="empty">
      <Radio size={22} />
      <p>{children}</p>
    </div>
  );
}
function Clock() {
  const [clock, setClock] = useState("Synchronizing clock");
  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleString("en-AU", {
          timeZone: "Australia/Melbourne",
          weekday: "short",
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="clock">
      <span>MELBOURNE · LOCAL TIME</span>
      <strong>{clock}</strong>
    </div>
  );
}
function Notices({ items }: { items: Item[] }) {
  return items.length ? (
    <div className="notices">
      {items.map((item, i) => (
        <details key={`${item.title}-${i}`}>
          <summary>
            <span
              className={`notice-icon ${item.severity === "major" ? "amber" : ""}`}
            >
              <TrainFront size={16} />
            </span>
            <span>
              <strong>{item.title}</strong>
              <small>
                {item.mode} · {item.area}
              </small>
            </span>
            <span className="badge">{item.severity || "unknown"}</span>
          </summary>
          <p>{item.description || "No additional details supplied."}</p>
          <p className="caption">
            Routes: {item.routes?.join(", ") || "Not supplied"} · Location:{" "}
            {item.precision || "No reliable coordinates"}
          </p>
        </details>
      ))}
    </div>
  ) : (
    <Empty>
      No matching notices. Check source status before interpreting this as a
      clear network.
    </Empty>
  );
}
function Trend({ data, signal }: { data: History | null; signal: string }) {
  return (data?.items.length || 0) >= 2 ? (
    <div
      className="chart"
      role="img"
      aria-label={`${signal} historical trend from stored hourly observations`}
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        initialDimension={{ width: 600, height: 230 }}
        minWidth={0}
      >
        <AreaChart data={gappedHistory(data!.items)}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5fe1d5" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#5fe1d5" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#ffffff0a" vertical={false} />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(v) =>
              new Date(v).toLocaleTimeString("en-AU", {
                timeZone: "Australia/Melbourne",
                hour: "2-digit",
              })
            }
            stroke="#8d9eae"
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#8d9eae"
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip
            contentStyle={{
              background: "#122030",
              border: "1px solid #344658",
              borderRadius: 10,
            }}
            labelFormatter={(v) => melbourneTime(String(v))}
          />
          <Area
            type="linear"
            dataKey={signal}
            stroke="#5fe1d5"
            strokeWidth={2}
            fill="url(#trendFill)"
            isAnimationActive={false}
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  ) : (
    <Empty>
      Building an honest history. At least two hourly observations are needed to
      draw a trend.
    </Empty>
  );
}
export default function Dashboard() {
  const [view, setView] = useState<View>("overview");
  const [operator, setOperator] = useState(false);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("all");
  const [area, setArea] = useState("all");
  const [hours, setHours] = useState(24);
  const [signal, setSignal] = useState("score");
  const [palette, setPalette] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [replay, setReplay] = useState(0);
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const [camera, setCamera] = useState<{ location: Location; nonce: number }>({
    location: "cbd",
    nonce: 0,
  });
  const [compareNonce, setCompareNonce] = useState(0);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () =>
      setReduced(
        localStorage.getItem("cityhq-reduced") === "true" || preference.matches,
      );
    sync();
    preference.addEventListener("change", sync);
    const shortcuts = (event: KeyboardEvent) => {
      const typing =
        event.target instanceof HTMLElement &&
        (event.target.matches("input,textarea,select") ||
          event.target.isContentEditable);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPalette((v) => !v);
      }
      if (!typing && !event.metaKey && !event.ctrlKey && event.key === "?") {
        event.preventDefault();
        setOperator(true);
      }
    };
    window.addEventListener("keydown", shortcuts);
    return () => {
      preference.removeEventListener("change", sync);
      window.removeEventListener("keydown", shortcuts);
    };
  }, []);
  function focus(location: Location) {
    setCamera((v) => ({ location, nonce: v.nonce + 1 }));
  }
  function executeAction(action: Action) {
    if (action.type === "navigate_dashboard") navigate(action.view);
    else if (action.type === "focus_map_location") {
      navigate("overview");
      focus(action.location);
    } else if (action.type === "toggle_map_layer") {
      navigate("overview");
      setLayers((v) => ({ ...v, [action.layer]: action.enabled }));
    } else if (action.type === "select_time_range") {
      navigate("overview");
      setHours(action.hours);
      setCompareNonce((v) => v + 1);
    }
  }
  const [model, setModel] = useState("selected");
  const [horizon, setHorizon] = useState(1);
  const weather = usePoll<Weather>("/weather", 600000);
  const transit = usePoll<Transit>("/transport", 120000);
  const events = usePoll<Events>("/events", 1800000);
  const activity = usePoll<Activity>("/activity", 60000);
  const history = usePoll<History>(`/history?hours=${hours}`, 60000);
  const forecast = usePoll<Forecast>(
    `/forecast?model=${model}&horizon=${horizon}`,
    600000,
  );
  const diagnostics = usePoll<Diagnostics>("/diagnostics", 120000);
  useEffect(() => {
    const update = () => {
      const candidate = window.location.hash.slice(1);
      if (NAV.some((n) => n.id === candidate)) setView(candidate as View);
    };
    update();
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  function navigate(next: View) {
    setView(next);
    setQuery("");
    setMode("all");
    window.location.hash = next;
  }
  function refresh() {
    weather.refresh();
    transit.refresh();
    events.refresh();
    activity.refresh();
    history.refresh();
    forecast.refresh();
    diagnostics.refresh();
  }
  const sources = [
    { name: "Weather", meta: weather.data?.metadata, error: weather.error },
    { name: "Transit", meta: transit.data?.metadata, error: transit.error },
    { name: "Events", meta: events.data?.metadata, error: events.error },
  ];
  const errors = [
    weather.error,
    transit.error,
    events.error,
    activity.error,
    history.error,
    forecast.error,
    diagnostics.error,
  ].filter(Boolean);
  const transitItems = (transit.data?.items || []).filter(
    (i) =>
      (mode === "all" || i.mode === mode) &&
      (area === "all" || i.area === area) &&
      `${i.title} ${i.area} ${i.routes}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const eventItems = (events.data?.items || []).filter(
    (i) =>
      (mode === "all" || i.category === mode) &&
      (area === "all" || i.area === area) &&
      `${i.title} ${i.venue} ${i.area}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const areas = Array.from(
    new Set(
      [...(transit.data?.items || []), ...(events.data?.items || [])].map(
        (i) => i.area,
      ),
    ),
  );
  const a = activity.data;
  const w = weather.data;
  const f = forecast.data;
  const forecastPoints = [
    ...(f?.observed || []).map((p) => ({
      timestamp: p.timestamp,
      observed: p.temperature,
      predicted: undefined as number | undefined,
    })),
    ...(f?.predictions || []).map((p) => ({
      timestamp: p.timestamp,
      observed: undefined as number | undefined,
      predicted: p.temperature,
    })),
  ];
  if (f?.observed.length && f.predictions.length)
    forecastPoints[f.observed.length - 1].predicted =
      f.observed.at(-1)!.temperature;
  return (
    <MotionConfig reducedMotion={reduced ? "always" : "user"}>
      <div
        className={`app-shell overdrive ${reduced ? "reduced-effects" : ""}`}
      >
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <aside className="sidebar">
          <a
            href="#overview"
            className="brand"
            onClick={() => navigate("overview")}
          >
            <div className="brand-symbol">
              <Command size={25} />
            </div>
            <div>
              CITYHQ<span>MELBOURNE</span>
            </div>
            <span className="version">01</span>
          </a>
          <div className="workspace-label">
            <span className="dot" /> URBAN INTELLIGENCE
          </div>
          <nav aria-label="Main navigation">
            {NAV.map(({ id, label, icon: Icon }, i) => (
              <button
                key={id}
                className={view === id ? "active" : ""}
                aria-label={label}
                title={label}
                aria-current={view === id ? "page" : undefined}
                onClick={() => navigate(id)}
              >
                <Icon size={18} />
                <span>{label}</span>
                <small aria-hidden="true">0{i + 1}</small>
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="source-mini">
              <p>SIGNAL CONNECTIONS</p>
              {sources.map((s) => (
                <div key={s.name}>
                  <span>{s.name}</span>
                  {s.error ? (
                    <span className="badge unavailable">API error</span>
                  ) : (
                    <Badge meta={s.meta} />
                  )}
                </div>
              ))}
            </div>
            <button
              className="operator-launch"
              aria-label="Open Operator"
              onClick={() => setOperator(true)}
            >
              <Sparkles size={18} />
              <span>
                Open Operator<small>Your city, explained</small>
              </span>
              <ArrowUpRight size={17} />
            </button>
            <p className="sidebar-foot">37.8136° S &nbsp; 144.9631° E</p>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <span>
              <span className="dot" /> MELBOURNE, AUSTRALIA{" "}
              <span className="separator">/</span>{" "}
              <b>{NAV.find((n) => n.id === view)?.label}</b>
            </span>
            <div className="topbar-controls">
              <button
                onClick={() => setPalette(true)}
                aria-label="Open command palette"
              >
                <Search size={15} />
                <span>Commands</span>
                <kbd>⌘ K</kbd>
              </button>
              <button
                aria-pressed={reduced}
                onClick={() => {
                  const next = !reduced;
                  setReduced(next);
                  localStorage.setItem("cityhq-reduced", String(next));
                }}
              >
                Reduced effects
              </button>
              <button onClick={() => setReplay((v) => v + 1)}>
                Replay briefing
              </button>
              <Clock />
            </div>
          </header>
          <main id="main">
            <div className="page-heading">
              <div>
                <span className="eyebrow">
                  CITYHQ /{" "}
                  {view === "overview" ? "COMMAND CENTRE" : view.toUpperCase()}
                </span>
                <h1>{TITLES[view][0]}</h1>
                <p>{TITLES[view][1]}</p>
              </div>
              <div className="heading-actions">
                <button
                  className="icon-button"
                  onClick={refresh}
                  aria-label="Refresh all signals"
                >
                  <RefreshCw size={16} />
                </button>
                <button
                  className="primary-button"
                  onClick={() => setOperator(true)}
                >
                  <Sparkles size={16} /> Ask Operator
                </button>
              </div>
            </div>
            {errors.length > 0 && (
              <div role="alert" className="error-banner">
                API connection issue. Retained values may be stale. Check that
                the backend is running, then refresh.
              </div>
            )}
            <div className="context-strip">
              <span>
                <Radio size={14} />
                {a?.demo ? "DEMO SIGNALS INCLUDED" : "SOURCE-AWARE OPERATIONS"}
              </span>
              <p>
                Observations, estimates and predictions. Always distinguished.
              </p>
              {(view === "overview" ||
                view === "transit" ||
                view === "events") && (
                <label title="Filters maps and listings; citywide metrics remain citywide.">
                  Area{" "}
                  <select
                    aria-label="Geographic area"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                  >
                    <option value="all">All Melbourne</option>
                    {areas.map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {view === "overview" && (
              <CommandCentre
                weather={weather.data}
                transit={transit.data}
                events={events.data}
                activity={activity.data}
                history={history.data}
                diagnostics={diagnostics.data}
                layers={layers}
                onLayer={(layer, enabled) =>
                  setLayers((v) => ({ ...v, [layer]: enabled }))
                }
                camera={camera}
                onFocus={focus}
                hours={hours}
                onHours={setHours}
                navigate={navigate}
                onOperator={() => setOperator(true)}
                reduced={reduced}
                area={area}
                compareNonce={compareNonce}
                sourceErrors={{
                  weather: weather.error,
                  transport: transit.error,
                  events: events.error,
                }}
              />
            )}
            {view === "transit" && (
              <>
                <div className="filters">
                  <label className="search">
                    <Search size={16} />
                    <input
                      aria-label="Search disruptions"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search notices, routes or area…"
                    />
                  </label>
                  {["all", "train", "tram", "bus"].map((m) => (
                    <button
                      className={mode === m ? "selected" : ""}
                      key={m}
                      onClick={() => setMode(m)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <section className="panel">
                  <div className="panel-heading">
                    <h2>{transitItems.length} matching service notices</h2>
                    <Freshness meta={transit.data?.metadata} />
                  </div>
                  <p className="muted">
                    Major: {transit.data?.major_disruptions ?? "—"} · Minor:{" "}
                    {transit.data?.minor_delays ?? "—"}. Provider severity may
                    be unknown.
                  </p>
                  <Notices items={transitItems} />
                </section>
                <section className="panel spaced">
                  <h2>Notice count history</h2>
                  <Trend data={history.data} signal="disruptions" />
                </section>
              </>
            )}
            {view === "weather" && (
              <>
                <section className="panel weather-hero">
                  <div>
                    <span className="eyebrow">MELBOURNE CONDITIONS</span>
                    <div className="weather-temperature">
                      {w?.temperature ?? "—"}
                      <span>°C</span>
                    </div>
                    <h2>{w?.condition || "No current observation"}</h2>
                    <Freshness meta={w?.metadata} />
                  </div>
                  <CloudSun size={100} strokeWidth={1} />
                  <div className="weather-details">
                    <p>
                      <Wind size={18} />
                      Wind <strong>{w?.wind_speed ?? "—"} km/h</strong>
                    </p>
                    <p>
                      Relative humidity <strong>{w?.humidity ?? "—"}%</strong>
                    </p>
                    <p>
                      Activity factor{" "}
                      <strong>
                        {a?.components.find(
                          (c) => c.name === "Weather suitability",
                        )?.contribution ?? "—"}{" "}
                        / 15
                      </strong>
                    </p>
                  </div>
                </section>
                <div className="two-columns spaced">
                  <section className="panel">
                    <h2>Provider outlook</h2>
                    {w?.forecast.length ? (
                      w.forecast.map((day) => (
                        <div className="data-row" key={day.date}>
                          <span>{day.date}</span>
                          <strong>
                            {day.minimum}° / {day.maximum}°C
                          </strong>
                        </div>
                      ))
                    ) : (
                      <Empty>
                        This adapter has no daily forecast available.
                      </Empty>
                    )}
                  </section>
                  <section className="panel">
                    <h2>Observed temperature history</h2>
                    <Trend data={history.data} signal="temperature" />
                  </section>
                </div>
              </>
            )}
            {view === "events" && (
              <>
                <div className="filters">
                  <label className="search">
                    <Search size={16} />
                    <input
                      aria-label="Search events"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search listings or venues…"
                    />
                  </label>
                  <select
                    aria-label="Event category"
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                  >
                    <option value="all">All categories</option>
                    {Array.from(
                      new Set(events.data?.items.map((i) => i.category)),
                    ).map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  <Freshness meta={events.data?.metadata} />
                </div>
                <div className="two-columns">
                  <section className="panel">
                    <h2>Upcoming timeline</h2>
                    {eventItems.length ? (
                      eventItems.map((event, i) => (
                        <article className="event-row" key={i}>
                          <div className="event-date">
                            <span>{event.date?.slice(5) || "TBA"}</span>
                            <small>
                              {event.time?.slice(0, 5) || "Time TBA"}
                            </small>
                          </div>
                          <div>
                            <span className="eyebrow violet-text">
                              {event.category}
                            </span>
                            <h3>{event.title}</h3>
                            <p>
                              {event.venue} · {event.area}
                            </p>
                          </div>
                        </article>
                      ))
                    ) : (
                      <Empty>No matching listings.</Empty>
                    )}
                  </section>
                  <section className="panel">
                    <h2>Listings by area</h2>
                    {Array.from(new Set(eventItems.map((i) => i.area))).map(
                      (area) => (
                        <div className="data-row" key={area}>
                          <span>{area}</span>
                          <strong>
                            {eventItems.filter((i) => i.area === area).length}{" "}
                            listings
                          </strong>
                        </div>
                      ),
                    )}
                    <p className="caption">
                      Counts describe listings, not audience size or crowd
                      density.
                    </p>
                    <CityMap events={eventItems} transit={[]} />
                  </section>
                </div>
              </>
            )}
            {view === "forecasting" && (
              <>
                <div className="filters">
                  <label>
                    Model{" "}
                    <select
                      aria-label="Forecast model"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                    >
                      <option value="selected">Validation winner</option>
                      <option value="baseline">Persistence baseline</option>
                      <option value="ridge">Ridge regression</option>
                      <option value="random_forest">Random forest</option>
                    </select>
                  </label>
                  <label>
                    Horizon{" "}
                    <select
                      aria-label="Prediction horizon"
                      value={horizon}
                      onChange={(e) => setHorizon(Number(e.target.value))}
                    >
                      {[1, 3, 6].map((h) => (
                        <option key={h} value={h}>
                          {h} hour{h > 1 ? "s" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span className="badge demo">
                    {f?.metadata?.mode || "No model"} DATASET
                  </span>
                </div>
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">TEMPERATURE · °C</span>
                      <h2>Observed vs predicted</h2>
                    </div>
                    <span className="caption">
                      Cyan: observed / Violet dashed: predicted
                    </span>
                  </div>
                  {f?.available ? (
                    <div
                      className="chart forecast-chart"
                      role="img"
                      aria-label="Observed and forecast temperatures"
                    >
                      <ResponsiveContainer
                        width="100%"
                        height="100%"
                        initialDimension={{ width: 600, height: 230 }}
                        minWidth={0}
                      >
                        <LineChart data={forecastPoints}>
                          <CartesianGrid stroke="#ffffff0a" vertical={false} />
                          <XAxis
                            dataKey="timestamp"
                            stroke="#8d9eae"
                            tickFormatter={(v) =>
                              new Date(v).toLocaleTimeString("en-AU", {
                                timeZone: "Australia/Melbourne",
                                hour: "2-digit",
                              })
                            }
                          />
                          <YAxis stroke="#8d9eae" />
                          <Tooltip
                            contentStyle={{
                              background: "#122030",
                              border: "1px solid #344658",
                            }}
                            labelFormatter={(v) => melbourneTime(String(v))}
                          />
                          <Line
                            dataKey="observed"
                            stroke="#5fe1d5"
                            dot={false}
                            strokeWidth={2}
                            isAnimationActive={false}
                          />
                          <Line
                            dataKey="predicted"
                            stroke="#b5a0ff"
                            strokeDasharray="5 5"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <Empty>{f?.reason || "Loading forecast…"}</Empty>
                  )}
                  <p>{f?.explanation}</p>
                  {horizon > 1 && (
                    <p className="warning">
                      Recursive {horizon}-hour forecast: only the one-hour
                      horizon has been evaluated.
                    </p>
                  )}
                </section>
                {f?.metadata && (
                  <div className="two-columns spaced">
                    <section className="panel">
                      <h2>Held-out evaluation</h2>
                      <p className="muted">
                        {f.metadata.rows.toLocaleString()} hourly rows · 60 / 20
                        / 20 chronological split · one-hour boundary purge
                      </p>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Model</th>
                              <th>Validation MAE</th>
                              <th>Test MAE</th>
                              <th>Test RMSE</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(f.metadata.metrics).map(
                              ([name, m]) => (
                                <tr key={name}>
                                  <td>
                                    {name}
                                    {name === f.metadata!.selected_model
                                      ? " ★"
                                      : ""}
                                  </td>
                                  <td>{m.validation.mae.toFixed(3)}</td>
                                  <td>{m.test.mae.toFixed(3)}</td>
                                  <td>{m.test.rmse.toFixed(3)}</td>
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      </div>
                      <p className="caption">
                        ★ Selected on validation MAE only. All errors in °C.
                      </p>
                      <p className="muted">
                        Residual mean {f.metadata.residuals.mean.toFixed(3)} ·
                        standard deviation {f.metadata.residuals.std.toFixed(3)}
                        °C
                      </p>
                    </section>
                    <section className="panel">
                      <h2>What the model uses</h2>
                      {Object.entries(f.metadata.feature_importance)
                        .sort((a, b) => b[1] - a[1])
                        .map(([name, value]) => (
                          <div className="contribution" key={name}>
                            <div>
                              <span>{name}</span>
                              <strong>{(value * 100).toFixed(1)}%</strong>
                            </div>
                            <progress
                              aria-label={`${name} importance`}
                              value={value}
                              max={1}
                            />
                          </div>
                        ))}
                      <p className="caption">{f.metadata.importance_note}</p>
                    </section>
                    <section className="panel full-width model-provenance">
                      <details>
                        <summary>
                          Training provenance & chronological split dates
                        </summary>
                        <p className="caption">
                          {f.metadata.version} · {f.metadata.target} ·{" "}
                          {f.metadata.mode} · seed{" "}
                          {f.metadata.seed ?? "not supplied"}
                        </p>
                        <p className="caption">{f.metadata.selection}</p>
                        {Object.entries(f.metadata.splits).map(
                          ([name, split]) => (
                            <div className="data-row" key={name}>
                              <strong>
                                {name} · {split.rows} rows
                              </strong>
                              <span>
                                {melbourneTime(split.start)} →{" "}
                                {melbourneTime(split.end)}
                              </span>
                            </div>
                          ),
                        )}
                        <p className="caption">
                          Dataset SHA-256:{" "}
                          {f.metadata.dataset_sha256 ?? "not supplied"}
                        </p>
                        <p className="caption">
                          Forecast dates are shown in Australia/Melbourne.
                          Synthetic inference follows the stored 2025 research
                          timeline, separate from current weather.
                        </p>
                      </details>
                    </section>
                    <section className="panel full-width">
                      <h2>Model limitations</h2>
                      {f.metadata.limitations.map((l) => (
                        <p key={l} className="limitation">
                          {l}
                        </p>
                      ))}
                    </section>
                  </div>
                )}
                <section className="panel spaced">
                  <div className="panel-heading">
                    <h2>Stored signal explorer</h2>
                    <div className="filters">
                      <select
                        aria-label="Signal to compare"
                        value={signal}
                        onChange={(e) => setSignal(e.target.value)}
                      >
                        {["score", "temperature", "disruptions", "events"].map(
                          (s) => (
                            <option key={s}>{s}</option>
                          ),
                        )}
                      </select>
                      <select
                        aria-label="History time range"
                        value={hours}
                        onChange={(e) => setHours(Number(e.target.value))}
                      >
                        <option value={24}>24 hours</option>
                        <option value={168}>7 days</option>
                        <option value={720}>30 days</option>
                      </select>
                      <a
                        className="button"
                        href={`${API}/api/v1/history.csv?hours=${hours}`}
                      >
                        <ArrowDownToLine size={15} /> CSV
                      </a>
                    </div>
                  </div>
                  <Trend data={history.data} signal={signal} />
                </section>
              </>
            )}
            {view === "forecasting" && <ResidualDiagnostics forecast={f} />}
            {view === "diagnostics" && (
              <div className="two-columns">
                <section className="panel">
                  <h2>Connectivity & polling</h2>
                  <div className="data-row">
                    <span>API</span>
                    <strong>
                      {diagnostics.error
                        ? "Connection failed"
                        : diagnostics.data
                          ? "Reachable"
                          : "Connecting"}
                    </strong>
                  </div>
                  <div className="data-row">
                    <span>Polling</span>
                    <strong>
                      {diagnostics.paused
                        ? "Paused while hidden"
                        : "Visibility-aware"}
                    </strong>
                  </div>
                  <div className="data-row">
                    <span>Last successful API refresh</span>
                    <strong>{melbourneTime(diagnostics.lastSuccess)}</strong>
                  </div>
                  <div className="data-row">
                    <span>Model version</span>
                    <strong>
                      {diagnostics.data?.model_version || "Not trained"}
                    </strong>
                  </div>
                  <p className="caption">
                    Weather 10 min · Transit 2 min · Events 30 min. API
                    reachability does not imply live source availability.
                  </p>
                </section>
                <section className="panel">
                  <h2>Dataset coverage</h2>
                  {Object.entries(diagnostics.data?.coverage || {}).map(
                    ([name, c]) => (
                      <div className="data-row" key={name}>
                        <span>
                          {name}
                          <small>
                            {melbourneTime(c.first)} → {melbourneTime(c.last)}
                          </small>
                        </span>
                        <strong>{c.count} rows</strong>
                      </div>
                    ),
                  )}
                </section>
                {Object.entries(diagnostics.data?.sources || {}).map(
                  ([name, meta]) => (
                    <section className="panel" key={name}>
                      <div className="panel-heading">
                        <h2>{name}</h2>
                        <Badge meta={meta} />
                      </div>
                      <div className="data-row">
                        <span>Provider</span>
                        <strong>{meta.source}</strong>
                      </div>
                      <div className="data-row">
                        <span>Observed</span>
                        <strong>{melbourneTime(meta.observed_at)}</strong>
                      </div>
                      <div className="data-row">
                        <span>Last successful fetch</span>
                        <strong>{melbourneTime(meta.fetched_at)}</strong>
                      </div>
                      <div className="data-row">
                        <span>Observation age</span>
                        <strong>
                          {meta.age_seconds == null
                            ? "Unknown"
                            : `${Math.round(meta.age_seconds / 60)} min`}
                        </strong>
                      </div>
                      {meta.error && <p className="warning">{meta.error}</p>}
                      {meta.limitations.map((l) => (
                        <p className="caption" key={l}>
                          {l}
                        </p>
                      ))}
                    </section>
                  ),
                )}
                <section className="panel">
                  <h2>Ingestion audit</h2>
                  {diagnostics.data?.ingestion_runs
                    .slice(0, 8)
                    .map((run, i) => (
                      <div className="data-row" key={i}>
                        <span>
                          {run.source}
                          <small>{melbourneTime(run.timestamp)}</small>
                        </span>
                        <span
                          className={
                            run.status === "failed" ? "warning" : "muted"
                          }
                        >
                          {run.status}
                        </span>
                      </div>
                    ))}
                </section>
              </div>
            )}
            <footer>
              <span>
                <ShieldCheck size={14} /> Designed for transparent city
                intelligence
              </span>
              <span>CITYHQ · MELBOURNE / 01</span>
            </footer>
          </main>
        </div>
        <Operator
          open={operator}
          navigate={navigate}
          onAction={executeAction}
          onClose={() => setOperator(false)}
        />
        <CommandPalette
          open={palette}
          onClose={() => setPalette(false)}
          onAction={executeAction}
        />
        <BootSequence sources={sources} reduced={reduced} replay={replay} />
      </div>
    </MotionConfig>
  );
}
