export const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
export async function request<T>(
  path: string,
  signal?: AbortSignal,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${API}/api/v1${path}`, {
    signal,
    ...(body
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
