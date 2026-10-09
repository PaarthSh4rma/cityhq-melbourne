"use client";
import { useEffect, useRef, useState } from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { useCity } from "@/lib/city-context";
import { request } from "@/lib/api";
import type { Activity, Forecast } from "@/lib/types";
export function ScenarioLab({ activity }: { activity: Activity | null }) {
  const { scope, city } = useCity();
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{
      after: number;
      label: string;
      before: Activity;
    } | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const current = useRef<AbortController | null>(null);
  useEffect(() => () => current.current?.abort(), []);
  const controls = [
    { key: "events", name: "Event listings", max: 40 },
    {
      key: "transport",
      name: "Service notices",
      max: city === "delhi" ? 0 : 25,
    },
    { key: "weather", name: "Weather suitability", max: 15 },
  ];
  const values = Object.fromEntries(
    controls.map((c) => [
      c.key,
      overrides[c.key] ??
        activity?.components.find((v) => v.name === c.name)?.contribution ??
        0,
    ]),
  );
  const time =
    activity?.components.find((c) => c.name === "Time context")?.contribution ??
    0;
  const after =
    Math.round((time + Object.values(values).reduce((a, b) => a + b, 0)) * 10) /
    10;
  async function validate() {
    current.current?.abort();
    const abort = new AbortController();
    current.current = abort;
    setBusy(true);
    setError("");
    const timer = setTimeout(() => abort.abort(), 30000);
    try {
      const reply = await request<{
        after: number;
        label: string;
        before: Activity;
      }>(scope("/scenario"), abort.signal, values);
      if (current.current === abort && !abort.signal.aborted) setResult(reply);
    } catch {
      if (!abort.signal.aborted)
        setError(
          "Server validation unavailable. The preview remains a local deterministic calculation.",
        );
    } finally {
      clearTimeout(timer);
      if (current.current === abort) setBusy(false);
    }
  }
  return (
    <section className="scenario-lab">
      <div className="panel-heading">
        <div>
          <span className="eyebrow violet-text">
            <SlidersHorizontal size={14} /> COUNTERFACTUAL WORKSPACE
          </span>
          <h2>Change the inputs. Inspect the index.</h2>
        </div>
        <button
          onClick={() => {
            current.current?.abort();
            current.current = null;
            setBusy(false);
            setOverrides({});
            setResult(null);
            setError("");
          }}
          aria-label="Reset scenario"
        >
          <RotateCcw size={16} />
        </button>
      </div>
      <p className="scenario-label">
        Scenario simulation — not a real-world causal forecast
      </p>
      <p className="caption">
        {city === "delhi" ? "Delhi" : "Melbourne"} · hypothetical contributions
        are isolated from source records. Missing measurements remain missing.
      </p>
      <div className="scenario-grid">
        <div>
          {controls.map((c) => (
            <label className="scenario-control" key={c.key}>
              <span>
                {c.name}
                <strong>
                  {values[c.key].toFixed(2)} / {c.max}
                </strong>
              </span>
              <input
                aria-label={`${c.name} scenario contribution`}
                type="range"
                min={0}
                max={c.max}
                step={0.01}
                value={values[c.key]}
                onChange={(e) => {
                  current.current?.abort();
                  current.current = null;
                  setBusy(false);
                  setError("");
                  setOverrides((v) => ({
                    ...v,
                    [c.key]: Number(e.target.value),
                  }));
                  setResult(null);
                }}
              />
            </label>
          ))}
        </div>
        <div className="scenario-score">
          <span>REFERENCE SOURCE INDEX</span>
          <strong>
            {activity?.score ?? "—"}
            <small>
              {" "}
              / {activity?.maximum || (city === "delhi" ? 75 : 100)}
            </small>
          </strong>
          <span>SIMULATED INDEX</span>
          <strong className="violet-text">
            {after}
            <small>
              {" "}
              / {activity?.maximum || (city === "delhi" ? 75 : 100)}
            </small>
          </strong>
          <p>
            Time context held at {time}. Manual contributions. No observations
            are written.
          </p>
          <button disabled={!activity || busy} onClick={() => void validate()}>
            {busy ? "Validating…" : "Validate scenario"}
          </button>
          {result && (
            <p role="status">
              Server calculation: {result.after}. Current source index at
              validation: {result.before.score ?? "unavailable"}.
            </p>
          )}
          {error && <p role="status">{error}</p>}
        </div>
      </div>
    </section>
  );
}
export function ResidualDiagnostics({
  forecast,
}: {
  forecast: Forecast | null;
}) {
  const residuals = forecast?.metadata?.residuals;
  if (!residuals?.histogram)
    return (
      <p className="caption">
        Residual distribution requires a model artifact generated by the current
        training pipeline.
      </p>
    );
  const max = Math.max(1, ...residuals.histogram.map((b) => b.count));
  return (
    <section className="panel spaced">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">HELD-OUT ERRORS · SELECTED MODEL</span>
          <h2>Where the model misses</h2>
        </div>
        <span className="badge">{forecast?.metadata?.mode}</span>
      </div>
      <p className="muted">
        Actual − predicted temperature. Test set only; these bins are not
        calibrated prediction intervals.
      </p>
      <div
        className="residual-histogram"
        role="img"
        aria-label="Test residual distribution"
      >
        {residuals.histogram.map((b, i) => (
          <div
            key={i}
            title={`${b.low.toFixed(2)} to ${b.high.toFixed(2)}°C: ${b.count} observations`}
          >
            <span style={{ height: `${(b.count / max) * 100}%` }} />
            <small>{b.low.toFixed(1)}</small>
          </div>
        ))}
      </div>
      <details>
        <summary>Inspect exact bins and sampled errors</summary>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Error range °C</th>
                <th>Test observations</th>
              </tr>
            </thead>
            <tbody>
              {residuals.histogram.map((b, i) => (
                <tr key={i}>
                  <td>
                    {b.low.toFixed(2)} to {b.high.toFixed(2)}
                  </td>
                  <td>{b.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="error-timeline">
          {residuals.timeline?.map((p) => (
            <span
              key={p.timestamp}
              title={`${p.timestamp}: ${p.error.toFixed(2)}°C`}
              style={{
                background: p.error < 0 ? "#8ccbeb" : "#c9a36b",
                height: `${Math.min(100, 12 + Math.abs(p.error) * 25)}%`,
              }}
            />
          ))}
        </div>
        <p className="caption">
          Chronological test residual samples; full test distribution above.
        </p>
      </details>
    </section>
  );
}
