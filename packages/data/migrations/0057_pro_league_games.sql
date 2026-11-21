-- Games with a complete derived draft per patch and league: the denominator of every pro rate,
-- kept once per league rather than read back from each champion's row.
CREATE TABLE pro_league_games (
  patch_key text NOT NULL REFERENCES patches(patch_key),
  league text NOT NULL,
  games integer NOT NULL CHECK (games > 0),
  PRIMARY KEY (patch_key, league)
);
INSERT INTO pro_league_games(patch_key, league, games)
SELECT DISTINCT patch_key, league, league_games FROM pro_champion_stats;
