import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePoll } from "../lib/use-poll";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("typed polling", () => {
  it("retains last success when refresh fails", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ value: 18 }) })
      .mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() =>
      usePoll<{ value: number }>("/weather", 60000),
    );
    await waitFor(() => expect(result.current.data?.value).toBe(18));
    const stamp = result.current.lastSuccess;
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.error).toContain("failed"));
    expect(result.current.data?.value).toBe(18);
    expect(result.current.lastSuccess).toBe(stamp);
  });
  it("does not overlap requests and aborts on cleanup", async () => {
    let signal: AbortSignal | undefined;
    const fetch = vi.fn((_url, options) => {
      signal = options.signal;
      return new Promise(() => {});
    });
    vi.stubGlobal("fetch", fetch);
    const { result, unmount } = renderHook(() => usePoll("/weather", 60000));
    act(() => {
      result.current.refresh();
      result.current.refresh();
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    unmount();
    expect(signal?.aborted).toBe(true);
  });
  it("waits while hidden and resumes on visibility", async () => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    const fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetch);
    const { unmount } = renderHook(() => usePoll("/events", 1800000));
    expect(fetch).not.toHaveBeenCalled();
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    unmount();
  });
});
it("never labels a previous query result as a new model selection", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ model: "baseline" }),
    })
    .mockImplementation(() => new Promise(() => {}));
  vi.stubGlobal("fetch", fetch);
  const { result, rerender } = renderHook(
    ({ path }) => usePoll<{ model: string }>(path, 60000),
    { initialProps: { path: "/forecast?model=baseline" } },
  );
  await waitFor(() => expect(result.current.data?.model).toBe("baseline"));
  rerender({ path: "/forecast?model=ridge" });
  expect(result.current.data).toBeNull();
});
