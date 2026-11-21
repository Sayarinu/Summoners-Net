-- The fourth, fifth and sixth completed items, the options after the core build, and the full
-- skill path of the first fifteen levels, as build kinds.
ALTER TABLE champion_builds DROP CONSTRAINT champion_builds_kind_check;
ALTER TABLE champion_builds ADD CONSTRAINT champion_builds_kind_check CHECK (kind IN (
  'start','boots','path','slot1','slot2','slot3','slot4','slot5','slot6','runes','keystone',
  'shards','spells','skills','skillmax','skillpath','skills_incomplete','skillmax_incomplete'));
-- Existing solo patches fill in when their aggregates are next rebuilt.
INSERT INTO aggregate_dirty(source, patch_key, marked_at)
SELECT DISTINCT 'solo', patch_key, now() FROM champion_aggregates WHERE source='solo'
ON CONFLICT DO NOTHING;
