import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("cityhq-boot-seen", "yes"),
  );
  await page.route("https://tiles.openfreemap.org/**", (route) =>
    route.fulfill({
      json: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#07090d" },
          },
        ],
      },
    }),
  );
});
for (const [width, height] of [
  [1920, 1080],
  [1440, 900],
  [1024, 768],
  [768, 1024],
  [430, 932],
  [390, 844],
  [320, 568],
]) {
  test(`Nocturne ${width}x${height}: two cities, every view and usable controls`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height });
    await page.goto("/");
    for (const city of ["Melbourne", "Delhi"]) {
      await page
        .getByRole("button", { name: `Select ${city}`, exact: true })
        .click();
      await expect(page.locator("main")).toHaveAttribute(
        "data-city",
        city.toLowerCase(),
      );
      await expect(
        page.getByRole("button", { name: "Open Operator", exact: true }),
      ).toBeInViewport({ ratio: 1 });
      for (const view of [
        "Overview",
        "Transit intelligence",
        "Weather intelligence",
        "Air quality intelligence",
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
        if (view === "Overview") {
          await expect(page.locator(".maplibregl-canvas")).toBeVisible();
          await expect(page.locator(".map-loading")).toBeHidden();
          await page.screenshot({
            path: `test-results/nocturne-${city.toLowerCase()}-${width}x${height}.png`,
            fullPage: true,
          });
        }
      }
      await page
        .getByRole("button", { name: "Open Operator", exact: true })
        .click();
      const input = page.getByLabel("Ask CityHQ", { exact: true });
      await expect(input).toBeVisible();
      await input.fill("Show air quality.");
      await page.getByLabel("Send question").click();
      await expect(page.locator("main")).toHaveAttribute(
        "data-view",
        "air-quality",
      );
      await page.getByLabel("Close operator").click();
      const settings = page.getByRole("button", {
        name: "Presentation settings",
        exact: true,
      });
      await settings.click();
      await expect(
        page.getByRole("dialog", { name: "Presentation settings" }),
      ).toBeVisible();
      await page.getByLabel("Enable spatial transition").press("Escape");
      await expect(settings).toBeFocused();
    }
    expect(errors).toEqual([]);
  });
}
test("source disclosure, discrete historical scrubber and keyboard tabs", async ({
  page,
}) => {
  await page.goto("/");
  const source = page.getByLabel("Inspect air quality provenance", {
    exact: true,
  });
  await source.click();
  await expect(page.locator(".source-disclosure[open]")).toContainText(
    "Data kind",
  );
  await source.press("Escape");
  await expect(page.locator(".source-disclosure[open]")).toHaveCount(0);
  await page.getByRole("tab", { name: "Signal analytics" }).press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Time machine", exact: true }),
  ).toBeFocused();
  const slider = page.getByRole("slider", {
    name: "Recorded capture scrubber",
  });
  await expect(slider).toBeEnabled();
  await page.getByLabel("Previous recorded capture").click();
  if (Number(await slider.getAttribute("max")) > 0) {
    await slider.press("End");
    await slider.press("Home");
    await expect(slider).toHaveValue("0");
  }
  await expect(page.locator(".historical-banner")).toBeVisible();
  await expect(page.locator(".capture-scrubber")).toContainText(
    "Discrete steps",
  );
  await page
    .getByRole("tab", { name: "Time machine", exact: true })
    .press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Scenario lab" })).toBeFocused();
});
test("presentation preference persists, OS reduced motion and AQ accessible summary", async ({
  page,
}) => {
  // The offline AQ adapter intentionally has no forecast. Supply an explicit
  // synthetic series here to exercise the chart without contacting a provider.
  await page.route("**/api/v1/air-quality?*", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    const start = new Date(data.metadata.observed_at).getTime();
    data.hourly = Array.from({ length: 6 }, (_, i) => ({
      timestamp: new Date(start + i * 3600000).toISOString(),
      us_aqi: i === 2 ? null : 40 + i,
      european_aqi: i === 2 ? null : 20 + i,
    }));
    await route.fulfill({ json: data });
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveClass(/reduced-effects/);
  await expect(page.locator(".spatial-transition")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Presentation settings", exact: true })
    .click();
  await page.getByLabel("Enable spatial transition").uncheck();
  await page.getByLabel("Enable spatial transition").press("Escape");
  await page.reload();
  await page
    .getByRole("button", { name: "Presentation settings", exact: true })
    .click();
  await expect(page.getByLabel("Enable spatial transition")).not.toBeChecked();
  await page.getByLabel("Enable spatial transition").press("Escape");
  await page
    .getByRole("button", { name: "Air quality intelligence", exact: true })
    .click();
  await expect(page.locator(".aq-forecast-chart")).toBeVisible();
  await expect(page.locator(".aq-forecast-chart")).toHaveAttribute(
    "aria-label",
    /US AQI/,
  );
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("verified camera modes, environmental layer and rapid city switching", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  for (const city of ["Delhi", "Melbourne", "Delhi"]) {
    await page
      .getByRole("button", { name: `Select ${city}`, exact: true })
      .click();
  }
  await expect(page.locator("main")).toHaveAttribute("data-city", "delhi");
  await expect(page.locator(".map-loading")).toBeHidden();
  await page
    .getByRole("button", { name: "Transport focus", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "New Delhi", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".map-coordinate")).toContainText("28.6435");
  await page
    .getByRole("button", { name: "Environmental focus", exact: true })
    .click();
  await expect(page.getByLabel("Air-quality", { exact: true })).toBeChecked();
  await expect(page.locator(".aq-map-overlay")).toContainText("demo fixture");
  await page.getByRole("button", { name: "Recenter", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Rajiv Chowk", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".map-coordinate")).toContainText("28.6327");
  await expect(page.locator(".spatial-transition")).toHaveCount(0);
});

test("200 percent text enlargement preserves reflow and keyboard entry", async ({
  page,
}) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.locator(".map-loading")).toBeHidden();
    // Simulate a user stylesheet enlarging text independently of geometry.
    await page.evaluate(() => {
      const values = [...document.querySelectorAll<HTMLElement>(".nocturne *")]
        .filter(
          (el) =>
            el instanceof HTMLElement &&
            ([...el.childNodes].some(
              (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
            ) ||
              el.matches("input,select,textarea")),
        )
        .map((el) => ({ el, size: parseFloat(getComputedStyle(el).fontSize) }));
      for (const { el, size } of values)
        el.style.setProperty("font-size", `${size * 2}px`, "important");
    });
    const geometry = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      outside: [
        ...document.querySelectorAll<HTMLElement>(
          ".topbar *,.page-heading *,.context-strip *",
        ),
      ]
        .filter((el) => el.getBoundingClientRect().right > innerWidth)
        .map((el) => ({
          tag: el.tagName,
          class: el.className,
          right: el.getBoundingClientRect().right,
        })),
    }));
    expect(
      geometry.scroll,
      JSON.stringify(geometry.outside),
    ).toBeLessThanOrEqual(geometry.width);
    expect(
      await page.locator(".sidebar nav button span").evaluateAll((labels) =>
        labels.every((label) => {
          const text = label.getBoundingClientRect(),
            target = label.closest("button")!.getBoundingClientRect();
          return text.left >= target.left && text.right <= target.right;
        }),
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Open Operator", exact: true })
      .click();
    await page
      .getByLabel("Ask CityHQ", { exact: true })
      .fill("Show air quality.");
    await page.getByLabel("Send question").press("Enter");
    await expect(page.locator("main")).toHaveAttribute(
      "data-view",
      "air-quality",
    );
    await page.getByLabel("Close operator").press("Escape");
    await page.screenshot({
      path: `test-results/nocturne-text-200-${width}.png`,
      fullPage: true,
    });
  }
});
