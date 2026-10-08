import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { it, expect, vi, afterEach } from "vitest";
import { CityContext, cityValue, type CityId } from "../lib/city-context";
import { usePoll } from "../lib/use-poll";
import { validateAction } from "../lib/commands";
afterEach(() => vi.unstubAllGlobals());
it("scopes requests and never carries data between city providers", async () => {
  const calls: string[] = [];
  let completeOld: (value: unknown) => void = () => {};
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      calls.push(url);
      if (url.includes("city=melbourne"))
        return new Promise((resolve) => {
          completeOld = resolve;
        });
      return Promise.resolve({
        ok: true,
        json: async () => ({ city: "delhi" }),
      });
    }),
  );
  let selected: CityId = "melbourne";
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <CityContext.Provider value={cityValue(selected)}>
      {children}
    </CityContext.Provider>
  );
  const { result, rerender } = renderHook(
    () => usePoll<{ city: string }>("/weather?fixture=city-boundary", 60000),
    { wrapper },
  );
  await waitFor(() => expect(calls).toHaveLength(1));
  selected = "delhi";
  rerender();
  await waitFor(() => expect(result.current.data?.city).toBe("delhi"));
  await act(async () =>
    completeOld({ ok: true, json: async () => ({ city: "melbourne" }) }),
  );
  expect(result.current.data?.city).toBe("delhi");
  expect(calls).toEqual(
    expect.arrayContaining([
      expect.stringContaining("&city=melbourne"),
      expect.stringContaining("&city=delhi"),
    ]),
  );
});
it("allows only supported city and metric actions", () => {
  expect(validateAction({ type: "switch_city", city: "delhi" })).toEqual({
    type: "switch_city",
    city: "delhi",
  });
  expect(validateAction({ type: "switch_city", city: "sydney" })).toBeNull();
  expect(
    validateAction({
      type: "switch_city",
      city: "delhi",
      url: "https://example.test",
    }),
  ).toBeNull();
  expect(
    validateAction({ type: "compare_city_metric", metric: "us_aqi" }),
  ).not.toBeNull();
  expect(
    validateAction({ type: "compare_city_metric", metric: "congestion" }),
  ).toBeNull();
  expect(cityValue("delhi").scope("/history?hours=6")).toBe(
    "/history?hours=6&city=delhi",
  );
  expect(cityValue("delhi").config.timezone).toBe("Asia/Kolkata");
});
