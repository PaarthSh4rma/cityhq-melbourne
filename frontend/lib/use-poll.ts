"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { request } from "./api";
import { useCity } from "./city-context";
export function usePoll<T>(inputPath: string | null, interval: number) {
  const { scope } = useCity();
  const path = inputPath ? scope(inputPath) : null;
  const [result, setResult] = useState<{
    path: string;
    data: T;
    lastSuccess: string;
  } | null>(null);
  const [error, setError] = useState<{ path: string; message: string } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const trigger = useRef<() => void>(() => {});
  useEffect(() => {
    if (!path) {
      trigger.current = () => {};
      return;
    }
    const activePath = path;
    let disposed = false,
      running = false,
      failures = 0;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | null = null;
    async function run() {
      clearTimeout(timer);
      if (disposed || running || document.hidden) return;
      running = true;
      setLoading(true);
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 30000);
      try {
        const value = await request<T>(activePath, controller.signal);
        if (!disposed) {
          setResult({
            path: activePath,
            data: value,
            lastSuccess: new Date().toISOString(),
          });
          setError(null);
          failures = 0;
        }
      } catch {
        if (!disposed) {
          setError({
            path: activePath,
            message:
              "API connection failed. Last successful data, if any, is retained.",
          });
          failures++;
        }
      } finally {
        clearTimeout(timeout);
        running = false;
        if (!disposed) {
          setLoading(false);
          timer = setTimeout(
            run,
            failures
              ? Math.min(interval, 5000 * 2 ** Math.min(failures, 5))
              : interval,
          );
        }
      }
    }
    const visibility = () => {
      setPaused(document.hidden);
      if (document.hidden) {
        clearTimeout(timer);
      } else {
        void run();
      }
    };
    trigger.current = () => void run();
    document.addEventListener("visibilitychange", visibility);
    void run();
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [path, interval]);
  return {
    data: path && result?.path === path ? result.data : null,
    error: error?.path === path ? error.message : null,
    loading: !!path && loading,
    lastSuccess: result?.path === path ? result.lastSuccess : null,
    paused,
    refresh: useCallback(() => trigger.current(), []),
  };
}
