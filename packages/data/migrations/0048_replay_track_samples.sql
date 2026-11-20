-- Replay track samples one row per timestamp, so viewers read bounded time ranges by key instead
-- of the whole track. Small summary columns let reads skip the stored file; movements are
-- detected at import (NULL for tracks imported before this migration). The summary columns are
-- backfilled here and written by every import.
CREATE TABLE replay_track_samples (
  platform text NOT NULL,
  game_id text NOT NULL,
  format_version integer NOT NULL,
  time_ms integer NOT NULL CHECK (time_ms BETWEEN 0 AND 7200000),
  positions jsonb NOT NULL CHECK (jsonb_typeof(positions) = 'array'),
  PRIMARY KEY (platform, game_id, format_version, time_ms),
  FOREIGN KEY (platform, game_id, format_version) REFERENCES replay_tracks ON DELETE CASCADE
);
ALTER TABLE replay_tracks
  ADD COLUMN sample_rate_hz double precision,
  ADD COLUMN roster jsonb,
  ADD COLUMN movements jsonb CHECK (jsonb_typeof(movements) = 'array');
UPDATE replay_tracks SET sample_rate_hz = (track->>'sampleRateHz')::double precision,
  roster = track->'roster';
INSERT INTO replay_track_samples(platform, game_id, format_version, time_ms, positions)
SELECT t.platform, t.game_id, t.format_version, (s->>'timeMs')::integer, s->'positions'
FROM replay_tracks t, jsonb_array_elements(t.track->'samples') s;
