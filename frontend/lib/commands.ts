import type { View } from "./types";
export const VIEWS: View[] = [
  "overview",
  "transit",
  "weather",
  "events",
  "forecasting",
  "diagnostics",
];
export const LOCATIONS = [
  "cbd",
  "flinders",
  "southern-cross",
  "melbourne-park",
  "docklands",
  "southbank",
  "st-kilda",
] as const;
export const LAYERS = [
  "events",
  "transit",
  "weather",
  "alerts",
  "boundaries",
] as const;
export type Location = (typeof LOCATIONS)[number];
export type Layer = (typeof LAYERS)[number];
export type Layers = Record<Layer, boolean>;
export const DEFAULT_LAYERS: Layers = {
  events: true,
  transit: true,
  weather: false,
  alerts: false,
  boundaries: false,
};
export type Action =
  | { type: "navigate_dashboard"; view: View }
  | { type: "focus_map_location"; location: Location }
  | { type: "toggle_map_layer"; layer: Layer; enabled: boolean }
  | { type: "select_time_range"; hours: 6 | 24 | 168 | 720 };
// Reject unknown fields as well as values. Never interpret generated text as an action.
export function validateAction(value: unknown): Action | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const a = value as Record<string, unknown>;
  const keys = Object.keys(a).sort().join(",");
  if (
    a.type === "navigate_dashboard" &&
    keys === "type,view" &&
    VIEWS.includes(a.view as View)
  )
    return a as Action;
  if (
    a.type === "focus_map_location" &&
    keys === "location,type" &&
    LOCATIONS.includes(a.location as Location)
  )
    return a as Action;
  if (
    a.type === "toggle_map_layer" &&
    keys === "enabled,layer,type" &&
    LAYERS.includes(a.layer as Layer) &&
    typeof a.enabled === "boolean"
  )
    return a as Action;
  if (
    a.type === "select_time_range" &&
    keys === "hours,type" &&
    [6, 24, 168, 720].includes(a.hours as number)
  )
    return a as Action;
  return null;
}
