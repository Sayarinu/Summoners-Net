-- Metadata-only replay imports remain independent of Riot match retention.
CREATE TABLE replay_metadata (
  source_sha256 text PRIMARY KEY CHECK (source_sha256 ~ '^[a-f0-9]{64}$'),
  format text NOT NULL CHECK (format IN ('ROFL', 'ROFL2')),
  game_id text CHECK (game_id ~ '^[1-9][0-9]{0,19}$'),
  platform text,
  metadata jsonb NOT NULL CHECK (jsonb_typeof(metadata) = 'object'),
  retained_file text,
  imported_at timestamptz NOT NULL,
  CHECK (format <> 'ROFL2' OR game_id IS NULL)
);
