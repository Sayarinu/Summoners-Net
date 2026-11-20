// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  tierList: vi.fn(),
  championMatchups: vi.fn(),
  matchupPairs: vi.fn(),
  counterPickList: vi.fn(),
  patchOverview: vi.fn(),
  draftAnalytics: vi.fn(),
  wpaLeaderboard: vi.fn(),
  trending: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("./data", () => ({ data: () => mocks }));
const { exportRowLimit, exportTables, loadExport } = await import("./exports");

const champion = (k: number) => ({
  championKey: k,
  championId: `C${k}`,
  name: k === 2 ? "Kai'Sa, Daughter" : `Champion ${k}`,
  imageUrl: null,
});
const row = (k: number) => ({
  ...champion(k),
  role: "MIDDLE",
  games: 12,
  wins: 6,
  winRate: { value: 0.5, sampleCount: 12, lower: 0.25, upper: 0.75 },
  pickRate: { value: null, sampleCount: 0 },
  banRate: { value: 0, sampleCount: 100 },
  sample: "shown",
});
const tierPage = (page: number, total: number, size = 50) => ({
  query: {},
  patch: "16.22",
  sliceGames: 100,
  facets: { patches: [], regions: [], tiers: [] },
  page: {
    page,
    pageSize: size,
    total,
    items: Array.from({ length: Math.max(0, Math.min(size, total - (page - 1) * size)) }, (_, i) =>
      row((page - 1) * size + i + 1),
    ),
  },
});
async function text(result: Awaited<ReturnType<typeof loadExport>>) {
  if (typeof result === "string") throw new Error(result);
  const lines = [result.header.join(",")];
  for await (const r of result.rows) lines.push(r.map((c) => (c ?? "") as string).join("|"));
  return { filename: result.filename, lines };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.tierList.mockImplementation(({ page }: { page: number }) =>
    Promise.resolve(tierPage(page, 120)),
  );
});

it("validates the table and filters before reading data", async () => {
  expect(await loadExport("sql", new URLSearchParams())).toBe("not-found");
  expect(await loadExport("constructor", new URLSearchParams())).toBe("not-found");
  for (const query of ["role=SUPPORT", "role=MIDDLE&role=TOP", "sort=name", "unknown=1"])
    expect(await loadExport("tier-list", new URLSearchParams(query))).toBe("invalid");
  expect(await loadExport("patch-trends", new URLSearchParams("patch=latest"))).toBe("invalid");
  expect(await loadExport("draft-roles", new URLSearchParams())).toBe("invalid");
  expect(mocks.tierList).not.toHaveBeenCalled();
  expect(exportTables).toEqual([
    "tier-list",
    "wpa",
    "champion-matchups",
    "matchup-matrix",
    "counter-picks",
    "trending",
    "patch-trends",
    "patch-builds",
    "patch-pro",
    "draft-priorities",
    "draft-roles",
  ]);
});

it("pages through every row with the page's filters, ignoring paging and 'all'", async () => {
  const { filename, lines } = await text(
    await loadExport(
      "tier-list",
      new URLSearchParams("role=MIDDLE&region=all&page=3&sort=winRate&patch="),
    ),
  );
  expect(mocks.tierList.mock.calls.map((c) => c[0] as unknown)).toEqual([
    { source: "solo", role: "MIDDLE", sort: "winRate", order: "desc", page: 1 },
    { source: "solo", role: "MIDDLE", sort: "winRate", order: "desc", page: 2 },
    { source: "solo", role: "MIDDLE", sort: "winRate", order: "desc", page: 3 },
  ]);
  expect(filename).toBe("tier-list-solo-16.22-MIDDLE.csv");
  expect(lines).toHaveLength(121);
  expect(lines[0]).toBe(
    "source,patch,champion_key,champion_id,champion_name,role,games,wins,win_rate,win_rate_sample,win_rate_lower,win_rate_upper,pick_rate,pick_rate_sample,ban_rate,ban_rate_sample",
  );
  // Unknown stays empty with its sample count; a measured zero stays zero.
  expect(lines[1]).toBe("solo|16.22|1|C1|Champion 1|MIDDLE|12|6|0.5|12|0.25|0.75||0|0|100");
});

it("stops at the row bound", async () => {
  mocks.tierList.mockImplementation(({ page }: { page: number }) =>
    Promise.resolve(tierPage(page, exportRowLimit + 500)),
  );
  const { lines } = await text(await loadExport("tier-list", new URLSearchParams()));
  expect(lines).toHaveLength(exportRowLimit + 1);
  expect(mocks.tierList).toHaveBeenCalledTimes(exportRowLimit / 50 + 1);
});

it("exports matchups, pairs and counter-pick values with samples and source identifiers", async () => {
  const estimate = {
    raw: null,
    shrunk: null,
    sampleCount: 3,
    baseline: 0.5,
    baselineSampleCount: 40,
  };
  mocks.championMatchups.mockResolvedValueOnce(null);
  expect(await loadExport("champion-matchups", new URLSearchParams("champion=Nope"))).toBe(
    "not-found",
  );
  mocks.championMatchups.mockResolvedValue({
    champion: champion(103),
    patch: "16.22",
    page: {
      page: 1,
      pageSize: 100,
      total: 1,
      items: [
        {
          opponent: champion(2),
          games: 3,
          metrics: Object.fromEntries(
            [
              "winRate",
              "gold10",
              "gold15",
              "xp10",
              "xp15",
              "cs10",
              "cs15",
              "firstBlood",
              "firstTower",
            ].map((m) => [m, estimate]),
          ),
        },
      ],
    },
  });
  const matchups = await text(
    await loadExport(
      "champion-matchups",
      new URLSearchParams("champion=Ahri&role=MIDDLE&value=raw"),
    ),
  );
  expect(mocks.championMatchups).toHaveBeenLastCalledWith(
    expect.objectContaining({ champion: "Ahri", role: "MIDDLE", page: 1, pageSize: 100 }),
  );
  expect(
    matchups.lines[1]!.startsWith(
      "solo|16.22|MIDDLE|103|C103|Champion 103|2|C2|Kai'Sa, Daughter|3|||3|0.5|40",
    ),
  ).toBe(true);

  mocks.matchupPairs.mockResolvedValue({
    patch: "16.22",
    page: {
      page: 1,
      pageSize: 200,
      total: 1,
      items: [{ champion: champion(1), opponent: champion(2), games: 11, estimate }],
    },
  });
  const pairs = await text(
    await loadExport("matchup-matrix", new URLSearchParams("role=TOP&metric=gold10&columnPage=4")),
  );
  expect(mocks.matchupPairs).toHaveBeenCalledWith({
    source: "solo",
    role: "TOP",
    metric: "gold10",
    page: 1,
  });
  expect(pairs.lines[1]).toBe(
    "solo|16.22|TOP|gold10|1|C1|Champion 1|2|C2|Kai'Sa, Daughter|11|||3|0.5|40",
  );

  mocks.counterPickList.mockResolvedValue({
    patch: "16.22",
    page: {
      page: 1,
      pageSize: 100,
      total: 1,
      items: [
        {
          champion: champion(1),
          games: 32,
          coveredPicks: 30,
          rolePicks: 32,
          coverage: 0.9375,
          blind: null,
          counter: null,
          difference: null,
          score: null,
          counterOpponents: 0,
          counterPicks: 0,
          reason: "few-opponents",
          counterReason: "blind-unavailable",
        },
      ],
    },
  });
  const counter = await text(await loadExport("counter-picks", new URLSearchParams("role=MIDDLE")));
  expect(counter.lines[1]).toBe(
    "solo|16.22|MIDDLE|1|C1|Champion 1|32|||||30|32|0.9375|0|0|few-opponents|blind-unavailable",
  );
});

it("exports patch overview and draft tables, and reports unknown patches", async () => {
  mocks.patchOverview.mockResolvedValueOnce(null);
  expect(await loadExport("patch-pro", new URLSearchParams("patch=16.99"))).toBe("not-found");
  mocks.patchOverview.mockResolvedValue({
    patch: "16.22",
    previousPatch: "16.21",
    risers: [],
    fallers: [],
    builds: [],
    pro: [
      {
        ...champion(1),
        picks: 3,
        bans: 4,
        presence: { value: 0.7, sampleCount: 10 },
        sample: "low-sample",
      },
    ],
  });
  expect(
    (await text(await loadExport("patch-pro", new URLSearchParams("patch=16.22")))).lines,
  ).toEqual([
    "patch,champion_key,champion_id,champion_name,picks,bans,presence,presence_sample,sample_status",
    "16.22|1|C1|Champion 1|3|4|0.7|10|low-sample",
  ]);
  expect(
    (await text(await loadExport("patch-trends", new URLSearchParams("patch=16.22")))).lines,
  ).toHaveLength(1);
  mocks.draftAnalytics.mockImplementation(({ rolePage }: { rolePage?: number }) =>
    Promise.resolve({
      priorities: { page: 1, pageSize: 25, total: 0, items: [] },
      roles: {
        page: rolePage ?? 1,
        pageSize: 1,
        total: 2,
        items: [
          {
            champion: rolePage === 2 ? "Nunu" : "Ahri",
            role: "mid",
            games: 4,
            blindRate: { value: null, sampleCount: 4 },
            counterRate: { value: 0.5, sampleCount: 4 },
          },
        ],
      },
    }),
  );
  const roles = await text(
    await loadExport("draft-roles", new URLSearchParams("patch=16.22&league=LCK&rolePage=9")),
  );
  expect(roles.filename).toBe("draft-roles-16.22-LCK.csv");
  expect(roles.lines.slice(1)).toEqual([
    "16.22|LCK|Ahri|mid|4||4|0.5|4",
    "16.22|LCK|Nunu|mid|4||4|0.5|4",
  ]);
});

it("exports WPA boards, trends, new builds and draft priorities", async () => {
  mocks.wpaLeaderboard.mockResolvedValue({
    model: { id: 4 },
    patch: "16.22",
    page: {
      page: 1,
      pageSize: 50,
      total: 1,
      items: [
        {
          kind: "player",
          subject: "puuid-1",
          name: "=cmd#EUW",
          championId: null,
          games: 3,
          total: { value: null, sampleCount: 3 },
          perGame: { value: null, sampleCount: 3 },
        },
      ],
    },
  });
  const wpa = await loadExport("wpa", new URLSearchParams("kind=player"));
  if (typeof wpa === "string") throw new Error(wpa);
  expect((await text(wpa)).lines[1]).toBe("player|16.22|4|puuid-1|=cmd#EUW||3||3||3");
  const share = { value: 0.2, sampleCount: 60 };
  const change = {
    current: share,
    previous: { value: null, sampleCount: 0 },
    delta: null,
    z: null,
    direction: null,
    reason: "missing",
  };
  mocks.trending.mockResolvedValue({
    patch: "16.22",
    previousPatch: "16.21",
    page: {
      page: 1,
      pageSize: 25,
      total: 1,
      items: [{ ...champion(1), role: "ALL", pickRate: change, winRate: change }],
    },
  });
  expect((await text(await loadExport("trending", new URLSearchParams()))).lines[1]).toBe(
    "solo|16.22|16.21|1|C1|Champion 1|ALL|0.2|60||0|||missing|0.2|60||0|||missing",
  );
  mocks.patchOverview.mockResolvedValue({
    patch: "16.22",
    previousPatch: "16.21",
    risers: [{ ...champion(1), metric: "pick", change }],
    fallers: [],
    builds: [
      {
        ...champion(2),
        role: "BOTTOM",
        items: [{ id: 3031 }, { id: 3006 }],
        games: 55,
        share,
        previousSample: 70,
      },
    ],
    pro: [],
  });
  expect(
    (await text(await loadExport("patch-builds", new URLSearchParams("patch=16.22")))).lines[1],
  ).toBe("16.22|2|C2|Kai'Sa, Daughter|BOTTOM|3031 3006|55|0.2|60|70");
  expect(
    (await text(await loadExport("patch-trends", new URLSearchParams("patch=16.22")))).lines[1],
  ).toBe("16.22|16.21|1|C1|Champion 1|pick||0.2|60||0|||missing");
  mocks.draftAnalytics.mockResolvedValue({
    priorities: {
      page: 1,
      pageSize: 25,
      total: 1,
      items: [
        {
          champion: "Ahri",
          action: "pick",
          phase: 1,
          slot: null,
          games: 4,
          rate: { value: 0.25, sampleCount: 4 },
        },
      ],
    },
    roles: { page: 1, pageSize: 25, total: 0, items: [] },
  });
  expect(
    (await text(await loadExport("draft-priorities", new URLSearchParams("patch=16.22")))).lines[1],
  ).toBe("16.22||Ahri|pick|1||4|0.25|4");
});
