-- Win probability added per champion, player and role, per model and patch. games counts every
-- game the model scored in which the subject played, so a game without contributions adds zero.
-- Leaderboards read one model's rows, so model versions are never mixed.
CREATE TABLE wpa_aggregates (
  model_id bigint NOT NULL REFERENCES wp_models(id) ON DELETE CASCADE,
  patch_key text NOT NULL REFERENCES patches(patch_key),
  kind text NOT NULL CHECK (kind IN ('champion', 'player', 'role')),
  subject text NOT NULL,
  games integer NOT NULL CHECK (games > 0),
  total double precision NOT NULL,
  built_at timestamptz NOT NULL,
  PRIMARY KEY (model_id, patch_key, kind, subject)
);
CREATE INDEX wpa_aggregates_rank ON wpa_aggregates(model_id, patch_key, kind, total DESC);
