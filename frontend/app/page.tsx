"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  CloudRain,
  MapPinned,
  TrainFront,
  TriangleAlert,
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

const metricCards = [
  {
    title: "Urban Activity",
    value: "73",
    unit: "/100",
    change: "+8%",
    icon: Activity,
  },
  {
    title: "Transit Network",
    value: "Loading",
    unit: "",
    change: "Fetching network status",
    icon: TrainFront,
  },
  {
    title: "Weather",
    value: "--°",
    unit: "Loading",
    change: "Fetching live data",
    icon: CloudRain,
  },
  {
    title: "Event Load",
    value: "High",
    unit: "",
    change: "5 major events",
    icon: MapPinned,
  },
];

const fallbackAlerts = [
  { title: "Minor tram disruption impacting CBD northbound flow", severity: "warning", mode: "tram", area: "CBD" },
  { title: "Event traffic building near Rod Laver Arena precinct", severity: "info", mode: "event", area: "Melbourne Park" },
  { title: "Weather conditions may suppress bay-side foot traffic", severity: "low", mode: "weather", area: "St Kilda" },
];

const sidebarItems = ["Overview", "Transit", "Weather", "Events", "Forecasting"];

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

export default function Home() {
  const [time, setTime] = useState<string | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState(false);
  const [transport, setTransport] = useState<Transport | null>(null);

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
    const fetchWeather = async () => {
      try {
        setWeatherError(false);

        const res = await fetch("http://127.0.0.1:8000/weather");

        if (!res.ok) {
          throw new Error("Weather request failed");
        }

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

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="flex min-h-screen">
        <aside className="w-72 border-r border-zinc-800 bg-zinc-950/80 px-6 py-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="mb-10"
          >
            <p className="text-xs uppercase tracking-[0.25em] text-cyan-400">
              CityHQ
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">
              Melbourne
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Real-time urban intelligence dashboard
            </p>
          </motion.div>

          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
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
                    className={`cursor-pointer rounded-xl border px-4 py-3 text-sm transition ${
                      item === "Overview"
                        ? "border-cyan-500/20 bg-cyan-500/10 text-cyan-300"
                        : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-white"
                    }`}
                  >
                    {item}
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.12 }}
            >
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                System Status
              </p>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Data Sync</span>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-400">
                    Online
                  </span>
                </div>

                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Last refresh</span>
                  <span className="text-zinc-300">12 sec ago</span>
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
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08 }}
            className="mb-8 flex items-start justify-between"
          >
            <div>
              <h2 className="text-4xl font-semibold tracking-tight">
                Urban Overview
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                Monitor live conditions, city activity, and operational signals
                across Melbourne.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-wider text-zinc-500">
                Last Updated
              </p>
              <p className="mt-1 text-sm text-zinc-200">{time ?? "--"}</p>
            </div>
          </motion.div>

          <div className="mb-8 grid grid-cols-1 gap-4 xl:grid-cols-4">
            {metricCards.map((card, index) => {
              const Icon = card.icon;
              const isWeather = card.title === "Weather";
              const isTransport = card.title === "Transit Network";

              const value = isWeather
                ? weatherLoading
                  ? "--°"
                  : weatherError
                    ? "Offline"
                    : weather
                      ? `${Math.round(Number(weather.temperature))}°`
                      : "--°"
                : isTransport
                  ? transport?.status ?? "Loading"
                  : card.value;

              const unit = isWeather
                ? weatherLoading
                  ? "Loading"
                  : weatherError
                    ? "Unavailable"
                    : weather?.condition ?? "Unknown"
                : isTransport
                  ? ""
                  : card.unit;

              const change = isWeather
                ? weatherLoading
                  ? "Fetching live weather"
                  : weatherError
                    ? "Backend connection issue"
                    : weather
                      ? `Wind · ${weather.wind_speed} km/h`
                      : "No data"
                : isTransport
                  ? transport
                    ? `${transport.minor_delays} minor delays · ${transport.major_disruptions} major`
                    : "Fetching network status"
                  : card.change;

              return (
                <motion.div
                  key={card.title}
                  variants={fadeUp}
                  initial="initial"
                  animate="animate"
                  transition={{ duration: 0.35, delay: 0.12 + index * 0.06 }}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-cyan-500/30 hover:bg-zinc-900/80 hover:shadow-[0_0_20px_rgba(34,211,238,0.08)]"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-xs uppercase tracking-wider text-zinc-500">
                      {card.title}
                    </p>

                    <div className="rounded-xl border border-cyan-500/20 bg-zinc-950 p-2 text-cyan-400">
                      <Icon size={16} />
                    </div>
                  </div>

                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-semibold tracking-tight">
                      {value}
                    </span>
                    <span className="pb-1 text-sm text-zinc-500">{unit}</span>
                  </div>

                  <p className="mt-3 text-sm text-zinc-400">{change}</p>
                </motion.div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.28 }}
              className="xl:col-span-2 rounded-3xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-cyan-500/20"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-lg font-medium">City Activity Map</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Hotspots, movement patterns, and signal overlays
                  </p>
                </div>

                <span className="flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
                  <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                  Live
                </span>
              </div>

              <div className="flex h-[420px] items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 text-zinc-500">
                Melbourne map placeholder
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.34 }}
              className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-amber-500/20"
            >
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-lg font-medium">Operational Alerts</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Transport exceptions, surges, and notable city changes
                  </p>
                </div>
                <TriangleAlert className="text-amber-400" size={18} />
              </div>

              <div className="space-y-4">
                {alertItems.map((alert, index) => (
                  <motion.div
                    key={`${alert.title}-${index}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.4 + index * 0.05 }}
                    className={`rounded-2xl border p-4 ${
                      alert.severity === "warning" || alert.severity === "minor"
                        ? "border-amber-500/20 bg-amber-500/5"
                        : alert.severity === "info"
                          ? "border-cyan-500/20 bg-cyan-500/5"
                          : "border-zinc-800 bg-zinc-950"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs uppercase tracking-wider text-zinc-500">
                        {alert.mode} · {alert.area}
                      </span>
                      <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400">
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
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.42 }}
              className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-cyan-500/20"
            >
              <p className="text-lg font-medium">Activity Trend</p>
              <p className="mt-1 text-sm text-zinc-400">
                Short-term movement and congestion trajectory
              </p>

              <div className="mt-4 flex h-56 items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 text-zinc-500">
                Trend chart placeholder
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.48 }}
              className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-cyan-500/20"
            >
              <p className="text-lg font-medium">Forecast Window</p>
              <p className="mt-1 text-sm text-zinc-400">
                Next 1–3 hour operational outlook
              </p>

              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                  <p className="text-sm text-zinc-500">CBD</p>
                  <p className="mt-1 text-lg font-medium text-white">
                    Congestion likely to rise by 14%
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
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