import type { Pool } from "pg";

/**
 * The stored recording of each given archive game, keyed by game ID: the link opening where the
 * game starts, else the game's own recording, else the link opening at the draft.
 */
export async function archiveGameVods(pool: Pool, gameIds: readonly string[]) {
  if (!gameIds.length) return new Map<string, string>();
  const result = await pool.query<{ id: string; url: string }>(
    `SELECT DISTINCT ON (g.id) g.id,
       coalesce(v.game_start_url,v.vod_url,v.draft_start_url) AS url
     FROM games g
     JOIN oracle_archive_games a ON a.id=g.archive_game_id
     JOIN pro_game_vods v ON v.source_game_id=a.source_game_id
     WHERE g.id=ANY($1::text[])
       AND coalesce(v.game_start_url,v.vod_url,v.draft_start_url) IS NOT NULL
     ORDER BY g.id,v.observed_at DESC`,
    [gameIds],
  );
  return new Map(result.rows.map(({ id, url }) => [id, url]));
}
