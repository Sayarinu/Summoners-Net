import type { PoolClient } from "pg";
import {
  bucketKinds,
  bucketLabels,
  goldBuckets,
  lengthBuckets,
  levelBuckets,
  type ChampionBuckets,
} from "../domain/buckets.js";
import { applySamplePolicy } from "../domain/statistics.js";
import type { Executor } from "./database.js";

/** SQL for a bucket index, from the same definitions the application labels them with. */
function bucketCase(expression: string, buckets: readonly { max: number | null }[]) {
  const whens = buckets
    .map((b, i) => (b.max === null ? null : `WHEN ${expression}<${b.max} THEN ${i}`))
    .filter(Boolean)
    .join(" ");
  return `CASE ${whens} ELSE ${buckets.length - 1} END`;
}

/**
 * Rebuilds one patch's solo-queue length and lead buckets inside the caller's transaction.
 * Length counts every non-remake game with a duration; leads need the lane opponent (the one
 * enemy in the same position) and both players' frames at that minute.
 */
export async function rebuildBuckets(c: PoolClient, patchKey: string, now: Date) {
  await c.query("DELETE FROM champion_buckets WHERE patch_key=$1", [patchKey]);
  const inserted = await c.query(
    `WITH players AS (
       SELECT m.match_id,p.participant_id,p.team_id,p.champion_id AS champion_key,
         CASE WHEN p.team_position IN ('TOP','JUNGLE','MIDDLE','BOTTOM','UTILITY')
           THEN p.team_position ELSE 'UNKNOWN' END AS role,p.win,m.duration_seconds,
         coalesce(m.queue_id::text,'unknown') AS queue,i.region,
         coalesce((SELECT e.tier FROM riot_ladder_entries e WHERE e.puuid=i.first_seen_puuid
           ORDER BY e.fetched_at DESC LIMIT 1),'UNKNOWN') AS tier
       FROM riot_matches m JOIN riot_match_ids i USING (match_id)
       JOIN riot_match_participants p USING (match_id)
       WHERE m.patch_key=$1 AND m.remake IS NOT TRUE),
     opponents AS (
       SELECT p.match_id,p.participant_id,min(o.participant_id) AS opponent
       FROM players p JOIN riot_match_participants o ON o.match_id=p.match_id
         AND o.team_id<>p.team_id AND o.team_position=p.role
       WHERE p.role<>'UNKNOWN'
       GROUP BY p.match_id,p.participant_id HAVING count(*)=1),
     leads AS (
       SELECT p.*,minutes.minute,f.total_gold-g.total_gold AS gold,f.level-g.level AS level
       FROM players p JOIN opponents o USING (match_id,participant_id)
       CROSS JOIN (VALUES (10),(15)) minutes(minute)
       JOIN riot_timeline_frames f ON f.match_id=p.match_id AND f.participant_id=p.participant_id
         AND f.minute=minutes.minute
       JOIN riot_timeline_frames g ON g.match_id=p.match_id AND g.participant_id=o.opponent
         AND g.minute=minutes.minute),
     bucketed AS (
       SELECT queue,region,tier,champion_key,role,win,'length' AS kind,
         ${bucketCase("duration_seconds/60.0", lengthBuckets)} AS bucket
       FROM players WHERE duration_seconds IS NOT NULL
       UNION ALL
       SELECT queue,region,tier,champion_key,role,win,'gold'||minute,${bucketCase("gold", goldBuckets)}
       FROM leads WHERE gold IS NOT NULL
       UNION ALL
       SELECT queue,region,tier,champion_key,role,win,'level'||minute,
         ${bucketCase("level", levelBuckets)}
       FROM leads WHERE level IS NOT NULL)
     INSERT INTO champion_buckets(patch_key,queue,region,tier,champion_key,role,kind,bucket,games,
       result_games,wins,built_at)
     SELECT $1,queue,region,tier,champion_key,role,kind,bucket,count(*),count(win),
       count(*) FILTER(WHERE win),$2
     FROM bucketed GROUP BY queue,region,tier,champion_key,role,kind,bucket`,
    [patchKey, now],
  );
  return inserted.rowCount ?? 0;
}

/** Every bucket of every kind for a champion, summed over the filters; empty buckets are null. */
export async function championBuckets(
  db: Executor,
  input: {
    championKey: number;
    patch: string;
    role: string;
    region?: string | undefined;
    tier?: string | undefined;
  },
): Promise<ChampionBuckets> {
  const rows = await db.query<{
    kind: (typeof bucketKinds)[number];
    bucket: number;
    games: number;
    result_games: number;
    wins: number;
  }>(
    `SELECT kind,bucket,sum(games)::integer AS games,sum(result_games)::integer AS result_games,
       sum(wins)::integer AS wins
     FROM champion_buckets WHERE patch_key=$1 AND champion_key=$2 AND ($3='ALL' OR role=$3)
       AND ($4::text IS NULL OR region=$4) AND ($5::text IS NULL OR tier=$5)
     GROUP BY kind,bucket`,
    [input.patch, input.championKey, input.role, input.region ?? null, input.tier ?? null],
  );
  return Object.fromEntries(
    bucketKinds.map((kind) => [
      kind,
      bucketLabels[kind].map((label, index) => {
        const row = rows.rows.find((r) => r.kind === kind && r.bucket === index);
        const rate = applySamplePolicy({
          value: row?.result_games ? row.wins / row.result_games : null,
          sampleCount: row?.result_games ?? 0,
        });
        return {
          index,
          label,
          games: row?.games ?? 0,
          winRate: { value: rate.value, sampleCount: rate.sampleCount },
        };
      }),
    ]),
  ) as ChampionBuckets;
}
