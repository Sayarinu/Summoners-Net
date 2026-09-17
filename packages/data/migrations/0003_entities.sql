-- Source records remain intact. A crosswalk can be rebuilt or removed without rewriting games.
CREATE TABLE identity_aliases (
  identity_id text NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  name text NOT NULL,
  PRIMARY KEY(identity_id,name)
);
INSERT INTO identity_aliases SELECT id,name FROM identities;
INSERT INTO identity_aliases
SELECT DISTINCT value->'team'->>'id',value->'team'->>'name'
FROM games CROSS JOIN LATERAL jsonb_array_elements(document->'participants')
UNION SELECT DISTINCT value->'player'->>'id',value->'player'->>'name'
FROM games CROSS JOIN LATERAL jsonb_array_elements(document->'participants')
WHERE value->'player'->>'id' IS NOT NULL
ON CONFLICT DO NOTHING;
CREATE INDEX identity_aliases_search ON identity_aliases USING gin(lower(name) gin_trgm_ops);

-- The full free context catalog is private matching evidence, not additional league coverage.
CREATE TABLE identity_catalog (
  id text PRIMARY KEY,
  document jsonb NOT NULL,
  observed_at timestamptz NOT NULL
);
CREATE TABLE identity_links (
  oracle_id text PRIMARY KEY REFERENCES identities(id) ON DELETE CASCADE,
  panda_id text NOT NULL UNIQUE REFERENCES identities(id) ON DELETE CASCADE,
  evidence jsonb NOT NULL,
  resolved_at timestamptz NOT NULL,
  CHECK(oracle_id LIKE 'oracle:%' AND panda_id LIKE 'pandascore:%')
);
CREATE TABLE identity_resolution_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  resolved_at timestamptz NOT NULL,
  report jsonb NOT NULL
);
CREATE TABLE image_assets (
  hash text PRIMARY KEY CHECK(hash ~ '^[a-f0-9]{64}$'),
  mime text NOT NULL CHECK(mime IN ('image/png','image/jpeg','image/webp','image/gif')),
  body bytea NOT NULL CHECK(octet_length(body) <= 3145728)
);
CREATE TABLE identity_images (
  identity_id text PRIMARY KEY REFERENCES identities(id) ON DELETE CASCADE,
  asset_hash text REFERENCES image_assets(hash),
  source_url text NOT NULL,
  fetched_at timestamptz,
  attempted_at timestamptz NOT NULL,
  error text
);
CREATE VIEW entity_members AS
SELECT i.id,coalesce(l.oracle_id,i.id) AS entity_id FROM identities i
LEFT JOIN identity_links l ON l.panda_id=i.id;
CREATE VIEW entity_profiles AS
SELECT i.id,i.kind,coalesce(p.name,i.name) AS name,
  i.document || jsonb_build_object(
    'name',coalesce(p.name,i.name),'entityId',i.id,
    'imageUrl',CASE WHEN img.asset_hash IS NOT NULL THEN '/api/images/'||img.asset_hash ELSE NULL END,
    'imageSource',CASE WHEN img.asset_hash IS NOT NULL THEN 'PandaScore' ELSE NULL END,
    'sourceCount',CASE WHEN p.id IS NULL THEN 1 ELSE 2 END
  ) AS document
FROM identities i
LEFT JOIN identity_links l ON l.oracle_id=i.id
LEFT JOIN identities p ON p.id=l.panda_id
LEFT JOIN identity_images img ON img.identity_id=coalesce(p.id,i.id)
WHERE NOT EXISTS(SELECT 1 FROM identity_links linked WHERE linked.panda_id=i.id);
