import type { PoolClient } from "pg";
import { applySamplePolicy, deltaShrinkGames } from "../domain/statistics.js";
import {
  synergyPageSize,
  type BotLaneMatrix,
  type Synergies,
  type SynergyRow,
} from "../domain/synergies.js";
import type { Executor } from "./database.js";

/** Rebuilds one patch's teammate pairs (both directions) inside the caller's transaction. */
export async function rebuildDuos(c: PoolClient, patchKey: string, now: Date) {
  await c.query("DELETE FROM champion_duos WHERE patch_key=$1", [patchKey]);
  const inserted = await c.query(
    `WITH players AS (
       SELECT m.match_id,p.participant_id,p.team_id,p.champion_id AS champion_key,
         CASE WHEN p.team_position IN ('TOP','JUNGLE','MIDDLE','BOTTOM','UTILITY')
           THEN p.team_position ELSE 'UNKNOWN' END AS role,p.win,
         coalesce(m.queue_id::text,'unknown') AS queue,i.region,
         coalesce((SELECT e.tier FROM riot_ladder_entries e WHERE e.puuid=i.first_seen_puuid
           ORDER BY e.fetched_at DESC LIMIT 1),'UNKNOWN') AS tier
       FROM riot_matches m JOIN riot_match_ids i USING (match_id)
       JOIN riot_match_participants p USING (match_id)
       WHERE m.patch_key=$1 AND m.remake IS NOT TRUE)
     INSERT INTO champion_duos(patch_key,queue,region,tier,champion_key,role,ally_key,ally_role,
       games,result_games,wins,built_at)
     SELECT $1,p.queue,p.region,p.tier,p.champion_key,p.role,a.champion_key,a.role,count(*),
       count(p.win),count(*) FILTER(WHERE p.win),$2
     FROM players p JOIN players a ON a.match_id=p.match_id AND a.team_id=p.team_id
       AND a.participant_id<>p.participant_id
     GROUP BY p.queue,p.region,p.tier,p.champion_key,p.role,a.champion_key,a.role`,
    [patchKey, now],
  );
  return inserted.rowCount ?? 0;
}

const names = `
  SELECT DISTINCT ON (c.champion_key) c.champion_key,c.champion_id,c.name,c.patch_key
  FROM catalog_champions c JOIN patches p USING (patch_key)
  ORDER BY c.champion_key,(c.patch_key=$1) DESC,p.release_order DESC`;

/**
 * A champion's allies for a patch, summed over the filters, with the pair's win rate, its
 * expected rate (each champion's win rate in its role, added as distances from 50%) and the
 * shrunk delta. Sorted and paginated in SQL.
 */
export async function championSynergies(
  db: Executor,
  input: {
    championKey: number;
    patch: string;
    role: string;
    region?: string | undefined;
    tier?: string | undefined;
    sort: Synergies["sort"];
    page: number;
  },
): Promise<Synergies> {
  const sortColumn = { games: "games", winRate: "win_rate", delta: "delta" }[input.sort];
  const rows = await db.query<{
    ally_key: number;
    ally_role: string;
    games: number;
    result_games: number;
    wins: number;
    expected: number | null;
    delta: number | null;
    champion_id: string | null;
    name: string | null;
    asset_hash: string | null;
    total: number;
  }>(
    `WITH filtered AS (
       SELECT * FROM champion_aggregates WHERE source='solo' AND patch_key=$1
         AND ($4::text IS NULL OR region=$4) AND ($5::text IS NULL OR tier=$5)),
     rates AS (
       SELECT champion_key,role,sum(wins)::double precision/nullif(sum(result_games),0) AS rate
       FROM filtered GROUP BY champion_key,role),
     duo AS (
       SELECT ally_key,ally_role,sum(games)::integer AS games,
         sum(result_games)::integer AS result_games,sum(wins)::integer AS wins
       FROM champion_duos WHERE patch_key=$1 AND champion_key=$2 AND ($3='ALL' OR role=$3)
         AND ($4::text IS NULL OR region=$4) AND ($5::text IS NULL OR tier=$5)
       GROUP BY ally_key,ally_role),
     scored AS (
       SELECT d.*,d.wins::double precision/nullif(d.result_games,0) AS win_rate,
         least(1,greatest(0,s.rate+a.rate-0.5)) AS expected
       FROM duo d
       LEFT JOIN rates s ON s.champion_key=$2 AND s.role=$3
       LEFT JOIN rates a ON a.champion_key=d.ally_key AND a.role=d.ally_role),
     ranked AS (
       SELECT *,(win_rate-expected)*result_games/(result_games+$6::double precision) AS delta
       FROM scored)
     SELECT r.*,n.champion_id,n.name,i.asset_hash,count(*) OVER()::integer AS total
     FROM ranked r LEFT JOIN (${names}) n ON n.champion_key=r.ally_key
     LEFT JOIN catalog_images i ON i.patch_key=n.patch_key AND i.kind='champion'
       AND i.catalog_id=n.champion_id
     ORDER BY r.${sortColumn} DESC NULLS LAST,r.games DESC,r.ally_key,r.ally_role
     LIMIT $7 OFFSET $8`,
    [
      input.patch,
      input.championKey,
      input.role,
      input.region ?? null,
      input.tier ?? null,
      deltaShrinkGames,
      synergyPageSize,
      (input.page - 1) * synergyPageSize,
    ],
  );
  return {
    sort: input.sort,
    page: {
      items: rows.rows.map((r): SynergyRow => {
        const win = applySamplePolicy({
          value: r.result_games ? r.wins / r.result_games : null,
          sampleCount: r.result_games,
        });
        const delta = applySamplePolicy({ value: r.delta, sampleCount: r.result_games });
        return {
          allyKey: r.ally_key,
          allyId: r.champion_id,
          allyName: r.name,
          allyImageUrl: r.asset_hash ? `/api/images/${r.asset_hash}` : null,
          allyRole: r.ally_role,
          games: r.games,
          winRate: { value: win.value, sampleCount: win.sampleCount },
          expected: r.expected,
          delta: { value: delta.value, sampleCount: delta.sampleCount },
        };
      }),
      page: input.page,
      pageSize: synergyPageSize,
      total: rows.rows[0]?.total ?? 0,
    },
  };
}

/** Win rates of the most played bot-lane carries with the most played supports. */
export async function botLaneMatrix(
  db: Executor,
  input: { patch: string; region?: string | undefined; tier?: string | undefined },
  size = 8,
): Promise<BotLaneMatrix> {
  const pairs = await db.query<{
    carry: number;
    support: number;
    games: number;
    result_games: number;
    wins: number;
  }>(
    `WITH pairs AS (
       SELECT champion_key AS carry,ally_key AS support,sum(games)::integer AS games,
         sum(result_games)::integer AS result_games,sum(wins)::integer AS wins
       FROM champion_duos WHERE patch_key=$1 AND role='BOTTOM' AND ally_role='UTILITY'
         AND ($2::text IS NULL OR region=$2) AND ($3::text IS NULL OR tier=$3)
       GROUP BY champion_key,ally_key),
     carries AS (SELECT carry FROM pairs GROUP BY carry ORDER BY sum(games) DESC,carry LIMIT $4),
     supports AS (SELECT support FROM pairs GROUP BY support ORDER BY sum(games) DESC,support LIMIT $4)
     SELECT p.* FROM pairs p WHERE p.carry IN (SELECT carry FROM carries)
       AND p.support IN (SELECT support FROM supports)
     ORDER BY p.carry,p.support`,
    [input.patch, input.region ?? null, input.tier ?? null, size],
  );
  const keys = [...new Set(pairs.rows.flatMap((p) => [p.carry, p.support]))];
  const named = new Map(
    (
      await db.query<{ champion_key: number; name: string }>(
        `SELECT champion_key,name FROM (${names}) n WHERE champion_key=ANY($2::integer[])`,
        [input.patch, keys],
      )
    ).rows.map((r) => [r.champion_key, r.name]),
  );
  const order = (pick: "carry" | "support") =>
    [...new Set(pairs.rows.map((p) => p[pick]))].map((key) => ({
      key,
      name: named.get(key) ?? null,
    }));
  return {
    carries: order("carry"),
    supports: order("support"),
    cells: pairs.rows.map((p) => {
      const rate = applySamplePolicy({
        value: p.result_games ? p.wins / p.result_games : null,
        sampleCount: p.result_games,
      });
      return {
        carry: p.carry,
        support: p.support,
        games: p.games,
        winRate: { value: rate.value, sampleCount: rate.sampleCount },
      };
    }),
  };
}
