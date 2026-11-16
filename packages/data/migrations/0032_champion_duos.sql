-- Teammate pairs per patch, queue, region, tier, champion, role, ally and ally role, from
-- solo-queue match details. Each pair is stored in both directions.
CREATE TABLE champion_duos (
  patch_key text NOT NULL REFERENCES patches(patch_key),
  queue text NOT NULL,
  region text NOT NULL,
  tier text NOT NULL,
  champion_key integer NOT NULL,
  role text NOT NULL,
  ally_key integer NOT NULL,
  ally_role text NOT NULL,
  games integer NOT NULL CHECK (games > 0),
  result_games integer NOT NULL CHECK (result_games >= 0),
  wins integer NOT NULL CHECK (wins >= 0),
  built_at timestamptz NOT NULL,
  PRIMARY KEY (patch_key, queue, region, tier, champion_key, role, ally_key, ally_role)
);
CREATE INDEX champion_duos_champion ON champion_duos(champion_key, patch_key, role);
CREATE INDEX champion_duos_roles ON champion_duos(patch_key, role, ally_role);
