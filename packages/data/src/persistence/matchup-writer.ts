import type { PoolClient } from "pg";

const soloPlayers = `SELECT m.match_id AS game_id,p.participant_id::text AS slot,p.team_id::text AS team,
  p.champion_id AS champion_key,p.team_position AS assigned_role,p.win,m.match_id,p.participant_id,
  NULL::jsonb AS statistics,NULL::jsonb AS team_statistics
  FROM riot_matches m JOIN riot_match_participants p USING(match_id)
  WHERE m.patch_key=$1 AND m.queue_id=420 AND m.remake IS NOT TRUE`;
const proPlayers = `WITH games AS (
  SELECT g.* FROM oracle_archive_games g JOIN patch_sources ps ON ps.source='oracle' AND ps.source_string=g.patch
  WHERE ps.patch_key=$1 AND g.summary_eligible
), keys AS (
  SELECT DISTINCT ON(n.name) n.name,c.champion_key FROM oracle_champion_names n
  JOIN catalog_champions c ON c.champion_id=n.champion_id JOIN patches cp USING(patch_key)
  ORDER BY n.name,cp.release_order DESC
), teams AS (
  SELECT p.game_id,p.side,min(p.slot) AS slot FROM oracle_archive_participants p JOIN games g ON g.id=p.game_id
  WHERE p.position='team' GROUP BY p.game_id,p.side HAVING count(*)=1
)
SELECT g.id AS game_id,p.slot,p.side AS team,k.champion_key,
  CASE p.position WHEN 'top' THEN 'TOP' WHEN 'jungle' THEN 'JUNGLE' WHEN 'mid' THEN 'MIDDLE'
    WHEN 'bottom' THEN 'BOTTOM' WHEN 'support' THEN 'UTILITY' END AS assigned_role,p.result AS win,
  NULL::text AS match_id,NULL::integer AS participant_id,p.statistics,t.statistics AS team_statistics
  FROM games g JOIN oracle_archive_participants p ON p.game_id=g.id AND p.position<>'team'
  LEFT JOIN keys k ON k.name=p.champion
  LEFT JOIN teams team ON team.game_id=p.game_id AND team.side=p.side
  LEFT JOIN oracle_archive_participants t ON t.game_id=team.game_id AND t.slot=team.slot`;
function scope(source: "solo" | "pro") {
  return `players AS (${source === "solo" ? soloPlayers : proPlayers}),
  roles AS (SELECT *,CASE WHEN assigned_role IN ('TOP','JUNGLE','MIDDLE','BOTTOM','UTILITY') THEN assigned_role ELSE 'UNKNOWN' END AS role FROM players),
  role_groups AS (
    SELECT game_id,team,role,count(*) AS n,min(champion_key) AS champion_key,min(participant_id) AS participant_id
    FROM roles GROUP BY game_id,team,role
  ), paired AS (
    SELECT p.*,o.champion_key AS opponent_key,o.participant_id AS opponent_id,
      CASE WHEN p.role='UNKNOWN' THEN 'unknown_role'
        WHEN own.n>1 OR o.n>1 THEN 'ambiguous_role'
        WHEN o.n IS NULL THEN 'missing_opponent'
        WHEN p.champion_key IS NULL OR o.champion_key IS NULL THEN 'unmapped_champion' END AS excluded
    FROM roles p JOIN role_groups own USING(game_id,team,role)
    LEFT JOIN role_groups o ON o.game_id=p.game_id AND o.team<>p.team AND o.role=p.role
  )`;
}
// Only numeric checkpoint observations and explicit binary objective outcomes are eligible.
const checkpoint = (key: string) =>
  `CASE WHEN jsonb_typeof(p.statistics->'${key}')='number' THEN (p.statistics->>'${key}')::double precision END`;
const objective = (key: string) =>
  `CASE WHEN p.team_statistics->>'${key}' IN ('0','1') THEN (p.team_statistics->>'${key}')::double precision END`;
const soloReadings = `SELECT p.*,f10.total_gold-o10.total_gold AS gold10,f15.total_gold-o15.total_gold AS gold15,
  f10.xp-o10.xp AS xp10,f15.xp-o15.xp AS xp15,
  f10.minions_killed+f10.jungle_minions_killed-o10.minions_killed-o10.jungle_minions_killed AS cs10,
  f15.minions_killed+f15.jungle_minions_killed-o15.minions_killed-o15.jungle_minions_killed AS cs15,
  blood.first::integer::double precision AS first_blood,tower.first::integer::double precision AS first_tower
  FROM paired p
  LEFT JOIN riot_timeline_frames f10 ON f10.match_id=p.match_id AND f10.participant_id=p.participant_id AND f10.minute=10
  LEFT JOIN riot_timeline_frames o10 ON o10.match_id=p.match_id AND o10.participant_id=p.opponent_id AND o10.minute=10 AND o10.timestamp_ms=f10.timestamp_ms
  LEFT JOIN riot_timeline_frames f15 ON f15.match_id=p.match_id AND f15.participant_id=p.participant_id AND f15.minute=15
  LEFT JOIN riot_timeline_frames o15 ON o15.match_id=p.match_id AND o15.participant_id=p.opponent_id AND o15.minute=15 AND o15.timestamp_ms=f15.timestamp_ms
  LEFT JOIN riot_match_objectives blood ON blood.match_id=p.match_id AND blood.team_id=p.team::integer AND blood.objective='champion'
  LEFT JOIN riot_match_objectives tower ON tower.match_id=p.match_id AND tower.team_id=p.team::integer AND tower.objective='tower'
  WHERE p.excluded IS NULL`;
const proReadings = `SELECT p.*,${checkpoint("golddiffat10")} AS gold10,${checkpoint("golddiffat15")} AS gold15,
  ${checkpoint("xpdiffat10")} AS xp10,${checkpoint("xpdiffat15")} AS xp15,
  ${checkpoint("csdiffat10")} AS cs10,${checkpoint("csdiffat15")} AS cs15,
  ${objective("firstblood")} AS first_blood,${objective("firsttower")} AS first_tower FROM paired p WHERE p.excluded IS NULL`;

/** Rebuild both samples and exclusions in the caller's patch transaction. */
export async function rebuildMatchups(
  c: PoolClient,
  source: "solo" | "pro",
  patch: string,
  now: Date,
) {
  await c.query("DELETE FROM matchup_aggregates WHERE source=$1 AND patch_key=$2", [source, patch]);
  await c.query("DELETE FROM matchup_exclusions WHERE source=$1 AND patch_key=$2", [source, patch]);
  const inserted = await c.query(
    `WITH ${scope(source)}, readings AS (${source === "solo" ? soloReadings : proReadings}),
    metrics AS (SELECT champion_key,opponent_key,role,v.* FROM readings CROSS JOIN LATERAL (VALUES
      ('winRate',win::integer::double precision),('gold10',gold10),('gold15',gold15),('xp10',xp10),('xp15',xp15),
      ('cs10',cs10),('cs15',cs15),('firstBlood',first_blood),('firstTower',first_tower)) v(metric,value)),
    totals AS (SELECT champion_key,opponent_key,role,metric,count(*)::integer AS games,sum(value) AS total,count(value)::integer AS n
      FROM metrics GROUP BY champion_key,opponent_key,role,metric)
    INSERT INTO matchup_aggregates(source,patch_key,champion_key,opponent_key,role,games,metrics,built_at)
    SELECT $2,$1,champion_key,opponent_key,role,max(games),jsonb_object_agg(metric,jsonb_build_object('total',total,'count',n)),$3
    FROM totals GROUP BY champion_key,opponent_key,role`,
    [patch, source, now],
  );
  await c.query(
    `WITH ${scope(source)}
    INSERT INTO matchup_exclusions(source,patch_key,role,games,participants,unknown_role,ambiguous_role,missing_opponent,unmapped_champion,built_at)
    SELECT $2,$1,role,count(DISTINCT game_id),count(*),count(*) FILTER(WHERE excluded='unknown_role'),
      count(*) FILTER(WHERE excluded='ambiguous_role'),count(*) FILTER(WHERE excluded='missing_opponent'),count(*) FILTER(WHERE excluded='unmapped_champion'),$3
    FROM paired WHERE excluded IS NOT NULL GROUP BY role`,
    [patch, source, now],
  );
  return inserted.rowCount ?? 0;
}
