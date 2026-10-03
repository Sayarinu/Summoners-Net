-- Stable, source-neutral profile URLs. Slugs are assigned once, so later name corrections
-- do not break existing links. A short digest is used only when names collide.
CREATE TABLE identity_routes (
  entity_id text PRIMARY KEY REFERENCES identities(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('team','player')),
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  UNIQUE (kind,slug)
);

CREATE FUNCTION identity_route_base(label text, fallback_kind text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(nullif(btrim(regexp_replace(lower(replace(replace(label, '''', ''), '’', '')),
    '[^a-z0-9]+', '-', 'g'), '-'), ''), fallback_kind)
$$;

-- The ordered first pass gives an unambiguous name its clean slug. Only colliding
-- identities need a digest suffix; source names and IDs never enter the route.
INSERT INTO identity_routes(entity_id,kind,slug)
SELECT id,kind,identity_route_base(name,kind) FROM identities
ORDER BY kind,identity_route_base(name,kind),id ON CONFLICT DO NOTHING;
INSERT INTO identity_routes(entity_id,kind,slug)
SELECT id,kind,identity_route_base(name,kind)||'-'||left(md5(id),12) FROM identities i
WHERE NOT EXISTS (SELECT 1 FROM identity_routes r WHERE r.entity_id=i.id)
ORDER BY id ON CONFLICT DO NOTHING;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM identities i WHERE NOT EXISTS
    (SELECT 1 FROM identity_routes r WHERE r.entity_id=i.id)) THEN
    RAISE EXCEPTION 'Unable to allocate unique public identity routes';
  END IF;
END $$;

CREATE FUNCTION assign_identity_route() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE base text;
BEGIN
  base := identity_route_base(NEW.name,NEW.kind);
  INSERT INTO identity_routes(entity_id,kind,slug) VALUES(NEW.id,NEW.kind,base)
    ON CONFLICT DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM identity_routes WHERE entity_id=NEW.id) THEN
    INSERT INTO identity_routes(entity_id,kind,slug)
      VALUES(NEW.id,NEW.kind,base||'-'||left(md5(NEW.id),12))
      ON CONFLICT DO NOTHING;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM identity_routes WHERE entity_id=NEW.id) THEN
    RAISE EXCEPTION 'Unable to allocate unique public route for identity %',NEW.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER identities_assign_public_route AFTER INSERT ON identities
FOR EACH ROW EXECUTE FUNCTION assign_identity_route();

CREATE OR REPLACE VIEW entity_profiles AS
SELECT i.id,i.kind,coalesce(p.name,i.name) AS name,
  i.document || jsonb_build_object(
    'name',coalesce(p.name,i.name),'entityId',i.id,'publicSlug',route.slug,
    'imageUrl',CASE WHEN img.asset_hash IS NOT NULL THEN '/api/images/'||coalesce(r.asset_hash,img.asset_hash) ELSE NULL END,
    'imageSource',CASE WHEN img.asset_hash IS NOT NULL THEN 'PandaScore' ELSE NULL END,
    'sourceCount',CASE WHEN p.id IS NULL THEN 1 ELSE 2 END
  ) AS document
FROM identities i
LEFT JOIN identity_links l ON l.oracle_id=i.id
LEFT JOIN identities p ON p.id=l.panda_id
LEFT JOIN identity_images img ON img.identity_id=coalesce(p.id,i.id)
LEFT JOIN image_renditions r ON r.source_hash=img.asset_hash
LEFT JOIN identity_routes route ON route.entity_id=i.id
WHERE NOT EXISTS(SELECT 1 FROM identity_links linked WHERE linked.panda_id=i.id);
