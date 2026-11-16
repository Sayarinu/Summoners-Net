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
it("shows the Riot key state, last check and development key expiry without contacting Riot", () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const view = render(<SourcesPage status={status} timezone="UTC" year={2026} />);
  const section = () => screen.getByRole("region", { name: "Riot API key" });
  expect(section()).toHaveTextContent("Not configured");
  expect(section()).toHaveTextContent("Riot jobs are skipped until a key is set");
  const riot = (riotKey: Partial<typeof status.riotKey>) =>
    view.rerender(
      <SourcesPage
        status={{ ...status, riotKey: { ...status.riotKey, detail: null, ...riotKey } }}
        timezone="UTC"
        year={2026}
      />,
    );
  riot({
    state: "untested",
    kind: "development",
    setAt: "2026-03-01T10:00:00.000Z",
    expiresAt: "2026-03-02T10:00:00.000Z",
  });
  expect(section()).toHaveTextContent("Untested");
  expect(section()).toHaveTextContent("Not checked yet");
  expect(section()).toHaveTextContent(/expire after 24 hours.*by/);
  riot({ state: "valid", kind: "production", checkedAt: "2026-03-01T11:00:00.000Z" });
  expect(section()).toHaveTextContent("Valid");
  expect(section()).toHaveTextContent("Last checked");
  expect(section()).not.toHaveTextContent("expire");
  riot({
    state: "rejected",
    kind: "development",
    checkedAt: "2026-03-02T11:00:00.000Z",
    detail: "Riot rejected the key (HTTP 401).",
  });
  expect(section()).toHaveTextContent("Rejected");
  expect(section()).toHaveTextContent("Riot rejected the key (HTTP 401).");
  expect(fetcher).not.toHaveBeenCalled();
});
it("shows solo-queue storage per patch and the retention setting", () => {
  const view = render(<SourcesPage status={status} timezone="UTC" year={2026} />);
  const section = () => screen.getByRole("region", { name: "Solo-queue storage" });
  expect(section()).toHaveTextContent("Retention has not run yet");
  expect(section()).toHaveTextContent("No solo-queue matches stored yet.");
  view.rerender(
    <SourcesPage
      status={{
        ...status,
        riotStorage: {
          previousPatches: 1,
          keptPatches: ["16.22", "16.21"],
          lastRunAt: "2026-03-01T10:00:00.000Z",
          prunedMatches: 120,
          backfilledMatches: 0,
          patches: [
            { patchKey: null, matches: 2, timelines: 0, estimatedBytes: 800 },
            { patchKey: "16.22", matches: 400, timelines: 380, estimatedBytes: 52428800 },
            { patchKey: "16.21", matches: 90, timelines: 90, estimatedBytes: 3 * 1024 * 1024 },
          ],
        },
      }}
      timezone="UTC"
      year={2026}
    />,
  );
  expect(section()).toHaveTextContent("current patch and 1 previous patch (16.22, 16.21)");
  const table = screen.getByRole("table", { name: "Solo-queue data per patch" });
  expect(table).toHaveTextContent("Unknown version");
  expect(table).toHaveTextContent("50 MiB");
  expect(table).toHaveTextContent("3.0 MiB");
  expect(table).toHaveTextContent("800 B");
  expect(section()).toHaveTextContent("120 pruned, 0 queued to refetch");
});
it("shows Riot quota, job outcomes and crawl progress, and queues a crawl", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 202 }));
  vi.stubGlobal("fetch", fetcher);
  const view = render(<SourcesPage status={status} timezone="UTC" year={2026} />);
  const section = () => screen.getByRole("region", { name: "Riot crawler" });
  expect(section()).toHaveTextContent("No ladder or match data yet.");
  expect(section()).toHaveTextContent("No Riot requests in the last hour.");
  view.rerender(
    <SourcesPage
      status={{
        ...status,
        riotCrawl: {
          quota: [
            {
              region: "europe",
              method: "",
              windows: [
                { limit: 20, windowSeconds: 1, used: 3 },
                { limit: 100, windowSeconds: 120, used: 42 },
              ],
              pausedUntil: null,
            },
            {
              region: "kr",
              method: "league-v4.masterleagues",
              windows: [],
              pausedUntil: "2026-03-01T10:00:30.000Z",
            },
          ],
          jobs: [
            {
              kind: "riot-match",
              lastSuccess: "2026-03-01T09:00:00.000Z",
              lastErrorAt: null,
              error: null,
              records: 50,
            },
            {
              kind: "riot-match-ids",
              lastSuccess: null,
              lastErrorAt: "2026-03-01T09:30:00.000Z",
              error: "No patch catalog yet",
              records: 0,
            },
          ],
          progress: [
            {
              region: "europe",
              patchKey: "16.22",
              ladderPlayers: 300,
              matchIds: 2000,
              matches: 1500,
              timelines: 1400,
            },
          ],
        },
      }}
      timezone="UTC"
      year={2026}
    />,
  );
  const progress = screen.getByRole("table", { name: "Crawl progress by region and patch" });
  expect(progress).toHaveTextContent("europe16.22300200015001400");
  const jobs = screen.getByRole("table", { name: "Riot jobs" });
  expect(jobs).toHaveTextContent("Match details");
  expect(jobs).toHaveTextContent("No patch catalog yet");
  const quota = screen.getByRole("table", { name: "Riot request quota" });
  expect(quota).toHaveTextContent("3 / 20 per 1 s, 42 / 100 per 2 min");
  expect(quota).toHaveTextContent("All methods (application limit)");
  expect(quota).toHaveTextContent("Limit not reported yet");
  fireEvent.click(screen.getByRole("button", { name: "Queue crawl" }));
  await screen.findByText(/Queued\. The local worker/);
  expect(fetcher).toHaveBeenCalledWith(
    "/api/refresh",
    expect.objectContaining({ body: JSON.stringify({ kind: "riot-match-ids" }) }),
  );
});
