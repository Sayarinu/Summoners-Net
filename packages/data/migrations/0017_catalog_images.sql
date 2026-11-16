CREATE VIEW catalog_icon_entries AS
SELECT patch_key,'champion'::text AS kind,champion_id AS id,name,version,image FROM catalog_champions
UNION ALL SELECT patch_key,'item',item_id::text,name,version,image FROM catalog_items
UNION ALL SELECT patch_key,'rune',rune_id::text,name,version,icon FROM catalog_runes
UNION ALL SELECT patch_key,'spell',spell_id,name,version,image FROM catalog_summoner_spells;

CREATE TABLE catalog_images (
  patch_key text NOT NULL REFERENCES patches(patch_key),
  kind text NOT NULL CHECK (kind IN ('champion','item','rune','spell')),
  catalog_id text NOT NULL,
  source_url text,
  asset_hash text REFERENCES image_assets(hash),
  fetched_at timestamptz,
  attempted_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 1,
  error text,
  PRIMARY KEY (patch_key,kind,catalog_id)
);
