import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ChampionOverview, ChampionPlayer } from "@summonersnet/data/contracts";
import { PlayersSection } from "./players";
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const player: ChampionPlayer = {
  puuid: "a".repeat(78),
  platform: "euw1",
  gameName: "Sampled player",
  tagLine: "EUW",
  games: 12,
  winRate: { value: 0.5, sampleCount: 12 },
  tier: "CHALLENGER",
  leaguePoints: 500,
  ladderObservedAt: "2026-03-01T12:00:00Z",
  pro: {
    id: "oracle:player:1",
    source: "oracle",
    sourceId: "1",
    kind: "player",
    name: "Pro player",
    imageUrl: null,
    country: null,
    role: null,
    publicSlug: "pro-player",
  },
};
const overview: Pick<ChampionOverview, "players" | "query" | "champion"> = {
  champion: { id: "Ahri", key: 103, name: "Ahri", imageUrl: null },
  query: {
    champion: "Ahri",
    source: "solo",
    patch: ["16.22"],
    role: "MIDDLE",
    region: "europe",
    tier: "CHALLENGER",
    synergySort: "games",
    synergyPage: 2,
    playersSort: "games",
    historyPage: 1,
    playersPage: 1,
  },
  players: {
    sort: "games",
    page: {
      page: 1,
      pageSize: 20,
      total: 21,
      items: [
        player,
        {
          ...player,
          puuid: "b".repeat(78),
          gameName: null,
          tagLine: null,
          pro: null,
          winRate: { value: null, sampleCount: 1 },
        },
      ],
    },
  },
};
it("shows sampled rates, current stored rank, public pro links and preserved pagination filters", () => {
  const { container } = render(<PlayersSection overview={overview} />);
  expect(screen.getByText(/Players on the latest apex ladder/)).toBeVisible();
  expect(screen.getAllByText("EUW1 · CHALLENGER · 500 LP")).toHaveLength(2);
  expect(screen.getAllByText("Observed 2026-03-01")).toHaveLength(2);
  expect(screen.getByRole("link", { name: "Sampled player#EUW" })).toHaveAttribute(
    "href",
    `/summoners/${player.puuid}?platform=euw1`,
  );
  expect(screen.getByRole("link", { name: "Pro: Pro player" })).toHaveAttribute(
    "href",
    "/players/pro-player",
  );
  expect(screen.getByRole("link", { name: "b".repeat(78) })).toBeVisible();
  expect(screen.getByText("Unknown")).toBeVisible();
  expect(screen.getByText("50.0%")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Next Page" }));
  const target = String(push.mock.calls.at(-1)?.[0]);
  expect(target).toContain("/champions/Ahri?");
  const params = new URL(target, "http://localhost").searchParams;
  expect(params.get("playersPage")).toBe("2");
  expect(params.get("region")).toBe("europe");
  expect(params.get("synergyPage")).toBe("2");
  const form = container.querySelector("form")!;
  expect(form).toHaveAttribute("action", "/champions/Ahri");
  expect(form.querySelector('input[name="playersPage"]')).toBeNull();
  expect(form.querySelector('input[name="patch"]')).toHaveValue("16.22");
  fireEvent.click(screen.getByRole("button", { name: /Sort Players By$/ }));
  fireEvent.click(screen.getByRole("option", { name: "Win Rate" }));
  expect(within(form).getByRole("button", { name: /Win Rate/ })).toBeVisible();
});
it("explains insufficient samples and hides the section when solo data is unavailable", () => {
  const view = render(
    <PlayersSection
      overview={{
        ...overview,
        players: { sort: "winRate", page: { page: 1, pageSize: 20, total: 0, items: [] } },
      }}
    />,
  );
  expect(
    screen.getByText("No ladder players on this champion in this selection yet."),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "Next Page" })).toBeDisabled();
  view.rerender(<PlayersSection overview={{ ...overview, players: null }} />);
  expect(screen.queryByRole("heading")).toBeNull();
});
