-- Keep season membership tied to source identities so a revised crosswalk applies immediately.
CREATE VIEW team_competition_seasons AS
SELECT team_id, year, league, max(played_at) AS last_played
FROM (
  SELECT p.team_id, g.year, g.league, max(g.occurred_at) AS played_at
  FROM participants p JOIN games g ON g.id=p.game_id
  GROUP BY p.team_id,g.year,g.league
  UNION ALL
  SELECT team->>'id', extract(year FROM m.starts_at AT TIME ZONE 'UTC')::integer, m.league, max(m.starts_at)
  FROM matches m CROSS JOIN LATERAL jsonb_array_elements(m.document->'teams') team
  WHERE m.state='final' AND m.starts_at IS NOT NULL
  GROUP BY 1,2,3
) played
GROUP BY team_id,year,league;

CREATE INDEX matches_team_membership ON matches USING gin ((document->'teams') jsonb_path_ops);
