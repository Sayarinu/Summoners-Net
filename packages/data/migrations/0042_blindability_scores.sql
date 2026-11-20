-- Blindability per champion, role, patch and source, from the stored lane matchup samples.
-- Statistics are null with a reason when the sampled opponents cover too little of the role's picks.
CREATE TABLE blindability_scores (
  source text NOT NULL CHECK (source IN ('solo','pro')),
  patch_key text NOT NULL REFERENCES patches(patch_key),
  champion_key integer NOT NULL CHECK (champion_key > 0),
  role text NOT NULL CHECK (role IN ('TOP','JUNGLE','MIDDLE','BOTTOM','UTILITY')),
  games integer NOT NULL CHECK (games >= 0),
  sampled_opponents integer NOT NULL CHECK (sampled_opponents >= 0),
  covered_opponents integer NOT NULL CHECK (covered_opponents >= 0),
  covered_picks integer NOT NULL CHECK (covered_picks >= 0),
  role_picks integer NOT NULL CHECK (role_picks >= 0),
  expected double precision,
  worst_case double precision,
  worst_opponent_key integer,
  variance double precision,
  lower_tail double precision,
  reason text CHECK (reason IN ('no-opponent-picks','few-opponents','low-coverage')),
  built_at timestamptz NOT NULL,
  PRIMARY KEY (source,patch_key,champion_key,role),
  CHECK ((reason IS NULL) = (lower_tail IS NOT NULL))
);
INSERT INTO aggregate_dirty(source,patch_key,marked_at)
SELECT DISTINCT source,patch_key,now() FROM matchup_aggregates
ON CONFLICT(source,patch_key) DO UPDATE SET marked_at=EXCLUDED.marked_at;
