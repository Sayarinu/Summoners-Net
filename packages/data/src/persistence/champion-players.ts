import {
  championPlayerMinimumGames,
  championPlayerPageSize,
  type ChampionPlayers,
  type ChampionPlayer,
} from "../domain/champion-players.js";
import type { ParsedChampionOverviewQuery } from "../domain/champion-stats.js";
import type { Executor } from "./database.js";
/** The caller validates the champion query; retained samples and current ladder entries stay in SQL. */
export async function championPlayers(
  db: Executor,
  input: {
    championKey: number;
    patch: string;
    role: ParsedChampionOverviewQuery["role"];
    region: string | undefined;
    tier: string | undefined;
    sort: ChampionPlayers["sort"];
    page: number;
  },
): Promise<ChampionPlayers> {
  const row = (
    await db.query<{ total: number; items: ChampionPlayer[] }>(
      `
    WITH current_ladder AS (
      SELECT e.* FROM riot_ladder_entries e JOIN riot_ladder_status s USING(platform)
      WHERE e.queue='RANKED_SOLO_5x5' AND e.fetched_at=s.last_success
        AND ($5::text IS NULL OR e.tier=$5)
    ), counted AS (
      SELECT p.puuid,lower(m.platform_id) AS platform,count(*)::integer AS games,
        count(p.win)::integer AS results,count(*) FILTER(WHERE p.win)::integer AS wins
      FROM riot_match_participants p JOIN riot_matches m USING(match_id)
      JOIN riot_match_ids i USING(match_id)
      JOIN current_ladder e ON e.puuid=p.puuid AND e.platform=lower(m.platform_id)
      WHERE p.champion_id=$1 AND m.patch_key=$2 AND m.queue_id=420 AND m.remake IS NOT TRUE
        AND ($3='ALL' OR CASE WHEN p.team_position IN ('TOP','JUNGLE','MIDDLE','BOTTOM','UTILITY')
          THEN p.team_position ELSE 'UNKNOWN' END=$3)
        AND ($4::text IS NULL OR i.region=$4)
      GROUP BY p.puuid,lower(m.platform_id) HAVING count(*)>=${championPlayerMinimumGames}
    ), rated AS (
      SELECT *,CASE WHEN results>=${championPlayerMinimumGames} THEN wins::double precision/results END AS rate FROM counted
    ), ordered AS (
      SELECT *,row_number() OVER(ORDER BY CASE WHEN $6='winRate' THEN rate END DESC NULLS LAST,
        games DESC,rate DESC NULLS LAST,puuid,platform) AS position FROM rated
    ), selected AS (SELECT * FROM ordered ORDER BY position LIMIT ${championPlayerPageSize} OFFSET $7),
    rows AS (
      SELECT s.position,s.puuid,s.platform,s.games,
        jsonb_build_object('value',s.rate,'sampleCount',s.results) AS "winRate",
        a.game_name AS "gameName",a.tag_line AS "tagLine",e.tier,e.league_points AS "leaguePoints",
        e.fetched_at AS "ladderObservedAt",
        pro.document AS pro
      FROM selected s JOIN current_ladder e USING(puuid,platform)
      LEFT JOIN riot_accounts a USING(puuid)
      LEFT JOIN pro_account_links l USING(puuid)
      LEFT JOIN entity_members member ON member.id=l.identity_id
      LEFT JOIN entity_profiles pro ON pro.id=member.entity_id
    ) SELECT (SELECT count(*)::integer FROM counted) AS total,
      coalesce((SELECT jsonb_agg(to_jsonb(rows) ORDER BY position) FROM rows),'[]'::jsonb) AS items
  `,
      [
        input.championKey,
        input.patch,
        input.role,
        input.region ?? null,
        input.tier ?? null,
        input.sort,
        (input.page - 1) * championPlayerPageSize,
      ],
    )
  ).rows[0]!;
  return {
    sort: input.sort,
    page: {
      page: input.page,
      pageSize: championPlayerPageSize,
      total: row.total,
      items: row.items,
    },
  };
}
