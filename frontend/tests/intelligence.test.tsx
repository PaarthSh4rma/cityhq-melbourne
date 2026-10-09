import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import {
  CaptureScrubber,
  SourceBadge,
} from "../components/intelligence-primitives";
import type { Meta } from "../lib/types";
const times = ["2026-10-08T00:00:00Z", "2026-10-08T03:00:00Z"];
it("scrubs only distinct recorded captures without filling a three-hour gap", () => {
  const select = vi.fn();
  render(
    <CaptureScrubber
      captures={[
        { timestamp: times[1] },
        { timestamp: times[0] },
        { timestamp: times[0] },
      ]}
      at={null}
      onSelect={select}
    />,
  );
  const slider = screen.getByRole("slider");
  expect(slider).toHaveAttribute("max", "1");
  fireEvent.change(slider, { target: { value: "0" } });
  expect(select).toHaveBeenLastCalledWith(times[0]);
  fireEvent.click(screen.getByLabelText("Previous recorded capture"));
  expect(select).toHaveBeenLastCalledWith(times[1]);
  expect(screen.getByLabelText("Next recorded capture")).toBeDisabled();
});
it("bounds navigation at the oldest capture and handles empty history", () => {
  const { rerender } = render(
    <CaptureScrubber
      captures={times.map((timestamp) => ({ timestamp }))}
      at={times[0]}
      onSelect={vi.fn()}
    />,
  );
  expect(screen.getByLabelText("Previous recorded capture")).toBeDisabled();
  expect(screen.getByLabelText("Next recorded capture")).toBeEnabled();
  rerender(<CaptureScrubber captures={[]} at={null} onSelect={vi.fn()} />);
  expect(screen.getByRole("slider")).toBeDisabled();
  expect(screen.getByRole("slider")).toHaveAttribute(
    "aria-valuetext",
    "No recorded captures",
  );
});
it("does not invent source provenance while connecting", () => {
  render(<SourceBadge label="weather" />);
  expect(screen.getByLabelText("Inspect weather provenance")).toHaveTextContent(
    "connecting",
  );
  expect(screen.getByText("Awaiting source")).toBeInTheDocument();
});
it("prioritises staleness and closes provenance with Escape", () => {
  const meta = {
    status: "live",
    stale: true,
    source: "Fixture provider",
    data_kind: "modelled",
    age_seconds: 120,
    limitations: ["Area estimate only"],
  } as Meta;
  render(<SourceBadge meta={meta} label="air" />);
  const summary = screen.getByLabelText("Inspect air provenance");
  expect(summary).toHaveTextContent("stale");
  const details = summary.closest("details")!;
  details.open = true;
  fireEvent.keyDown(summary, { key: "Escape" });
  expect(details.open).toBe(false);
  expect(summary).toHaveFocus();
  expect(screen.getByText("Area estimate only")).toBeInTheDocument();
});
