import type { PoolClient } from "pg";
import {
  blindability,
  championBlindabilityQuerySchema,
  type BlindabilityMatchup,
  type BlindabilityReason,
  type ChampionBlindability,
  type ChampionBlindabilityQuery,
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
  const picks = new Map<string, Map<number, number>>();
  const samples = new Map<string, BlindabilityMatchup[]>();
  for (const r of rows) {
    const role = picks.get(r.role) ?? new Map<number, number>();
    picks.set(r.role, role.set(r.champion_key, (role.get(r.champion_key) ?? 0) + r.games));
    const key = `${r.role}:${r.champion_key}`;
    samples.set(key, [
      ...(samples.get(key) ?? []),
      {
        opponentKey: r.opponent_key,
        games: r.games,
        winRate: r.win_rate ?? { total: null, count: 0 },
      },
    ]);
  }
  const scores = [...samples].map(([key, matchups]) => {
    const [role, champion] = key.split(":") as [string, string];
    return {
      role,
      championKey: Number(champion),
      ...blindability(Number(champion), matchups, picks.get(role)!),
    };
  });
  if (scores.length === 0) return 0;
  const column = <K extends keyof (typeof scores)[number]>(k: K) => scores.map((s) => s[k]);
  const inserted = await c.query(
    `INSERT INTO blindability_scores(source,patch_key,champion_key,role,games,sampled_opponents,
       covered_opponents,covered_picks,role_picks,expected,worst_case,worst_opponent_key,variance,
       lower_tail,reason,built_at)
     SELECT $1,$2,* ,$16 FROM unnest($3::integer[],$4::text[],$5::integer[],$6::integer[],$7::integer[],
       $8::integer[],$9::integer[],$10::double precision[],$11::double precision[],$12::integer[],
       $13::double precision[],$14::double precision[],$15::text[])`,
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
      now,
    ],
  );
  return inserted.rowCount ?? 0;
}

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
      builtAt: Date;
      worstOpponent: PatchChampion | null;
    }>(
      `SELECT s.games,s.sampled_opponents AS "sampledOpponents",s.covered_opponents AS "coveredOpponents",
        s.covered_picks AS "coveredPicks",s.role_picks AS "rolePicks",s.expected,s.worst_case AS "worstCase",
        s.variance,s.lower_tail AS "lowerTail",s.reason,s.built_at AS "builtAt",
        CASE WHEN s.worst_opponent_key IS NOT NULL THEN jsonb_build_object('championKey',s.worst_opponent_key,
          'championId',c.champion_id,'name',c.name,
          'imageUrl',CASE WHEN c.asset_hash IS NULL THEN NULL ELSE '/api/images/'||c.asset_hash END) END AS "worstOpponent"
      FROM blindability_scores s LEFT JOIN LATERAL (
        SELECT c.champion_id,c.name,i.asset_hash FROM catalog_champions c JOIN patches p USING(patch_key)
        LEFT JOIN catalog_images i ON i.patch_key=c.patch_key AND i.kind='champion' AND i.catalog_id=c.champion_id
        WHERE c.champion_key=s.worst_opponent_key ORDER BY (c.patch_key=s.patch_key) DESC,p.release_order DESC LIMIT 1
      ) c ON true
      WHERE s.source=$1 AND s.patch_key=$2 AND s.champion_key=$3 AND s.role=$4`,
      [q.source, q.patch, q.championKey, q.role],
    )
  ).rows[0];
  if (!row) return null;
  return {
    ...row,
    coverage: row.rolePicks > 0 ? row.coveredPicks / row.rolePicks : null,
    score: row.lowerTail,
    builtAt: row.builtAt.toISOString(),
  };
}
