-- Pro-play champion use per patch and league, from Oracle's Elixir games whose drafts were
-- derived without exclusions. league_games is every such game in the league, the denominator
-- of presence, pick and ban rates. Champion names resolve through oracle_champion_names; names
-- without a mapping are counted in pro_unmapped_drafts instead of being guessed.
CREATE TABLE pro_champion_stats (
  patch_key text NOT NULL REFERENCES patches(patch_key),
  league text NOT NULL,
  champion_key integer NOT NULL,
  league_games integer NOT NULL CHECK (league_games > 0),
  picks integer NOT NULL CHECK (picks >= 0),
  bans integer NOT NULL CHECK (bans >= 0),
  result_picks integer NOT NULL CHECK (result_picks >= 0),
  wins integer NOT NULL CHECK (wins >= 0),
  blue_picks integer NOT NULL CHECK (blue_picks >= 0),
  blue_result_picks integer NOT NULL CHECK (blue_result_picks >= 0),
  blue_wins integer NOT NULL CHECK (blue_wins >= 0),
  red_picks integer NOT NULL CHECK (red_picks >= 0),
  red_result_picks integer NOT NULL CHECK (red_result_picks >= 0),
  red_wins integer NOT NULL CHECK (red_wins >= 0),
  blind_picks integer NOT NULL CHECK (blind_picks >= 0),
  counter_picks integer NOT NULL CHECK (counter_picks >= 0),
  built_at timestamptz NOT NULL,
  PRIMARY KEY (patch_key, league, champion_key)
);
CREATE INDEX pro_champion_stats_champion ON pro_champion_stats(champion_key, patch_key);

CREATE TABLE pro_unmapped_drafts (
  patch_key text NOT NULL REFERENCES patches(patch_key),
  league text NOT NULL,
  name text NOT NULL,
  picks integer NOT NULL,
  bans integer NOT NULL,
  PRIMARY KEY (patch_key, league, name)
);
