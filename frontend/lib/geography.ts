import registry from "./cities.json";
import type { Place } from "./city-context";
// Default retained for callers outside a workspace. Runtime callers pass city presets.
export const PLACES = registry.melbourne.places as Place[];
export function placeForArea(area: string, places: Place[] = PLACES) {
  return places.find(
    (p) =>
      p.label.toLowerCase() === area.toLowerCase() ||
      p.id === area.toLowerCase(),
  );
}
