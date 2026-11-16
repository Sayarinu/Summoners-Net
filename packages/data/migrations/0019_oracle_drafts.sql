CREATE TABLE oracle_draft_games (
  game_id text PRIMARY KEY REFERENCES oracle_archive_games(id) ON DELETE CASCADE,
  artifact_hash text NOT NULL,
  version integer NOT NULL,
  excluded_reason text,
  first_pick_side text CHECK (first_pick_side IN ('blue','red')),
  first_pick_won boolean,
  events jsonb NOT NULL CHECK (jsonb_typeof(events)='array'),
  derived_at timestamptz NOT NULL,
  CHECK ((excluded_reason IS NULL AND first_pick_side IS NOT NULL AND jsonb_array_length(events)=20)
    OR (excluded_reason IS NOT NULL AND jsonb_array_length(events)=0))
);
CREATE INDEX oracle_archive_games_draft_scope ON oracle_archive_games(patch,lower(source_league),id);
