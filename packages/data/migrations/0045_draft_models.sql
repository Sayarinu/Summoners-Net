-- A third model kind: 'draft', the pre-game win probability from champion strength, lane matchups
-- and synergy. It is trained and calibrated on its own held-out games, with one active model.
ALTER TABLE wp_models DROP CONSTRAINT wp_models_kind_check;
ALTER TABLE wp_models
  ADD CONSTRAINT wp_models_kind_check CHECK (kind IN ('timeline', 'pro-checkpoints', 'draft'));
