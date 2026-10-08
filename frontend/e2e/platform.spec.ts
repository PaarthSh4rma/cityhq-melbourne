import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.beforeEach(async ({ page }) => {
  // Automated tests must not load public OSM tiles.
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
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
  await expect(page.getByText("API error").first()).toBeVisible();
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
