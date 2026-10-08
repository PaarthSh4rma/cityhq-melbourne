import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("cityhq-boot-seen", "yes"),
  );
  // Deterministic geographic fixture: automated tests do not load public tiles.
  await page.route("https://tiles.openfreemap.org/**", (route) =>
    route.fulfill({
      json: {
        version: 8,
        sources: {
          fixture: {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          },
        },
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#07111e" },
          },
        ],
      },
    }),
  );
});

test("overview, navigation, filters, operator and mobile", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "The city, in perspective." }),
  ).toBeVisible();
  await expect(page.getByText("DEMO SIGNALS INCLUDED")).toBeVisible();
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await page.screenshot({
    path: "test-results/overview-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Transit intelligence", exact: true })
    .click();
  await page.getByRole("button", { name: "tram", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "1 matching service notices" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ask Operator", exact: true }).click();
  await page
    .getByRole("button", { name: "Which sources are unavailable?" })
    .click();
  await expect(
    page.getByRole("button", { name: "Open relevant view" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close operator" }).click();
  for (const name of [
    "Weather intelligence",
    "Event intelligence",
    "Forecasting lab",
    "System diagnostics",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.locator("h1")).toBeVisible();
  }
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("h1")).toBeVisible();
  await page.screenshot({
    path: "test-results/overview-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("offline API has honest error state", async ({ page }) => {
  await page.route("**/api/v1/**", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "API connection issue",
  );
  await expect(
    page.locator(".source-pulse").getByText("API error").first(),
  ).toBeVisible();
});
test("overview accessibility", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("DEMO SIGNALS INCLUDED")).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("forecast controls and session conversation persist", async ({ page }) => {
  await page.goto("/#forecasting");
  await expect(
    page.getByRole("heading", { name: "Held-out evaluation" }),
  ).toBeVisible({ timeout: 30000 });
  await page.getByLabel("Prediction horizon").selectOption("3");
  await expect(page.getByText(/Recursive 3-hour forecast/)).toBeVisible();
  await page.getByLabel("Forecast model").selectOption("ridge");
  await expect(
    page.getByRole("img", { name: "Observed and forecast temperatures" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/forecasting-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Ask Operator", exact: true }).click();
  await page.getByLabel("Ask CityHQ", { exact: true }).fill("Weather outlook?");
  await page.getByLabel("Send question").click();
  await expect(
    page.getByRole("button", { name: "Open relevant view" }),
  ).toBeVisible();
  await page.getByLabel("Close operator").click();
  await page.getByRole("button", { name: "Ask Operator", exact: true }).click();
  await expect(
    page.getByText("Weather outlook?", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear conversation" }).click();
  await expect(page.getByText("Weather outlook?", { exact: true })).toHaveCount(
    0,
  );
});

test("map controls and provider-coordinate marker", async ({ page }) => {
  await page.route("**/api/v1/events", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    data.items[0].coordinates = [144.9631, -37.8136];
    data.items[0].precision = "Automated test coordinate fixture";
    await route.fulfill({ json: data });
  });
  await page.goto("/");
  await expect(page.locator(".maplibregl-marker")).toHaveCount(1);
  await page.locator(".maplibregl-marker").click();
  await expect(page.locator(".maplibregl-popup-content")).toContainText(
    "Automated test coordinate fixture",
  );
  await page.getByLabel("Events", { exact: true }).uncheck();
  await expect(page.locator(".maplibregl-marker")).toHaveCount(0);
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.getByRole("button", { name: "Recenter", exact: true }).click();
  await expect(page.getByText(/Some map tiles could not load/)).toHaveCount(0);
});

test("map provider failure is visible and retry recovers", async ({ page }) => {
  const failTiles = (route: import("@playwright/test").Route) => route.abort();
  await page.route("https://tiles.openfreemap.org/**", failTiles);
  await page.goto("/");
  await expect(page.getByText(/Some map tiles could not load/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Signals worth inspecting" }),
  ).toBeVisible();
  await page.unroute("https://tiles.openfreemap.org/**", failTiles);
  await page.getByRole("button", { name: "Retry map", exact: true }).click();
  await expect(page.getByText(/Some map tiles could not load/)).toHaveCount(0);
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
});

test("Operator map actions, historical replay, comparison and scenario reset", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Ask Operator", exact: true }).click();
  await page
    .getByRole("button", { name: "Show Melbourne Park", exact: true })
    .click();
  await expect(
    page.getByText(/Focusing the verified melbourne park camera preset/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Melbourne Park", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Close operator" }).click();
  await page.getByRole("tab", { name: "Time machine", exact: true }).click();
  const captures = page.getByLabel("Historical capture", { exact: true });
  await expect(captures.locator("option")).not.toHaveCount(1);
  await captures.selectOption({ index: 1 });
  await expect(page.locator(".historical-banner")).toContainText(
    "Stored context",
  );
  await expect(
    page.getByText("HISTORICAL CAPTURE MODE", { exact: true }),
  ).toBeVisible();
  await page
    .locator(".historical-banner")
    .getByRole("button", { name: "Return to current" })
    .click();
  await expect(page.locator(".historical-banner")).toHaveCount(0);
  await page.getByRole("tab", { name: "Scenario lab" }).click();
  await expect(
    page.getByText("Scenario simulation — not a real-world causal forecast", {
      exact: true,
    }),
  ).toBeVisible();
  const slider = page.getByLabel("Event listings scenario contribution");
  await slider.press("End");
  await expect(slider).toHaveValue("40");
  await page
    .getByRole("button", { name: "Validate scenario", exact: true })
    .click();
  await expect(page.getByText(/Server calculation:/)).toBeVisible();
  await page.getByLabel("Reset scenario").click();
  await expect(slider).toHaveValue("12");
  await page.getByRole("button", { name: "Open command palette" }).click();
  await page.getByLabel("Search commands").fill("Compare");
  await page.getByRole("button", { name: "Compare last six hours" }).click();
  await expect(page.getByText(/PREVIOUS VS CURRENT \/ 6 HOURS/)).toBeVisible();
});

test("command dialog restores focus, reduced effects and all responsive views", async ({
  page,
}) => {
  await page.goto("/");
  const commands = page.getByRole("button", { name: "Open command palette" });
  await commands.click();
  await expect(
    page.getByRole("dialog", { name: "Command palette" }),
  ).toBeVisible();
  await page.getByLabel("Search commands").press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Command palette" }),
  ).not.toBeVisible();
  await expect(commands).toBeFocused();
  await page
    .getByRole("button", { name: "Reduced effects", exact: true })
    .click();
  await expect(page.locator(".app-shell")).toHaveClass(/reduced-effects/);
  for (const width of [1920, 1440, 768, 390]) {
    await page.setViewportSize({ width, height: width < 800 ? 1000 : 1080 });
    for (const view of [
      "Overview",
      "Transit intelligence",
      "Weather intelligence",
      "Event intelligence",
      "Forecasting lab",
      "System diagnostics",
    ]) {
      await page.getByRole("button", { name: view, exact: true }).click();
      await expect(page.locator("h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
});
