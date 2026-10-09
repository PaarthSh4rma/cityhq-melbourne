import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import Operator from "../components/operator";
afterEach(() => vi.unstubAllGlobals());
it("shows grounded response, navigation and reset", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        answer: "Demo weather: 18°C",
        navigation: "weather",
        references: [{ source: "demo", status: "demo" }],
      }),
    }),
  );
  const navigate = vi.fn();
  render(<Operator navigate={navigate} onClose={() => {}} />);
  expect(screen.getByLabelText("Ask CityHQ")).toHaveFocus();
  fireEvent.change(screen.getByLabelText("Ask CityHQ"), {
    target: { value: "Weather?" },
  });
  fireEvent.click(screen.getByLabelText("Send question"));
  expect(await screen.findByText("Demo weather: 18°C")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Open relevant view →"));
  expect(navigate).toHaveBeenCalledWith("weather");
  fireEvent.click(screen.getByText("Clear conversation"));
  expect(screen.queryByText("Demo weather: 18°C")).not.toBeInTheDocument();
});
it("shows API failures without invented answers", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  render(<Operator navigate={() => {}} onClose={() => {}} />);
  fireEvent.click(screen.getByText("Which sources are unavailable?"));
  await waitFor(() =>
    expect(screen.getByText(/Unable to reach CityHQ/)).toBeInTheDocument(),
  );
});
