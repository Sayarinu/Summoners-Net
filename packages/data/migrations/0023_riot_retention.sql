-- Solo-queue retention. Pruned matches leave their id behind as a 'pruned' tombstone with the
-- match's patch, so the crawler does not fetch them again and a wider setting can backfill them.
ALTER TABLE riot_match_ids DROP CONSTRAINT riot_match_ids_fetch_state_check;
ALTER TABLE riot_match_ids
  ADD CONSTRAINT riot_match_ids_fetch_state_check
    CHECK (fetch_state IN ('pending', 'fetched', 'missing', 'invalid', 'pruned')),
  ADD COLUMN pruned_patch_key text;
CREATE INDEX riot_match_ids_pruned ON riot_match_ids(pruned_patch_key) WHERE fetch_state = 'pruned';

-- The setting the worker last applied, and what its last run did.
CREATE TABLE riot_retention (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  previous_patches integer CHECK (previous_patches IS NULL OR previous_patches >= 0),
  kept_patches text[] NOT NULL DEFAULT '{}',
  last_run_at timestamptz,
  pruned_matches integer NOT NULL DEFAULT 0,
  backfilled_matches integer NOT NULL DEFAULT 0
);
INSERT INTO riot_retention(id) VALUES (true);
