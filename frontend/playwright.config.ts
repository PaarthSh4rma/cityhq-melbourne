import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:3105",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    launchOptions: { args: ["--enable-unsafe-swiftshader"] },
  },
  webServer: [
    {
      command:
        "cd ../backend && CORS_ORIGINS=http://127.0.0.1:3105 WEATHER_ADAPTER=demo TRANSPORT_ADAPTER=demo EVENTS_ADAPTER=demo DATABASE_URL=sqlite:////tmp/cityhq-e2e.db venv/bin/alembic upgrade head && CORS_ORIGINS=http://127.0.0.1:3105 WEATHER_ADAPTER=demo TRANSPORT_ADAPTER=demo EVENTS_ADAPTER=demo DATABASE_URL=sqlite:////tmp/cityhq-e2e.db venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8105",
      url: "http://127.0.0.1:8105/health",
      reuseExistingServer: false,
    },
    {
      command:
        "NEXT_PUBLIC_API_URL=http://127.0.0.1:8105 npm run dev -- --hostname 127.0.0.1 --port 3105",
      url: "http://127.0.0.1:3105",
      reuseExistingServer: false,
    },
  ],
  timeout: 30000,
});
