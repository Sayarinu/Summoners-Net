-- Stat shards are not in Data Dragon's rune catalog, but their icons are on the same CDN. List
-- them as runes for every patch with a rune catalog, so the image cache downloads them.
CREATE OR REPLACE VIEW catalog_icon_entries AS
SELECT patch_key,'champion'::text AS kind,champion_id AS id,name,version,image FROM catalog_champions
UNION ALL SELECT patch_key,'item',item_id::text,name,version,image FROM catalog_items
UNION ALL SELECT patch_key,'rune',rune_id::text,name,version,icon FROM catalog_runes
UNION ALL SELECT patch_key,'spell',spell_id,name,version,image FROM catalog_summoner_spells
UNION ALL SELECT r.patch_key,'rune',s.id,s.name,r.version,'perk-images/StatMods/'||s.icon||'.png'
FROM (SELECT DISTINCT ON (patch_key) patch_key,version FROM catalog_runes ORDER BY patch_key,version DESC) r
CROSS JOIN (VALUES
  ('5001','Health Scaling','StatModsHealthScalingIcon'),
  ('5002','Armor','StatModsArmorIcon'),
  ('5003','Magic Resist','StatModsMagicResIcon'),
  ('5005','Attack Speed','StatModsAttackSpeedIcon'),
  ('5007','Ability Haste','StatModsCDRScalingIcon'),
  ('5008','Adaptive Force','StatModsAdaptiveForceIcon'),
  ('5010','Move Speed','StatModsMovementSpeedIcon'),
  ('5011','Health','StatModsHealthPlusIcon'),
  ('5013','Tenacity and Slow Resist','StatModsTenacityIcon')
) s(id,name,icon);
