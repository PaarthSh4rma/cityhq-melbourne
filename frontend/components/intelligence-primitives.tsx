"use client";
import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCity } from "@/lib/city-context";
import type { Meta } from "@/lib/types";

/** Original catalogue-point mark; no external visual assets or iconography. */
export function NocturneMark() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M3 11V3h8M21 3h8v8M29 21v8h-8M11 29H3v-8"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M16 7v18M7 16h18" stroke="currentColor" strokeOpacity=".35" />
      <rect x="12" y="12" width="8" height="8" stroke="currentColor" />
      <circle cx="16" cy="16" r="1.5" fill="currentColor" />
    </svg>
  );
}
export function SourceBadge({
  meta,
  label = "Source",
}: {
  meta?: Meta;
  label?: string;
}) {
  const { config, formatTime } = useCity();
  const status = meta?.stale ? "stale" : meta?.status || "connecting";
  return (
    <details
      className="source-disclosure"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.currentTarget.open = false;
          event.currentTarget.querySelector("summary")?.focus();
        }
      }}
    >
      <summary
        aria-label={`Inspect ${label} provenance`}
        className={`badge ${status}`}
      >
        <i aria-hidden="true" />
        {status}
        <span aria-hidden="true"> +</span>
      </summary>
      <div className="source-dossier">
        <span className="eyebrow">
          {config.name} / {label}
        </span>
        <strong>{meta?.source || "Awaiting source"}</strong>
        <dl>
          <div>
            <dt>Data kind</dt>
            <dd>{meta?.data_kind || "unknown"}</dd>
          </div>
          <div>
            <dt>Sample</dt>
            <dd>{formatTime(meta?.observed_at)}</dd>
          </div>
          <div>
            <dt>Retrieved</dt>
            <dd>{formatTime(meta?.fetched_at)}</dd>
          </div>
          <div>
            <dt>Source age</dt>
            <dd>
              {meta?.age_seconds == null
                ? "Unknown"
                : `${Math.round(meta.age_seconds / 60)} min`}
            </dd>
          </div>
        </dl>
        {meta?.error && <p className="warning">{meta.error}</p>}
        {meta?.limitations?.map((l) => (
          <p key={l}>{l}</p>
        ))}
        <p>{meta?.attribution}</p>
      </div>
    </details>
  );
}
export function CaptureScrubber({
  captures,
  at,
  onSelect,
}: {
  captures: { timestamp: string }[];
  at: string | null;
  onSelect: (value: string | null) => void;
}) {
  const { config, formatTime } = useCity();
  const times = useMemo(
    () => [...new Set(captures.map((c) => c.timestamp))].sort(),
    [captures],
  );
  const index = at ? times.findLastIndex((t) => t <= at) : times.length - 1;
  return (
    <section
      className="capture-scrubber"
      aria-label="Recorded capture timeline"
    >
      <div className="scrubber-readout">
        <span className="eyebrow">{config.name} / CAPTURE INDEX</span>
        <strong>{at ? formatTime(at) : "CURRENT CONTEXT"}</strong>
      </div>
      <div className="scrubber-controls">
        <button
          aria-label="Previous recorded capture"
          disabled={!times.length || (at !== null && index <= 0)}
          onClick={() => onSelect(times[at ? index - 1 : times.length - 1])}
        >
          <ChevronLeft size={18} />
        </button>
        <input
          aria-label="Recorded capture scrubber"
          type="range"
          min={0}
          max={Math.max(0, times.length - 1)}
          value={Math.max(0, index)}
          disabled={!times.length}
          aria-valuetext={
            times.length
              ? formatTime(times[Math.max(0, index)])
              : "No recorded captures"
          }
          onChange={(e) => onSelect(times[Number(e.target.value)])}
        />
        <button
          aria-label="Next recorded capture"
          disabled={!at || index >= times.length - 1}
          onClick={() => onSelect(times[index + 1])}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="scrubber-bounds">
        <span>{times.length ? formatTime(times[0]) : "No history yet"}</span>
        <span>{times.length ? formatTime(times.at(-1)) : "—"}</span>
      </div>
      <p className="caption">
        {times.length} distinct stored capture times. Discrete steps; gaps are
        not interpolated. The basemap remains geographic context.
      </p>
    </section>
  );
}
