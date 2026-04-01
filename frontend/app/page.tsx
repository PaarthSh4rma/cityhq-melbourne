import { Activity, CloudRain, MapPinned, TrainFront, TriangleAlert } from "lucide-react";
import { motion } from "framer-motion";

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
    value: "Normal",
    unit: "",
    change: "2 minor delays",
    icon: TrainFront,
  },
  {
    title: "Weather",
    value: "18°",
    unit: "Cloudy",
    change: "Light wind",
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

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="w-72 border-r border-zinc-800 bg-zinc-950/80 px-6 py-8">
          <div className="mb-10">
            <p className="text-xs uppercase tracking-[0.25em] text-cyan-400">CityHQ</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">Melbourne</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Real-time urban intelligence dashboard
            </p>
          </div>

          <div className="space-y-8">
            <div>
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                Modules
              </p>
              <div className="space-y-2">
                {["Overview", "Transit", "Weather", "Events", "Forecasting"].map((item) => (
                  <div
                    key={item}
                    className={`rounded-xl border px-4 py-3 text-sm transition ${
                      item === "Overview"
                        ? "border-cyan-500/20 bg-cyan-500/10 text-cyan-300"
                        : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white"
                    }`}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div>
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
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <section className="flex-1 px-8 py-8">
          {/* Header */}
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h2 className="text-4xl font-semibold tracking-tight">Urban Overview</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Monitor live conditions, city activity, and operational signals across Melbourne.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-wider text-zinc-500">Last Updated</p>
              <p className="mt-1 text-sm text-zinc-200">{new Date().toLocaleTimeString()}</p>
            </div>
          </div>

          {/* Metrics */}
          <div className="mb-8 grid grid-cols-1 gap-4 xl:grid-cols-4">
            {metricCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-cyan-500/30 hover:bg-zinc-900/80"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-xs uppercase tracking-wider text-zinc-500">
                      {card.title}
                    </p>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-2 text-cyan-400">
                      <Icon size={16} />
                    </div>
                  </div>

                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-semibold tracking-tight">{card.value}</span>
                    <span className="pb-1 text-sm text-zinc-500">{card.unit}</span>
                  </div>

                  <p className="mt-3 text-sm text-zinc-400">{card.change}</p>
                </div>
              );
            })}
          </div>

          {/* Main panels */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            {/* Map */}
            <div className="xl:col-span-2 rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
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
            </div>

            {/* Alerts */}
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-lg font-medium">Operational Alerts</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Exceptions, surges, and notable changes
                  </p>
                </div>
                <TriangleAlert className="text-amber-400" size={18} />
              </div>

              <div className="space-y-4">
                {[
                  "Minor tram disruption impacting CBD northbound flow",
                  "Event traffic building near Rod Laver Arena precinct",
                  "Weather conditions may suppress bay-side foot traffic",
                ].map((alert, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
                  >
                    <p className="text-sm leading-6 text-zinc-300">{alert}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom panels */}
          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
              <p className="text-lg font-medium">Activity Trend</p>
              <p className="mt-1 text-sm text-zinc-400">
                Short-term movement and congestion trajectory
              </p>
              <div className="mt-4 flex h-56 items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 text-zinc-500">
                Trend chart placeholder
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
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
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}