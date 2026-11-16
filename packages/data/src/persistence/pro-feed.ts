import {
  proFeedQuerySchema,
  type ProFeed,
  type ProFeedQuery,
  type ProFeedGame,
} from "../domain/pro-feed.js";
import type { Executor } from "./database.js";
export async function proFeed(db: Executor, input: ProFeedQuery): Promise<ProFeed> {
  const q = proFeedQuerySchema.parse(input);
  const row = (
    await db.query<{
      total: number;
      items: ProFeedGame[];
      teams: ProFeed["teams"];
      leagues: string[];
    }>(
      `
    WITH linked AS (
      SELECT l.puuid,l.identity_id,em.entity_id FROM pro_account_links l
      JOIN entity_members em ON em.id=l.identity_id
    ), people AS (
      SELECT DISTINCT entity_id FROM linked
    ), affiliations AS (
      SELECT p.entity_id,latest.team_id,latest.league,latest.observed_at
      FROM people p CROSS JOIN LATERAL (
        WITH latest AS (
          SELECT team.entity_id AS team_id,g.league,g.occurred_at
          FROM entity_members member JOIN participants part ON part.player_id=member.id
          JOIN games g ON g.id=part.game_id
          JOIN entity_members team ON team.id=part.team_id
          WHERE member.entity_id=p.entity_id AND g.complete
          ORDER BY g.occurred_at DESC FETCH FIRST 1 ROW WITH TIES
        )
        SELECT CASE WHEN count(DISTINCT team_id)=1 THEN min(team_id) END AS team_id,
          CASE WHEN count(DISTINCT league)=1 THEN min(league) END AS league,
          max(occurred_at) AS observed_at FROM latest
      ) latest
    ), filtered AS (
      SELECT m.match_id AS "matchId",part.participant_id AS "participantId",l.puuid,
        l.identity_id AS "sourceIdentityId",l.entity_id,a.team_id,a.league,a.observed_at AS "proObservedAt",
        part.champion_id AS "championKey",part.champion_name,part.win,
        coalesce(m.started_at,m.created_at) AS "occurredAt",m.patch_key
      FROM linked l JOIN riot_match_participants part USING(puuid)
      JOIN riot_matches m USING(match_id) JOIN affiliations a ON a.entity_id=l.entity_id
      WHERE m.queue_id=420 AND ($1::text IS NULL OR a.team_id=$1) AND ($2::text IS NULL OR a.league=$2)
    ), selected AS (
      SELECT * FROM filtered ORDER BY "occurredAt" DESC,"matchId","participantId" LIMIT $3 OFFSET $4
    ), rows AS (
      SELECT s."matchId",s."participantId",s.puuid,s."sourceIdentityId",p.document AS player,
        t.document AS team,s.league,s."proObservedAt",s."championKey",c.champion_id AS "championId",
        coalesce(c.name,s.champion_name) AS "championName",
        CASE WHEN i.asset_hash IS NULL THEN NULL ELSE '/api/images/'||i.asset_hash END AS "imageUrl",
        s.win,s."occurredAt"
      FROM selected s JOIN entity_profiles p ON p.id=s.entity_id
      LEFT JOIN entity_profiles t ON t.id=s.team_id
      LEFT JOIN catalog_champions c ON c.patch_key=s.patch_key AND c.champion_key=s."championKey"
      LEFT JOIN catalog_images i ON i.patch_key=c.patch_key AND i.kind='champion' AND i.catalog_id=c.champion_id
    ) SELECT (SELECT count(*)::integer FROM filtered) AS total,
      coalesce((SELECT jsonb_agg(to_jsonb(rows) ORDER BY "occurredAt" DESC,"matchId","participantId") FROM rows),'[]'::jsonb) AS items,
      coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.name,t.id) FROM (
        SELECT DISTINCT p.id,p.name FROM affiliations a JOIN entity_profiles p ON p.id=a.team_id
      ) t),'[]'::jsonb) AS teams,
      coalesce((SELECT jsonb_agg(league ORDER BY league) FROM (
        SELECT DISTINCT league FROM affiliations WHERE league IS NOT NULL
      ) l),'[]'::jsonb) AS leagues
  `,
      [q.team || null, q.league || null, q.pageSize, (q.page - 1) * q.pageSize],
    )
  ).rows[0]!;
  return {
    query: q,
    page: { page: q.page, pageSize: q.pageSize, total: row.total, items: row.items },
    teams: row.teams,
    leagues: row.leagues,
  };
}
