-- Trained win probability models. Each artifact records its model and feature versions, the
-- patch window and seed it was trained on, the match-level train/evaluation split sizes, its
-- coefficients, Brier score and reliability bins on held-out matches. At most one is active;
-- a model trained on too small a sample is stored as rejected and never becomes active.
CREATE TABLE wp_models (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  model_version integer NOT NULL,
  feature_version integer NOT NULL,
  patch_window text[] NOT NULL,
  seed integer NOT NULL,
  train_matches integer NOT NULL,
  train_rows integer NOT NULL,
  eval_matches integer NOT NULL,
  eval_rows integer NOT NULL,
  coefficients jsonb NOT NULL,
  brier double precision,
  bins jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'retired', 'rejected')),
  reason text,
  trained_at timestamptz NOT NULL
);
CREATE UNIQUE INDEX wp_models_one_active ON wp_models(status) WHERE status = 'active';
