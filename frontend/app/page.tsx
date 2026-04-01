export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="flex">

        {/* Sidebar */}
        <aside className="w-64 h-screen border-r border-zinc-800 p-4">
          <h1 className="text-xl font-semibold mb-6">CityHQ</h1>
          <div className="space-y-2 text-sm text-zinc-400">
            <p>Melbourne, AU</p>
            <p>Status: Online</p>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 p-6">

          {/* Header */}
          <div className="mb-6">
            <h2 className="text-2xl font-semibold">Urban Dashboard</h2>
            <p className="text-zinc-400 text-sm">Last updated just now</p>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {["Activity", "Transport", "Weather", "Events"].map((item) => (
              <div key={item} className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                <p className="text-sm text-zinc-400">{item}</p>
                <p className="text-xl mt-2">--</p>
              </div>
            ))}
          </div>

          {/* Main panel */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 bg-zinc-900 h-96 rounded-xl border border-zinc-800 flex items-center justify-center">
              Map Placeholder
            </div>

            <div className="bg-zinc-900 h-96 rounded-xl border border-zinc-800 p-4">
              <p className="text-sm text-zinc-400 mb-2">Alerts</p>
              <ul className="text-sm space-y-2">
                <li>• No major incidents</li>
              </ul>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}