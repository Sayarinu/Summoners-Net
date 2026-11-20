import { it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ChampionOverview, MatchupRow } from "@summonersnet/data/contracts";
import { ChampionOverviewPage } from "./overview";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const overview: ChampionOverview = {
  players: null,
  query: {
    champion: "Ahri",
    source: "solo",
    role: "MIDDLE",
    tier: "CHALLENGER",
    synergySort: "delta",
    synergyPage: 1,
    playersSort: "games",
    playersPage: 1,
  },
  champion: { id: "Ahri", key: 103, name: "Ahri", imageUrl: null },
  patch: "16.22",
  sliceGames: 200,
  games: 40,
  winRate: { value: 0.55, sampleCount: 40, lower: 0.4, upper: 0.69 },
  pickRate: { value: 0.2, sampleCount: 200 },
  banRate: { value: null, sampleCount: 0 },
  shrunkWinRate: { value: 0.52, sampleCount: 40 },
  baseline: 0.5,
  tier: "A",
  trend: [
    {
      patch: "16.21",
      games: 0,
      winRate: { value: null, sampleCount: 0 },
      pickRate: { value: 0, sampleCount: 150 },
      banRate: { value: null, sampleCount: 0 },
    },
    {
      patch: "16.22",
      games: 40,
      winRate: { value: 0.55, sampleCount: 40 },
      pickRate: { value: 0.2, sampleCount: 200 },
      banRate: { value: null, sampleCount: 0 },
    },
  ],
  roles: [
    { role: "MIDDLE", games: 34, share: { value: 0.85, sampleCount: 40 } },
    { role: "TOP", games: 6, share: { value: 0.15, sampleCount: 40 } },
  ],
  facets: { patches: ["16.22"], regions: ["europe"], tiers: ["CHALLENGER"] },
  builds: {
    start: [
      {
        items: [
          { kind: "item", id: 1056, catalogId: "1056", name: "Doran's Ring", imageUrl: null },
          { kind: "item", id: 2003, catalogId: "2003", name: "Health Potion", imageUrl: null },
        ],
        games: 30,
        pickRate: { value: null, sampleCount: 0 },
        winRate: { value: 0.6, sampleCount: 30 },
        sample: "low-sample",
      },
    ],
    boots: [],
    path: [
      {
        items: [
          { kind: "item", id: 4645, catalogId: "4645", name: "Shadowflame", imageUrl: null },
          { kind: "item", id: 3089, catalogId: "3089", name: null, imageUrl: null },
          { kind: "item", id: 3157, catalogId: "3157", name: "Zhonya's Hourglass", imageUrl: null },
        ],
        games: 4,
        pickRate: { value: null, sampleCount: 0 },
        winRate: { value: null, sampleCount: 4 },
        sample: "hidden",
      },
    ],
    slot1: [],
    slot2: [],
    slot3: [],
    runes: [],
    keystone: [
      {
        items: [{ kind: "rune", id: 8112, catalogId: "8112", name: "Electrocute", imageUrl: null }],
        games: 25,
        pickRate: { value: 0.625, sampleCount: 40 },
        winRate: { value: 0.56, sampleCount: 25 },
        sample: "low-sample",
      },
    ],
    shards: [
      {
        items: [
          { kind: "shard", id: 5005, catalogId: "5005", name: null, imageUrl: null },
          { kind: "shard", id: 5008, catalogId: "5008", name: null, imageUrl: null },
        ],
        games: 3,
        pickRate: { value: null, sampleCount: 40 },
        winRate: { value: null, sampleCount: 3 },
        sample: "hidden",
      },
    ],
    skills: [
      {
        items: [
          { kind: "skill", id: 1, catalogId: "1", name: "Q", imageUrl: null },
          { kind: "skill", id: 3, catalogId: "3", name: "E", imageUrl: null },
          { kind: "skill", id: 2, catalogId: "2", name: "W", imageUrl: null },
        ],
        games: 20,
        pickRate: { value: null, sampleCount: 0 },
        winRate: { value: 0.55, sampleCount: 20 },
        sample: "low-sample",
      },
    ],
    skillmax: [],
    excluded: { skills: 2, skillmax: 7 },
    spells: [
      {
        items: [
          { kind: "spell", id: 4, catalogId: "SummonerFlash", name: "Flash", imageUrl: null },
          { kind: "spell", id: 14, catalogId: "SummonerDot", name: "Ignite", imageUrl: null },
        ],
        games: 30,
        pickRate: { value: 0.75, sampleCount: 40 },
        winRate: { value: 0.5, sampleCount: 30 },
        sample: "low-sample",
      },
    ],
  },
  buckets: {
    length: [
      { index: 0, label: "Under 20 min", games: 30, winRate: { value: 0.6, sampleCount: 30 } },
      { index: 1, label: "20–25 min", games: 0, winRate: { value: null, sampleCount: 0 } },
    ],
    gold10: [],
    gold15: [],
    level10: [],
    level15: [],
  },
  pro: {
    patch: "16.22",
    league: null,
    leagues: ["LCK", "LEC"],
    games: 40,
    picks: 12,
    bans: 8,
    presence: { value: 0.5, sampleCount: 40 },
    pickRate: { value: 0.3, sampleCount: 40 },
    banRate: { value: 0.2, sampleCount: 40 },
    winRate: { value: 0.5, sampleCount: 12 },
    sides: [
      { side: "blue", picks: 5, winRate: { value: 0.6, sampleCount: 5 } },
      { side: "red", picks: 7, winRate: { value: null, sampleCount: 0 } },
    ],
    blindRate: { value: 0.25, sampleCount: 12 },
    counterRate: { value: 0.75, sampleCount: 12 },
    unmapped: [{ name: "Mel", picks: 2, bans: 1 }],
  },
  synergies: {
    sort: "delta",
    page: {
      page: 1,
      pageSize: 20,
      total: 1,
      items: [
        {
          allyKey: 412,
          allyId: "Thresh",
          allyName: "Thresh",
          allyImageUrl: null,
          allyRole: "UTILITY",
          games: 80,
          winRate: { value: 0.6, sampleCount: 80 },
          expected: 0.55,
          delta: { value: 0.031, sampleCount: 80 },
        },
      ],
    },
  },
  botLane: {
    carries: [{ key: 222, name: "Jinx" }],
    supports: [{ key: 412, name: "Thresh" }],
    cells: [{ carry: 222, support: 412, games: 80, winRate: { value: 0.6, sampleCount: 80 } }],
  },
};
it("shows rates with samples, the interval, the tier and its basis, and the trend", () => {
  render(<ChampionOverviewPage overview={overview} error={null} />);
  expect(screen.getByRole("heading", { name: "Ahri", level: 1 })).toBeVisible();
  // Source and role are tabs; each role shows the share of the champion's games.
  const roles = screen.getByRole("navigation", { name: "Role" });
  expect(within(roles).getByRole("link", { current: "page" })).toHaveAccessibleName("Mid 85.0%");
  expect(within(roles).getByRole("link", { name: /Top/ })).toHaveAttribute(
    "href",
    "/champions/Ahri?source=solo&role=TOP&tier=CHALLENGER",
  );
  expect(within(roles).getByRole("link", { name: "Jungle" })).toBeVisible();
  const sources = screen.getByRole("navigation", { name: "Source" });
  expect(within(sources).getByRole("link", { current: "page" })).toHaveTextContent("Solo Queue");
  const stats = screen.getByRole("region", { name: "Champion Statistics" });
  expect(stats).toHaveTextContent("TierA");
  expect(stats).toHaveTextContent("Win Rate40.0–69.0% · 40 Results55.0%");
  expect(stats).toHaveTextContent("Ban Rate0 GamesUnknown");
  expect(screen.getByTitle(/Shrunk win rate 52\.0%, above the 50\.0% average/)).toHaveTextContent(
    "A",
  );
  // Patches label the x-axis; a rate with no observations draws no axis.
  for (const rate of ["Win", "Pick"])
    expect(screen.getByRole("img", { name: `Ahri ${rate} Rate by Patch` })).toHaveTextContent(
      /16\.21.*16\.22/,
    );
  expect(screen.getByRole("img", { name: "Ahri Ban Rate by Patch" })).not.toHaveTextContent(
    "16.22",
  );
});
it("explains an unknown tier, shows an empty state without data, and shows filter errors", () => {
  const view = render(
    <ChampionOverviewPage
      overview={{ ...overview, tier: null, shrunkWinRate: { value: null, sampleCount: 0 } }}
      error={null}
    />,
  );
  expect(screen.getByTitle(/Unknown until this champion has games/)).toHaveTextContent("Unknown");
  view.rerender(<ChampionOverviewPage overview={{ ...overview, patch: null }} error={null} />);
  expect(screen.getByText("No Statistics for This Selection")).toBeVisible();
  view.rerender(<ChampionOverviewPage overview={overview} error="Choose filters from the lists" />);
  expect(screen.getByRole("alert")).toHaveTextContent("Choose filters from the lists");
});
it("shows the most common build as icons with win rates and games", () => {
  const view = render(<ChampionOverviewPage overview={overview} error={null} />);
  const card = screen.getByRole("region", { name: "Most Common Build" });
  const block = (name: string) => within(card).getByRole("region", { name });
  expect(block("Starting Items")).toHaveTextContent("60.0% Win Rate · 30 Games");
  expect(
    within(block("Starting Items")).getByLabelText("Doran's Ring, Health Potion"),
  ).toBeVisible();
  expect(
    within(block("Core Build")).getByLabelText(
      "Shadowflame then Item 3089 then Zhonya's Hourglass",
    ),
  ).toBeVisible();
  expect(block("Core Build")).toHaveTextContent("Too Few Games (4)");
  expect(block("Skill Order")).toHaveTextContent(/Q.*E.*W.*55\.0% Win Rate · 20 Games/);
  expect(block("Summoner Spells")).toHaveTextContent("50.0% Win Rate · 30 Games");
  expect(block("Runes")).toHaveTextContent(/5005.*5008.*56\.0% Win Rate · 25 Games/);
  expect(block("Boots")).toHaveTextContent("No Games Yet");
  view.rerender(<ChampionOverviewPage overview={{ ...overview, builds: null }} error={null} />);
  expect(screen.queryByRole("region", { name: "Most Common Build" })).toBeNull();
  expect(screen.queryByText("All Builds, Runes and Skills")).toBeNull();
});
/** The section renders its tables once its toggle event arrives. */
async function openAllBuilds() {
  fireEvent.click(screen.getByText("All Builds, Runes and Skills"));
  await screen.findByRole("table", { name: "Keystones" });
}
it("keeps every build option in tables under All Builds", async () => {
  render(<ChampionOverviewPage overview={overview} error={null} />);
  expect(screen.getByText("All Builds, Runes and Skills")).toBeVisible();
  await openAllBuilds();
  const start = screen.getByRole("table", { name: "Starting Items" });
  expect(start).toHaveTextContent(/Doran's Ring.*Health Potion/);
  expect(start).toHaveTextContent("60.0% · 30 results");
  const paths = screen.getByRole("table", { name: "Core Paths" });
  expect(paths).toHaveTextContent(/Shadowflame.*Item 3089.*Zhonya's Hourglass/);
  expect(paths).toHaveTextContent("Too Few Games (4)");
  expect(screen.getByRole("table", { name: "Boots" })).toHaveTextContent(
    "No games with timelines yet.",
  );
});
it("shows rune pages, shards and spells with pick and win rates", async () => {
  render(<ChampionOverviewPage overview={overview} error={null} />);
  await openAllBuilds();
  const keystones = screen.getByRole("table", { name: "Keystones" });
  expect(keystones).toHaveTextContent("Electrocute");
  expect(keystones).toHaveTextContent("62.5%");
  expect(keystones).toHaveTextContent("56.0% · 25 results");
  expect(screen.getByRole("table", { name: "Stat Shards" })).toHaveTextContent(
    /Stat Shard 5005.*Stat Shard 5008/,
  );
  expect(screen.getByRole("table", { name: "Summoner Spells" })).toHaveTextContent(/Flash.*Ignite/);
  expect(screen.getByRole("table", { name: "Rune Pages" })).toHaveTextContent("No games yet.");
});
it("shows skill orders and how many games were left out", async () => {
  render(<ChampionOverviewPage overview={overview} error={null} />);
  await openAllBuilds();
  expect(screen.getByRole("table", { name: "First Levels" })).toHaveTextContent(/Q.*E.*W/);
  expect(screen.getByRole("table", { name: "Max Order" })).toHaveTextContent(
    "No games with a decided max order yet.",
  );
  // The tables sit in the All Builds section, which renders them once opened.
  expect(
    screen.getByText(/Games left out: 2 for the first levels, 7 for the max order/),
  ).toBeInTheDocument();
});
it("charts win rate by game length with gaps and a data table", () => {
  const view = render(<ChampionOverviewPage overview={overview} error={null} />);
  const section = screen.getByRole("region", { name: "When It Wins" });
  expect(section).toHaveTextContent("Win Rate by Game Length");
  expect(section).toHaveTextContent("Under 20 min · 30 games");
  expect(section).toHaveTextContent("20–25 min · 0 games");
  expect(section).toHaveTextContent("Unknown");
  view.rerender(<ChampionOverviewPage overview={{ ...overview, buckets: null }} error={null} />);
  expect(screen.queryByRole("region", { name: "When It Wins" })).toBeNull();
});
it("lists allies with expected rates and deltas, keeps filters when sorting, and maps bot lanes", () => {
  const { container } = render(<ChampionOverviewPage overview={overview} error={null} />);
  const allies = screen.getByRole("table", { name: "Allies" });
  expect(within(allies).getByRole("img", { name: "Thresh" })).toBeVisible();
  expect(allies).toHaveTextContent(/Support.*80.*60\.0%.*55\.0%.*\+3\.1 pts/);
  expect(screen.getByRole("link", { name: "Thresh" })).toHaveAttribute("href", "/champions/Thresh");
  const hidden = [...container.querySelectorAll<HTMLInputElement>("input[type=hidden]")].map(
    (i) => `${i.name}=${i.value}`,
  );
  expect(hidden).toEqual(expect.arrayContaining(["source=solo", "role=MIDDLE", "tier=CHALLENGER"]));
  expect(screen.getAllByText("Bot-Lane Pairs: Win Rate (%)")[0]).toBeInTheDocument();
  expect(screen.getByText("1 allies · Page 1")).toBeVisible();
});
it("shows pro presence, sides and draft order with samples, and reports unmapped names", () => {
  const view = render(<ChampionOverviewPage overview={overview} error={null} />);
  const stats = screen.getByLabelText("Pro-Play Statistics");
  expect(stats).toHaveTextContent("Presence40 Games50.0%");
  expect(stats).toHaveTextContent("Picks / BansDrafts12 / 8");
  expect(stats).toHaveTextContent("Win Rate12 Results50.0%");
  expect(stats).toHaveTextContent("Blue Side Win Rate5 Picks · 5 Results60.0%");
  expect(stats).toHaveTextContent("Red Side Win Rate7 Picks · 0 ResultsUnknown");
  expect(stats).toHaveTextContent("Blind / Counter12 Picks25.0% / 75.0%");
  expect(screen.getByText(/no champion mapping: Mel/)).toBeVisible();
  view.rerender(
    <ChampionOverviewPage
      overview={{ ...overview, pro: { ...overview.pro, patch: null, leagues: [] } }}
      error={null}
    />,
  );
  expect(screen.getByText("No pro drafts imported yet.")).toBeVisible();
});
it("shows the stored counter-pick value for a lane role", () => {
  const view = render(
    <ChampionOverviewPage
      overview={overview}
      draftValue={{
        games: 32,
        sampledOpponents: 4,
        coveredOpponents: 3,
        coveredPicks: 30,
        rolePicks: 32,
        coverage: 30 / 32,
        expected: 0.5,
        worstCase: 0.4,
        worstOpponent: null,
        variance: 0.01,
        lowerTail: 0.42,
        score: 0.42,
        reason: null,
        counterWinRate: 0.56,
        counterOpponents: 2,
        counterPicks: 12,
        counterReason: null,
        counterDifference: 0.06,
        builtAt: "2026-11-16T12:00:00.000Z",
      }}
      error={null}
    />,
  );
  expect(screen.getByRole("heading", { name: "Counter-Pick Value" })).toBeVisible();
  expect(screen.getByLabelText("Counter-Pick Statistics")).toHaveTextContent(
    "Counter-Pick Value+6.0 pts",
  );
  view.rerender(<ChampionOverviewPage overview={overview} draftValue={null} error={null} />);
  expect(screen.queryByRole("heading", { name: "Counter-Pick Value" })).toBeNull();
});
const opponent = (name: string, key: number, shrunk: number | null, games: number): MatchupRow => ({
  opponent: { championKey: key, championId: name, name, imageUrl: null },
  games,
  metrics: {
    winRate: { raw: shrunk, shrunk, sampleCount: games, baseline: 0.5, baselineSampleCount: 400 },
  } as MatchupRow["metrics"],
});
it("shows the best and worst lane opponents as cards with signed differences", () => {
  const view = render(
    <ChampionOverviewPage
      overview={overview}
      error={null}
      matchupSummary={{
        role: "MIDDLE",
        source: "solo",
        patch: "16.22",
        opponents: 12,
        best: [opponent("Zed", 238, 0.556, 80)],
        worst: [opponent("Annie", 1, 0.47, 64)],
      }}
    />,
  );
  const cards = screen.getByRole("region", { name: "Matchups Mid" });
  expect(within(cards).getByRole("region", { name: "Good Against" })).toHaveTextContent(
    "+5.6%80 Games",
  );
  expect(within(cards).getByRole("region", { name: "Bad Against" })).toHaveTextContent(
    "-3.0%64 Games",
  );
  expect(within(cards).getByRole("link", { name: /Zed/ })).toHaveAttribute(
    "href",
    "/champions/Zed",
  );
  expect(within(cards).getByRole("link", { name: "Full List (12)" })).toHaveAttribute(
    "href",
    "/champions/Ahri/matchups?source=solo&role=MIDDLE&patch=16.22",
  );
  view.rerender(
    <ChampionOverviewPage
      overview={overview}
      error={null}
      matchupSummary={{
        role: "MIDDLE",
        source: "solo",
        patch: "16.22",
        opponents: 0,
        best: [],
        worst: [],
      }}
    />,
  );
  expect(screen.queryByRole("region", { name: /Matchups Mid/ })).toBeNull();
});
