CREATE TABLE identity_match_context (
  id text PRIMARY KEY,
  year integer NOT NULL,
  document jsonb NOT NULL,
  observed_at timestamptz NOT NULL
);
CREATE INDEX identity_match_context_year ON identity_match_context(year);
