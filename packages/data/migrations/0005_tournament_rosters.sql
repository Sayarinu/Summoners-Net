-- Historical tournament participation is not a current roster observation.
CREATE TABLE identity_tournament_rosters (
  tournament_id text PRIMARY KEY,
  year integer NOT NULL,
  document jsonb NOT NULL,
  observed_at timestamptz NOT NULL
);
