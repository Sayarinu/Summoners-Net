-- Counter-pick values next to the blind scores. Scores are derived from matchup_aggregates, so the
-- stored rows are cleared and their patches rebuilt with the new columns.
INSERT INTO aggregate_dirty(source,patch_key,marked_at)
SELECT DISTINCT source,patch_key,now() FROM blindability_scores
ON CONFLICT(source,patch_key) DO UPDATE SET marked_at=EXCLUDED.marked_at;
DELETE FROM blindability_scores;
ALTER TABLE blindability_scores
  ADD COLUMN counter_win_rate double precision,
  ADD COLUMN counter_opponents integer NOT NULL CHECK (counter_opponents >= 0),
  ADD COLUMN counter_picks integer NOT NULL CHECK (counter_picks >= 0),
  ADD COLUMN counter_reason text CHECK (counter_reason IN ('blind-unavailable','never-best-response')),
  ADD CHECK ((counter_reason IS NULL) = (counter_win_rate IS NOT NULL));
-- The role list filters one source, patch and role, then sorts its few hundred rows.
CREATE INDEX blindability_scores_role ON blindability_scores(source,patch_key,role);
