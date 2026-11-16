import {
  leaderboardQuerySchema,
  type Leaderboard,
  type LeaderboardQuery,
  type LeaderboardRow,
} from "../domain/leaderboards.js";
import type { Executor } from "./database.js";

/** One snapshot of the last successful ladder; champion samples cover stored ranked games only. */
export async function leaderboard(db: Executor, input: LeaderboardQuery): Promise<Leaderboard> {
  const q = leaderboardQuerySchema.parse(input);
  const result = await db.query<{
    last_success: Date | null;
    last_attempt: Date | null;
    refresh_failed: boolean;
    total: number;
    items: LeaderboardRow[];
  }>(
    `WITH status AS (
      SELECT last_success,last_attempt,error IS NOT NULL AS refresh_failed
      FROM riot_ladder_status WHERE platform=$1
    ), current AS (
      SELECT e.* FROM riot_ladder_entries e JOIN status s ON e.fetched_at=s.last_success
      WHERE e.platform=$1 AND e.queue='RANKED_SOLO_5x5'
    ), ranked AS (
      SELECT e.*,row_number() OVER (ORDER BY CASE tier WHEN 'CHALLENGER' THEN 0
        WHEN 'GRANDMASTER' THEN 1 ELSE 2 END,league_points DESC,puuid)::integer AS position
      FROM current e
    ), selected AS (
      SELECT * FROM ranked ORDER BY position LIMIT $2 OFFSET $3
    ), rows AS (
      SELECT e.position AS rank,e.puuid,a.game_name AS "gameName",a.tag_line AS "tagLine",
        e.tier,e.league_points AS "leaguePoints",e.wins,e.losses,
        jsonb_build_object('value',e.wins::double precision/nullif(e.wins::bigint+e.losses,0),
          'sampleCount',e.wins::bigint+e.losses) AS "winRate",
        samples.games AS "sampledGames",samples.champions
      FROM selected e LEFT JOIN riot_accounts a USING(puuid)
      CROSS JOIN LATERAL (
        WITH counts AS (
          SELECT p.champion_id,count(*)::integer AS games
          FROM riot_match_participants p JOIN riot_matches m USING(match_id)
          WHERE p.puuid=e.puuid AND lower(m.platform_id)=$1 AND m.queue_id=420
          GROUP BY p.champion_id
        ), top AS (
          SELECT * FROM counts ORDER BY games DESC,champion_id LIMIT 3
        )
        SELECT coalesce((SELECT sum(games)::integer FROM counts),0) AS games,
          coalesce((SELECT jsonb_agg(jsonb_build_object('championKey',t.champion_id,
            'championId',n.champion_id,'name',n.name,'imageUrl',
            CASE WHEN n.asset_hash IS NULL THEN NULL ELSE '/api/images/'||n.asset_hash END,
            'games',t.games) ORDER BY t.games DESC,t.champion_id)
          FROM top t LEFT JOIN LATERAL (
            SELECT c.champion_id,c.name,i.asset_hash FROM catalog_champions c
            JOIN patches p USING(patch_key)
            LEFT JOIN catalog_images i ON i.patch_key=c.patch_key AND i.kind='champion'
              AND i.catalog_id=c.champion_id
            WHERE c.champion_key=t.champion_id ORDER BY p.release_order DESC LIMIT 1
          ) n ON true),'[]'::jsonb) AS champions
      ) samples
    )
    SELECT (SELECT last_success FROM status) AS last_success,
      (SELECT last_attempt FROM status) AS last_attempt,
      coalesce((SELECT refresh_failed FROM status),false) AS refresh_failed,
      (SELECT count(*)::integer FROM current) AS total,
      coalesce((SELECT jsonb_agg(to_jsonb(rows) ORDER BY rank) FROM rows),'[]'::jsonb) AS items`,
    [q.region, q.pageSize, (q.page - 1) * q.pageSize],
  );
  const row = result.rows[0]!;
  return {
    query: q,
    lastSuccess: row.last_success?.toISOString() ?? null,
    lastAttempt: row.last_attempt?.toISOString() ?? null,
    refreshFailed: row.refresh_failed,
    page: { page: q.page, pageSize: q.pageSize, total: row.total, items: row.items },
  };
}
