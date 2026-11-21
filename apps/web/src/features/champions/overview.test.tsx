import { it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  matchupMetrics,
  type ChampionOverview,
  type MatchupRow,
} from "@summonersnet/data/contracts";
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
    historyPage: 1,
  },
  champion: { id: "Ahri", key: 103, name: "Ahri", imageUrl: null },
  patch: "16.22",
  combined: ["16.22"],
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
    slot4: [],
    slot5: [],
    slot6: [],
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
    skillpath: [],
    excluded: { skills: 2, skillmax: 7 },
    runeTrees: [],
    shardRows: [],
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
    split: null,
    stage: null,
    splits: ["Spring", "Summer"],
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
    byLeague: [
      {
        league: "LCK",
        games: 30,
        picks: 10,
        bans: 6,
        presence: { value: 16 / 30, sampleCount: 30 },
        winRate: { value: 0.6, sampleCount: 10 },
      },
      {
        league: "LEC",
        games: 10,
        picks: 2,
        bans: 2,
        presence: { value: 0.4, sampleCount: 10 },
        winRate: { value: null, sampleCount: 2 },
      },
    ],
    performance: {
      games: 12,
      kda: { value: 4.5, sampleCount: 12 },
      killsPerGame: { value: 3.2, sampleCount: 12 },
      deathsPerGame: { value: 1.8, sampleCount: 12 },
      assistsPerGame: { value: 4.9, sampleCount: 12 },
      killParticipation: { value: 0.68, sampleCount: 12 },
      csPerMinute: { value: 8.9, sampleCount: 12 },
      goldPerMinute: { value: null, sampleCount: 0 },
      damagePerMinute: { value: 640.2, sampleCount: 12 },
      damageShare: { value: 0.29, sampleCount: 12 },
      goldDiffAt15: { value: 245, sampleCount: 12 },
      csDiffAt15: { value: -3.5, sampleCount: 12 },
      xpDiffAt15: { value: 120, sampleCount: 12 },
      firstBloodParticipation: { value: 0.25, sampleCount: 12 },
      visionScorePerMinute: { value: 1.42, sampleCount: 12 },
      gameLength: { value: 1919.6, sampleCount: 12 },
    },
  },
  performance: {
    games: 60,
    kda: { value: 3.1, sampleCount: 60 },
    killsPerGame: { value: 6.2, sampleCount: 60 },
    deathsPerGame: { value: 4.4, sampleCount: 60 },
    assistsPerGame: { value: 7.5, sampleCount: 60 },
    killParticipation: { value: 0.55, sampleCount: 60 },
    csPerMinute: { value: 7.8, sampleCount: 60 },
    goldPerMinute: { value: 402.1, sampleCount: 60 },
    damagePerMinute: { value: 812.6, sampleCount: 60 },
    damageShare: { value: 0.27, sampleCount: 60 },
    goldDiffAt15: { value: null, sampleCount: 0 },
    csDiffAt15: { value: null, sampleCount: 0 },
    xpDiffAt15: { value: null, sampleCount: 0 },
    firstBloodParticipation: { value: null, sampleCount: 0 },
    visionScorePerMinute: { value: 0.91, sampleCount: 60 },
    gameLength: { value: 1745, sampleCount: 60 },
  },
  proPlayers: null,
  proHistory: {
    league: null,
    page: {
      page: 1,
      pageSize: 12,
      total: 13,
      items: [
        {
          patch: "16.22",
          games: 40,
          picks: 12,
          bans: 8,
          presence: { value: 0.5, sampleCount: 40 },
          pickRate: { value: 0.3, sampleCount: 40 },
          banRate: { value: 0.2, sampleCount: 40 },
          winRate: { value: 0.5, sampleCount: 12 },
          blueWinRate: { value: 0.6, sampleCount: 5 },
          redWinRate: { value: null, sampleCount: 0 },
        },
      ],
    },
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
/** The same champion on the Pro Play view, where the pro panels appear. */
const pro: ChampionOverview = {
  ...overview,
  query: { ...overview.query, source: "pro" },
  builds: null,
  proPlayers: {
    total: 2,
    items: [
      {
        name: "Faker",
        team: "T1",
        leagues: ["LCK"],
        profile: { name: "Faker", publicSlug: "faker" },
        games: 10,
        winRate: { value: 0.7, sampleCount: 10 },
        kda: { value: 5.25, sampleCount: 10 },
      },
      {
        name: "Caps",
        team: null,
        leagues: ["LEC"],
        profile: null,
        games: 2,
        winRate: { value: null, sampleCount: 2 },
        kda: { value: null, sampleCount: 0 },
      },
    ],
  },
};
/** Opens a collapsed section; its body renders once the toggle event arrives. */
async function open(title: string, ready: () => Promise<unknown>) {
  fireEvent.click(screen.getByText(title));
  await ready();
}
it("shows rates with samples, the tier and its basis, and the trend", async () => {
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
  const stats = screen.getByLabelText("Headline Statistics");
  expect(stats).toHaveTextContent("TierA");
  expect(stats).toHaveTextContent("Win Rate40 Games55.0%");
  expect(stats).not.toHaveTextContent("40.0–69.0%");
  expect(stats).toHaveTextContent("Ban Rate0 GamesUnknown");
  expect(screen.getByTitle(/Shrunk win rate 52\.0%, above the 50\.0% average/)).toHaveTextContent(
    "A",
  );
  // Patches label the x-axis; a rate with no observations draws no axis.
  await open("Patch Trends and When It Wins", () =>
    screen.findByRole("img", { name: "Ahri Win Rate by Patch" }),
  );
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
it("draws the rune page over its trees, with spells, skills and items in build order", () => {
  const rune = (id: number, name: string) => ({
    kind: "rune" as const,
    id,
    catalogId: String(id),
    name,
    imageUrl: null,
  });
  const shard = (id: number, name: string) => ({ ...rune(id, name), kind: "shard" as const });
  const skill = (id: number) => ({
    kind: "skill" as const,
    id,
    catalogId: String(id),
    name: ["", "Q", "W", "E", "R"][id]!,
    imageUrl: null,
  });
  const builds = overview.builds!;
  const sampled = { games: 25, pickRate: { value: 0.625, sampleCount: 40 } };
  const page = [
    rune(8100, "Domination"),
    rune(8112, "Electrocute"),
    rune(8139, "Taste of Blood"),
    rune(8138, "Eyeball Collection"),
    rune(8106, "Ultimate Hunter"),
    rune(8200, "Sorcery"),
    rune(8226, "Manaflow Band"),
    rune(8237, "Scorch"),
  ];
  const view = render(
    <ChampionOverviewPage
      overview={{
        ...overview,
        builds: {
          ...builds,
          runes: [
            {
              ...sampled,
              items: page,
              winRate: { value: 0.56, sampleCount: 25 },
              sample: "low-sample",
            },
          ],
          runeTrees: [
            {
              tree: page[0]!,
              rows: [[page[1]!, rune(8128, "Dark Harvest")], [page[2]!], [page[3]!], [page[4]!]],
            },
            { tree: page[5]!, rows: [[rune(8214, "Summon Aery")], [page[6]!], [page[7]!]] },
          ],
          shards: [
            {
              ...builds.shards[0]!,
              items: [
                {
                  kind: "shard",
                  id: 5008,
                  catalogId: "5008",
                  name: "Adaptive Force",
                  imageUrl: null,
                },
                { kind: "shard", id: 5010, catalogId: "5010", name: "Move Speed", imageUrl: null },
                { kind: "shard", id: 5011, catalogId: "5011", name: "Health", imageUrl: null },
              ],
            },
          ],
          shardRows: [
            [
              shard(5008, "Adaptive Force"),
              shard(5005, "Attack Speed"),
              shard(5007, "Ability Haste"),
            ],
            [
              shard(5008, "Adaptive Force"),
              shard(5010, "Move Speed"),
              shard(5001, "Health Scaling"),
            ],
            [
              shard(5011, "Health"),
              shard(5013, "Tenacity and Slow Resist"),
              shard(5001, "Health Scaling"),
            ],
          ],
          skillmax: [{ ...builds.skills[0]!, items: [skill(1), skill(3), skill(2)] }],
          skillpath: [{ ...builds.skills[0]!, items: [1, 3, 2, 1, 1, 4].map(skill), games: 12 }],
          slot4: [{ ...builds.start[0]!, items: [builds.path[0]!.items[2]!], games: 9 }],
        },
      }}
      error={null}
    />,
  );
  const runes = screen.getByRole("region", { name: "Runes" });
  const primary = within(runes).getByRole("region", { name: "Primary: Domination" });
  expect(within(primary).getByRole("img", { name: "Electrocute" })).toHaveAttribute(
    "data-state",
    "selected",
  );
  expect(within(primary).getByRole("img", { name: "Dark Harvest" })).toHaveAttribute(
    "data-state",
    "muted",
  );
  // A secondary tree has no keystone row.
  const secondary = within(runes).getByRole("region", { name: "Secondary: Sorcery" });
  expect(within(secondary).queryByRole("img", { name: "Summon Aery" })).toBeNull();
  expect(within(secondary).getByRole("img", { name: "Scorch" })).toHaveAttribute(
    "data-state",
    "selected",
  );
  // Each shard row lights its chosen shard among the client's options.
  const shards = within(runes).getByRole("region", { name: "Stat Shards" });
  expect(
    within(shards)
      .getAllByRole("img")
      .filter((icon) => icon.getAttribute("data-state") === "selected")
      .map((icon) => icon.getAttribute("aria-label") ?? icon.getAttribute("alt")),
  ).toEqual(["Adaptive Force", "Move Speed", "Health"]);
  expect(within(shards).getAllByRole("img")).toHaveLength(9);
  expect(runes).toHaveTextContent("56.0%WR62.5% Pick25 Games");
  const skills = screen.getByRole("region", { name: "Summoner Spells and Skills" });
  expect(within(skills).getByRole("group", { name: "Q then E then W" })).toBeVisible();
  expect(within(skills).getByRole("group", { name: "Flash, Ignite" })).toBeVisible();
  const grid = within(skills).getByRole("table", { name: "Most Common Skill Order" });
  expect(within(grid).getByRole("row", { name: /^R/ })).toHaveTextContent(/^RR$/);
  const items = screen.getByRole("region", { name: "Items" });
  expect(within(items).getByRole("group", { name: "Doran's Ring, Health Potion" })).toBeVisible();
  expect(
    within(items).getByRole("group", {
      name: "Shadowflame then Item 3089 then Zhonya's Hourglass",
    }),
  ).toBeVisible();
  // A rate without results stays unknown; items show their share among the slot's options.
  expect(items).toHaveTextContent("—WR4 Games");
  expect(within(items).getByRole("region", { name: "Fourth Item" })).toHaveTextContent(
    "60.0%WR9 Games",
  );
  expect(items).toHaveTextContent("No Games With Timelines Yet");
  view.rerender(<ChampionOverviewPage overview={{ ...overview, builds: null }} error={null} />);
  expect(screen.queryByRole("region", { name: "Runes" })).toBeNull();
  expect(screen.queryByText("All Builds, Runes and Skills")).toBeNull();
});
it("keeps pro panels off the solo-queue view", () => {
  render(<ChampionOverviewPage overview={overview} error={null} />);
  expect(screen.queryByLabelText("Pro-Play Statistics")).toBeNull();
  expect(screen.queryByRole("table", { name: "Ahri Pro Play by Patch" })).toBeNull();
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
  expect(start).toHaveTextContent("60.0%");
  const paths = screen.getByRole("table", { name: "Core Paths" });
  expect(paths).toHaveTextContent(/Shadowflame.*Item 3089.*Zhonya's Hourglass/);
  expect(paths).not.toHaveTextContent(/Too Few/);
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
  expect(keystones).toHaveTextContent("56.0%");
  expect(screen.getByRole("table", { name: "Stat Shards" })).toHaveTextContent(
    /Stat Shard 5005.*Stat Shard 5008/,
  );
  expect(screen.getByRole("table", { name: "Summoner Spells" })).toHaveTextContent(/Flash.*Ignite/);
  expect(screen.getByRole("table", { name: "Rune Pages" })).toHaveTextContent("No games yet.");
});
it("shows first levels, max orders and full skill orders", async () => {
  render(<ChampionOverviewPage overview={overview} error={null} />);
  await openAllBuilds();
  expect(screen.getByRole("table", { name: "First Levels" })).toHaveTextContent(/Q.*E.*W/);
  expect(screen.getByRole("table", { name: "Max Order" })).toHaveTextContent(
    "No games with a decided max order yet.",
  );
  expect(screen.getByRole("table", { name: "Skill Orders" })).toBeInTheDocument();
  expect(screen.queryByText(/left out/)).toBeNull();
});
it("charts win rate by game length with gaps and a data table", async () => {
  const view = render(<ChampionOverviewPage overview={overview} error={null} />);
  await open("Patch Trends and When It Wins", () =>
    screen.findByRole("region", { name: "When It Wins" }),
  );
  const section = screen.getByRole("region", { name: "When It Wins" });
  expect(section).toHaveTextContent("Win Rate by Game Length");
  expect(section).toHaveTextContent("Under 20 min");
  expect(section).toHaveTextContent("20–25 min");
  expect(section).toHaveTextContent("Unknown");
  view.rerender(<ChampionOverviewPage overview={{ ...overview, buckets: null }} error={null} />);
  expect(screen.queryByRole("region", { name: "When It Wins" })).toBeNull();
});
it("lists allies with expected rates and deltas, keeps filters when sorting, and maps bot lanes", () => {
  const { container } = render(<ChampionOverviewPage overview={overview} error={null} />);
  // The top allies show first; the full list and bot-lane pairs open below them.
  const allies = screen.getByRole("table", { name: "Top Allies" });
  expect(within(allies).getByRole("img", { name: "Thresh" })).toBeVisible();
  expect(allies).toHaveTextContent(/Support.*80.*60\.0%.*55\.0%.*\+3\.1 pts/);
  expect(within(allies).getByRole("link", { name: "Thresh" })).toHaveAttribute(
    "href",
    "/champions/Thresh",
  );
  const hidden = [...container.querySelectorAll<HTMLInputElement>("input[type=hidden]")].map(
    (i) => `${i.name}=${i.value}`,
  );
  expect(hidden).toEqual(expect.arrayContaining(["source=solo", "role=MIDDLE", "tier=CHALLENGER"]));
  expect(screen.getAllByText("Bot-Lane Pairs: Win Rate (%)")[0]).toBeInTheDocument();
  expect(screen.getByText("Show All 1 Allies")).toBeVisible();
  expect(screen.getByText("1 allies · Page 1")).toBeInTheDocument();
});
it("shows pro presence, sides and draft order with samples, and reports unmapped names", () => {
  const view = render(<ChampionOverviewPage overview={pro} error={null} />);
  const stats = screen.getByLabelText("Pro-Play Statistics");
  expect(stats).toHaveTextContent("Presence40 Games50.0%");
  expect(stats).toHaveTextContent("Picks / BansDrafts12 / 8");
  expect(stats).toHaveTextContent("Win Rate12 Results50.0%");
  expect(stats).toHaveTextContent("Blue Side Win Rate5 Picks · 5 Results60.0%");
  expect(stats).toHaveTextContent("Red Side Win Rate7 Picks · 0 ResultsUnknown");
  expect(stats).toHaveTextContent("Blind Pick12 Picks · 75.0% Counter25.0%");
  // The pro view has no tier box or solo-queue sections.
  expect(screen.queryByLabelText("Headline Statistics")).toBeNull();
  expect(screen.queryByRole("region", { name: "Runes" })).toBeNull();
  expect(screen.getByText(/no champion mapping: Mel/)).toBeVisible();
  view.rerender(
    <ChampionOverviewPage
      overview={{ ...pro, pro: { ...overview.pro, patch: null, leagues: [] } }}
      error={null}
    />,
  );
  expect(screen.getByText("No pro drafts imported yet.")).toBeVisible();
});
it("shows how the champion performs in pro play once picked, with unknown values left empty", () => {
  render(<ChampionOverviewPage overview={pro} error={null} />);
  const stats = screen.getByLabelText("Pro-Play Performance");
  for (const text of [
    "KDA12 Games4.50",
    "Gold / Minute0 GamesUnknown",
    "Damage / Minute12 Games640",
    "Gold Diff @1512 Games+245",
    "CS Diff @1512 Games-3.5",
    "Kill Participation12 Games68.0%",
    "Game Length12 Games32:00",
  ])
    expect(stats).toHaveTextContent(text);
});

it("shows solo-queue performance once picked, leaving out what solo queue does not record", () => {
  render(<ChampionOverviewPage overview={overview} error={null} />);
  const stats = screen.getByLabelText("Solo-Queue Performance");
  expect(stats).toHaveTextContent("KDA60 Games3.10");
  expect(stats).toHaveTextContent("Damage / Minute60 Games813");
  expect(stats).toHaveTextContent("Game Length60 Games29:05");
  expect(stats).not.toHaveTextContent("Gold Diff @15");
  expect(stats).not.toHaveTextContent("First Blood");
});

it("lists the champion by league and its pro players, with small samples shown as a dash", () => {
  render(<ChampionOverviewPage overview={pro} error={null} />);
  const leagues = screen.getByRole("table", { name: "Ahri by League" });
  const [lck, lec] = within(leagues).getAllByRole("row").slice(1);
  expect(lck).toHaveTextContent("LCK3053.3%10 / 660.0%");
  expect(lec).toHaveTextContent("LEC1040.0%2 / 2—");
  expect(within(lck!).getByRole("link", { name: "LCK" })).toHaveAttribute(
    "href",
    "/champions/Ahri?source=pro&role=MIDDLE&region=LCK&patch=16.22",
  );
  const players = screen.getByRole("table", { name: "Ahri Pro Players" });
  const [faker, caps] = within(players).getAllByRole("row").slice(1);
  expect(within(faker!).getByRole("link", { name: "Faker" })).toHaveAttribute(
    "href",
    "/players/faker",
  );
  expect(faker).toHaveTextContent("FakerT1LCK1070.0%5.25");
  expect(caps).toHaveTextContent("CapsUnknown TeamLEC2—Unknown");
  expect(within(caps!).queryByRole("link")).toBeNull();
});
it("lists pro play by patch, linking each patch, with unknown rates left empty", () => {
  render(<ChampionOverviewPage overview={pro} error={null} />);
  const table = screen.getByRole("table", { name: "Ahri Pro Play by Patch" });
  const [row] = within(table).getAllByRole("row").slice(1);
  expect(row).toHaveTextContent("16.224050.0%12850.0% (12)60.0%Unknown");
  expect(within(row!).getByRole("link", { name: "16.22" })).toHaveAttribute(
    "href",
    "/champions/Ahri?source=pro&role=MIDDLE&patch=16.22",
  );
  expect(screen.getByText("13 patches")).toBeVisible();
  expect(screen.getByRole("navigation", { name: "Patch History Pages" })).toBeVisible();
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
  metrics: Object.fromEntries(
    matchupMetrics.map((metric) => [
      metric,
      metric === "winRate"
        ? { raw: shrunk, shrunk, sampleCount: games, baseline: 0.5, baselineSampleCount: 400 }
        : { raw: 120, shrunk: 100, sampleCount: games, baseline: 0, baselineSampleCount: 400 },
    ]),
  ) as MatchupRow["metrics"],
});
it("shows the best and worst lane opponents as cards with signed differences", () => {
  const view = render(
    <ChampionOverviewPage
      overview={overview}
      error={null}
      matchupSummary={{
        role: "MIDDLE",
        source: "solo",
        patches: ["16.22"],
        opponents: 12,
        best: [opponent("Zed", 238, 0.556, 80)],
        worst: [opponent("Annie", 1, 0.47, 64)],
        all: [opponent("Zed", 238, 0.556, 80), opponent("Annie", 1, 0.47, 64)],
      }}
    />,
  );
  const cards = screen.getByRole("region", { name: "Matchups Mid" });
  expect(within(cards).getByRole("region", { name: "Good Against" })).toHaveTextContent(
    "+5.6%55.6% WR · 80 Games",
  );
  expect(within(cards).getByRole("region", { name: "Bad Against" })).toHaveTextContent(
    "-3.0%47.0% WR · 64 Games",
  );
  expect(within(cards).getAllByRole("link", { name: /Zed/ })[0]).toHaveAttribute(
    "href",
    "/champions/Zed",
  );
  // Every opponent is listed in place, with its lane differences.
  expect(screen.getByText("Show All 12 Opponents")).toBeVisible();
  const all = within(cards).getByRole("table", { name: "All Lane Opponents" });
  expect(all).toHaveTextContent(/Zed.*80.*55\.6%.*\+120/);
  view.rerender(
    <ChampionOverviewPage
      overview={overview}
      error={null}
      matchupSummary={{
        role: "MIDDLE",
        source: "solo",
        patches: ["16.22"],
        opponents: 0,
        best: [],
        worst: [],
        all: [],
      }}
    />,
  );
  expect(screen.queryByRole("region", { name: /Matchups Mid/ })).toBeNull();
});
