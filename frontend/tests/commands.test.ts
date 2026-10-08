import { expect, it, vi, afterEach } from "vitest";
import { validateAction } from "../lib/commands";
import { request } from "../lib/api";
afterEach(() => vi.unstubAllGlobals());
it("rejects unknown commands, URLs, extra fields and non-catalogue locations", () => {
  expect(
    validateAction({ type: "focus_map_location", location: "melbourne-park" }),
  ).toEqual({ type: "focus_map_location", location: "melbourne-park" });
  for (const value of [
    { type: "eval", code: "alert(1)" },
    { type: "navigate_dashboard", view: "https://example.com" },
    { type: "focus_map_location", location: "cbd", script: "bad" },
    { type: "focus_map_location", location: "invented-place" },
    { type: "toggle_map_layer", layer: "events", enabled: "true" },
    { type: "select_time_range", hours: 10000 },
  ])
    expect(validateAction(value)).toBeNull();
});
it("deduplicates simultaneous GET requests while keeping subscriber cancellation independent", async () => {
  let finish!: (value: unknown) => void;
  const fetch = vi.fn(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  vi.stubGlobal("fetch", fetch);
  const a = new AbortController(),
    b = new AbortController();
  const first = request("/dedup-test", a.signal),
    second = request("/dedup-test", b.signal);
  const rejected = expect(first).rejects.toMatchObject({ name: "AbortError" });
  a.abort();
  await rejected;
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0]).toBeDefined();
  finish({ ok: true, json: async () => ({ value: 42 }) });
  await expect(second).resolves.toEqual({ value: 42 });
});

it("breaks historical lines at missing hours without inventing observations", async () => {
  const { gappedHistory } = await import("../lib/history");
  const points = [
    {
      timestamp: "2026-01-01T00:00:00Z",
      score: 10,
      temperature: 20,
      disruptions: 1,
      events: 1,
      provenance: {},
    },
    {
      timestamp: "2026-01-01T03:00:00Z",
      score: 20,
      temperature: 22,
      disruptions: 2,
      events: 2,
      provenance: {},
    },
  ];
  const result = gappedHistory(points);
  expect(result).toHaveLength(3);
  expect(result[1].score).toBeNull();
  expect(result.filter((r) => r.score !== null)).toEqual(points);
});
