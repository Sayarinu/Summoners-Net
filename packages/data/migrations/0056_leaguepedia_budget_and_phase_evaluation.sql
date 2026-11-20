-- One request budget for every Leaguepedia job (pro game details and recordings), persisted so
-- spacing, the hourly ceiling and a pause the wiki asks for hold across runs and restarts.
CREATE TABLE provider_request_ledger (
  provider text NOT NULL,
  requested_at timestamptz NOT NULL
);
CREATE INDEX provider_request_ledger_window ON provider_request_ledger(provider, requested_at);
-- A provider-wide pause after a rate limit or lag reply. `strikes` counts consecutive refusals,
-- so repeated ones back off exponentially; a successful reply clears it.
CREATE TABLE provider_pauses (
  provider text PRIMARY KEY,
  until timestamptz NOT NULL,
  reason text NOT NULL,
  strikes integer NOT NULL DEFAULT 0 CHECK (strikes >= 0)
);
-- Held-out evaluation beyond the pooled Brier score: log loss, and Brier, log loss and calibration
-- per game phase, so early and late estimates are checked separately. Null for older models.
ALTER TABLE wp_models ADD COLUMN evaluation jsonb;
