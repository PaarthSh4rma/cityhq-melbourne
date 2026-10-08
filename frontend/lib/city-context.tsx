"use client";
import { createContext, useContext } from "react";
import registry from "./cities.json";
import type { Reply } from "./types";
import type { Action, Location } from "./commands";
export type InitialMessage = {
  question: string;
  reply: Reply;
  actions: Action[];
};
export type CityId = "melbourne" | "delhi";
export type Place = {
  id: Location;
  label: string;
  center: [number, number];
  zoom: number;
  source: string;
  bounds?: [number, number, number, number];
};
export function cityValue(city: CityId) {
  const config = registry[city];
  return {
    city,
    config,
    places: config.places as Place[],
    formatTime: (value?: string | null) =>
      value
        ? new Date(value).toLocaleString("en-AU", {
            timeZone: config.timezone,
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "Timestamp not supplied",
    scope: (path: string) =>
      `${path}${path.includes("?") ? "&" : "?"}city=${city}`,
    initialMessage: undefined as InitialMessage | undefined,
    switchCity: (
      _city: CityId,
      _actions: Action[] = [],
      _message?: InitialMessage,
    ) => {
      void _city;
      void _actions;
      void _message;
    },
  };
}
const defaultValue = cityValue("melbourne");
// Standalone test components retain their original request contract; the app always provides a city.
export const CityContext = createContext({
  ...defaultValue,
  scope: (path: string) => path,
});
export const useCity = () => useContext(CityContext);
