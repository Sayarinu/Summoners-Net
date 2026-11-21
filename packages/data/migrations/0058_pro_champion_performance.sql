-- How pro champions perform once picked, per patch, league, role and champion, from each player's
-- Oracle's Elixir row. Every metric keeps its sum and the number of rows that reported it, so any
-- league or role selection averages only the games with a value; unknown values are never zero.
CREATE TABLE pro_champion_performance (
  patch_key text NOT NULL REFERENCES patches(patch_key),
  league text NOT NULL,
  role text NOT NULL CHECK (role IN ('TOP','JUNGLE','MIDDLE','BOTTOM','UTILITY')),
  champion_key integer NOT NULL,
  games integer NOT NULL CHECK (games > 0),
  result_games integer NOT NULL,
  wins integer NOT NULL,
  kills double precision NOT NULL,
  deaths double precision NOT NULL,
  assists double precision NOT NULL,
  kda_n integer NOT NULL,
  kp_takedowns double precision NOT NULL,
  kp_team_kills double precision NOT NULL,
  kp_n integer NOT NULL,
  cspm_sum double precision NOT NULL, cspm_n integer NOT NULL,
  gpm_sum double precision NOT NULL, gpm_n integer NOT NULL,
  dpm_sum double precision NOT NULL, dpm_n integer NOT NULL,
  damage_share_sum double precision NOT NULL, damage_share_n integer NOT NULL,
  gd15_sum double precision NOT NULL, gd15_n integer NOT NULL,
  csd15_sum double precision NOT NULL, csd15_n integer NOT NULL,
  xpd15_sum double precision NOT NULL, xpd15_n integer NOT NULL,
  first_blood_sum double precision NOT NULL, first_blood_n integer NOT NULL,
  vspm_sum double precision NOT NULL, vspm_n integer NOT NULL,
  game_length_sum double precision NOT NULL, game_length_n integer NOT NULL,
  built_at timestamptz NOT NULL,
  PRIMARY KEY (patch_key, league, role, champion_key)
);
CREATE INDEX pro_champion_performance_champion ON pro_champion_performance(champion_key, patch_key);
-- Existing patches fill in when their pro statistics are next rebuilt.
INSERT INTO aggregate_dirty(source, patch_key, marked_at)
SELECT DISTINCT 'pro', patch_key, now() FROM pro_champion_stats
ON CONFLICT DO NOTHING;
