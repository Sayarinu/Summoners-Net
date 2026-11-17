-- Per-patch solo-queue heatmaps on a fixed 16 x 16 grid of the map, with red side mirrored onto
-- blue side (docs/analytics/heatmaps.md). Samples are kept for every subject; cells only for
-- subjects that reach the minimum sample.
CREATE TABLE heatmap_samples (
  patch_key text NOT NULL REFERENCES patches(patch_key),
  subject_kind text NOT NULL CHECK (subject_kind IN ('champion','player','role')),
  subject text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('position','death','kill')),
  games integer NOT NULL CHECK (games > 0),
  points integer NOT NULL CHECK (points >= 0),
  built_at timestamptz NOT NULL,
  PRIMARY KEY (subject_kind,subject,kind,patch_key)
);
CREATE INDEX heatmap_samples_patch ON heatmap_samples(patch_key);

CREATE TABLE heatmap_cells (
  patch_key text NOT NULL REFERENCES patches(patch_key),
  subject_kind text NOT NULL,
  subject text NOT NULL,
  kind text NOT NULL,
  cell_x smallint NOT NULL CHECK (cell_x BETWEEN 0 AND 15),
  cell_y smallint NOT NULL CHECK (cell_y BETWEEN 0 AND 15),
  points integer NOT NULL CHECK (points > 0),
  PRIMARY KEY (subject_kind,subject,kind,patch_key,cell_x,cell_y)
);
CREATE INDEX heatmap_cells_patch ON heatmap_cells(patch_key);

INSERT INTO aggregate_dirty(source,patch_key,marked_at)
SELECT DISTINCT 'solo',patch_key,now() FROM riot_matches WHERE patch_key IS NOT NULL
ON CONFLICT(source,patch_key) DO UPDATE SET marked_at=EXCLUDED.marked_at;
