-- User-supplied source identifiers and evidence; never infer account ownership from a name.
CREATE TABLE pro_account_links (
  puuid text PRIMARY KEY,
  identity_id text NOT NULL REFERENCES identities(id),
  evidence jsonb NOT NULL CHECK (jsonb_typeof(evidence)='array' AND jsonb_array_length(evidence) BETWEEN 1 AND 5),
  format_version integer NOT NULL CHECK (format_version=1),
  source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[a-f0-9]{64}$'),
  imported_at timestamptz NOT NULL
);
CREATE INDEX pro_account_links_player ON pro_account_links(identity_id,puuid);
