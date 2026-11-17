-- Early jungle paths inferred from solo-queue timelines (docs/analytics/jungle-paths.md): one row
-- per jungler game, then clusters per champion and patch. Unknown inferences stay NULL; a
-- cluster keys them as 'unknown'. Paths are blue-side coordinates at minutes 1 to 3.
CREATE TABLE jungle_paths (
  match_id text NOT NULL,
  participant_id integer NOT NULL,
  patch_key text NOT NULL REFERENCES patches(patch_key),
  champion_key integer NOT NULL CHECK (champion_key > 0),
  win boolean,
  start_side text CHECK (start_side IN ('blue-buff','red-buff','invade')),
  start_confidence text CHECK (start_confidence IN ('high','low')),
  route text CHECK (route IN ('same-side','cross','invade')),
  gank_lane text CHECK (gank_lane IN ('top','mid','bot')),
  gank_confidence text CHECK (gank_confidence IN ('high','low')),
  gank_minute integer CHECK (gank_minute >= 0),
  path_x integer[] NOT NULL,
  path_y integer[] NOT NULL,
  built_at timestamptz NOT NULL,
  PRIMARY KEY (match_id,participant_id),
  FOREIGN KEY (match_id,participant_id) REFERENCES riot_match_participants ON DELETE CASCADE
);
CREATE INDEX jungle_paths_patch ON jungle_paths(patch_key,champion_key);

CREATE TABLE jungle_path_clusters (
  patch_key text NOT NULL REFERENCES patches(patch_key),
  champion_key integer NOT NULL CHECK (champion_key > 0),
  start_side text NOT NULL,
  route text NOT NULL,
  gank_lane text NOT NULL,
  games integer NOT NULL CHECK (games > 0),
  result_games integer NOT NULL CHECK (result_games >= 0),
  wins integer NOT NULL CHECK (wins >= 0),
  path_x double precision[] NOT NULL,
  path_y double precision[] NOT NULL,
  built_at timestamptz NOT NULL,
  PRIMARY KEY (champion_key,patch_key,start_side,route,gank_lane)
);
CREATE INDEX jungle_path_clusters_patch ON jungle_path_clusters(patch_key);

INSERT INTO aggregate_dirty(source,patch_key,marked_at)
SELECT DISTINCT 'solo',patch_key,now() FROM riot_matches WHERE patch_key IS NOT NULL
ON CONFLICT(source,patch_key) DO UPDATE SET marked_at=EXCLUDED.marked_at;
