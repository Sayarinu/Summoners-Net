import {
  summonerQuerySchema,
  type SummonerQuery,
  type SummonerProfile,
  type SummonerGame,
  type SummonerChampion,
  type LadderHistoryPoint,
} from "../domain/summoners.js";
import type { Executor } from "./database.js";
export async function summoner(
  db: Executor,
  input: SummonerQuery,
  now: Date,
): Promise<SummonerProfile | null> {
  const q = summonerQuerySchema.parse(input);
  const identity = (
    await db.query<{ game_name: string | null; tag_line: string | null }>(
      `
    SELECT a.game_name,a.tag_line FROM (SELECT $1::text AS puuid) person
    LEFT JOIN riot_accounts a USING(puuid)
    WHERE EXISTS(SELECT 1 FROM riot_match_participants WHERE puuid=$1)
      OR EXISTS(SELECT 1 FROM riot_ladder_entries WHERE puuid=$1)
      OR EXISTS(SELECT 1 FROM riot_ladder_snapshot_entries WHERE puuid=$1)`,
      [q.puuid],
    )
  ).rows[0];
  if (!identity) return null;
  const games = (
    await db.query<{ total: number; items: SummonerGame[] }>(
      `
    WITH matches AS (
      SELECT m.match_id AS "matchId",lower(m.platform_id) AS platform,
        coalesce(m.started_at,m.created_at) AS "occurredAt",m.patch_key AS patch,
        p.champion_id AS "championKey",p.champion_name AS "championName",p.win,
        p.kills,p.deaths,p.assists,m.duration_seconds AS "durationSeconds"
      FROM riot_match_participants p JOIN riot_matches m USING(match_id)
      WHERE p.puuid=$1 AND m.queue_id=420 AND ($2::text IS NULL OR lower(m.platform_id)=$2)
    ), selected AS (SELECT * FROM matches ORDER BY "occurredAt" DESC,"matchId" LIMIT 25 OFFSET $3)
    SELECT (SELECT count(*)::integer FROM matches) AS total,
      coalesce((SELECT jsonb_agg(to_jsonb(selected) ORDER BY "occurredAt" DESC,"matchId") FROM selected),'[]'::jsonb) AS items`,
      [q.puuid, q.region ?? null, (q.page - 1) * 25],
    )
  ).rows[0]!;
  const champions = (
    await db.query<{ total: number; items: SummonerChampion[] }>(
      `
    WITH counts AS (
      SELECT p.champion_id,count(*)::integer AS games,count(p.win)::integer AS results,
        count(*) FILTER(WHERE p.win)::integer AS wins
      FROM riot_match_participants p JOIN riot_matches m USING(match_id)
      WHERE p.puuid=$1 AND m.queue_id=420 AND ($2::text IS NULL OR lower(m.platform_id)=$2)
      GROUP BY p.champion_id
    ), selected AS (SELECT * FROM counts ORDER BY games DESC,champion_id LIMIT 25 OFFSET $3),
    rows AS (
      SELECT s.champion_id AS "championKey",n.champion_id AS "championId",n.name,
        CASE WHEN n.asset_hash IS NULL THEN NULL ELSE '/api/images/'||n.asset_hash END AS "imageUrl",
        s.games,jsonb_build_object('value',s.wins::double precision/nullif(s.results,0),'sampleCount',s.results) AS "winRate"
      FROM selected s LEFT JOIN LATERAL (
        SELECT c.champion_id,c.name,i.asset_hash FROM catalog_champions c JOIN patches p USING(patch_key)
        LEFT JOIN catalog_images i ON i.patch_key=c.patch_key AND i.kind='champion' AND i.catalog_id=c.champion_id
        WHERE c.champion_key=s.champion_id ORDER BY p.release_order DESC LIMIT 1
      ) n ON true
    ) SELECT (SELECT count(*)::integer FROM counts) AS total,
      coalesce((SELECT jsonb_agg(to_jsonb(rows) ORDER BY games DESC,"championKey") FROM rows),'[]'::jsonb) AS items`,
      [q.puuid, q.region ?? null, (q.championPage - 1) * 25],
    )
  ).rows[0]!;
  const end = new Date(now);
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 29);
  const from = start.toISOString().slice(0, 10),
    to = end.toISOString().slice(0, 10);
  const history = (
    await db.query<{ platform: string; points: LadderHistoryPoint[] }>(
      `
    WITH observations AS (
      SELECT s.platform,s.observed_at,s.snapshot_id,e.league_points,e.position,e.tier,
        (s.observed_at AT TIME ZONE 'UTC')::date AS day
      FROM riot_ladder_snapshot_entries e JOIN riot_ladder_snapshots s USING(snapshot_id)
      WHERE e.puuid=$1 AND ($2::text IS NULL OR s.platform=$2)
        AND s.observed_at >= $3::date AT TIME ZONE 'UTC'
        AND s.observed_at <= $5::timestamptz
    ), daily AS (
      SELECT DISTINCT ON(platform,day) *,count(*) OVER(PARTITION BY platform,day)::integer AS samples
      FROM observations ORDER BY platform,day,observed_at DESC,snapshot_id DESC
    ), calendar AS (
      SELECT platform,generate_series($3::date,$4::date,'1 day'::interval)::date AS day
      FROM (SELECT DISTINCT platform FROM observations) regions
    ) SELECT c.platform,jsonb_agg(jsonb_build_object('day',c.day::text,
      'leaguePoints',d.league_points,'rank',d.position,'tier',d.tier,
      'observedAt',d.observed_at,'sampleCount',coalesce(d.samples,0)) ORDER BY c.day) AS points
    FROM calendar c LEFT JOIN daily d USING(platform,day) GROUP BY c.platform ORDER BY c.platform`,
      [q.puuid, q.region ?? null, from, to, now],
    )
  ).rows;
  return {
    query: q,
    gameName: identity.game_name,
    tagLine: identity.tag_line,
    games: { ...games, page: q.page, pageSize: 25 },
    champions: { ...champions, page: q.championPage, pageSize: 25 },
    history,
    historyFrom: from,
    historyTo: to,
  };
}
