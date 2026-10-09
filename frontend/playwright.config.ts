import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3115",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    launchOptions: { args: ["--enable-unsafe-swiftshader"] },
  },
  webServer: [
    {
      command:
        "cd ../backend && CORS_ORIGINS=http://127.0.0.1:3115 AIR_QUALITY_ADAPTER=demo DELHI_TRANSPORT_ADAPTER=delhi-metro-static WEATHER_ADAPTER=demo TRANSPORT_ADAPTER=demo EVENTS_ADAPTER=demo DATABASE_URL=sqlite:////tmp/cityhq-e2e.db venv/bin/alembic upgrade head && CORS_ORIGINS=http://127.0.0.1:3115 AIR_QUALITY_ADAPTER=demo DELHI_TRANSPORT_ADAPTER=delhi-metro-static WEATHER_ADAPTER=demo TRANSPORT_ADAPTER=demo EVENTS_ADAPTER=demo DATABASE_URL=sqlite:////tmp/cityhq-e2e.db venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8115",
      url: "http://127.0.0.1:8115/health",
      reuseExistingServer: false,
    },
    {
      command:
        "NEXT_DIST_DIR=.next-e2e NEXT_PUBLIC_API_URL=http://127.0.0.1:8115 npm run dev -- --hostname 127.0.0.1 --port 3115",
      url: "http://127.0.0.1:3115",
      reuseExistingServer: false,
    },
  ],
  timeout: 30000,
});
