-- Per-role opponent samples. Metric totals and counts retain observations below display thresholds.
CREATE TABLE matchup_aggregates (
  source text NOT NULL CHECK (source IN ('solo','pro')),
  patch_key text NOT NULL REFERENCES patches(patch_key),
  champion_key integer NOT NULL CHECK (champion_key > 0),
  opponent_key integer NOT NULL CHECK (opponent_key > 0),
  role text NOT NULL CHECK (role IN ('TOP','JUNGLE','MIDDLE','BOTTOM','UTILITY')),
  games integer NOT NULL CHECK (games > 0),
  metrics jsonb NOT NULL CHECK (jsonb_typeof(metrics) = 'object'),
  built_at timestamptz NOT NULL,
  PRIMARY KEY (source,patch_key,champion_key,role,opponent_key)
);
CREATE INDEX matchup_aggregates_champion_role ON matchup_aggregates(champion_key,role,source,patch_key);
CREATE INDEX matchup_aggregates_role ON matchup_aggregates(source,patch_key,role,champion_key,opponent_key);

-- Counts are per role: a game with multiple invalid roles can appear in more than one row.
CREATE TABLE matchup_exclusions (
  source text NOT NULL CHECK (source IN ('solo','pro')),
  patch_key text NOT NULL REFERENCES patches(patch_key),
  role text NOT NULL,
  games integer NOT NULL,
  participants integer NOT NULL,
  unknown_role integer NOT NULL,
  ambiguous_role integer NOT NULL,
  missing_opponent integer NOT NULL,
  unmapped_champion integer NOT NULL,
  built_at timestamptz NOT NULL,
  PRIMARY KEY (source,patch_key,role)
);
INSERT INTO aggregate_dirty(source,patch_key,marked_at)
SELECT DISTINCT source,patch_key,now() FROM champion_aggregates
ON CONFLICT(source,patch_key) DO UPDATE SET marked_at=EXCLUDED.marked_at;
