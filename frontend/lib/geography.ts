import type { Location } from "./commands";
// OSM Nominatim records verified 2026-10-08. Camera targets are geographic context,
// not signal locations. CBD uses the Melbourne suburb label point, not a CBD boundary.
export const PLACES: {
  id: Location;
  label: string;
  center: [number, number];
  zoom: number;
  source: string;
  bounds?: [number, number, number, number];
}[] = [
  {
    id: "cbd",
    label: "CBD",
    center: [144.9655616, -37.8141705],
    zoom: 15.2,
    source: "https://www.openstreetmap.org/relation/2383266",
  },
  {
    id: "flinders",
    label: "Flinders Street",
    center: [144.9664779, -37.8184161],
    zoom: 16.1,
    source: "https://www.openstreetmap.org/node/4936370201",
  },
  {
    id: "southern-cross",
    label: "Southern Cross",
    center: [144.9525, -37.8183333333],
    zoom: 16,
    source: "https://www.wikidata.org/wiki/Q801455",
  },
  {
    id: "melbourne-park",
    label: "Melbourne Park",
    center: [144.9790884, -37.8213608],
    zoom: 15.3,
    source: "https://www.openstreetmap.org/way/220550128",
    bounds: [144.9759596, -37.8242045, 144.9867639, -37.8184481],
  },
  {
    id: "docklands",
    label: "Docklands",
    center: [144.9394923, -37.8175423],
    zoom: 14.3,
    source: "https://www.openstreetmap.org/relation/2397613",
    bounds: [144.9311288, -37.827023, 144.9559906, -37.8096133],
  },
  {
    id: "southbank",
    label: "Southbank",
    center: [144.9640203, -37.8253618],
    zoom: 15,
    source: "https://www.openstreetmap.org/relation/2395850",
    bounds: [144.946909, -37.831482, 144.971423, -37.819245],
  },
  {
    id: "st-kilda",
    label: "St Kilda",
    center: [144.981637, -37.8638261],
    zoom: 14.1,
    source: "https://www.openstreetmap.org/relation/2397474",
    bounds: [144.970653, -37.876291, 144.993262, -37.852189],
  },
];
export function placeForArea(area: string) {
  return PLACES.find(
    (p) =>
      p.label.toLowerCase() === area.toLowerCase() ||
      p.id === area.toLowerCase(),
  );
}
