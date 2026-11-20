-- Oracle teams recorded under several identities (games without a team ID, renamed organizations)
-- become one public entity. Each merge keeps the source identity, its source identifier and its
-- route, and records the lineup evidence; the resolver rebuilds the table on every run.
CREATE TABLE identity_merges (
  source_id text PRIMARY KEY REFERENCES identities(id) ON DELETE CASCADE,
  target_id text NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  evidence jsonb NOT NULL,
  resolved_at timestamptz NOT NULL,
  CHECK (source_id <> target_id),
  CHECK (source_id LIKE 'oracle:%' AND target_id LIKE 'oracle:%')
);
CREATE INDEX identity_merges_target ON identity_merges(target_id);

-- A PandaScore identity follows its Oracle link, and a merged Oracle identity its survivor.
CREATE OR REPLACE VIEW entity_members AS
SELECT i.id,coalesce(m.target_id,l.oracle_id,i.id) AS entity_id
FROM identities i
LEFT JOIN identity_links l ON l.panda_id=i.id
LEFT JOIN identity_merges m ON m.source_id=coalesce(l.oracle_id,i.id);

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
WHERE NOT EXISTS(SELECT 1 FROM identity_links linked WHERE linked.panda_id=i.id)
  AND NOT EXISTS(SELECT 1 FROM identity_merges merged WHERE merged.source_id=i.id);

-- The surviving team takes the readable slug when a merged source owned it; the source keeps the
-- survivor's previous slug, so every earlier link still resolves to the survivor.
CREATE FUNCTION promote_merged_identity_route(source_identity text, target_identity text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  clean_slug text;
  public_kind text;
  source_slug text;
  target_slug text;
BEGIN
  SELECT t.kind,identity_route_base(t.name,t.kind) INTO public_kind,clean_slug
    FROM identities t WHERE t.id=target_identity;
  SELECT slug INTO source_slug FROM identity_routes WHERE entity_id=source_identity;
  SELECT slug INTO target_slug FROM identity_routes WHERE entity_id=target_identity;
  IF source_slug IS DISTINCT FROM clean_slug OR target_slug IS NULL THEN RETURN; END IF;
  DELETE FROM identity_routes WHERE entity_id IN (source_identity,target_identity);
  INSERT INTO identity_routes(entity_id,kind,slug) VALUES
    (target_identity,public_kind,clean_slug),
    (source_identity,public_kind,target_slug);
END $$;

CREATE FUNCTION merged_identity_route_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM promote_merged_identity_route(NEW.source_id,NEW.target_id);
  RETURN NEW;
END $$;
CREATE TRIGGER identity_merges_promote_route AFTER INSERT ON identity_merges
FOR EACH ROW EXECUTE FUNCTION merged_identity_route_trigger();
