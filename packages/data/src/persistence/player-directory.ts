import type { Executor } from "./database.js";
import { leagueOrder } from "./team-directory.js";
import {
  directoryQuerySchema,
  type DirectoryQuery,
  type Identity,
  type Page,
} from "../domain/models.js";

export type PlayerDirectoryEntry = Identity & { team: Identity | null };

/**
 * Lists player profiles with their current team: the team of their latest recent game or of a
 * current saved roster, as long as that team played or has a fixture recently. A league filter
 * keeps players whose current team played in that league in its latest season; a role filter
 * matches the player's recorded lane under any of its spellings.
 */
export async function playerDirectory(
  db: Executor,
  input: DirectoryQuery,
  now: Date,
): Promise<Page<PlayerDirectoryEntry>> {
  const q = directoryQuerySchema.parse(input);
  const pattern = q.q.toLowerCase().replace(/[\\%_]/g, "\\$&");
  const { rows } = await db.query<{ items: PlayerDirectoryEntry[]; total: number }>(
    `WITH recent_games AS (
      SELECT id,occurred_at FROM games WHERE occurred_at BETWEEN $3::timestamptz-interval '180 days' AND $3::timestamptz
    ), recent_teams AS (
      SELECT DISTINCT m.entity_id FROM (
        SELECT p.team_id AS id FROM participants p JOIN recent_games g ON g.id=p.game_id
        UNION
        SELECT team->>'id' FROM matches f CROSS JOIN LATERAL jsonb_array_elements(f.document->'teams') team
        WHERE f.starts_at BETWEEN $3::timestamptz-interval '180 days' AND $3::timestamptz+interval '90 days'
          AND f.state IN ('scheduled','live','final')
      ) t JOIN entity_members m ON m.id=t.id
    ), seen AS (
      SELECT p.player_id,p.team_id,g.occurred_at AS seen_at
      FROM participants p JOIN recent_games g ON g.id=p.game_id WHERE p.player_id IS NOT NULL
      UNION ALL
      SELECT r.player_id,r.team_id,s.observed_at FROM roster_observations r
        JOIN roster_snapshots s ON s.team_id=r.team_id AND s.observed_at=r.observed_at
      WHERE s.observed_at BETWEEN $3::timestamptz-interval '30 days' AND $3::timestamptz
    ), current_teams AS (
      SELECT DISTINCT ON (pm.entity_id) pm.entity_id AS player_id,tm.entity_id AS team_id
      FROM seen JOIN entity_members pm ON pm.id=seen.player_id
        JOIN entity_members tm ON tm.id=seen.team_id
        JOIN recent_teams rt ON rt.entity_id=tm.entity_id
      ORDER BY pm.entity_id,seen.seen_at DESC,tm.entity_id
    ), competitions AS (
      SELECT m.entity_id,s.year,s.league,max(s.last_played) AS last_played
      FROM team_competition_seasons s JOIN entity_members m ON m.id=s.team_id
      WHERE $2::text IS NOT NULL AND m.entity_id IN (SELECT team_id FROM current_teams)
      GROUP BY m.entity_id,s.year,s.league
    ), latest AS (
      SELECT DISTINCT ON (entity_id) entity_id,array_agg(league ORDER BY ${leagueOrder}) AS competitions
      FROM competitions GROUP BY entity_id,year ORDER BY entity_id,year DESC
    ), filtered AS (
      SELECT p.id,p.name,p.document || jsonb_build_object('team',t.document - 'aliases') AS document,
        ($1='' AND t.id IS NOT NULL) AS active
      FROM entity_profiles p LEFT JOIN current_teams c ON c.player_id=p.id
        LEFT JOIN entity_profiles t ON t.id=c.team_id
        LEFT JOIN latest l ON l.entity_id=c.team_id
      WHERE p.kind='player' AND ($2::text IS NULL OR $2=ANY(l.competitions))
        AND ($6::text IS NULL OR CASE lower(p.document->>'role')
          WHEN 'top' THEN 'top' WHEN 'jungle' THEN 'jungle' WHEN 'jng' THEN 'jungle'
          WHEN 'jun' THEN 'jungle' WHEN 'mid' THEN 'mid' WHEN 'middle' THEN 'mid'
          WHEN 'bottom' THEN 'bottom' WHEN 'bot' THEN 'bottom' WHEN 'adc' THEN 'bottom'
          WHEN 'support' THEN 'support' WHEN 'sup' THEN 'support' WHEN 'utility' THEN 'support'
          END=$6)
        AND EXISTS (SELECT 1 FROM identity_aliases a JOIN entity_members m ON m.id=a.identity_id
          WHERE m.entity_id=p.id AND lower(a.name) LIKE '%'||$1||'%')
    ) SELECT (SELECT count(*)::integer FROM filtered) AS total,
      coalesce((SELECT jsonb_agg(document ORDER BY active DESC,lower(name),id) FROM (
        SELECT * FROM filtered ORDER BY active DESC,lower(name),id LIMIT $4 OFFSET $5
      ) batch),'[]') AS items`,
    [pattern, q.league ?? null, now, q.pageSize, (q.page - 1) * q.pageSize, q.role ?? null],
  );
  return { ...rows[0]!, page: q.page, pageSize: q.pageSize };
}
