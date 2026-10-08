export type Meta = {
  city_id?: "melbourne" | "delhi";
  provider?: string;
  data_kind?: string;
  geographic_precision?: string;
  units?: Record<string, string>;
  last_attempt_at?: string | null;
  latency_ms?: number | null;
  cache_age_seconds?: number | null;
  error_code?: string | null;
  authentication?: string;
  rate_limit?: string | null;
  attribution?: string | null;
  source: string;
  status: "live" | "cached" | "demo" | "stale" | "unavailable";
  origin_status: string;
  observed_at: string | null;
  fetched_at: string | null;
  age_seconds: number | null;
  stale: boolean;
  ttl_seconds: number;
  limitations: string[];
  error: string | null;
};
export type Item = {
  id?: string;
  url?: string;
  start_at?: string;
  end_at?: string;
  disruption_type?: string;
  publication_status?: string;
  title: string;
  area: string;
  mode?: string;
  severity?: string;
  routes: string[];
  description?: string;
  venue?: string;
  category?: string;
  date?: string;
  time?: string;
  coordinates?: [number, number];
  precision?: string;
};
export type Weather = {
  metadata: Meta;
  apparent_temperature?: number | null;
  precipitation?: number | null;
  wind_direction?: number | null;
  hourly?: {
    timestamp: string;
    temperature: number | null;
    rain_probability: number | null;
  }[];
  temperature: number | null;
  condition: string | null;
  description: string | null;
  wind_speed: number | null;
  humidity: number | null;
  forecast: { date: string; minimum: number; maximum: number }[];
};
export type Transit = {
  network?: MetroNetwork | null;
  operational_status_available?: boolean;
  metadata: Meta;
  status: string;
  disruption_count: number;
  minor_delays: number;
  major_disruptions: number | null;
  items: Item[];
};
export type Events = { metadata: Meta; event_count: number; items: Item[] };
export type Activity = {
  city_id?: string;
  maximum?: number;
  environmental_risk?: {
    standard: string;
    value: number | null;
    data_kind: string;
  } | null;
  score: number | null;
  category: string;
  coverage: number;
  demo: boolean;
  components: {
    name: string;
    contribution: number;
    maximum: number;
    explanation: string;
  }[];
  main_drivers: string[];
  methodology_version: string;
  input_freshness: Record<string, Meta>;
  limitations: string[];
};
export type History = {
  items: {
    timestamp: string;
    methodology_version?: string;
    score: number | null;
    temperature: number | null;
    us_aqi?: number | null;
    disruptions: number | null;
    events: number | null;
    provenance: Record<string, Meta>;
  }[];
  aggregation: string;
  limitations: string[];
};
export type Forecast = {
  available: boolean;
  reason?: string;
  model: string;
  horizon: number;
  predictions: { timestamp: string; temperature: number }[];
  observed: { timestamp: string; temperature: number }[];
  explanation: string;
  metadata?: {
    mode: string;
    version: string;
    target: string;
    selected_model: string;
    dataset_sha256?: string;
    seed?: number;
    selection?: string;
    rows: number;
    metrics: Record<
      string,
      {
        validation: { mae: number; rmse: number };
        test: { mae: number; rmse: number };
      }
    >;
    feature_importance: Record<string, number>;
    importance_note: string;
    residuals: {
      mean: number;
      std: number;
      p05: number;
      p95: number;
      histogram?: { low: number; high: number; count: number }[];
      timeline?: { timestamp: string; error: number }[];
    };
    limitations: string[];
    splits: Record<string, { rows: number; start: string; end: string }>;
  };
};
export type Diagnostics = {
  api: string;
  sources: Record<string, Meta>;
  coverage: Record<
    string,
    { count: number; first: string | null; last: string | null }
  >;
  ingestion_runs: { timestamp: string; source: string; status: string }[];
  model_version: string | null;
};
export type Reply = {
  answer: string;
  intent: string;
  navigation: string;
  references: Meta[];
  tool_calls: { tool: string }[];
  actions?: unknown[];
  supporting_data?: Record<string, unknown>;
};
export type View =
  | "overview"
  | "transit"
  | "weather"
  | "air-quality"
  | "events"
  | "forecasting"
  | "diagnostics";

export type Timeline = {
  at: string;
  signals: {
    weather: Weather;
    air_quality?: AirQuality;
    transport: Transit;
    events: Events;
  };
  activity: Activity;
  captures: Record<string, { timestamp: string; age_seconds: number } | null>;
  gaps: string[];
  limitations: string[];
};
export type Comparison = {
  previous: Period;
  current: Period;
  limitations: string[];
};
export type Period = {
  start: string;
  end: string;
  stored_hours: number;
  expected_hours: number;
  groups: {
    provenance: string;
    usable_hours: number;
    mean_score: number | null;
  }[];
};

export type AirQuality = {
  metadata: Meta;
  pm2_5: number | null;
  pm10: number | null;
  nitrogen_dioxide: number | null;
  ozone: number | null;
  us_aqi: number | null;
  european_aqi: number | null;
  hourly: {
    timestamp: string;
    pm2_5: number | null;
    us_aqi: number | null;
    european_aqi: number | null;
  }[];
  standards: Record<string, string>;
};
export type MetroNetwork = {
  type: "FeatureCollection";
  features: import("geojson").Feature[];
  stations: {
    id: string;
    name: string;
    coordinates: [number, number];
    source: string;
  }[];
  lines: { id: string; name: string; colour: string; source: string }[];
  as_of: string;
  attribution: string;
  limitations: string[];
};
export type AirComparison = {
  standard: string;
  comparable: boolean;
  higher_city: string | null;
  difference: number | null;
  items: Record<
    string,
    {
      city_id: string;
      value: number | null;
      pm2_5: number | null;
      metadata: Meta;
    }
  >;
  limitations: string[];
};
