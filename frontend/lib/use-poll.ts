"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { request } from "./api";
export function usePoll<T>(path: string, interval: number) {
  const [result, setResult] = useState<{
    path: string;
    data: T;
    lastSuccess: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const trigger = useRef<() => void>(() => {});
  useEffect(() => {
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
        const value = await request<T>(path, controller.signal);
        if (!disposed) {
          setResult({
            path,
            data: value,
            lastSuccess: new Date().toISOString(),
          });
          setError(null);
          failures = 0;
        }
      } catch {
        if (!disposed) {
          setError(
            "API connection failed. Last successful data, if any, is retained.",
          );
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
    data: result?.path === path ? result.data : null,
    error,
    loading,
    lastSuccess: result?.path === path ? result.lastSuccess : null,
    paused,
    refresh: useCallback(() => trigger.current(), []),
  };
}
