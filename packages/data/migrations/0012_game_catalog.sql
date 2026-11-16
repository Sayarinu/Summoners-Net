-- Data Dragon's champion, item, rune and summoner spell catalogs, one set per patch. Identifiers
-- are Data Dragon's own: champion id ("MonkeyKing") and numeric key (62), item id, rune and tree
-- ids with the rune key ("Electrocute"), and summoner spell id ("SummonerFlash") and key (4).
CREATE TABLE catalog_champions (
  patch_key text NOT NULL REFERENCES patches(patch_key),
  champion_id text NOT NULL,
  champion_key integer NOT NULL,
  name text NOT NULL,
  image text NOT NULL,
  version text NOT NULL,
  observed_at timestamptz NOT NULL,
  PRIMARY KEY (patch_key, champion_id),
  UNIQUE (patch_key, champion_key)
);
CREATE INDEX catalog_champions_id ON catalog_champions(champion_id, patch_key);
CREATE INDEX catalog_champions_key ON catalog_champions(champion_key, patch_key);

CREATE TABLE catalog_items (
  patch_key text NOT NULL REFERENCES patches(patch_key),
  item_id integer NOT NULL,
  name text NOT NULL,
  image text NOT NULL,
  version text NOT NULL,
  observed_at timestamptz NOT NULL,
  PRIMARY KEY (patch_key, item_id)
);

-- A rune tree has no tree_id or slot of its own; its runes reference it.
CREATE TABLE catalog_runes (
  patch_key text NOT NULL REFERENCES patches(patch_key),
  rune_id integer NOT NULL,
  rune_key text NOT NULL,
  name text NOT NULL,
  icon text NOT NULL,
  tree_id integer,
  slot integer CHECK (slot IS NULL OR slot >= 0),
  version text NOT NULL,
  observed_at timestamptz NOT NULL,
  PRIMARY KEY (patch_key, rune_id),
  CHECK ((tree_id IS NULL) = (slot IS NULL))
);

CREATE TABLE catalog_summoner_spells (
  patch_key text NOT NULL REFERENCES patches(patch_key),
  spell_id text NOT NULL,
  spell_key integer NOT NULL,
  name text NOT NULL,
  image text NOT NULL,
  version text NOT NULL,
  observed_at timestamptz NOT NULL,
  PRIMARY KEY (patch_key, spell_id),
  UNIQUE (patch_key, spell_key)
);

-- Oracle's Elixir names champions by display name ("Wukong"). Each name maps to exactly one
-- champion id ("MonkeyKing"); the table is rebuilt and validated as a whole with the catalog.
CREATE TABLE oracle_champion_names (
  name text PRIMARY KEY,
  champion_id text NOT NULL,
  observed_at timestamptz NOT NULL
);
CREATE INDEX oracle_champion_names_champion ON oracle_champion_names(champion_id);
