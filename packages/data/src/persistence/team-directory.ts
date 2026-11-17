import type { Executor } from "./database.js";
import {
  querySchema,
  type BrowseQuery,
  type Identity,
  type League,
  type Page,
} from "../domain/models.js";

export type TeamDirectoryEntry = Identity & { league: League | null };
export interface TeamSeason {
  year: number;
  league: League;
}
const leagueOrder = "league IN ('Worlds','MSI','First Stand','EWC'), last_played DESC, league";

export async function teamSeasons(db: Executor, entityId: string): Promise<TeamSeason[]> {
  return (
    await db.query<TeamSeason>(
      `SELECT DISTINCT ON (year) year,league FROM (SELECT year,league,max(last_played) AS last_played
     FROM team_competition_seasons s JOIN entity_members m ON m.id=s.team_id WHERE m.entity_id=$1
     GROUP BY year,league) competitions ORDER BY year DESC,${leagueOrder}`,
      [entityId],
    )
  ).rows;
}

export async function teamDirectory(
  db: Executor,
  input: BrowseQuery,
  now: Date,
): Promise<Page<TeamDirectoryEntry>> {
  const q = querySchema.parse(input);
  const pattern = q.q.toLowerCase().replace(/[\\%_]/g, "\\$&");
  const { rows } = await db.query<{ items: TeamDirectoryEntry[]; total: number }>(
    `WITH competitions AS (
      SELECT m.entity_id,s.year,s.league,max(s.last_played) AS last_played
      FROM team_competition_seasons s JOIN entity_members m ON m.id=s.team_id GROUP BY m.entity_id,s.year,s.league
    ), latest AS (
      SELECT DISTINCT ON (entity_id) entity_id,year,array_agg(league ORDER BY ${leagueOrder}) AS competitions,
        max(last_played) AS last_played FROM competitions GROUP BY entity_id,year ORDER BY entity_id,year DESC
    ), fixtures AS (
      SELECT DISTINCT m.entity_id FROM matches f CROSS JOIN LATERAL jsonb_array_elements(f.document->'teams') t
      JOIN entity_members m ON m.id=t->>'id' WHERE f.state IN ('scheduled','live','final') AND
      f.starts_at BETWEEN $3::timestamptz-interval '180 days' AND $3::timestamptz+interval '90 days'
    ), filtered AS (
      SELECT p.id,p.name,p.document || jsonb_build_object('league',coalesce($2::text,l.competitions[1])) AS document,
        ($1='' AND (f.entity_id IS NOT NULL OR coalesce(l.last_played BETWEEN $3::timestamptz-interval '180 days' AND $3,false))) AS active
      FROM entity_profiles p LEFT JOIN latest l ON l.entity_id=p.id
      LEFT JOIN fixtures f ON f.entity_id=p.id
      WHERE p.kind='team' AND ($2::text IS NULL OR $2=ANY(l.competitions))
        AND EXISTS (SELECT 1 FROM identity_aliases a JOIN entity_members m ON m.id=a.identity_id
          WHERE m.entity_id=p.id AND lower(a.name) LIKE '%'||$1||'%')
    ) SELECT (SELECT count(*)::integer FROM filtered) AS total,
      coalesce((SELECT jsonb_agg(document ORDER BY active DESC,lower(name),id) FROM (
        SELECT * FROM filtered ORDER BY active DESC,lower(name),id LIMIT $4 OFFSET $5
      ) batch),'[]') AS items`,
    [pattern, q.league ?? null, now, q.pageSize, (q.page - 1) * q.pageSize],
  );
  return { ...rows[0]!, page: q.page, pageSize: q.pageSize };
}
