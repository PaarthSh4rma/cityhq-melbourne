export const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
type Flight = {
  controller: AbortController;
  promise: Promise<unknown>;
  users: number;
};
const flights = new Map<string, Flight>();
async function fetchJSON(path: string, signal?: AbortSignal, body?: unknown) {
  const response = await fetch(`${API}/api/v1${path}`, {
    signal,
    ...(body !== undefined
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  if (!response.ok)
    throw new Error(`CityHQ request failed (${response.status})`);
  return response.json();
}
export function request<T>(
  path: string,
  signal?: AbortSignal,
  body?: unknown,
): Promise<T> {
  if (body !== undefined) return fetchJSON(path, signal, body);
  if (signal?.aborted)
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  let flight = flights.get(path);
  if (!flight || flight.controller.signal.aborted) {
    const controller = new AbortController();
    const next: Flight = { controller, users: 0, promise: Promise.resolve() };
    next.promise = fetchJSON(path, controller.signal).finally(() => {
      if (flights.get(path) === next) flights.delete(path);
    });
    flight = next;
    flights.set(path, next);
  }
  const shared = flight;
  shared.users++;
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const release = () => {
      if (settled) return false;
      settled = true;
      shared.users--;
      signal?.removeEventListener("abort", abort);
      return true;
    };
    const abort = () => {
      if (release()) {
        if (shared.users === 0) shared.controller.abort();
        reject(new DOMException("Aborted", "AbortError"));
      }
    };
    signal?.addEventListener("abort", abort, { once: true });
    shared.promise.then(
      (value) => {
        if (release()) resolve(value as T);
      },
      (error) => {
        if (release()) reject(error);
      },
    );
  });
}
export function melbourneTime(value: string | null | undefined) {
  return value
    ? new Date(value).toLocaleString("en-AU", {
        timeZone: "Australia/Melbourne",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Timestamp not supplied";
}
