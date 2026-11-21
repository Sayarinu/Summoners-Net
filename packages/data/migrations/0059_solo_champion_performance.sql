-- How solo-queue champions perform once picked, per patch, queue, region, ladder tier, role and
-- champion, from Riot's match participants. Every metric keeps its sum and the number of games
-- that reported it, so any filter averages only games with a value; unknown values are never zero.
CREATE TABLE solo_champion_performance (
  patch_key text NOT NULL REFERENCES patches(patch_key),
  queue text NOT NULL,
  region text NOT NULL,
  tier text NOT NULL,
  role text NOT NULL CHECK (role IN ('TOP','JUNGLE','MIDDLE','BOTTOM','UTILITY')),
  champion_key integer NOT NULL,
  games integer NOT NULL CHECK (games > 0),
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
  vspm_sum double precision NOT NULL, vspm_n integer NOT NULL,
  game_length_sum double precision NOT NULL, game_length_n integer NOT NULL,
  built_at timestamptz NOT NULL,
  PRIMARY KEY (patch_key, queue, region, tier, role, champion_key)
);
CREATE INDEX solo_champion_performance_champion ON solo_champion_performance(champion_key, patch_key);
-- Existing solo patches fill in when their aggregates are next rebuilt.
INSERT INTO aggregate_dirty(source, patch_key, marked_at)
SELECT DISTINCT 'solo', patch_key, now() FROM champion_aggregates WHERE source='solo'
ON CONFLICT DO NOTHING;
