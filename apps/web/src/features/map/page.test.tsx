import { afterEach, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type {
  MatchTrackSummary,
  SoloGame,
  SoloGameMapEvents,
  SoloGamePositions,
} from "@summonersnet/data/contracts";
import { GameMapPage } from "./page";

const participant = (participantId: number, side: "blue" | "red", name: string, role: string) => ({
  participantId,
  side,
  championKey: participantId,
  championId: name,
  championName: name,
  role,
  kills: null,
  deaths: null,
  assists: null,
});
const game: SoloGame = {
  matchId: "EUW1_1",
  patch: "16.22",
  queueId: 420,
  durationSeconds: 150,
  startedAt: null,
  teams: [],
  participants: [
    participant(1, "blue", "Ahri", "MIDDLE"),
    participant(2, "blue", "Lee Sin", "JUNGLE"),
    participant(6, "red", "Garen", "TOP"),
  ],
  winProbability: { model: null, reason: "none", points: [], markers: [] },
};
const positions: SoloGamePositions = {
  matchId: "EUW1_1",
  timelineState: "fetched",
  truncated: false,
  tracks: [
    {
      participantId: 1,
      frames: [
        { minute: 0, timestampMs: 0, x: 600, y: 500 },
        { minute: 1, timestampMs: 60000, x: 1200, y: 1100 },
        { minute: 2, timestampMs: 120000, x: 1200, y: 1100 },
      ],
    },
    {
      participantId: 2,
      frames: [
        { minute: 0, timestampMs: 0, x: 700, y: 600 },
        { minute: 1, timestampMs: null, x: null, y: null },
        { minute: 2, timestampMs: 120000, x: 800, y: 700 },
      ],
    },
    {
      participantId: 6,
      frames: [
        { minute: 0, timestampMs: 0, x: 14000, y: 14000 },
        { minute: 1, timestampMs: 60000, x: 13000, y: 13000 },
        { minute: 2, timestampMs: 120000, x: 12000, y: 12000 },
      ],
    },
  ],
};
const events: SoloGameMapEvents = {
  truncated: false,
  events: [
    {
      id: "w",
      kind: "ward",
      timestampMs: 10000,
      side: "blue",
      participantId: 2,
      victimId: null,
      x: null,
      y: null,
      label: "Ward placed (Yellow Trinket)",
    },
    {
      id: "k",
      kind: "kill",
      timestampMs: 98000,
      side: "blue",
      participantId: 1,
      victimId: 6,
      x: 7200,
      y: 7100,
      label: "Champion kill",
    },
    {
      id: "d",
      kind: "objective",
      timestampMs: 110000,
      side: null,
      participantId: null,
      victimId: null,
      x: 9866,
      y: 4414,
      label: "Fire Dragon",
    },
  ],
};
const table = () => screen.getByRole("table", { name: /^Positions at / });
const points = (container: HTMLElement) => container.querySelectorAll(".np-minimap__point");
afterEach(() => vi.useRealTimers());

it("scrubs to interpolated positions and shows missing frames as gaps", () => {
  const { container } = render(<GameMapPage game={game} positions={positions} events={events} />);
  expect(screen.getByText(/one position per champion per minute/)).toBeVisible();
  expect(points(container)).toHaveLength(3);
  expect(within(table()).getByRole("row", { name: /Ahri/ })).toHaveTextContent(
    "600, 500 (minute frame)",
  );
  fireEvent.change(screen.getByLabelText(/^Game time/), { target: { value: "30000" } });
  expect(screen.getByRole("table", { name: "Positions at 0:30" })).toBeVisible();
  expect(within(table()).getByRole("row", { name: /Ahri/ })).toHaveTextContent(
    "900, 800 (estimated between frames)",
  );
  // Lee Sin's minute 1 frame is missing: no point and a gap, never the map origin.
  expect(within(table()).getByRole("row", { name: /Lee Sin/ })).toHaveTextContent("Gap: no frame");
  expect(points(container)).toHaveLength(2);
  expect(screen.getByRole("link", { name: "Back to the Game" })).toHaveAttribute(
    "href",
    "/solo-games/EUW1_1",
  );
});
it("toggles teams and roles", () => {
  const { container } = render(<GameMapPage game={game} positions={positions} events={events} />);
  const controls = screen.getByRole("group", { name: "Show Champions" });
  fireEvent.click(within(controls).getByRole("switch", { name: "Red team" }));
  expect(within(table()).queryByRole("img", { name: "Garen" })).toBeNull();
  fireEvent.click(within(controls).getByRole("switch", { name: "Jungle" }));
  expect(within(table()).queryByRole("img", { name: "Lee Sin" })).toBeNull();
  expect(points(container)).toHaveLength(1);
  fireEvent.click(within(controls).getByRole("switch", { name: "Mid" }));
  expect(table()).toHaveTextContent("Every champion is hidden");
  fireEvent.click(within(controls).getByRole("switch", { name: "Red team" }));
  expect(within(table()).getByRole("img", { name: "Garen" })).toBeVisible();
});
it("plays, pauses and stops at the last frame", () => {
  vi.useFakeTimers();
  render(<GameMapPage game={game} positions={positions} events={events} />);
  const play = screen.getByRole("button", { name: "Play" });
  fireEvent.click(play);
  act(() => {
    vi.advanceTimersByTime(500);
  });
  expect(screen.getByLabelText(/^Game time/)).toHaveValue("30000");
  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  act(() => {
    vi.advanceTimersByTime(1000);
  });
  expect(screen.getByLabelText(/^Game time/)).toHaveValue("30000");
  fireEvent.click(screen.getByRole("button", { name: "Play" }));
  act(() => {
    vi.advanceTimersByTime(5000);
  });
  expect(screen.getByLabelText(/^Game time/)).toHaveValue("120000");
  expect(screen.getByRole("button", { name: "Play" })).toBeVisible();
  // Playing again from the end restarts at the first frame.
  fireEvent.click(screen.getByRole("button", { name: "Play" }));
  expect(screen.getByLabelText(/^Game time/)).toHaveValue("0");
});
it("explains a game without stored positions", () => {
  const empty = { ...positions, timelineState: "pending" as const, tracks: [] };
  render(<GameMapPage game={game} positions={empty} events={events} />);
  expect(screen.getByRole("status")).toHaveTextContent("timeline has not been stored");
  render(
    <GameMapPage
      game={game}
      positions={{ ...positions, truncated: true, tracks: [] }}
      events={events}
    />,
  );
  expect(screen.getByText("This game's timeline has no position frames.")).toBeVisible();
  expect(screen.getAllByText(/first 120 minutes/)).toHaveLength(1);
});
it("overlays nearby events, lists every event and jumps the scrubber to a selected one", () => {
  const { container } = render(<GameMapPage game={game} positions={positions} events={events} />);
  const list = screen.getByRole("table", { name: "Events" });
  expect(list).toHaveTextContent("Ward placed (Yellow Trinket) by Lee Sin");
  expect(list).toHaveTextContent("Not drawn: no coordinates");
  expect(list).toHaveTextContent("Ahri killed Garen");
  expect(list).toHaveTextContent("UnknownFire Dragon9866, 4414");
  // Nothing drawable is within 30 seconds of the start; the ward has no coordinates.
  expect(container.querySelectorAll(".np-minimap__event")).toHaveLength(0);
  fireEvent.click(within(list).getByRole("button", { name: "Go to 1:38" }));
  expect(screen.getByLabelText(/^Game time/)).toHaveValue("98000");
  expect(container.querySelector(".np-minimap__event--kill")).not.toBeNull();
  expect(container.querySelector(".np-minimap__event--objective")).toHaveAttribute(
    "fill",
    "var(--color-text-secondary)",
  );
  expect(list).toHaveTextContent("7200, 7100 (drawn now)");
  const toggles = screen.getByRole("group", { name: "Show Events" });
  fireEvent.click(within(toggles).getByRole("switch", { name: "Kills" }));
  expect(container.querySelector(".np-minimap__event--kill")).toBeNull();
  expect(screen.getByRole("table", { name: "Events" })).not.toHaveTextContent("Ahri killed");
  fireEvent.click(within(toggles).getByRole("switch", { name: "Objectives" }));
  fireEvent.click(within(toggles).getByRole("switch", { name: "Wards" }));
  expect(screen.getByRole("table", { name: "Events" })).toHaveTextContent(
    "Every event is hidden by the event toggles.",
  );
});
it("explains a game without stored events and a truncated event list", () => {
  render(
    <GameMapPage game={game} positions={positions} events={{ events: [], truncated: true }} />,
  );
  expect(screen.getByRole("table", { name: "Events" })).toHaveTextContent(
    "No kills, objectives or ward placements are stored for this game.",
  );
  expect(screen.getByText(/first 1,000 events/)).toBeVisible();
});

const track: MatchTrackSummary = {
  sampleRateHz: 2,
  sampleCount: 5,
  firstMs: 0,
  lastMs: 130000,
  importedAt: "2026-11-16T12:00:00.000Z",
  linkState: "linked",
  movements: [
    {
      kind: "recall",
      startMs: 1000,
      endMs: 1500,
      teamId: 100,
      participantIds: [1],
      from: "mid",
      to: "blue-base",
    },
    {
      kind: "rotation",
      startMs: 61000,
      endMs: 70000,
      teamId: 200,
      participantIds: [6],
      from: null,
      to: "bot",
    },
  ],
};
const observation = (participantId: number, x: number | null, confidence: number | null) => ({
  participantId,
  x,
  y: x,
  confidence,
});
function trackFetcher() {
  return vi.fn((url: string) => {
    const from = Number(new URL(url, "http://local").searchParams.get("fromMs"));
    const samples =
      from === 0
        ? [0, 500, 1000, 1500].map((timeMs) => ({
            timeMs,
            positions: [
              observation(1, timeMs < 1500 ? 7000 : 500, 0.9),
              observation(2, timeMs === 1000 ? null : 6000, 0.9),
              observation(6, 9000, 0.2),
            ],
          }))
        : [];
    return Promise.resolve(new Response(JSON.stringify(samples)));
  });
}

it("uses a linked track: latest samples, trails, low-confidence points, gaps and movements", async () => {
  const fetcher = trackFetcher();
  const { container } = render(
    <GameMapPage
      game={game}
      positions={positions}
      events={events}
      track={track}
      fetcher={fetcher as unknown as typeof fetch}
    />,
  );
  expect(screen.getByRole("note")).toHaveTextContent(
    "Source at 0:00: imported replay track, about 2 samples per second (5 samples from 0:00 to 2:10",
  );
  // Only the chunk under the scrubber and the next one are requested.
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
    "/api/solo-games/EUW1_1/track?fromMs=0&toMs=59999",
    "/api/solo-games/EUW1_1/track?fromMs=60000&toMs=119999",
  ]);
  await waitFor(() =>
    expect(within(table()).getByRole("row", { name: /Ahri/ })).toHaveTextContent(
      "7000, 7000 (track sample, confidence 0.90)",
    ),
  );
  expect(within(table()).getByRole("row", { name: /Garen/ })).toHaveTextContent(
    "9000, 9000 (track sample, low confidence 0.20)",
  );
  expect(container.querySelectorAll(".np-minimap__point--low")).toHaveLength(1);
  // The track runs past the last timeline frame.
  expect(screen.getByLabelText(/^Game time/)).toHaveAttribute("max", "130000");
  expect(screen.getByLabelText(/^Game time/)).toHaveAttribute("step", "500");
  fireEvent.change(screen.getByLabelText(/^Game time/), { target: { value: "1000" } });
  expect(within(table()).getByRole("row", { name: /Lee Sin/ })).toHaveTextContent("Gap: no sample");
  expect(container.querySelectorAll(".np-minimap__path").length).toBeGreaterThan(0);
  const movements = screen.getByRole("table", { name: "Detected Movements" });
  expect(movements).toHaveTextContent("Recall: Ahri");
  expect(movements).toHaveTextContent("Rotation: Garen to bot");
  fireEvent.click(within(movements).getByRole("button", { name: "Go to 1:01" }));
  expect(screen.getByLabelText(/^Game time/)).toHaveValue("61000");
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
});
it("uses the timeline outside a partial track's sampled interval", () => {
  const fetcher = trackFetcher();
  render(
    <GameMapPage
      game={game}
      positions={positions}
      events={events}
      track={{ ...track, firstMs: 60000, lastMs: 90000 }}
      fetcher={fetcher as unknown as typeof fetch}
    />,
  );
  expect(screen.getByRole("note")).toHaveTextContent(
    "Source at 0:00: Riot match timeline, one position per champion per minute.",
  );
  expect(screen.getByRole("note")).toHaveTextContent(
    "An imported replay track covers 1:00 to 1:30.",
  );
  expect(within(table()).getByRole("row", { name: /Ahri/ })).toHaveTextContent(
    "600, 500 (minute frame)",
  );
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(/^Game time/), { target: { value: "60000" } });
  expect(screen.getByRole("note")).toHaveTextContent("Source at 1:00: imported replay track");
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("falls back to the timeline and says why when a track is not linked or lacks movements", async () => {
  const fetcher = trackFetcher();
  const { unmount } = render(
    <GameMapPage
      game={game}
      positions={positions}
      events={events}
      track={{ ...track, linkState: "mismatch" }}
      fetcher={fetcher as unknown as typeof fetch}
    />,
  );
  expect(screen.getByRole("note")).toHaveTextContent("Source at 0:00: Riot match timeline");
  expect(screen.getByRole("note")).toHaveTextContent("does not match this game");
  expect(fetcher).not.toHaveBeenCalled();
  unmount();
  render(
    <GameMapPage
      game={game}
      positions={positions}
      events={events}
      track={{ ...track, movements: null }}
      fetcher={
        vi.fn(() => Promise.resolve(new Response("{}", { status: 500 }))) as unknown as typeof fetch
      }
    />,
  );
  expect(screen.getByText(/Import it again to list rotations, roams and recalls/)).toBeVisible();
  await waitFor(() =>
    expect(screen.getByRole("note")).toHaveTextContent("Some track samples could not be loaded."),
  );
  expect(table()).toHaveTextContent("Loading track samples");
});
