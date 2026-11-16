-- Local tracks outlive provider retention. Links are resolved by exact platform/game identity.
CREATE TABLE replay_tracks (
  platform text NOT NULL,
  game_id text NOT NULL,
  format_version integer NOT NULL CHECK (format_version = 1),
  patch text NOT NULL,
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  sample_count integer NOT NULL CHECK (sample_count BETWEEN 1 AND 72001),
  track jsonb NOT NULL CHECK (jsonb_typeof(track) = 'object'),
  imported_at timestamptz NOT NULL,
  PRIMARY KEY (platform, game_id, format_version),
  CHECK (split_part(game_id, '_', 1) = upper(platform))
);
