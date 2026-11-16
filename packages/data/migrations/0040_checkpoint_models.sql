-- Win probability models now come in two kinds: 'timeline' (solo-queue minute frames) and
-- 'pro-checkpoints' (Oracle's Elixir checkpoints at 10, 15, 20 and 25 minutes). Each kind has
-- at most one active model, trained and calibrated on its own data.
ALTER TABLE wp_models
  ADD COLUMN kind text NOT NULL DEFAULT 'timeline' CHECK (kind IN ('timeline', 'pro-checkpoints'));
DROP INDEX wp_models_one_active;
CREATE UNIQUE INDEX wp_models_one_active ON wp_models(kind) WHERE status = 'active';
