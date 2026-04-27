"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  CloudRain,
  MapPinned,
  Radio,
  Satellite,
  TrainFront,
  TriangleAlert,
  Zap,
} from "lucide-react";
import { motion } from "framer-motion";

type Weather = {
  temperature: string | number;
  condition: string;
  description: string;
  wind_speed: string | number;
  city: string;
};

type TransportItem = {
  title: string;
  severity: string;
  mode: string;
  area: string;
};

type Transport = {
  status: string;
  minor_delays: number;
  major_disruptions: number;
  items: TransportItem[];
  updated_at: string;
};

const sidebarItems = ["Overview", "Transit", "Weather", "Events", "Forecasting"];

const fallbackAlerts: TransportItem[] = [
  {
    title: "Minor tram disruption impacting CBD northbound flow",
    severity: "minor",
    mode: "tram",
    area: "CBD",
  },
  {
    title: "Event traffic building near Rod Laver Arena precinct",
    severity: "info",
    mode: "event",
    area: "Melbourne Park",
  },
  {
    title: "Weather conditions may suppress bay-side foot traffic",
    severity: "low",
    mode: "weather",
    area: "St Kilda",
  },
];

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
};

export default function Home() {
  const [time, setTime] = useState<string | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState(false);
  const [transport, setTransport] = useState<Transport | null>(null);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        setWeatherError(false);
        const res = await fetch("http://127.0.0.1:8000/weather");

        if (!res.ok) throw new Error("Weather request failed");

        const data = await res.json();
        setWeather(data);
      } catch (err) {
        console.error("Failed to fetch weather:", err);
        setWeatherError(true);
      } finally {
        setWeatherLoading(false);
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 60_000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchTransport = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/transport");
        const data = await res.json();
        setTransport(data);
      } catch (err) {
        console.error("Failed to fetch transport:", err);
      }
    };

    fetchTransport();
    const interval = setInterval(fetchTransport, 60_000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleString(undefined, {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  const alertItems = transport?.items?.length ? transport.items : fallbackAlerts;

  const metrics = [
    {
      title: "Urban Activity",
      value: "73",
      unit: "/100",
      change: "+8% from previous hour",
      icon: Activity,
      accent: "cyan",
    },
    {
      title: "Transit Network",
      value: transport?.status ?? "Loading",
      unit: "",
      change: transport
        ? `${transport.minor_delays} active disruptions · updated just now`
        : "Monitoring network conditions",
      icon: TrainFront,
      accent: "amber",
    },
    {
      title: "Weather",
      value: weatherLoading
        ? "--°"
        : weatherError
          ? "Offline"
          : weather
            ? `${Math.round(Number(weather.temperature))}°`
            : "--°",
      unit: weatherLoading
        ? "Loading"
        : weatherError
          ? "Unavailable"
          : weather?.condition ?? "Unknown",
      change: weatherLoading
        ? "Fetching live weather"
        : weatherError
          ? "Backend connection issue"
          : weather
            ? `Wind · ${weather.wind_speed} km/h`
            : "No data",
      icon: CloudRain,
      accent: "cyan",
    },
    {
      title: "Event Load",
      value: "High",
      unit: "",
      change: "5 major events detected",
      icon: MapPinned,
      accent: "violet",
    },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05070d] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.12),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(14,165,233,0.08),transparent_35%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:48px_48px]" />

      <div className="relative flex min-h-screen">
        <aside className="w-72 border-r border-white/10 bg-zinc-950/60 px-6 py-8 backdrop-blur-xl">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="mb-10"
          >
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300 shadow-[0_0_30px_rgba(34,211,238,0.12)]">
              <Satellite size={22} />
            </div>

            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">
              CityHQ
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">
              Melbourne
            </h1>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Real-time urban intelligence dashboard for live city operations.
            </p>
          </motion.div>

          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.05 }}
            >
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                Modules
              </p>

              <div className="space-y-2">
                {sidebarItems.map((item, index) => (
                  <motion.div
                    key={item}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.08 + index * 0.04 }}
                    className={`group cursor-pointer rounded-2xl border px-4 py-3 text-sm transition ${
                      item === "Overview"
                        ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,0.08)]"
                        : "border-white/10 bg-white/[0.03] text-zinc-400 hover:border-cyan-400/20 hover:bg-cyan-400/5 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{item}</span>
                      {item === "Overview" && (
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.8)]" />
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.12 }}
            >
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                System Status
              </p>

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Data Sync</span>
                  <span className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                    Online
                  </span>
                </div>

                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Weather API</span>
                  <span className="text-zinc-300">
                    {weatherError ? "Offline" : "Active"}
                  </span>
                </div>

                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Transit Feed</span>
                  <span className="text-zinc-300">
                    {transport ? "Active" : "Mock"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Coverage</span>
                  <span className="text-zinc-300">Metro region</span>
                </div>
              </div>
            </motion.div>
          </div>
        </aside>

        <section className="flex-1 px-8 py-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08 }}
            className="mb-8 flex items-start justify-between"
          >
            <div>
              <div className="mb-3 flex items-center gap-3">
                <span className="flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">
                  <Radio size={13} />
                  Live Operations
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-400">
                  Metro Intelligence Layer
                </span>
              </div>

              <h2 className="text-5xl font-semibold tracking-tight">
                Urban Overview
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
                Monitor live conditions, movement pressure, and operational
                signals across Melbourne.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-4 text-right backdrop-blur-xl">
              <p className="text-xs uppercase tracking-wider text-zinc-500">
                Last Updated
              </p>
              <p className="mt-1 text-sm text-zinc-200">{time ?? "--"}</p>
            </div>
          </motion.div>

          <div className="mb-8 grid grid-cols-1 gap-4 xl:grid-cols-4">
            {metrics.map((card, index) => {
              const Icon = card.icon;

              const accentClass =
                card.accent === "amber"
                  ? "border-amber-400/20 text-amber-300 bg-amber-400/10"
                  : card.accent === "violet"
                    ? "border-violet-400/20 text-violet-300 bg-violet-400/10"
                    : "border-cyan-400/20 text-cyan-300 bg-cyan-400/10";

              return (
                <motion.div
                  key={card.title}
                  variants={fadeUp}
                  initial="initial"
                  animate="animate"
                  transition={{ duration: 0.35, delay: 0.12 + index * 0.06 }}
                  className="group rounded-3xl border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl transition hover:border-cyan-400/25 hover:bg-white/[0.065] hover:shadow-[0_0_32px_rgba(34,211,238,0.08)]"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <p className="text-xs uppercase tracking-wider text-zinc-500">
                      {card.title}
                    </p>

                    <div className={`rounded-2xl border p-2.5 ${accentClass}`}>
                      <Icon size={17} />
                    </div>
                  </div>

                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-semibold tracking-tight">
                      {card.value}
                    </span>
                    <span className="pb-1 text-sm text-zinc-500">
                      {card.unit}
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-zinc-400">{card.change}</p>
                </motion.div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.28 }}
              className="xl:col-span-2 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl transition hover:border-cyan-400/20"
            >
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-xl font-medium">City Activity Map</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Hotspots, movement patterns, and signal overlays
                  </p>
                </div>

                <span className="flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">
                  <span className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse shadow-[0_0_12px_rgba(34,211,238,0.9)]" />
                  Live
                </span>
              </div>

              <div className="relative h-[430px] overflow-hidden rounded-3xl border border-white/10 bg-[#05070d]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(34,211,238,0.18),transparent_25%),radial-gradient(circle_at_35%_65%,rgba(168,85,247,0.12),transparent_22%)]" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.07)_1px,transparent_1px)] bg-[size:36px_36px]" />

                <div className="absolute left-[48%] top-[46%] h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/20 bg-cyan-300/10 blur-sm" />
                <div className="absolute left-[48%] top-[46%] h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_32px_rgba(34,211,238,0.9)]" />

                {[
                  ["22%", "30%", "CBD"],
                  ["62%", "34%", "Richmond"],
                  ["50%", "70%", "Southbank"],
                  ["72%", "62%", "St Kilda"],
                  ["34%", "58%", "Docklands"],
                ].map(([left, top, label]) => (
                  <div
                    key={label}
                    className="absolute"
                    style={{ left, top }}
                  >
                    <div className="h-3 w-3 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.9)]" />
                    <p className="mt-2 rounded-full border border-white/10 bg-black/40 px-2 py-1 text-xs text-zinc-300 backdrop-blur">
                      {label}
                    </p>
                  </div>
                ))}

                <div className="absolute bottom-5 left-5 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 backdrop-blur">
                  <p className="text-xs uppercase tracking-wider text-zinc-500">
                    Signal Overlay
                  </p>
                  <p className="mt-1 text-sm text-zinc-200">
                    Activity density · transport pressure · weather influence
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.34 }}
              className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl transition hover:border-amber-400/20"
            >
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-xl font-medium">Operational Alerts</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Transport exceptions and notable city changes
                  </p>
                </div>
                <TriangleAlert className="text-amber-300" size={20} />
              </div>

              <div className="space-y-4">
                {alertItems.slice(0, 3).map((alert, index) => (
                  <motion.div
                    key={`${alert.title}-${index}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.4 + index * 0.05 }}
                    className={`rounded-3xl border p-4 ${
                      alert.severity === "warning" || alert.severity === "minor"
                        ? "border-amber-400/20 bg-amber-400/5"
                        : alert.severity === "info"
                          ? "border-cyan-400/20 bg-cyan-400/5"
                          : "border-white/10 bg-white/[0.03]"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs uppercase tracking-wider text-zinc-500">
                        {alert.mode} · {alert.area}
                      </span>
                      <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-xs text-zinc-400">
                        {alert.severity}
                      </span>
                    </div>
                    <p className="text-sm leading-6 text-zinc-300">
                      {alert.title}
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.42 }}
              className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl transition hover:border-cyan-400/20"
            >
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-xl font-medium">Activity Trend</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Short-term movement and congestion trajectory
                  </p>
                </div>
                <Zap className="text-cyan-300" size={19} />
              </div>

              <div className="flex h-56 items-end gap-3 rounded-3xl border border-white/10 bg-black/20 p-5">
                {[38, 44, 52, 48, 61, 68, 73, 66, 71, 78, 74, 82].map(
                  (height, index) => (
                    <div
                      key={index}
                      className="flex flex-1 items-end"
                    >
                      <div
                        className="w-full rounded-t-xl bg-cyan-300/70 shadow-[0_0_18px_rgba(34,211,238,0.16)]"
                        style={{ height: `${height}%` }}
                      />
                    </div>
                  )
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.48 }}
              className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl transition hover:border-cyan-400/20"
            >
              <p className="text-xl font-medium">Forecast Window</p>
              <p className="mt-1 text-sm text-zinc-400">
                Next 1–3 hour operational outlook
              </p>

              <div className="mt-5 space-y-4">
                <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/5 p-4">
                  <p className="text-sm text-zinc-500">CBD</p>
                  <p className="mt-1 text-lg font-medium text-white">
                    Congestion likely to rise by 14%
                  </p>
                </div>

                <div className="rounded-3xl border border-violet-400/20 bg-violet-400/5 p-4">
                  <p className="text-sm text-zinc-500">Southbank</p>
                  <p className="mt-1 text-lg font-medium text-white">
                    Event-driven activity expected through evening peak
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </div>
    </main>
  );
}