-- Win rate by game length and by gold and level lead over the lane opponent at 10 and 15
-- minutes, per patch, queue, region, tier, champion and role. bucket is an index into the
-- application's bucket definitions; leads compare the participant with the enemy in the same
-- position, and games without exactly one such opponent or without that minute's frame are left out.
CREATE TABLE champion_buckets (
  patch_key text NOT NULL REFERENCES patches(patch_key),
  queue text NOT NULL,
  region text NOT NULL,
  tier text NOT NULL,
  champion_key integer NOT NULL,
  role text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('length', 'gold10', 'gold15', 'level10', 'level15')),
  bucket integer NOT NULL CHECK (bucket >= 0),
  games integer NOT NULL CHECK (games > 0),
  result_games integer NOT NULL CHECK (result_games >= 0),
  wins integer NOT NULL CHECK (wins >= 0),
  built_at timestamptz NOT NULL,
  PRIMARY KEY (patch_key, queue, region, tier, champion_key, role, kind, bucket)
);
CREATE INDEX champion_buckets_champion ON champion_buckets(champion_key, patch_key, kind);
