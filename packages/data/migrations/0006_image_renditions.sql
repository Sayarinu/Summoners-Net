-- Retain original source bytes and derive separately addressed transparent display assets.
CREATE TABLE image_renditions (
  source_hash text PRIMARY KEY REFERENCES image_assets(hash) ON DELETE CASCADE,
  asset_hash text NOT NULL REFERENCES image_assets(hash),
  version integer NOT NULL CHECK(version > 0)
);
CREATE OR REPLACE VIEW entity_profiles AS
SELECT i.id,i.kind,coalesce(p.name,i.name) AS name,
  i.document || jsonb_build_object(
    'name',coalesce(p.name,i.name),'entityId',i.id,
    'imageUrl',CASE WHEN img.asset_hash IS NOT NULL THEN '/api/images/'||coalesce(r.asset_hash,img.asset_hash) ELSE NULL END,
    'imageSource',CASE WHEN img.asset_hash IS NOT NULL THEN 'PandaScore' ELSE NULL END,
    'sourceCount',CASE WHEN p.id IS NULL THEN 1 ELSE 2 END
  ) AS document
FROM identities i
LEFT JOIN identity_links l ON l.oracle_id=i.id
LEFT JOIN identities p ON p.id=l.panda_id
LEFT JOIN identity_images img ON img.identity_id=coalesce(p.id,i.id)
LEFT JOIN image_renditions r ON r.source_hash=img.asset_hash
WHERE NOT EXISTS(SELECT 1 FROM identity_links linked WHERE linked.panda_id=i.id);
