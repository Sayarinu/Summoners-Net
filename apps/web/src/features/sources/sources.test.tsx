import { afterEach, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SourcesPage } from "./page";
import { RefreshButton } from "./refresh";
import { status, instant } from "../../../tests/fixtures";
afterEach(() => vi.unstubAllGlobals());
it("queues manual refresh and reports success or failure without pretending to fetch providers", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 202 }));
  vi.stubGlobal("fetch", fetcher);
  const view = render(<RefreshButton kind="matches" />);
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
  await screen.findByText(/Queued\. The local worker/);
  expect(fetcher).toHaveBeenCalledWith(
    "/api/refresh",
    expect.objectContaining({ body: JSON.stringify({ kind: "matches" }) }),
  );
  fetcher.mockResolvedValue(new Response("{}", { status: 503 }));
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
  await screen.findByText("Could not queue refresh. Try again.");
  view.rerender(<RefreshButton kind="history" year={2024} />);
  fetcher.mockRejectedValue(new Error());
  fireEvent.click(screen.getByRole("button", { name: "Queue 2024 import" }));
  await waitFor(() =>
    expect(fetcher).toHaveBeenLastCalledWith(
      "/api/refresh",
      expect.objectContaining({
        body: JSON.stringify({ kind: "history", year: 2024 }),
      }),
    ),
  );
});
it("shows data freshness, actual coverage and queued uploads", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 202 }));
  vi.stubGlobal("fetch", fetcher);
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const view = render(<SourcesPage status={status} timezone="UTC" year={2026} />);
  expect(screen.getByRole("table", { name: "Data freshness" })).toBeVisible();
  expect(screen.getAllByText("Needs attention")).toHaveLength(2);
  expect(screen.getByRole("link", { name: "2026" })).toHaveAttribute("href", "/history?year=2026");
  fireEvent.submit(screen.getByRole("button", { name: "Queue local import" }).closest("form")!);
  await screen.findByText(/Import queued/);
  expect(fetcher).toHaveBeenCalledWith("/api/import", expect.objectContaining({ method: "POST" }));
  fetcher.mockRejectedValue(new Error());
  fireEvent.submit(screen.getByRole("button", { name: "Queue local import" }).closest("form")!);
  await screen.findByText(/Import could not be queued/);
  fetcher.mockResolvedValue(new Response("{}", { status: 400 }));
  fireEvent.submit(screen.getByRole("button", { name: "Queue local import" }).closest("form")!);
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
  view.rerender(
    <SourcesPage status={{ ...status, cooldownUntil: instant }} timezone="UTC" year={2026} />,
  );
  expect(screen.getByText(/Refresh cooldown until/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Reload status" }));
  error.mockRestore();
});
it("reports linked profiles, cached images and failed image refreshes", () => {
  render(
    <SourcesPage
      status={status}
      year={2026}
      timezone="UTC"
      entities={{
        last: { at: "2026-03-01T00:00:00Z", links: 2, catalogTeams: 3, ambiguous: 1 },
        counts: [{ kind: "team", identities: 5, linked: 2, images: 3 }],
        images: { cached: 3, failed: 1 },
      }}
    />,
  );
  expect(screen.getByRole("table", { name: "Resolved library" })).toBeVisible();
  expect(screen.getByText(/1 ambiguous candidates/)).toBeVisible();
  expect(screen.getByText(/1 image downloads unavailable/)).toBeVisible();
  expect(screen.getByRole("button", { name: "Refresh identities & images" })).toBeVisible();
});
