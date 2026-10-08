import type { History } from "./types";
type Point = History["items"][number];
const signature = (p: Point) =>
  JSON.stringify([
    p.methodology_version,
    Object.entries(p.provenance || {})
      .sort()
      .map(([name, m]) => [
        name,
        m.source,
        m.data_kind,
        m.city_id,
        m.origin_status,
        m.stale,
        m.status === "unavailable",
      ]),
  ]);
// Break the chart across missing hours or changed provenance. No values are filled.
export function gappedHistory(items: Point[]): Point[] {
  const result: Point[] = [];
  for (const point of items) {
    const previous = result.at(-1);
    if (
      previous &&
      (Date.parse(point.timestamp) - Date.parse(previous.timestamp) >
        3600000 * 1.1 ||
        signature(previous) !== signature(point))
    ) {
      result.push({
        ...point,
        timestamp: new Date(
          (Date.parse(point.timestamp) + Date.parse(previous.timestamp)) / 2,
        ).toISOString(),
        score: null,
        temperature: null,
        disruptions: null,
        events: null,
        us_aqi: null,
      });
    }
    result.push(point);
  }
  return result;
}
