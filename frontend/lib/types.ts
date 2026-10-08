export type Meta = {
  source: string;
  status: "live" | "cached" | "demo" | "unavailable";
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
  temperature: number | null;
  condition: string | null;
  description: string | null;
  wind_speed: number | null;
  humidity: number | null;
  forecast: { date: string; minimum: number; maximum: number }[];
};
export type Transit = {
  metadata: Meta;
  status: string;
  disruption_count: number;
  minor_delays: number;
  major_disruptions: number;
  items: Item[];
};
export type Events = { metadata: Meta; event_count: number; items: Item[] };
export type Activity = {
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
    score: number | null;
    temperature: number | null;
    disruptions: number;
    events: number;
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
    residuals: { mean: number; std: number; p05: number; p95: number };
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
};
export type View =
  "overview" | "transit" | "weather" | "events" | "forecasting" | "diagnostics";
