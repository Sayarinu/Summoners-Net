-- When two provider identities become one public entity, its visible profile
-- should own the readable slug, not the hidden linked source identity.
CREATE FUNCTION promote_linked_identity_route(oracle_identity text, panda_identity text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  clean_slug text;
  public_kind text;
  current_owner text;
  fallback_slug text;
BEGIN
  SELECT o.kind,identity_route_base(coalesce(p.name,o.name),o.kind)
    INTO public_kind,clean_slug
    FROM identities o JOIN identities p ON p.id=panda_identity
    WHERE o.id=oracle_identity;
  SELECT entity_id INTO current_owner FROM identity_routes
    WHERE kind=public_kind AND slug=clean_slug;
  IF current_owner IS DISTINCT FROM panda_identity THEN RETURN; END IF;

  DELETE FROM identity_routes WHERE entity_id=panda_identity;
  UPDATE identity_routes SET slug=clean_slug WHERE entity_id=oracle_identity;
  fallback_slug := clean_slug||'-'||left(md5(panda_identity),12);
  INSERT INTO identity_routes(entity_id,kind,slug)
    VALUES(panda_identity,public_kind,fallback_slug);
END $$;

CREATE FUNCTION linked_identity_route_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM promote_linked_identity_route(NEW.oracle_id,NEW.panda_id);
  RETURN NEW;
END $$;
CREATE TRIGGER identity_links_promote_public_route AFTER INSERT ON identity_links
FOR EACH ROW EXECUTE FUNCTION linked_identity_route_trigger();

-- Repair links that predate this migration.
SELECT promote_linked_identity_route(oracle_id,panda_id) FROM identity_links;
