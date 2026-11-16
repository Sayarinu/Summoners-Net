-- One row per game patch known to Data Dragon. patch_key ("15.21") is the normalized key that
-- links each source's patch strings; release_order ranks patches from oldest (1) to newest.
CREATE TABLE patches (
  patch_key text PRIMARY KEY,
  major integer NOT NULL CHECK (major >= 1),
  minor integer NOT NULL CHECK (minor >= 1),
  release_order integer NOT NULL CHECK (release_order >= 1),
  ddragon_versions text[] NOT NULL,
  observed_at timestamptz NOT NULL,
  UNIQUE (major, minor)
);
CREATE INDEX patches_release_order ON patches(release_order DESC);

-- Every patch string a source supplied, exactly as received. patch_key stays NULL when the
-- string is unparseable or names a patch Data Dragon does not list; those rows are reported.
CREATE TABLE patch_sources (
  source text NOT NULL CHECK (source IN ('ddragon', 'oracle', 'riot')),
  source_string text NOT NULL,
  patch_key text REFERENCES patches(patch_key),
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  PRIMARY KEY (source, source_string)
);
CREATE INDEX patch_sources_patch_key ON patch_sources(patch_key, source);
CREATE INDEX patch_sources_unresolved ON patch_sources(source, source_string) WHERE patch_key IS NULL;
