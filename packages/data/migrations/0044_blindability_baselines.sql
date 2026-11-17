-- The pooled win-rate counts behind each champion's shrunk matchups, so a draft can shrink one lane
-- matchup without reading the role's whole matchup table. Scores are derived and rebuilt.
INSERT INTO aggregate_dirty(source,patch_key,marked_at)
SELECT DISTINCT source,patch_key,now() FROM blindability_scores
ON CONFLICT(source,patch_key) DO UPDATE SET marked_at=EXCLUDED.marked_at;
DELETE FROM blindability_scores;
ALTER TABLE blindability_scores
  ADD COLUMN win_total double precision,
  ADD COLUMN win_count integer NOT NULL CHECK (win_count >= 0);
