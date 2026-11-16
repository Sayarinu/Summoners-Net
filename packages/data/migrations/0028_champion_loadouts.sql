-- Rune pages and summoner spells join items in champion_builds. Ids are Data Dragon's:
--   'runes'    full page: primary style, its four perks, secondary style, its two perks;
--   'keystone' the primary style's first perk;
--   'shards'   stat shards: offense, flex, defense;
--   'spells'   the summoner spell pair by key, lower first.
-- These come from match details, so every non-remake game counts, timeline or not.
ALTER TABLE champion_builds DROP CONSTRAINT champion_builds_kind_check;
ALTER TABLE champion_builds ADD CONSTRAINT champion_builds_kind_check CHECK (kind IN (
  'start', 'boots', 'path', 'slot1', 'slot2', 'slot3', 'runes', 'keystone', 'shards', 'spells'
));
