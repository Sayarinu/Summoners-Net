-- Item attributes from Data Dragon, as received, so builds can tell boots, completed items and
-- consumables apart. NULL for items stored before these columns existed.
ALTER TABLE catalog_items
  ADD COLUMN tags text[],
  ADD COLUMN builds_from integer[],
  ADD COLUMN builds_into integer[],
  ADD COLUMN total_gold integer;

-- Solo-queue builds from timeline purchase events, per patch, queue, region, tier, champion and
-- role. kind: 'start' (starting items), 'boots', 'path' (first three completed items, in order),
-- or 'slot1'..'slot3' (the completed item bought nth). build lists item ids, comma-separated.
CREATE TABLE champion_builds (
  patch_key text NOT NULL REFERENCES patches(patch_key),
  queue text NOT NULL,
  region text NOT NULL,
  tier text NOT NULL,
  champion_key integer NOT NULL,
  role text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('start', 'boots', 'path', 'slot1', 'slot2', 'slot3')),
  build text NOT NULL CHECK (build ~ '^\d+(,\d+)*$'),
  games integer NOT NULL CHECK (games > 0),
  result_games integer NOT NULL CHECK (result_games >= 0),
  wins integer NOT NULL CHECK (wins >= 0),
  built_at timestamptz NOT NULL,
  PRIMARY KEY (patch_key, queue, region, tier, champion_key, role, kind, build)
);
CREATE INDEX champion_builds_champion ON champion_builds(champion_key, patch_key, kind);
