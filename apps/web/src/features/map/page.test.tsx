import { afterEach, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { SoloGame, SoloGamePositions } from "@summonersnet/data/contracts";
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
const table = () => screen.getByRole("table", { name: /^Positions at / });
const points = (container: HTMLElement) => container.querySelectorAll(".np-minimap__point");
afterEach(() => vi.useRealTimers());

it("scrubs to interpolated positions and shows missing frames as gaps", () => {
  const { container } = render(<GameMapPage game={game} positions={positions} />);
  expect(screen.getByText(/one position per champion per minute/)).toBeVisible();
  expect(points(container)).toHaveLength(3);
  expect(table()).toHaveTextContent("AhriBlueMid600, 500 (minute frame)");
  fireEvent.change(screen.getByLabelText(/^Game time/), { target: { value: "30000" } });
  expect(screen.getByRole("table", { name: "Positions at 0:30" })).toBeVisible();
  expect(table()).toHaveTextContent("AhriBlueMid900, 800 (estimated between frames)");
  // Lee Sin's minute 1 frame is missing: no point and a gap, never the map origin.
  expect(table()).toHaveTextContent("Lee SinBlueJungleGap: no frame");
  expect(points(container)).toHaveLength(2);
  expect(screen.getByRole("link", { name: "Back to the game" })).toHaveAttribute(
    "href",
    "/solo-games/EUW1_1",
  );
});
it("toggles teams and roles", () => {
  const { container } = render(<GameMapPage game={game} positions={positions} />);
  const controls = screen.getByRole("group", { name: "Show champions" });
  fireEvent.click(within(controls).getByRole("switch", { name: "Red team" }));
  expect(table()).not.toHaveTextContent("Garen");
  fireEvent.click(within(controls).getByRole("switch", { name: "Jungle" }));
  expect(table()).not.toHaveTextContent("Lee Sin");
  expect(points(container)).toHaveLength(1);
  fireEvent.click(within(controls).getByRole("switch", { name: "Mid" }));
  expect(table()).toHaveTextContent("Every champion is hidden");
  fireEvent.click(within(controls).getByRole("switch", { name: "Red team" }));
  expect(table()).toHaveTextContent("Garen");
});
it("plays, pauses and stops at the last frame", () => {
  vi.useFakeTimers();
  render(<GameMapPage game={game} positions={positions} />);
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
  render(<GameMapPage game={game} positions={empty} />);
  expect(screen.getByRole("status")).toHaveTextContent("timeline has not been stored");
  render(<GameMapPage game={game} positions={{ ...positions, truncated: true, tracks: [] }} />);
  expect(screen.getByText("This game's timeline has no position frames.")).toBeVisible();
  expect(screen.getAllByText(/first 120 minutes/)).toHaveLength(1);
});
