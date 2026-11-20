-- Skill orders join champion_builds, from timeline skill-up events. build lists ability slots
-- (1 Q, 2 W, 3 E): 'skills' is the first three basic level-ups, 'skillmax' the order basic
-- abilities reach five points. A game whose skill-ups do not decide an order is counted under
-- 'skills_incomplete' or 'skillmax_incomplete' with build '0', and nowhere else.
ALTER TABLE champion_builds DROP CONSTRAINT champion_builds_kind_check;
ALTER TABLE champion_builds ADD CONSTRAINT champion_builds_kind_check CHECK (kind IN (
  'start', 'boots', 'path', 'slot1', 'slot2', 'slot3', 'runes', 'keystone', 'shards', 'spells',
  'skills', 'skillmax', 'skills_incomplete', 'skillmax_incomplete'
));
