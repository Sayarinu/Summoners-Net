-- Precomputed champion statistics per source, patch, queue, region, tier, champion and role.
-- source 'solo' is Riot ranked play (region = match-v5 region, tier = the ladder tier of the
-- player whose crawl found the match); source 'pro' is Oracle's Elixir (region = league,
-- tier = 'PRO', queue = 'pro'). role 'ALL' totals a champion across roles and carries its bans.
-- Rates are NULL when their denominator is zero: win rate over games with a known result,
-- pick and ban rates over the slice's games.
CREATE TABLE champion_aggregates (
  source text NOT NULL CHECK (source IN ('solo', 'pro')),
  patch_key text NOT NULL REFERENCES patches(patch_key),
  queue text NOT NULL,
  region text NOT NULL,
  tier text NOT NULL,
  champion_key integer NOT NULL,
  role text NOT NULL CHECK (role IN ('TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY', 'UNKNOWN', 'ALL')),
  games integer NOT NULL CHECK (games >= 0),
  result_games integer NOT NULL CHECK (result_games >= 0),
  wins integer NOT NULL CHECK (wins >= 0),
  bans integer CHECK (bans IS NULL OR bans >= 0),
  slice_games integer NOT NULL CHECK (slice_games >= 0),
  win_rate double precision,
  pick_rate double precision,
  ban_rate double precision,
  built_at timestamptz NOT NULL,
  PRIMARY KEY (source, patch_key, queue, region, tier, champion_key, role)
);
CREATE INDEX champion_aggregates_role ON champion_aggregates(source, patch_key, role, region, tier);
CREATE INDEX champion_aggregates_tier ON champion_aggregates(source, patch_key, tier, role);
CREATE INDEX champion_aggregates_champion ON champion_aggregates(champion_key, source, patch_key);

-- Patches whose facts changed since their aggregates were built.
CREATE TABLE aggregate_dirty (
  source text NOT NULL CHECK (source IN ('solo', 'pro')),
  patch_key text NOT NULL REFERENCES patches(patch_key),
  marked_at timestamptz NOT NULL,
  PRIMARY KEY (source, patch_key)
);
