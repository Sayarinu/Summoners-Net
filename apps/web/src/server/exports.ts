import "server-only";
import { z } from "zod";
import {
  championMatchupsQuerySchema,
  counterPickListQuerySchema,
  draftQuerySchema,
  matchupMetrics,
  matchupPairsQuerySchema,
  overviewPatchSchema,
  tierListQuerySchema,
  trendingQuerySchema,
  wpaLeaderboardQuerySchema,
  type ProportionTrend,
  type SampledValue,
} from "@summonersnet/data/contracts";
import { data } from "./data";

/** The most rows one export streams; larger tables are cut at this bound. */
export const exportRowLimit = 10000;
export type Cell = string | number | boolean | null | undefined;
export interface Export {
  filename: string;
  header: readonly string[];
  rows: AsyncIterable<Cell[]>;
}

/** Fetches pages until the table, or the row bound, is exhausted. */
async function* paged<T>(
  fetch: (page: number) => Promise<{ items: T[]; total: number; pageSize: number } | null>,
) {
  let sent = 0;
  for (let page = 1; ; page++) {
    const result = await fetch(page);
    if (!result) return;
    for (const item of result.items) {
      if (sent++ >= exportRowLimit) return;
      yield item;
    }
    if (!result.items.length || page * result.pageSize >= result.total) return;
  }
}
async function* map<T>(items: AsyncIterable<T>, row: (item: T) => Cell[]) {
  for await (const item of items) yield row(item);
}
async function* list<T>(items: Promise<T[]>) {
  yield* (await items).slice(0, exportRowLimit);
}
const sampled = (prefix: string) => [prefix, `${prefix}_sample`];
const value = (v: SampledValue) => [v.value, v.sampleCount];
const trend = (prefix: string) => [
  `${prefix}`,
  `${prefix}_sample`,
  `previous_${prefix}`,
  `previous_${prefix}_sample`,
  `${prefix}_change`,
  `${prefix}_z`,
  `${prefix}_result`,
];
const trendValues = (t: ProportionTrend) => [
  t.current.value,
  t.current.sampleCount,
  t.previous.value,
  t.previous.sampleCount,
  t.delta,
  t.z,
  t.reason,
];
const champion = ["champion_key", "champion_id", "champion_name"];
/** Combined patches oldest first, as "16.21+16.22"; one patch stays as it is. */
const patchesOf = (combined: readonly string[]) => [...combined].reverse().join("+") || null;
const name = (stem: string, ...parts: (string | null | undefined)[]) =>
  [stem, ...parts.filter(Boolean)].join("-").replace(/[^A-Za-z0-9.-]/g, "_") + ".csv";

/**
 * Each export takes its page's filters, minus paging, validates them with the page's schema and
 * reads through the data interface. Null means the filters are invalid; undefined, not found.
 */
const exporters: Record<
  string,
  (params: Record<string, string>) => Promise<Export | null | undefined>
> = {
  async "tier-list"(params) {
    const q = tierListQuerySchema.omit({ page: true }).safeParse(params);
    if (!q.success) return null;
    // The export is the raw table: champions below the page's minimum sample are included.
    const every = { minimumGames: 0 };
    const first = await data().tierList({ ...q.data, page: 1 }, every);
    return {
      filename: name("tier-list", q.data.source, patchesOf(first.combined), q.data.role),
      header: [
        "source",
        "patch",
        ...champion,
        "role",
        "games",
        "wins",
        ...sampled("win_rate"),
        "win_rate_lower",
        "win_rate_upper",
        ...sampled("pick_rate"),
        ...sampled("ban_rate"),
      ],
      rows: map(
        paged(
          async (page) =>
            (page === 1 ? first : await data().tierList({ ...q.data, page }, every)).page,
        ),
        (r) => [
          q.data.source,
          patchesOf(first.combined),
          r.championKey,
          r.championId,
          r.name,
          r.role,
          r.games,
          r.wins,
          ...value(r.winRate),
          r.winRate.lower,
          r.winRate.upper,
          ...value(r.pickRate),
          ...value(r.banRate),
        ],
      ),
    };
  },
  async wpa(params) {
    const q = wpaLeaderboardQuerySchema.omit({ page: true }).safeParse(params);
    if (!q.success) return null;
    const first = await data().wpaLeaderboard({ ...q.data, page: 1 });
    return {
      filename: name("wpa", q.data.kind, first.patch),
      header: [
        "kind",
        "patch",
        "model_id",
        "subject",
        "name",
        "champion_id",
        "games",
        ...sampled("total_wpa"),
        ...sampled("wpa_per_game"),
      ],
      rows: map(
        paged(
          async (page) =>
            (page === 1 ? first : await data().wpaLeaderboard({ ...q.data, page })).page,
        ),
        (r) => [
          r.kind,
          first.patch,
          first.model?.id,
          r.subject,
          r.name,
          r.championId,
          r.games,
          ...value(r.total),
          ...value(r.perGame),
        ],
      ),
    };
  },
  async "champion-matchups"(params) {
    const q = championMatchupsQuerySchema.omit({ page: true, pageSize: true }).safeParse(params);
    if (!q.success) return null;
    // The export is the raw table: opponents below the page's minimum sample are included.
    const read = (page: number) =>
      data().championMatchups({ ...q.data, page, pageSize: 100 }, { minimumGames: 0 });
    const first = await read(1);
    if (!first) return undefined;
    return {
      filename: name(
        "matchups",
        first.champion.championId,
        q.data.source,
        patchesOf(first.combined),
        q.data.role,
      ),
      header: [
        "source",
        "patch",
        "role",
        ...champion,
        "opponent_key",
        "opponent_id",
        "opponent_name",
        "games",
        ...matchupMetrics.flatMap((m) => [
          `${m}_raw`,
          `${m}_shrunk`,
          `${m}_sample`,
          `${m}_baseline`,
          `${m}_baseline_sample`,
        ]),
      ],
      rows: map(
        paged(async (page) => (page === 1 ? first : await read(page))?.page ?? null),
        (r) => [
          q.data.source,
          patchesOf(first.combined),
          q.data.role,
          first.champion.championKey,
          first.champion.championId,
          first.champion.name,
          r.opponent.championKey,
          r.opponent.championId,
          r.opponent.name,
          r.games,
          ...matchupMetrics.flatMap((m) => {
            const e = r.metrics[m];
            return [e.raw, e.shrunk, e.sampleCount, e.baseline, e.baselineSampleCount];
          }),
        ],
      ),
    };
  },
  async "matchup-matrix"(params) {
    const q = matchupPairsQuerySchema.omit({ page: true, pageSize: true }).safeParse(params);
    if (!q.success) return null;
    const read = (page: number) => data().matchupPairs({ ...q.data, page });
    const first = await read(1);
    return {
      filename: name("matchup-matrix", q.data.source, first.patch, q.data.role, q.data.metric),
      header: [
        "source",
        "patch",
        "role",
        "metric",
        ...champion,
        "opponent_key",
        "opponent_id",
        "opponent_name",
        "games",
        "raw",
        "shrunk",
        "sample",
        "baseline",
        "baseline_sample",
      ],
      rows: map(
        paged(async (page) => (page === 1 ? first : await read(page)).page),
        (r) => [
          q.data.source,
          first.patch,
          q.data.role,
          q.data.metric,
          r.champion.championKey,
          r.champion.championId,
          r.champion.name,
          r.opponent.championKey,
          r.opponent.championId,
          r.opponent.name,
          r.games,
          r.estimate.raw,
          r.estimate.shrunk,
          r.estimate.sampleCount,
          r.estimate.baseline,
          r.estimate.baselineSampleCount,
        ],
      ),
    };
  },
  async "counter-picks"(params) {
    const q = counterPickListQuerySchema.omit({ page: true, pageSize: true }).safeParse(params);
    if (!q.success) return null;
    const read = (page: number) => data().counterPickList({ ...q.data, page, pageSize: 100 });
    const first = await read(1);
    return {
      filename: name("counter-picks", q.data.source, first.patch, q.data.role),
      header: [
        "source",
        "patch",
        "role",
        ...champion,
        "lane_games",
        "blind_win_rate",
        "counter_pick_win_rate",
        "counter_pick_value",
        "blindability_score",
        "covered_picks",
        "role_picks",
        "coverage",
        "best_response_opponents",
        "best_response_picks",
        "reason",
        "counter_pick_reason",
      ],
      rows: map(
        paged(async (page) => (page === 1 ? first : await read(page)).page),
        (r) => [
          q.data.source,
          first.patch,
          q.data.role,
          r.champion.championKey,
          r.champion.championId,
          r.champion.name,
          r.games,
          r.blind,
          r.counter,
          r.difference,
          r.score,
          r.coveredPicks,
          r.rolePicks,
          r.coverage,
          r.counterOpponents,
          r.counterPicks,
          r.reason,
          r.counterReason,
        ],
      ),
    };
  },
  async trending(params) {
    const q = trendingQuerySchema.omit({ page: true }).safeParse(params);
    if (!q.success) return null;
    const read = (page: number) => data().trending({ ...q.data, page });
    const first = await read(1);
    return {
      filename: name("trending", q.data.source, first.patch, q.data.role),
      header: [
        "source",
        "patch",
        "previous_patch",
        ...champion,
        "role",
        ...trend("pick_rate"),
        ...trend("win_rate"),
      ],
      rows: map(
        paged(async (page) => (page === 1 ? first : await read(page)).page),
        (r) => [
          q.data.source,
          first.patch,
          first.previousPatch,
          r.championKey,
          r.championId,
          r.name,
          r.role,
          ...trendValues(r.pickRate),
          ...trendValues(r.winRate),
        ],
      ),
    };
  },
  async "patch-trends"(params) {
    const patch = z.strictObject({ patch: overviewPatchSchema }).safeParse(params);
    if (!patch.success) return null;
    const o = await data().patchOverview(patch.data.patch);
    if (!o) return undefined;
    return {
      filename: name("patch-trends", o.patch),
      header: ["patch", "previous_patch", ...champion, "metric", "direction", ...trend("rate")],
      rows: map(list(Promise.resolve([...o.risers, ...o.fallers])), (r) => [
        o.patch,
        o.previousPatch,
        r.championKey,
        r.championId,
        r.name,
        r.metric,
        r.change.direction,
        ...trendValues(r.change),
      ]),
    };
  },
  async "patch-builds"(params) {
    const patch = z.strictObject({ patch: overviewPatchSchema }).safeParse(params);
    if (!patch.success) return null;
    const o = await data().patchOverview(patch.data.patch);
    if (!o) return undefined;
    return {
      filename: name("patch-builds", o.patch),
      header: [
        "patch",
        ...champion,
        "role",
        "item_ids",
        "games",
        ...sampled("share"),
        "previous_patch_sample",
      ],
      rows: map(list(Promise.resolve(o.builds)), (r) => [
        o.patch,
        r.championKey,
        r.championId,
        r.name,
        r.role,
        r.items.map((i) => i.id).join(" "),
        r.games,
        ...value(r.share),
        r.previousSample,
      ]),
    };
  },
  async "patch-pro"(params) {
    const patch = z.strictObject({ patch: overviewPatchSchema }).safeParse(params);
    if (!patch.success) return null;
    const o = await data().patchOverview(patch.data.patch);
    if (!o) return undefined;
    return {
      filename: name("patch-pro", o.patch),
      header: ["patch", ...champion, "picks", "bans", ...sampled("presence"), "sample_status"],
      rows: map(list(Promise.resolve(o.pro)), (r) => [
        o.patch,
        r.championKey,
        r.championId,
        r.name,
        r.picks,
        r.bans,
        ...value(r.presence),
        r.sample,
      ]),
    };
  },
  async "draft-priorities"(params) {
    const q = draftQuerySchema.omit({ priorityPage: true, rolePage: true }).safeParse(params);
    if (!q.success) return null;
    const first = await data().draftAnalytics(q.data);
    return {
      filename: name("draft-priorities", q.data.patch, q.data.league),
      header: [
        "patch",
        "league",
        "champion",
        "action",
        "phase",
        "slot",
        "games",
        ...sampled("rate"),
      ],
      rows: map(
        paged(async (page) =>
          page === 1
            ? first.priorities
            : (await data().draftAnalytics({ ...q.data, priorityPage: page })).priorities,
        ),
        (r) => [
          q.data.patch,
          q.data.league,
          r.champion,
          r.action,
          r.phase,
          r.slot,
          r.games,
          ...value(r.rate),
        ],
      ),
    };
  },
  async "draft-roles"(params) {
    const q = draftQuerySchema.omit({ priorityPage: true, rolePage: true }).safeParse(params);
    if (!q.success) return null;
    const first = await data().draftAnalytics(q.data);
    return {
      filename: name("draft-roles", q.data.patch, q.data.league),
      header: [
        "patch",
        "league",
        "champion",
        "role",
        "games",
        ...sampled("blind_rate"),
        ...sampled("counter_rate"),
      ],
      rows: map(
        paged(async (page) =>
          page === 1
            ? first.roles
            : (await data().draftAnalytics({ ...q.data, rolePage: page })).roles,
        ),
        (r) => [
          q.data.patch,
          q.data.league,
          r.champion,
          r.role,
          r.games,
          ...value(r.blindRate),
          ...value(r.counterRate),
        ],
      ),
    };
  },
};
export const exportTables = Object.keys(exporters);

/**
 * Validates the table and its filters. Paging parameters are ignored, "all" and empty values mean
 * no filter, and repeated parameters are rejected.
 */
export async function loadExport(
  table: string,
  params: URLSearchParams,
): Promise<Export | "invalid" | "not-found"> {
  const exporter = Object.hasOwn(exporters, table) ? exporters[table] : undefined;
  if (!exporter) return "not-found";
  const keys = [...params.keys()];
  if (new Set(keys).size !== keys.length) return "invalid";
  const paging = new Set(["page", "pageSize", "columnPage", "priorityPage", "rolePage", "value"]);
  const filters = Object.fromEntries(
    [...params].filter(([k, v]) => !paging.has(k) && v !== "" && v !== "all"),
  );
  const result = await exporter(filters);
  return result === null ? "invalid" : result === undefined ? "not-found" : result;
}
