import type { PoolClient } from "pg";
import {
  championBlindabilityQuerySchema,
  counterPickListQuerySchema,
  roleDraftValues,
  type BlindabilityMatchup,
  type BlindabilityReason,
  type ChampionBlindability,
  type ChampionBlindabilityQuery,
  type CounterPickList,
  type CounterPickListQuery,
  type CounterPickReason,
  type CounterPickRow,
} from "../domain/blindability.js";
import type { MetricCounts } from "../domain/matchups.js";
import type { PatchChampion } from "../domain/patch-overview.js";
import type { Executor } from "./database.js";

/** Rebuild one source and patch from its freshly rebuilt matchup samples, in the caller's transaction. */
export async function rebuildBlindability(
  c: PoolClient,
  source: "solo" | "pro",
  patch: string,
  now: Date,
) {
  await c.query("DELETE FROM blindability_scores WHERE source=$1 AND patch_key=$2", [
    source,
    patch,
  ]);
  const rows = (
    await c.query<{
      champion_key: number;
      opponent_key: number;
      role: string;
      games: number;
      win_rate: MetricCounts | null;
    }>(
      `SELECT champion_key,opponent_key,role,games,metrics->'winRate' AS win_rate
       FROM matchup_aggregates WHERE source=$1 AND patch_key=$2`,
      [source, patch],
    )
  ).rows;
  // A champion's picks in a role are its paired lane games there, as either side of the pair.
  const roles = new Map<
    string,
    { picks: Map<number, number>; samples: Map<number, BlindabilityMatchup[]> }
  >();
  for (const r of rows) {
    const role = roles.get(r.role) ?? {
      picks: new Map<number, number>(),
      samples: new Map<number, BlindabilityMatchup[]>(),
    };
    roles.set(r.role, role);
    role.picks.set(r.champion_key, (role.picks.get(r.champion_key) ?? 0) + r.games);
    role.samples.set(r.champion_key, [
      ...(role.samples.get(r.champion_key) ?? []),
      {
        opponentKey: r.opponent_key,
        games: r.games,
        winRate: r.win_rate ?? { total: null, count: 0 },
      },
    ]);
  }
  const scores = [...roles].flatMap(([role, { picks, samples }]) =>
    [...roleDraftValues(samples, picks)].map(([championKey, value]) => ({
      role,
      championKey,
      ...value,
    })),
  );
  if (scores.length === 0) return 0;
  const column = <K extends keyof (typeof scores)[number]>(k: K) => scores.map((s) => s[k]);
  const inserted = await c.query(
    `INSERT INTO blindability_scores(source,patch_key,champion_key,role,games,sampled_opponents,
       covered_opponents,covered_picks,role_picks,expected,worst_case,worst_opponent_key,variance,
       lower_tail,reason,counter_win_rate,counter_opponents,counter_picks,counter_reason,built_at)
     SELECT $1,$2,*,$20 FROM unnest($3::integer[],$4::text[],$5::integer[],$6::integer[],$7::integer[],
       $8::integer[],$9::integer[],$10::double precision[],$11::double precision[],$12::integer[],
       $13::double precision[],$14::double precision[],$15::text[],$16::double precision[],
       $17::integer[],$18::integer[],$19::text[])`,
    [
      source,
      patch,
      column("championKey"),
      column("role"),
      column("games"),
      column("sampledOpponents"),
      column("coveredOpponents"),
      column("coveredPicks"),
      column("rolePicks"),
      column("expected"),
      column("worstCase"),
      column("worstOpponentKey"),
      column("variance"),
      column("lowerTail"),
      column("reason"),
      column("counterWinRate"),
      column("counterOpponents"),
      column("counterPicks"),
      column("counterReason"),
      now,
    ],
  );
  return inserted.rowCount ?? 0;
}

/** Catalog name and icon for a champion key, preferring the scored patch. */
const champion = (key: string, alias: string) => `LEFT JOIN LATERAL (
        SELECT c.champion_id,c.name,i.asset_hash FROM catalog_champions c JOIN patches p USING(patch_key)
        LEFT JOIN catalog_images i ON i.patch_key=c.patch_key AND i.kind='champion' AND i.catalog_id=c.champion_id
        WHERE c.champion_key=${key} ORDER BY (c.patch_key=s.patch_key) DESC,p.release_order DESC LIMIT 1
      ) ${alias} ON true`;
const championJson = (key: string, alias: string) =>
  `jsonb_build_object('championKey',${key},'championId',${alias}.champion_id,'name',${alias}.name,
    'imageUrl',CASE WHEN ${alias}.asset_hash IS NULL THEN NULL ELSE '/api/images/'||${alias}.asset_hash END)`;

/** The stored score for one champion, role, source and patch; null when nothing was stored. */
export async function championBlindability(
  db: Executor,
  input: ChampionBlindabilityQuery,
): Promise<ChampionBlindability | null> {
  const q = championBlindabilityQuerySchema.parse(input);
  const row = (
    await db.query<{
      games: number;
      sampledOpponents: number;
      coveredOpponents: number;
      coveredPicks: number;
      rolePicks: number;
      expected: number | null;
      worstCase: number | null;
      variance: number | null;
      lowerTail: number | null;
      reason: BlindabilityReason | null;
      counterWinRate: number | null;
      counterOpponents: number;
      counterPicks: number;
      counterReason: CounterPickReason | null;
      builtAt: Date;
      worstOpponent: PatchChampion | null;
    }>(
      `SELECT s.games,s.sampled_opponents AS "sampledOpponents",s.covered_opponents AS "coveredOpponents",
        s.covered_picks AS "coveredPicks",s.role_picks AS "rolePicks",s.expected,s.worst_case AS "worstCase",
        s.variance,s.lower_tail AS "lowerTail",s.reason,s.counter_win_rate AS "counterWinRate",
        s.counter_opponents AS "counterOpponents",s.counter_picks AS "counterPicks",
        s.counter_reason AS "counterReason",s.built_at AS "builtAt",
        CASE WHEN s.worst_opponent_key IS NOT NULL THEN ${championJson("s.worst_opponent_key", "c")} END AS "worstOpponent"
      FROM blindability_scores s ${champion("s.worst_opponent_key", "c")}
      WHERE s.source=$1 AND s.patch_key=$2 AND s.champion_key=$3 AND s.role=$4`,
      [q.source, q.patch, q.championKey, q.role],
    )
  ).rows[0];
  if (!row) return null;
  return {
    ...row,
    coverage: row.rolePicks > 0 ? row.coveredPicks / row.rolePicks : null,
    score: row.lowerTail,
    counterDifference:
      row.counterWinRate === null || row.expected === null
        ? null
        : row.counterWinRate - row.expected,
    builtAt: row.builtAt.toISOString(),
  };
}

const sortColumns = {
  difference: "s.counter_win_rate-s.expected",
  counter: "s.counter_win_rate",
  blind: "s.expected",
  score: "s.lower_tail",
  games: "s.games",
} as const;
/** One role's champions with blind and counter-pick values, sorted and paged in SQL. */
export async function counterPickList(
  db: Executor,
  input: CounterPickListQuery,
): Promise<CounterPickList> {
  const q = counterPickListQuerySchema.parse(input);
  const order = q.order === "asc" ? "ASC" : "DESC";
  const row = (
    await db.query<{
      patch: string | null;
      patches: string[];
      total: number;
      items: CounterPickRow[];
    }>(
      `WITH available AS (
        SELECT p.patch_key,p.release_order FROM patches p
        WHERE EXISTS (SELECT 1 FROM blindability_scores b WHERE b.source=$1 AND b.patch_key=p.patch_key)
      ), chosen AS (
        SELECT patch_key FROM patches WHERE patch_key=coalesce($2::text,
          (SELECT patch_key FROM available ORDER BY release_order DESC LIMIT 1))
      ), scoped AS (
        SELECT * FROM blindability_scores
        WHERE source=$1 AND patch_key=(SELECT patch_key FROM chosen) AND role=$3
      ), selected AS (
        SELECT s.*,${sortColumns[q.sort]} AS sort_value FROM scoped s
        ORDER BY sort_value ${order} NULLS LAST,s.champion_key LIMIT $4 OFFSET $5
      ), rows AS (
        SELECT s.sort_value,s.champion_key,${championJson("s.champion_key", "c")} AS champion,
          s.games,s.covered_picks AS "coveredPicks",s.role_picks AS "rolePicks",
          CASE WHEN s.role_picks>0 THEN s.covered_picks::double precision/s.role_picks END AS coverage,
          s.expected AS blind,s.counter_win_rate AS counter,s.counter_win_rate-s.expected AS difference,
          s.lower_tail AS score,s.counter_opponents AS "counterOpponents",s.counter_picks AS "counterPicks",
          s.reason,s.counter_reason AS "counterReason"
        FROM selected s ${champion("s.champion_key", "c")}
      )
      SELECT (SELECT patch_key FROM chosen) AS patch,
        coalesce((SELECT jsonb_agg(patch_key ORDER BY release_order DESC) FROM (
          SELECT * FROM available ORDER BY release_order DESC LIMIT 50) a),'[]') AS patches,
        (SELECT count(*)::integer FROM scoped) AS total,
        coalesce((SELECT jsonb_agg(to_jsonb(rows)-'sort_value'-'champion_key'
          ORDER BY sort_value ${order} NULLS LAST,champion_key) FROM rows),'[]') AS items`,
      [q.source, q.patch ?? null, q.role, q.pageSize, (q.page - 1) * q.pageSize],
    )
  ).rows[0]!;
  return {
    query: q,
    patch: row.patch,
    patches: row.patches,
    page: { page: q.page, pageSize: q.pageSize, total: row.total, items: row.items },
  };
}
